import { describe, it, expect, beforeEach } from "vitest";
import { PermissionManager, type PermissionDecision } from "./permission-manager.js";

function makeParams(overrides: Partial<Parameters<PermissionManager["register"]>[0]> = {}) {
  return {
    sessionId: "sess-1",
    agentId: "main",
    agentName: null,
    projectName: "my-project",
    branch: "main",
    toolName: "Bash",
    toolInput: { command: "npm test" },
    cwd: "/home/user/project",
    ...overrides,
  };
}

describe("PermissionManager", () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager(5000); // 5s expiry for tests
  });

  it("registers a pending request and returns an ID", () => {
    const { id, existing } = pm.register(makeParams());
    expect(id).toMatch(/^perm-/);
    expect(existing).toBe(false);
    expect(pm.size).toBe(1);
  });

  it("allows a pending request from dashboard", async () => {
    const { id, promise } = pm.register(makeParams());
    const decision: PermissionDecision = { behavior: "allow", source: "dashboard" };
    const resolved = pm.decide(id, decision);
    expect(resolved).toBe(true);
    expect(pm.size).toBe(0);
    const result = await promise;
    expect(result.behavior).toBe("allow");
    expect(result.source).toBe("dashboard");
  });

  it("denies a pending request from dashboard", async () => {
    const { id, promise } = pm.register(makeParams());
    const decision: PermissionDecision = { behavior: "deny", reason: "Not safe", source: "dashboard" };
    pm.decide(id, decision);
    const result = await promise;
    expect(result.behavior).toBe("deny");
    expect(result.reason).toBe("Not safe");
  });

  it("rejects deciding on an already-decided request", () => {
    const { id } = pm.register(makeParams());
    pm.decide(id, { behavior: "allow", source: "dashboard" });
    // Second decide should fail
    const result = pm.decide(id, { behavior: "deny", source: "dashboard" });
    expect(result).toBe(false);
  });

  it("rejects deciding on a non-existent request", () => {
    const result = pm.decide("fake-id", { behavior: "allow", source: "dashboard" });
    expect(result).toBe(false);
  });

  it("falls back to terminal on timeout", async () => {
    const { id, promise } = pm.register(makeParams());
    const decision: PermissionDecision = { behavior: "terminal", source: "timeout" };
    pm.decide(id, decision);
    const result = await promise;
    expect(result.behavior).toBe("terminal");
    expect(result.source).toBe("timeout");
  });

  it("resolves all pending requests for a session", () => {
    pm.register(makeParams({ toolInput: { command: "cmd1" } }));
    pm.register(makeParams({ toolInput: { command: "cmd2" } }));
    pm.register(makeParams({ sessionId: "sess-2" }));
    expect(pm.size).toBe(3);

    const count = pm.resolveSession("sess-1", { behavior: "terminal", source: "terminal" });
    expect(count).toBe(2);
    expect(pm.size).toBe(1);
  });

  it("deduplicates identical requests within time window", () => {
    const { id: id1 } = pm.register(makeParams());
    const { id: id2, existing } = pm.register(makeParams());
    expect(existing).toBe(true);
    expect(id2).toBe(id1);
    expect(pm.size).toBe(1);
  });

  it("extracts detail from Bash command", () => {
    const { detail } = PermissionManager.extractDetail("Bash", { command: "rm -rf /tmp" });
    expect(detail).toBe("rm -rf /tmp");
  });

  it("extracts detail from Edit file_path", () => {
    const { detail } = PermissionManager.extractDetail("Edit", { file_path: "/src/index.ts" });
    expect(detail).toBe("/src/index.ts");
  });

  it("extracts detail from WebFetch url", () => {
    const { detail } = PermissionManager.extractDetail("WebFetch", { url: "https://example.com" });
    expect(detail).toBe("https://example.com");
  });

  it("classifies risk for destructive commands", () => {
    const { id } = pm.register(makeParams({ toolInput: { command: "rm -rf /home" } }));
    const pending = pm.get(id);
    expect(pending?.risk).toBe("destructive");
  });

  it("classifies risk for external commands", () => {
    const { id } = pm.register(makeParams({ toolInput: { command: "git push origin main" } }));
    const pending = pm.get(id);
    expect(pending?.risk).toBe("external");
  });

  it("returns null risk for safe commands", () => {
    const { id } = pm.register(makeParams({ toolInput: { command: "npm test" } }));
    const pending = pm.get(id);
    expect(pending?.risk).toBeNull();
  });

  it("stores recent decisions for poll endpoint", () => {
    const { id } = pm.register(makeParams());
    expect(pm.getRecentDecision(id)).toBeNull();

    pm.decide(id, { behavior: "allow", source: "dashboard" });
    const recent = pm.getRecentDecision(id);
    expect(recent).not.toBeNull();
    expect(recent!.decision).toBe("allow");
  });

  it("records audit log entries", () => {
    const { id } = pm.register(makeParams());
    pm.decide(id, { behavior: "deny", reason: "test", source: "dashboard" });

    const log = pm.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].decision).toBe("deny");
    expect(log[0].source).toBe("dashboard");
    expect(log[0].projectName).toBe("my-project");
  });

  it("serializes pending request without resolve function", () => {
    const { id } = pm.register(makeParams());
    const pending = pm.get(id)!;
    const serialized = pm.serialize(pending);
    expect(serialized.id).toBe(id);
    expect(serialized.toolName).toBe("Bash");
    expect(serialized).not.toHaveProperty("resolve");
    expect(serialized).not.toHaveProperty("rawDetail");
  });
});
