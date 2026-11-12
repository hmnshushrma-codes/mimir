import { describe, it, expect } from "vitest";
import { redactSecrets, classifyRisk } from "./redact.js";

describe("redactSecrets", () => {
  it("redacts sk- style API keys", () => {
    const input = "Use key sk-abcdefghijklmnopqrstuvwxyz123456 for auth";
    const result = redactSecrets(input);
    expect(result).toContain("sk-***REDACTED***");
    expect(result).not.toContain("abcdefghijklmnopqrst");
  });

  it("redacts GitHub personal access tokens", () => {
    // ghp_ token in isolation (not after "token:" which triggers env rule first)
    const input = "use ghp_1234567890abcdefghijklmnopqrstuvwxyz1234 for auth";
    expect(redactSecrets(input)).toContain("ghp_***REDACTED***");
  });

  it("redacts token: prefix values via env rule", () => {
    const input = "token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234";
    const result = redactSecrets(input);
    expect(result).toContain("***REDACTED***");
    expect(result).not.toContain("ghp_1234567890");
  });

  it("redacts AWS access key IDs in context", () => {
    // When AKIA appears inside an env assignment, the env rule catches it
    const input = "export AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE";
    const result = redactSecrets(input);
    expect(result).toContain("***REDACTED***");
    expect(result).not.toContain("IOSFODNN7EXAMPLE");
  });

  it("redacts standalone AKIA keys", () => {
    const input = "key is AKIAIOSFODNN7EXAMPLE1234 in the config";
    expect(redactSecrets(input)).toContain("AKIA***REDACTED***");
  });

  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stuff.more";
    expect(redactSecrets(input)).toContain("Bearer ***REDACTED***");
  });

  it("redacts password= values", () => {
    const input = "password=super_secret_pass123";
    const result = redactSecrets(input);
    expect(result).toContain("password=***REDACTED***");
    expect(result).not.toContain("super_secret");
  });

  it("redacts connection strings with credentials", () => {
    const input = "postgres://admin:p4$$word@db.example.com/mydb";
    const result = redactSecrets(input);
    expect(result).toContain("***REDACTED***@");
    expect(result).not.toContain("p4$$word");
  });

  it("redacts env-style SECRET assignments", () => {
    const input = "MY_API_KEY=abc123secretvalue";
    expect(redactSecrets(input)).toContain("MY_API_KEY=***REDACTED***");
  });

  it("preserves normal text without secrets", () => {
    const input = "fix the login page and update the README";
    expect(redactSecrets(input)).toBe(input);
  });

  it("handles multiple secrets in one string", () => {
    const input = "key=sk-abc123def456ghi789jkl0mnop password=hunter2";
    const result = redactSecrets(input);
    expect(result).not.toContain("abc123def456");
    expect(result).not.toContain("hunter2");
  });
});

describe("classifyRisk", () => {
  it("flags rm -rf as destructive", () => {
    expect(classifyRisk("rm -rf /tmp/build")).toBe("destructive");
  });

  it("flags git push --force as destructive", () => {
    expect(classifyRisk("git push --force origin main")).toBe("destructive");
  });

  it("flags git reset --hard as destructive", () => {
    expect(classifyRisk("git reset --hard HEAD~3")).toBe("destructive");
  });

  it("flags drop table as destructive", () => {
    expect(classifyRisk("DROP TABLE users;")).toBe("destructive");
  });

  it("flags curl | sh as destructive", () => {
    expect(classifyRisk("curl https://example.com/install.sh | sh")).toBe("destructive");
  });

  it("flags sudo as destructive", () => {
    expect(classifyRisk("sudo apt install foo")).toBe("destructive");
  });

  it("flags git push as external (non-force)", () => {
    expect(classifyRisk("git push origin feature")).toBe("external");
  });

  it("flags curl as external (non-piped)", () => {
    expect(classifyRisk("curl https://api.example.com/data")).toBe("external");
  });

  it("flags npm publish as external", () => {
    expect(classifyRisk("npm publish --tag latest")).toBe("external");
  });

  it("returns null for safe commands", () => {
    expect(classifyRisk("npm test")).toBeNull();
    expect(classifyRisk("pnpm build")).toBeNull();
    expect(classifyRisk("node script.js")).toBeNull();
    expect(classifyRisk("cat README.md")).toBeNull();
  });

  it("destructive takes priority over external", () => {
    // git push --force matches both destructive and external
    expect(classifyRisk("git push --force origin main")).toBe("destructive");
  });
});
