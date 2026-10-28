import { describe, expect, it } from "vitest";
import { relativeTime, truncate } from "./text.js";

describe("truncate", () => {
  it("leaves short text untouched", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-01-01T00:10:00.000Z");

  it("reports just now for very recent times", () => {
    expect(relativeTime("2026-01-01T00:09:55.000Z", now)).toBe("just now");
  });

  it("reports minutes ago", () => {
    expect(relativeTime("2026-01-01T00:05:00.000Z", now)).toBe("5m ago");
  });

  it("reports hours ago", () => {
    expect(relativeTime("2025-12-31T22:10:00.000Z", now)).toBe("2h ago");
  });
});
