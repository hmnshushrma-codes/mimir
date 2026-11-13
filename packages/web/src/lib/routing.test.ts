import { describe, it, expect, beforeEach } from "vitest";

// Test URL parsing logic (same as App.tsx)
type ViewMode = "workshop" | "data" | "split" | "debug";
const VALID_VIEWS: ViewMode[] = ["workshop", "data", "split", "debug"];

function parseView(search: string): ViewMode {
  const params = new URLSearchParams(search);
  const v = params.get("view");
  if (v && VALID_VIEWS.includes(v as ViewMode)) return v as ViewMode;
  return "workshop";
}

describe("view routing", () => {
  it("parses ?view=data", () => {
    expect(parseView("?view=data")).toBe("data");
  });

  it("parses ?view=split", () => {
    expect(parseView("?view=split")).toBe("split");
  });

  it("parses ?view=workshop", () => {
    expect(parseView("?view=workshop")).toBe("workshop");
  });

  it("defaults to workshop for unknown view", () => {
    expect(parseView("?view=unknown")).toBe("workshop");
  });

  it("defaults to workshop for empty search", () => {
    expect(parseView("")).toBe("workshop");
  });

  it("preserves other params", () => {
    const params = new URLSearchParams("?view=data&page=tokens&filter=all");
    expect(params.get("view")).toBe("data");
    expect(params.get("page")).toBe("tokens");
    expect(params.get("filter")).toBe("all");
  });
});
