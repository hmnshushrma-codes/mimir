import { describe, expect, it } from "vitest";
import { findOurHooks, installHooks, MANAGED_EVENTS, uninstallHooks, type ClaudeSettings } from "./settings.js";

const SCRIPT_PATH = "/home/user/.claude/agent-workshop/hook-runner.mjs";

describe("installHooks", () => {
  it("adds our hook entry to every managed event on an empty settings file", () => {
    const result = installHooks({}, SCRIPT_PATH);
    for (const event of MANAGED_EVENTS) {
      expect(result.hooks?.[event]).toEqual([
        { matcher: "", hooks: [{ type: "command", command: `node ${SCRIPT_PATH}`, timeout: 1 }] }
      ]);
    }
  });

  it("does not touch other top-level settings keys", () => {
    const settings: ClaudeSettings = { permissions: { allow: ["Bash(ls)"] } };
    const result = installHooks(settings, SCRIPT_PATH);
    expect(result.permissions).toEqual({ allow: ["Bash(ls)"] });
  });

  it("preserves another tool's hook on the same event", () => {
    const settings: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-other-tool.sh" }] }]
      }
    };
    const result = installHooks(settings, SCRIPT_PATH);
    const preToolUse = result.hooks!.PreToolUse;
    expect(preToolUse).toHaveLength(2);
    expect(preToolUse[0]).toEqual({ matcher: "Bash", hooks: [{ type: "command", command: "my-other-tool.sh" }] });
    expect(preToolUse[1].hooks[0].command).toBe(`node ${SCRIPT_PATH}`);
  });

  it("is idempotent: installing twice does not duplicate our entry", () => {
    const once = installHooks({}, SCRIPT_PATH);
    const twice = installHooks(once, SCRIPT_PATH);
    expect(twice.hooks!.PreToolUse).toHaveLength(1);
    expect(twice).toEqual(once);
  });

  it("replaces a stale copy of our own entry (e.g. a different home directory) rather than appending", () => {
    const oldPath = "/home/old-user/.claude/agent-workshop/hook-runner.mjs";
    const withOld = installHooks({}, oldPath);
    const withNew = installHooks(withOld, SCRIPT_PATH);
    expect(withNew.hooks!.Stop).toHaveLength(1);
    expect(withNew.hooks!.Stop[0].hooks[0].command).toBe(`node ${SCRIPT_PATH}`);
  });

  it("does not mutate the input settings object", () => {
    const settings: ClaudeSettings = { hooks: { Stop: [] } };
    const frozen = JSON.parse(JSON.stringify(settings));
    installHooks(settings, SCRIPT_PATH);
    expect(settings).toEqual(frozen);
  });
});

describe("uninstallHooks", () => {
  it("removes our entries and deletes the hooks key entirely when nothing else remains", () => {
    const installed = installHooks({}, SCRIPT_PATH);
    const result = uninstallHooks(installed);
    expect(result.hooks).toBeUndefined();
  });

  it("leaves other tools' hooks on the same event intact", () => {
    const settings: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-other-tool.sh" }] }]
      }
    };
    const installed = installHooks(settings, SCRIPT_PATH);
    const result = uninstallHooks(installed);
    expect(result.hooks!.PreToolUse).toEqual([{ matcher: "Bash", hooks: [{ type: "command", command: "my-other-tool.sh" }] }]);
  });

  it("restores the settings file to exactly its pre-install shape, apart from the removed hooks", () => {
    const original: ClaudeSettings = {
      permissions: { allow: ["Bash(ls)"] },
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-other-tool.sh" }] }] }
    };
    const installed = installHooks(original, SCRIPT_PATH);
    const restored = uninstallHooks(installed);
    expect(restored).toEqual(original);
  });

  it("is a no-op on settings with no hooks key", () => {
    const settings: ClaudeSettings = { permissions: { allow: [] } };
    expect(uninstallHooks(settings)).toEqual(settings);
  });
});

describe("findOurHooks", () => {
  it("finds nothing on empty settings", () => {
    expect(findOurHooks({})).toEqual([]);
  });

  it("finds exactly our entries after install, one per managed event", () => {
    const installed = installHooks({}, SCRIPT_PATH);
    const found = findOurHooks(installed);
    expect(found).toHaveLength(MANAGED_EVENTS.length);
    expect(found.every((h) => h.scriptPath === SCRIPT_PATH)).toBe(true);
    expect(found.every((h) => h.timeout === 1)).toBe(true);
    expect(new Set(found.map((h) => h.event))).toEqual(new Set(MANAGED_EVENTS));
  });

  it("does not report another tool's hooks as ours", () => {
    const settings: ClaudeSettings = {
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-other-tool.sh" }] }] }
    };
    expect(findOurHooks(settings)).toEqual([]);
  });

  it("finds nothing after uninstall", () => {
    const installed = installHooks({}, SCRIPT_PATH);
    const uninstalled = uninstallHooks(installed);
    expect(findOurHooks(uninstalled)).toEqual([]);
  });
});
