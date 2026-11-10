import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import type { DatabaseSync } from "node:sqlite";
import {
  HookEventEnvelopeSchema,
  previewText,
  WorkshopModel,
  serializeAgent,
  serializeProject,
  serializeSession,
  buildSessionAnalytics,
  type ProjectRecord,
  type SessionRecord
} from "@agent-workshop/shared";
import type { ServerConfig } from "./config.js";
import {
  clearHistory,
  purgeOldData,
  getProjectNotes,
  getSessionRecap,
  getSessionAnalytics,
  getToolSummaries,
  insertEvent,
  insertToolCallAnalytics,
  listAllEventsRaw,
  listPermissionEvents,
  listProjects,
  listSessionAnalytics,
  listSessionEvents,
  listSessions,
  listToolCallAnalyticsBySession,
  getPendingPermissions,
  searchEvents,
  updateToolCallAnalytics,
  upsertPermissionEvent,
  upsertProject,
  upsertProjectNotes,
  upsertSession,
  upsertSessionAnalytics,
  upsertSessionRecap,
  type StoredEventRow
} from "./db.js";
import { enrichSubagentCorrelation } from "./correlation.js";
import { resolveProject } from "./project-resolver.js";
import { WsHub } from "./ws-hub.js";
import { DetectedSessionScanner } from "./detect-sessions.js";
import { buildRecapTranscript, generateRecap as defaultGenerateRecap } from "./recap.js";

export interface BuildAppOptions {
  config: ServerConfig;
  db: DatabaseSync;
  model?: WorkshopModel;
  /** Injectable for tests — the default shells out to the local `claude` CLI. */
  generateRecap?: (transcript: string) => Promise<string>;
  hub?: WsHub;
}

function persistProject(db: DatabaseSync, project: ProjectRecord): void {
  upsertProject(db, {
    id: project.id,
    name: project.name,
    rootPath: project.rootPath,
    worktreeOf: project.worktreeOf,
    firstSeen: project.firstSeen,
    lastSeen: project.lastSeen
  });
}

function persistSession(db: DatabaseSync, session: SessionRecord): void {
  upsertSession(db, {
    id: session.id,
    projectId: session.projectId,
    cwd: session.cwd,
    branch: session.branch,
    startedAt: session.startedAt,
    lastEventAt: session.lastEventAt,
    status: session.status
  });
}

/** Replay stored events through the model so a server restart recovers the
 *  full in-memory view (agents, moods, active tool calls) instead of starting
 *  empty. Silently skips any event whose raw_json is malformed.
 *
 *  Project info is not re-resolved via git (the repos may no longer exist at
 *  the same paths) — model.ingest() falls back to its own cwd-based project
 *  derivation, which is deterministic and sufficient for rehydration. */
function rehydrateModel(model: WorkshopModel, db: DatabaseSync): number {
  const rows = listAllEventsRaw(db);
  let replayed = 0;
  for (const row of rows) {
    try {
      const envelope = JSON.parse(row.rawJson);
      const parsed = HookEventEnvelopeSchema.safeParse(envelope);
      if (!parsed.success) continue;
      model.ingest(parsed.data);
      replayed++;
    } catch {
      // Malformed row — skip silently
    }
  }
  return replayed;
}

export function buildApp({
  config,
  db,
  model = new WorkshopModel({
    stalledAfterMs: config.stalledAfterMs,
    sleepAfterMs: config.sleepAfterMs,
    needsInputTools: config.needsInputTools
  }),
  hub = new WsHub(),
  generateRecap = defaultGenerateRecap
}: BuildAppOptions): FastifyInstance {
  // Purge data older than 24 hours so stale sessions from other projects
  // don't show up on startup (the DB file is local, never committed)
  const purged = purgeOldData(db, 24 * 60 * 60 * 1000);
  if (purged > 0) {
    console.log(`agent-workshop: purged ${purged} events older than 24h`);
  }

  // Rehydrate the model from remaining events
  const rehydrated = rehydrateModel(model, db);
  if (rehydrated > 0) {
    console.log(`agent-workshop: rehydrated ${rehydrated} events from database`);
  }

  const app = Fastify({ logger: false });

  // Serve the pre-built web app if it exists (production mode).
  // Check multiple paths: dev layout (../../web/dist) and bundled layout (../web or ./web)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, "../../web/dist"),  // dev: packages/server/dist -> packages/web/dist
    resolve(__dirname, "../web"),           // bundled: dist/server -> dist/web
    resolve(__dirname, "./web"),            // bundled flat: dist/mimir.mjs -> dist/web
    resolve(__dirname, "web"),              // relative
  ];
  const webDistPath = candidates.find((p) => existsSync(resolve(p, "index.html"))) ?? candidates[0];
  if (existsSync(webDistPath)) {
    app.register(fastifyStatic, { root: webDistPath, prefix: "/" });
    // SPA fallback: serve index.html for any non-API, non-file route
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html");
    });
  }

  // Hand-rolled instead of @fastify/cors: the web app (Vite dev server or a
  // static build) and the collector are always different origins by design
  // (see the architecture diagram), and this is a local developer tool with
  // no auth to protect — a permissive origin is an acceptable trade-off here.
  app.addHook("onRequest", (_request, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    done();
  });

  app.register(websocketPlugin);

  // The /ws route must be declared inside a register() callback so avvio
  // loads it after the websocket plugin's onRoute hook is active — a bare
  // app.get(..., { websocket: true }, ...) runs before that hook exists and
  // silently falls back to a normal HTTP route handler.
  app.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket) => {
      hub.add(socket);
      // Deferred one tick: pushing a message in the same turn as the upgrade
      // handshake can race the client's frame parser attaching itself.
      setImmediate(() => {
        socket.send(
          JSON.stringify({
            type: "snapshot",
            payload: {
              projects: model.getProjects().map(serializeProject),
              sessions: model.getSnapshot().map(serializeSession)
            }
          })
        );
      });
      socket.on("close", () => hub.remove(socket));
    });
  });

  app.post("/events", async (request, reply) => {
    const parsed = HookEventEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid payload", issues: parsed.error.issues };
    }
    const envelope = parsed.data;

    const cwd = (envelope as { cwd?: string }).cwd;
    const refreshBranch = envelope.hook_event_name === "SessionStart" || envelope.hook_event_name === "UserPromptSubmit";
    const projectInfo = cwd ? await resolveProject(cwd, { refreshBranch }) : undefined;

    const { workshopEvent, project, session, agent } = model.ingest(envelope, projectInfo);

    persistProject(db, project);
    persistSession(db, session);

    const row: StoredEventRow = {
      sessionId: workshopEvent.sessionId,
      agentId: workshopEvent.agentId,
      agentType: workshopEvent.agentType,
      hookEventName: workshopEvent.hookEventName,
      category: workshopEvent.category,
      toolName: workshopEvent.toolName,
      toolUseId: workshopEvent.toolUseId,
      target: workshopEvent.target,
      timestamp: workshopEvent.timestamp,
      previewInput: config.previewsEnabled
        ? previewText((envelope as { tool_input?: unknown }).tool_input, config.previewMaxLen) || null
        : null,
      previewOutput: config.previewsEnabled
        ? previewText((envelope as { tool_output?: unknown }).tool_output, config.previewMaxLen) || null
        : null,
      rawJson: JSON.stringify(envelope)
    };
    insertEvent(db, row);

    hub.broadcast({ type: "event", payload: workshopEvent, project: serializeProject(project), agent: serializeAgent(agent) });

    // ── Analytics persistence ──
    // Track tool call lifecycle
    if (workshopEvent.hookEventName === "PreToolUse" && workshopEvent.toolUseId) {
      insertToolCallAnalytics(db, {
        toolUseId: workshopEvent.toolUseId,
        sessionId: workshopEvent.sessionId,
        agentId: workshopEvent.agentId,
        toolName: workshopEvent.toolName ?? "unknown",
        category: workshopEvent.category,
        status: "running",
        target: workshopEvent.target,
        startedAt: workshopEvent.timestamp,
        finishedAt: null,
        durationMs: null,
        isRetry: false, // Retry detection is done at query time via buildToolCallAnalytics
      });
    }
    if ((workshopEvent.hookEventName === "PostToolUse" || workshopEvent.hookEventName === "PostToolUseFailure") && workshopEvent.toolUseId) {
      const status = workshopEvent.hookEventName === "PostToolUse" ? "succeeded" : "failed";
      // Compute duration from the active tool call if available
      const activeTc = agent.activeToolCalls.get(workshopEvent.toolUseId) ?? agent.finishedToolCalls.find((tc) => tc.toolUseId === workshopEvent.toolUseId);
      const durationMs = activeTc?.durationMs ?? null;
      updateToolCallAnalytics(db, workshopEvent.toolUseId, status, workshopEvent.timestamp, durationMs ?? 0);
    }
    // Track permission events
    if (workshopEvent.hookEventName === "Notification") {
      const notificationType = (envelope as { notification_type?: string }).notification_type;
      if (notificationType === "permission_prompt") {
        upsertPermissionEvent(db, {
          id: `perm-${workshopEvent.sessionId}-${workshopEvent.agentId}-${workshopEvent.timestamp}`,
          sessionId: workshopEvent.sessionId,
          agentId: workshopEvent.agentId,
          toolName: null,
          commandPreview: workshopEvent.target,
          requestedAt: workshopEvent.timestamp,
          decidedAt: null,
          decision: "pending",
          waitingDurationMs: null,
          requestType: "permission",
        });
      }
    }
    // Update session analytics on every event
    const sessionAnalytics = buildSessionAnalytics(session, (envelope as { prompt?: string }).prompt ?? null);
    upsertSessionAnalytics(db, {
      sessionId: sessionAnalytics.sessionId,
      projectId: sessionAnalytics.projectId,
      startedAt: sessionAnalytics.startedAt,
      endedAt: sessionAnalytics.endedAt,
      durationMs: sessionAnalytics.durationMs,
      agentCount: sessionAnalytics.agentCount,
      subagentCount: sessionAnalytics.subagentCount,
      toolCallCount: sessionAnalytics.toolCallCount,
      successfulToolCalls: sessionAnalytics.successfulToolCalls,
      failedToolCalls: sessionAnalytics.failedToolCalls,
      permissionRequests: sessionAnalytics.permissionRequests,
      prompt: sessionAnalytics.prompt,
      computedAt: new Date().toISOString(),
    });

    enrichSubagentCorrelation(model, envelope, (sessionId, agentId) => {
      const confirmedAgent = model.getSession(sessionId)?.agents.get(agentId);
      if (confirmedAgent) {
        hub.broadcast({ type: "agent_updated", sessionId, agentId, agent: serializeAgent(confirmedAgent) });
      }
    });

    reply.code(204);
    return null;
  });

  app.get("/projects", async () => {
    return listProjects(db);
  });

  app.get("/sessions", async () => {
    return listSessions(db);
  });

  app.get<{ Params: { id: string }; Querystring: { sinceId?: string; limit?: string } }>(
    "/sessions/:id/events",
    async (request) => {
      const sinceId = request.query.sinceId ? Number.parseInt(request.query.sinceId, 10) : undefined;
      const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
      return listSessionEvents(db, request.params.id, { sinceId, limit });
    }
  );

  app.get<{ Querystring: { q?: string; projectId?: string; limit?: string } }>("/search", async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q) {
      reply.code(400);
      return { error: "q is required" };
    }
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    return searchEvents(db, { q, projectId: request.query.projectId, limit });
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/recap", async (request) => {
    return getSessionRecap(db, request.params.id);
  });

  app.post<{ Params: { id: string } }>("/sessions/:id/recap", async (request, reply) => {
    const events = listSessionEvents(db, request.params.id, { limit: 5000 });
    const transcript = buildRecapTranscript(events);
    if (!transcript) {
      reply.code(422);
      return { error: "no recap-worthy activity in this session yet" };
    }
    let recap: string;
    try {
      recap = await generateRecap(transcript);
    } catch (err) {
      reply.code(502);
      return { error: `recap generation failed: ${(err as Error).message}` };
    }
    const row = { sessionId: request.params.id, recap, model: "claude", generatedAt: new Date().toISOString() };
    upsertSessionRecap(db, row);
    return row;
  });

  app.get<{ Params: { id: string } }>("/projects/:id/notes", async (request) => {
    const row = getProjectNotes(db, request.params.id);
    return row ?? { projectId: request.params.id, notes: "", updatedAt: null };
  });

  app.put<{ Params: { id: string }; Body: { notes: string } }>("/projects/:id/notes", async (request, reply) => {
    if (typeof request.body?.notes !== "string") {
      reply.code(400);
      return { error: "notes must be a string" };
    }
    const updatedAt = new Date().toISOString();
    upsertProjectNotes(db, request.params.id, request.body.notes, updatedAt);
    return { projectId: request.params.id, notes: request.body.notes, updatedAt };
  });

  const detector = new DetectedSessionScanner(config.detectWindowMs, (sessionId) => Boolean(model.getSession(sessionId)));
  detector.scan();
  const detectTimer = setInterval(() => detector.scan(), config.detectScanIntervalMs);
  detectTimer.unref();

  app.get("/detected-sessions", async () => {
    return detector.list();
  });

  app.delete("/history", async () => {
    // Keep any sessions that are currently active in the in-memory model
    const activeSessionIds: string[] = [];
    for (const session of model.getSnapshot()) {
      if (session.status === "active") activeSessionIds.push(session.id);
    }
    const result = clearHistory(db, activeSessionIds);
    // Reset the in-memory model and rehydrate from remaining DB rows
    model.reset();
    for (const { rawJson } of listAllEventsRaw(db)) {
      try {
        const parsed = JSON.parse(rawJson);
        model.ingest(parsed);
      } catch { /* skip corrupt rows */ }
    }
    // Broadcast a fresh snapshot to all connected clients
    hub.broadcast({
      type: "snapshot",
      payload: {
        projects: model.getProjects().map(serializeProject),
        sessions: model.getSnapshot().map(serializeSession)
      }
    });
    return result;
  });

  // ── Analytics API endpoints ──

  app.get("/analytics/sessions", async () => {
    return listSessionAnalytics(db);
  });

  app.get<{ Params: { id: string } }>("/analytics/sessions/:id", async (request) => {
    return getSessionAnalytics(db, request.params.id) ?? { error: "not found" };
  });

  app.get<{ Params: { id: string } }>("/analytics/sessions/:id/tools", async (request) => {
    return listToolCallAnalyticsBySession(db, request.params.id);
  });

  app.get<{ Querystring: { sessionId?: string } }>("/analytics/tools/summary", async (request) => {
    return getToolSummaries(db, request.query.sessionId);
  });

  app.get<{ Querystring: { sessionId?: string } }>("/analytics/permissions", async (request) => {
    return listPermissionEvents(db, request.query.sessionId);
  });

  app.get("/analytics/permissions/pending", async () => {
    return getPendingPermissions(db);
  });

  const sweep = setInterval(() => {
    const now = new Date().toISOString();
    const agentTouched = [
      ...model.sweepPresence(now, config.idleMs, config.staleMs),
      ...model.sweepDepartures(now, config.departAfterMs),
      ...model.sweepDisplayStates(now)
    ];
    const dedupedAgents = new Map(agentTouched.map((t) => [`${t.sessionId}:${t.agentId}`, t]));
    for (const { sessionId, agentId } of dedupedAgents.values()) {
      const agent = model.getSession(sessionId)?.agents.get(agentId);
      if (agent) hub.broadcast({ type: "agent_updated", sessionId, agentId, agent: serializeAgent(agent) });
    }

    const sessionTouched = model.sweepSessionStatus(now, config.sessionIdleAfterMs, config.sessionEndedAfterMs);
    for (const { sessionId } of sessionTouched) {
      const session = model.getSession(sessionId);
      if (!session) continue;
      persistSession(db, session);
      hub.broadcast({ type: "session_updated", sessionId, session: serializeSession(session) });
    }
  }, config.sweepIntervalMs);
  sweep.unref();
  app.addHook("onClose", (_instance, done) => {
    clearInterval(sweep);
    clearInterval(detectTimer);
    done();
  });

  return app;
}
