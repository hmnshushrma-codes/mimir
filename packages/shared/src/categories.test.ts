import { describe, expect, it } from "vitest";
import { categorizeTool } from "./categories.js";

describe("categorizeTool", () => {
  it.each([
    ["Read", "read"],
    ["Grep", "read"],
    ["Glob", "read"],
    ["LS", "read"],
    ["Edit", "write"],
    ["Write", "write"],
    ["MultiEdit", "write"],
    ["NotebookEdit", "write"],
    ["Bash", "shell"],
    ["WebSearch", "web"],
    ["WebFetch", "web"],
    ["Task", "delegate"],
    ["Agent", "delegate"],
    ["mcp__github__search_repositories", "mcp"],
    ["mcp__filesystem__read_file", "mcp"],
    ["SomethingUnknown", "other"],
    [null, "other"],
    [undefined, "other"]
  ] as const)("categorizes %s as %s", (toolName, expected) => {
    expect(categorizeTool(toolName)).toBe(expected);
  });

  it("does not conflate TaskCreate/TaskList with the Task delegate tool", () => {
    expect(categorizeTool("TaskCreate")).toBe("other");
    expect(categorizeTool("TaskList")).toBe("other");
    expect(categorizeTool("TaskUpdate")).toBe("other");
  });
});
