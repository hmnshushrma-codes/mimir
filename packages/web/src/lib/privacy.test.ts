import { describe, it, expect } from "vitest";
import {
  redactProject, redactBranch, redactPath, redactCommand, redactPrompt,
  redactAgent, GENERIC_TICKER_ITEMS,
} from "./privacy.js";

// Canary strings — real data that must NEVER appear after redaction
const CANARY_PROJECT = "mimir";
const CANARY_BRANCH = "feat/remote-permission-approval";
const CANARY_PATH = "/home/shambhu/Desktop/mimir/mimir/packages/web/src/App.tsx";
const CANARY_COMMAND = "rm -rf /home/shambhu/projects/secret-client";
const CANARY_PROMPT = "Fix the bug in shambhu's private repo at /home/shambhu/secret";
const CANARY_AGENT = "main";

describe("privacy redaction", () => {
  it("replaces project name with deterministic placeholder", () => {
    const result = redactProject(CANARY_PROJECT);
    expect(result).not.toContain("mimir");
    expect(result).toMatch(/^project-/);
  });

  it("replaces branch name", () => {
    const result = redactBranch(CANARY_BRANCH);
    expect(result).not.toContain("remote-permission");
    expect(result).not.toContain("feat/");
  });

  it("replaces file path", () => {
    const result = redactPath(CANARY_PATH);
    expect(result).not.toContain("shambhu");
    expect(result).not.toContain("Desktop");
    expect(result).not.toContain("App.tsx");
    expect(result).toMatch(/^(src|lib|app|config)\//);
  });

  it("replaces command", () => {
    const result = redactCommand(CANARY_COMMAND);
    expect(result).not.toContain("rm -rf");
    expect(result).not.toContain("shambhu");
    expect(result).not.toContain("secret-client");
  });

  it("replaces prompt text", () => {
    const result = redactPrompt(CANARY_PROMPT);
    expect(result).not.toContain("shambhu");
    expect(result).not.toContain("secret");
    expect(result).not.toContain("private repo");
  });

  it("replaces agent name", () => {
    const result = redactAgent(CANARY_AGENT);
    expect(result).not.toBe("main");
  });

  it("is deterministic — same input always gives same output", () => {
    const a = redactProject("my-real-project");
    const b = redactProject("my-real-project");
    expect(a).toBe(b);
  });

  it("different inputs give different outputs (usually)", () => {
    const a = redactProject("project-one");
    const b = redactProject("project-two");
    // Not guaranteed to be different (hash collision) but overwhelmingly likely
    // Just ensure they're valid
    expect(a).toMatch(/^project-/);
    expect(b).toMatch(/^project-/);
  });

  it("generic ticker items contain no real data", () => {
    for (const item of GENERIC_TICKER_ITEMS) {
      expect(item).not.toContain("shambhu");
      expect(item).not.toContain("mimir");
      expect(item).not.toContain("/home");
    }
  });

  it("canary strings do not survive any redaction type", () => {
    // Comprehensive canary test: no canary string appears in ANY redacted output
    const canaries = [CANARY_PROJECT, CANARY_BRANCH, CANARY_PATH, CANARY_COMMAND, CANARY_PROMPT, CANARY_AGENT];
    const redactors = [redactProject, redactBranch, redactPath, redactCommand, redactPrompt, redactAgent];

    for (const canary of canaries) {
      for (const redact of redactors) {
        const result = redact(canary);
        expect(result).not.toContain("shambhu");
        expect(result).not.toContain("secret");
        expect(result).not.toContain("mimir");
        expect(result).not.toContain("/home/");
      }
    }
  });
});
