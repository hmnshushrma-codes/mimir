import { describe, it, expect } from "vitest";
import { mapStatus, type StatusBucket, type SourceKind } from "./types.js";

/** Table-driven test helper */
function cases(source: SourceKind, table: Array<[string, StatusBucket, string?]>) {
  for (const [rawStatus, expected, category] of table) {
    it(`${source} "${rawStatus}"${category ? ` (category: ${category})` : ""} → ${expected}`, () => {
      expect(mapStatus(source, rawStatus, category)).toBe(expected);
    });
  }
}

describe("mapStatus", () => {
  describe("GitHub issues", () => {
    cases("github", [
      ["open", "todo"],
      ["closed", "done"],
      ["OPEN", "todo"],        // case insensitive
      ["  Closed  ", "done"],  // whitespace
    ]);
  });

  describe("GitHub Projects v2 status names", () => {
    cases("github", [
      ["Todo", "todo"],
      ["Backlog", "todo"],
      ["Triage", "todo"],
      ["In Progress", "in_progress"],
      ["In_Progress", "in_progress"],
      ["Working", "in_progress"],
      ["Active", "in_progress"],
      ["In Review", "in_review"],
      ["In_Review", "in_review"],
      ["Review", "in_review"],
      ["Awaiting Review", "in_review"],
      ["Done", "done"],
      ["Completed", "done"],
      ["Shipped", "done"],
      ["Merged", "done"],
      ["Blocked", "blocked"],
      ["On Hold", "blocked"],
      ["Paused", "blocked"],
    ]);
  });

  describe("Jira status categories", () => {
    cases("jira", [
      ["To Do", "todo", "new"],
      ["Open", "todo", "new"],
      ["In Progress", "in_progress", "indeterminate"],
      ["In Development", "in_progress", "indeterminate"],
      ["Done", "done", "done"],
      ["Resolved", "done", "done"],
      // Category takes priority over raw status
      ["Custom Status", "todo", "new"],
      ["Custom Status", "in_progress", "indeterminate"],
      ["Custom Status", "done", "done"],
      // Undefined category → todo
      ["Anything", "todo", "undefined"],
    ]);
  });

  describe("Jira statuses (without category)", () => {
    cases("jira", [
      ["To Do", "todo"],
      ["Open", "todo"],
      ["Backlog", "todo"],
      ["In Progress", "in_progress"],
      ["In Development", "in_progress"],
      ["In Review", "in_review"],
      ["Code Review", "in_review"],
      ["In QA", "in_review"],
      ["Testing", "in_review"],
      ["Done", "done"],
      ["Closed", "done"],
      ["Resolved", "done"],
      ["Released", "done"],
      ["Blocked", "blocked"],
      ["On Hold", "blocked"],
    ]);
  });

  describe("Bitbucket", () => {
    cases("bitbucket", [
      ["new", "todo"],
      ["open", "todo"],
      ["resolved", "done"],
      ["closed", "done"],
    ]);
  });

  describe("Vercel", () => {
    cases("vercel", [
      ["queued", "in_progress"],
      ["building", "in_progress"],
      ["ready", "done"],
      ["error", "blocked"],
      ["canceled", "blocked"],
      ["cancelled", "blocked"],  // both spellings
    ]);
  });

  describe("unknown statuses", () => {
    it("unknown GitHub status falls back to todo", () => {
      expect(mapStatus("github", "some-custom-status")).toBe("todo");
    });

    it("unknown Jira status falls back to todo", () => {
      expect(mapStatus("jira", "xyzzy-status")).toBe("todo");
    });

    it("unknown source kind with generic status works", () => {
      expect(mapStatus("manual", "in progress")).toBe("in_progress");
      expect(mapStatus("manual", "done")).toBe("done");
    });

    it("empty string falls back to todo", () => {
      expect(mapStatus("github", "")).toBe("todo");
    });

    it("never throws", () => {
      expect(() => mapStatus("github", "")).not.toThrow();
      expect(() => mapStatus("jira", "null")).not.toThrow();
      expect(() => mapStatus("manual" as SourceKind, "🚀")).not.toThrow();
    });
  });

  describe("casing and whitespace variants", () => {
    it("handles mixed case", () => {
      expect(mapStatus("github", "IN PROGRESS")).toBe("in_progress");
      expect(mapStatus("jira", "IN REVIEW")).toBe("in_review");
    });

    it("handles leading/trailing whitespace", () => {
      expect(mapStatus("github", "  todo  ")).toBe("todo");
      expect(mapStatus("jira", "\tDone\n")).toBe("done");
    });
  });
});
