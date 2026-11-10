import { describe, expect, it } from "vitest";
import { assessPrompt } from "./prompt-quality.js";

describe("prompt quality assessment", () => {
  it("scores a vague prompt low", () => {
    const result = assessPrompt("s1", "fix it");
    expect(result.overallScore).toBeLessThan(40);
    expect(result.dimensions.objectiveClarity).toBeLessThanOrEqual(6);
    expect(result.dimensions.taskSpecificity).toBeLessThan(5);
    expect(result.missingRequirements.length).toBeGreaterThan(0);
    expect(result.ambiguities.length).toBeGreaterThan(0);
  });

  it("scores a detailed prompt high", () => {
    const result = assessPrompt("s2",
      "Fix the authentication bug in src/auth.ts where the login function " +
      "returns null instead of throwing an error. The function `validateToken` " +
      "should check the JWT expiry. Only modify the auth module, don't touch " +
      "the middleware. Ensure all existing tests pass after the change. " +
      "Run `pnpm test` and `pnpm typecheck` to verify. " +
      "The expected output is that invalid tokens return a 401 HTTP status."
    );
    expect(result.overallScore).toBeGreaterThan(50);
    expect(result.dimensions.objectiveClarity).toBeGreaterThanOrEqual(6);
    expect(result.dimensions.taskSpecificity).toBeGreaterThanOrEqual(5);
    expect(result.dimensions.scopeDefinition).toBeGreaterThanOrEqual(4);
    expect(result.dimensions.verificationInstructions).toBeGreaterThanOrEqual(3);
    expect(result.missingRequirements.length).toBeLessThan(3);
  });

  it("does not equate length with quality", () => {
    const longVague = assessPrompt("s3",
      "I think there might be something wrong with the thing we were looking at " +
      "yesterday or maybe the day before, it was probably related to the stuff " +
      "in that file somewhere, can you sort of fix whatever is going on there, " +
      "I'm not really sure what the issue is but something seems off with things."
    );
    const shortClear = assessPrompt("s4",
      "Fix the null pointer in `src/auth.ts:validateToken`. Run `pnpm test` to verify."
    );
    // Short clear prompt should score higher than long vague one
    expect(shortClear.overallScore).toBeGreaterThan(longVague.overallScore);
  });

  it("detects ambiguous language", () => {
    const result = assessPrompt("s5", "Maybe fix something like the login probably");
    expect(result.dimensions.ambiguity).toBeLessThan(7);
    expect(result.ambiguities.length).toBeGreaterThan(0);
  });

  it("rewards technical context", () => {
    const withTech = assessPrompt("s6", "Fix the React component using TypeScript and the REST API endpoint");
    const withoutTech = assessPrompt("s7", "Fix the broken thing on the page");
    expect(withTech.dimensions.technicalContext).toBeGreaterThan(withoutTech.dimensions.technicalContext);
  });

  it("rewards acceptance criteria", () => {
    const withCriteria = assessPrompt("s8",
      "Add user validation. All tests must pass. Verify with `pnpm test`. " +
      "Done when no errors in the build."
    );
    expect(withCriteria.dimensions.acceptanceCriteria).toBeGreaterThanOrEqual(5);
  });

  it("rewards scope definition", () => {
    const scoped = assessPrompt("s9",
      "Only fix the login function. Don't modify the signup flow. " +
      "Avoid changing the database schema. Focus on the auth module specifically."
    );
    expect(scoped.dimensions.scopeDefinition).toBeGreaterThanOrEqual(6);
  });

  it("returns suggestions for improvement", () => {
    const result = assessPrompt("s10", "fix the bug");
    expect(result.suggestedImprovements.length).toBeGreaterThan(0);
    expect(result.suggestedImprovements.some((s) => s.includes("Add:"))).toBe(true);
  });

  it("gives a max-ish score for a comprehensive prompt", () => {
    const result = assessPrompt("s11",
      "Fix the authentication bug in `src/auth.ts` where `validateToken` " +
      "currently returns null for expired JWT tokens instead of throwing an " +
      "AuthenticationError. This is the existing TypeScript REST API using Node.js. " +
      "The function should check `token.exp` against `Date.now()`. " +
      "Only modify `src/auth.ts` and its test file `src/auth.test.ts`. " +
      "Don't touch the middleware or database layer. " +
      "The expected output: expired tokens return HTTP 401 with a JSON error body. " +
      "Ensure backward compatibility with existing valid token handling. " +
      "Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` to verify. " +
      "Done when all tests pass and no TypeScript errors remain."
    );
    expect(result.overallScore).toBeGreaterThan(65);
    expect(result.missingRequirements).toHaveLength(0);
    expect(result.ambiguities).toHaveLength(0);
  });

  it("never modifies the original prompt", () => {
    const original = "fix the bug";
    const result = assessPrompt("s12", original);
    expect(result.prompt).toBe(original);
  });

  it("handles empty prompt gracefully", () => {
    const result = assessPrompt("s13", "");
    expect(result.overallScore).toBeLessThan(30);
    expect(result.dimensions.objectiveClarity).toBeLessThan(5);
  });
});
