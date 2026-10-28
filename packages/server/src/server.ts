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
  type ProjectRecord,
  type SessionRecord
} from "@agent-workshop/shared";
import type { ServerConfig } from "./config.js";
import {
  insertEvent,
  listAllEventsRaw,
  listProjects,
  listSessionEvents,
  listSessions,
  upsertProject,
  upsertSession,
  type StoredEventRow
} from "./db.js";
import { enrichSubagentCorrelation } from "./correlation.js";
import { resolveProject } from "./project-resolver.js";
import { WsHub } from "./ws-hub.js";
import { DetectedSessionScanner } from "./detect-sessions.js";

export interface BuildAppOptions {
  config: ServerConfig;
  db: DatabaseSync;
  model?: WorkshopModel;
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

export function buildApp({ config, db, model = new WorkshopModel(), hub = new WsHub() }: BuildAppOptions): FastifyInstance {
  // Rehydrate the model from stored events so we don't lose state on restart
  const rehydrated = rehydrateModel(model, db);
  if (rehydrated > 0) {
    console.log(`agent-workshop: rehydrated ${rehydrated} events from database`);
  }

  const app = Fastify({ logger: false });

  // Serve the pre-built web app if it exists (production mode).
  // In dev mode (pnpm dev), the Vite dev server handles the frontend instead.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const webDistPath = resolve(__dirname, "../../web/dist");
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

  const detector = new DetectedSessionScanner(config.detectWindowMs, (sessionId) => Boolean(model.getSession(sessionId)));
  detector.scan();
  const detectTimer = setInterval(() => detector.scan(), config.detectScanIntervalMs);
  detectTimer.unref();

  app.get("/detected-sessions", async () => {
    return detector.list();
  });

  const sweep = setInterval(() => {
    const now = new Date().toISOString();
    const agentTouched = [
      ...model.sweepPresence(now, config.idleMs, config.staleMs),
      ...model.sweepDepartures(now, config.departAfterMs),
      ...model.sweepMoods(now)
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
