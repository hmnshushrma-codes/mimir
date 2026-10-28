import { describe, expect, it } from "vitest";
import { baseName, disambiguateProjectNames, fallbackProjectInfo, parentFolderName } from "./project.js";

describe("baseName", () => {
  it("extracts the last path segment on both separators", () => {
    expect(baseName("/home/user/my-project")).toBe("my-project");
    expect(baseName("C:\\Users\\user\\my-project")).toBe("my-project");
  });
});

describe("parentFolderName", () => {
  it("extracts the second-to-last segment", () => {
    expect(parentFolderName("/home/work/api")).toBe("work");
    expect(parentFolderName("C:\\Users\\me\\personal\\api")).toBe("personal");
  });

  it("returns null when there's no parent segment", () => {
    expect(parentFolderName("api")).toBeNull();
  });
});

describe("fallbackProjectInfo", () => {
  it("derives a name and deterministic id from a bare cwd", () => {
    const a = fallbackProjectInfo("/home/user/my-project");
    const b = fallbackProjectInfo("/home/user/my-project");
    expect(a.name).toBe("my-project");
    expect(a.id).toBe(b.id);
    expect(a.worktreeOf).toBeNull();
    expect(a.branch).toBeNull();
  });

  it("handles a null cwd without throwing", () => {
    expect(() => fallbackProjectInfo(null)).not.toThrow();
  });
});

describe("disambiguateProjectNames", () => {
  it("leaves a unique name untouched", () => {
    const result = disambiguateProjectNames([{ id: "p1", name: "agent-workshop", rootPath: "/home/user/agent-workshop" }]);
    expect(result.p1).toBe("agent-workshop");
  });

  it("appends the parent folder when two projects share a name", () => {
    const result = disambiguateProjectNames([
      { id: "p1", name: "api", rootPath: "/home/user/work/api" },
      { id: "p2", name: "api", rootPath: "/home/user/personal/api" }
    ]);
    expect(result.p1).toBe("api · work/");
    expect(result.p2).toBe("api · personal/");
  });

  it("does not cross-disambiguate unrelated names", () => {
    const result = disambiguateProjectNames([
      { id: "p1", name: "api", rootPath: "/home/user/work/api" },
      { id: "p2", name: "web", rootPath: "/home/user/work/web" }
    ]);
    expect(result.p1).toBe("api");
    expect(result.p2).toBe("web");
  });
});
