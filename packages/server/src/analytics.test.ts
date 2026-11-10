import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  openDb,
  getSessionAnalytics,
  listToolCallAnalyticsBySession,
  listPermissionEvents,
  getToolSummaries,
  getPendingPermissions,
  listSessionAnalytics,
} from "./db.js";
import type { DatabaseSync } from "node:sqlite";
import { buildApp } from "./server.js";
import { loadConfig } from "./config.js";

describe("analytics telemetry — end-to-end ingestion", () => {
  let tmpDir: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mimir-analytics-"));
    const dbPath = path.join(tmpDir, "test.sqlite");
    db = openDb(dbPath);
    const config = loadConfig();
    config.dbPath = dbPath;
    app = buildApp({ config, db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function postEvent(payload: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/events",
      payload: { timestamp: new Date().toISOString(), ...payload },
    });
  }

  it("ingests a full session and produces correct session analytics", async () => {
    const t = (ms: number) => new Date(Date.now() + ms).toISOString();

    await postEvent({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/project", timestamp: t(0) });
    await postEvent({ session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "Fix the bug", timestamp: t(100) });
    await postEvent({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/app.ts" }, tool_use_id: "tu1", timestamp: t(500) });
    await postEvent({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "tu1", timestamp: t(800) });
    await postEvent({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "tu2", timestamp: t(1000) });
    await postEvent({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "exit 1", tool_use_id: "tu2", timestamp: t(3000) });
    await postEvent({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "src/app.ts" }, tool_use_id: "tu3", timestamp: t(3500) });
    await postEvent({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: {}, tool_output: "ok", tool_use_id: "tu3", timestamp: t(4000) });

    // Check session analytics
    const sa = getSessionAnalytics(db, "s1");
    expect(sa).not.toBeNull();
    expect(sa!.toolCallCount).toBeGreaterThanOrEqual(3);
    expect(sa!.failedToolCalls).toBeGreaterThanOrEqual(1);
    expect(sa!.successfulToolCalls).toBeGreaterThanOrEqual(2);
    expect(sa!.prompt).toBe("Fix the bug");

    // Check tool call analytics
    const tools = listToolCallAnalyticsBySession(db, "s1");
    expect(tools.length).toBe(3);
    const readCall = tools.find((t) => t.toolName === "Read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("succeeded");
    expect(readCall!.durationMs).toBeGreaterThan(0);

    const bashCall = tools.find((t) => t.toolName === "Bash");
    expect(bashCall).toBeDefined();
    expect(bashCall!.status).toBe("failed");
  });

  it("tracks permission events from Notification hooks", async () => {
    const t = (ms: number) => new Date(Date.now() + ms).toISOString();

    await postEvent({ session_id: "s2", hook_event_name: "SessionStart", source: "startup", timestamp: t(0) });
    await postEvent({ session_id: "s2", hook_event_name: "UserPromptSubmit", prompt: "deploy", timestamp: t(100) });
    await postEvent({ session_id: "s2", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /tmp" }, tool_use_id: "tu-p", timestamp: t(500) });
    await postEvent({ session_id: "s2", hook_event_name: "Notification", notification_type: "permission_prompt", message: "Allow delete?", timestamp: t(600) });

    const perms = listPermissionEvents(db, "s2");
    expect(perms.length).toBe(1);
    expect(perms[0].decision).toBe("pending");
    expect(perms[0].requestType).toBe("permission");
    expect(perms[0].sessionId).toBe("s2");

    const pending = getPendingPermissions(db);
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.some((p) => p.sessionId === "s2")).toBe(true);
  });

  it("produces tool summaries with correct aggregation", async () => {
    const t = (ms: number) => new Date(Date.now() + ms).toISOString();

    await postEvent({ session_id: "s3", hook_event_name: "SessionStart", source: "startup", timestamp: t(0) });
    // 3 Read calls, 2 succeed, 1 fails
    await postEvent({ session_id: "s3", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "a.ts" }, tool_use_id: "r1", timestamp: t(100) });
    await postEvent({ session_id: "s3", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "ok", tool_use_id: "r1", timestamp: t(200) });
    await postEvent({ session_id: "s3", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "b.ts" }, tool_use_id: "r2", timestamp: t(300) });
    await postEvent({ session_id: "s3", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "ok", tool_use_id: "r2", timestamp: t(400) });
    await postEvent({ session_id: "s3", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "c.ts" }, tool_use_id: "r3", timestamp: t(500) });
    await postEvent({ session_id: "s3", hook_event_name: "PostToolUseFailure", tool_name: "Read", tool_input: {}, error: "ENOENT", tool_use_id: "r3", timestamp: t(600) });

    const summaries = getToolSummaries(db, "s3");
    const readSummary = summaries.find((s) => s.toolName === "Read");
    expect(readSummary).toBeDefined();
    expect(readSummary!.totalCalls).toBe(3);
    expect(readSummary!.successCount).toBe(2);
    expect(readSummary!.failureCount).toBe(1);
    expect(readSummary!.avgDurationMs).not.toBeNull();
  });

  it("analytics API endpoints return data", async () => {
    const t = (ms: number) => new Date(Date.now() + ms).toISOString();

    await postEvent({ session_id: "s4", hook_event_name: "SessionStart", source: "startup", timestamp: t(0) });
    await postEvent({ session_id: "s4", hook_event_name: "PreToolUse", tool_name: "Grep", tool_input: { pattern: "TODO" }, tool_use_id: "g1", timestamp: t(100) });
    await postEvent({ session_id: "s4", hook_event_name: "PostToolUse", tool_name: "Grep", tool_input: {}, tool_output: "3 matches", tool_use_id: "g1", timestamp: t(300) });

    // Test session analytics endpoint
    const sessResp = await app.inject({ method: "GET", url: "/analytics/sessions" });
    expect(sessResp.statusCode).toBe(200);
    const sessions = JSON.parse(sessResp.body);
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    // Test single session analytics
    const singleResp = await app.inject({ method: "GET", url: "/analytics/sessions/s4" });
    expect(singleResp.statusCode).toBe(200);
    const single = JSON.parse(singleResp.body);
    expect(single.sessionId).toBe("s4");

    // Test tool call analytics
    const toolsResp = await app.inject({ method: "GET", url: "/analytics/sessions/s4/tools" });
    expect(toolsResp.statusCode).toBe(200);
    const tools = JSON.parse(toolsResp.body);
    expect(tools.length).toBe(1);
    expect(tools[0].toolName).toBe("Grep");

    // Test tool summary
    const summaryResp = await app.inject({ method: "GET", url: "/analytics/tools/summary?sessionId=s4" });
    expect(summaryResp.statusCode).toBe(200);

    // Test permissions endpoints
    const permsResp = await app.inject({ method: "GET", url: "/analytics/permissions" });
    expect(permsResp.statusCode).toBe(200);

    const pendingResp = await app.inject({ method: "GET", url: "/analytics/permissions/pending" });
    expect(pendingResp.statusCode).toBe(200);
  });

  it("analytics survive server restart (DB persistence)", async () => {
    const t = (ms: number) => new Date(Date.now() + ms).toISOString();

    await postEvent({ session_id: "s5", hook_event_name: "SessionStart", source: "startup", timestamp: t(0) });
    await postEvent({ session_id: "s5", hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "x.ts" }, tool_use_id: "w1", timestamp: t(100) });
    await postEvent({ session_id: "s5", hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "w1", timestamp: t(300) });

    // Verify analytics exist
    const before = getSessionAnalytics(db, "s5");
    expect(before).not.toBeNull();
    const toolsBefore = listToolCallAnalyticsBySession(db, "s5");
    expect(toolsBefore.length).toBe(1);

    // "Restart" — close app, reopen DB, rebuild app
    await app.close();
    const db2 = openDb(path.join(tmpDir, "test.sqlite"));
    const config2 = loadConfig();
    config2.dbPath = path.join(tmpDir, "test.sqlite");
    const app2 = buildApp({ config: config2, db: db2 });
    await app2.ready();

    // Analytics still there
    const after = getSessionAnalytics(db2, "s5");
    expect(after).not.toBeNull();
    expect(after!.toolCallCount).toBe(before!.toolCallCount);
    const toolsAfter = listToolCallAnalyticsBySession(db2, "s5");
    expect(toolsAfter.length).toBe(1);
    expect(toolsAfter[0].toolName).toBe("Write");
    expect(toolsAfter[0].status).toBe("succeeded");

    await app2.close();
  });
});
