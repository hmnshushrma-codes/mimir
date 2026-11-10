/**
 * Prompt Improvement Recommendations — Part 3, Issue #14
 *
 * Generates actionable improvement suggestions from prompt quality scores.
 * Correlates prompt indicators with execution outcomes (without claiming causation).
 * Never auto-modifies or resubmits prompts.
 * Optional LLM-based evaluation is opt-in, disabled by default — this module
 * provides the deterministic recommendation layer only.
 */

import type { PromptAssessment, SessionAnalytics } from "./analytics.js";
import { assessPrompt } from "./prompt-quality.js";

export interface PromptRecommendation {
  sessionId: string;
  originalPrompt: string;
  qualityScore: number;
  /** Specific actionable suggestions. */
  suggestions: PromptSuggestion[];
  /** Improved prompt text — a rewrite incorporating suggestions. */
  improvedPrompt: string | null;
  /** Correlation with execution outcomes (not causation). */
  outcomeCorrelation: OutcomeCorrelation | null;
}

export interface PromptSuggestion {
  dimension: string;
  currentScore: number;
  suggestion: string;
  priority: "high" | "medium" | "low";
  /** Example text that could be added. */
  example: string | null;
}

export interface OutcomeCorrelation {
  failedToolCalls: number;
  totalToolCalls: number;
  retryCount: number;
  /** Observations — not causal claims. */
  observations: string[];
}

// ─── Suggestion generation ──────────────────────────────────────────

function generateSuggestions(assessment: PromptAssessment): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  const d = assessment.dimensions;

  if (d.objectiveClarity < 6) {
    suggestions.push({
      dimension: "objectiveClarity",
      currentScore: d.objectiveClarity,
      suggestion: "Start with a clear action verb and target (e.g. 'Fix the login bug in auth.ts')",
      priority: "high",
      example: "Fix the [specific issue] in [specific file/component]",
    });
  }

  if (d.taskSpecificity < 5) {
    suggestions.push({
      dimension: "taskSpecificity",
      currentScore: d.taskSpecificity,
      suggestion: "Reference specific files, functions, or code identifiers",
      priority: "high",
      example: "The function `validateToken` in `src/auth.ts` should...",
    });
  }

  if (d.acceptanceCriteria < 4) {
    suggestions.push({
      dimension: "acceptanceCriteria",
      currentScore: d.acceptanceCriteria,
      suggestion: "Define when the task is done (tests pass, build succeeds, specific behavior works)",
      priority: "high",
      example: "Done when `pnpm test` passes and the login page renders without errors",
    });
  }

  if (d.scopeDefinition < 4) {
    suggestions.push({
      dimension: "scopeDefinition",
      currentScore: d.scopeDefinition,
      suggestion: "Specify what to include and exclude from changes",
      priority: "medium",
      example: "Only modify the auth module. Don't change the database schema.",
    });
  }

  if (d.contextCompleteness < 4) {
    suggestions.push({
      dimension: "contextCompleteness",
      currentScore: d.contextCompleteness,
      suggestion: "Provide background — what exists now, why it needs to change",
      priority: "medium",
      example: "Currently the function returns null for expired tokens. It should throw an error instead.",
    });
  }

  if (d.constraints < 4) {
    suggestions.push({
      dimension: "constraints",
      currentScore: d.constraints,
      suggestion: "Mention requirements: backward compatibility, performance, security",
      priority: "medium",
      example: "Must maintain backward compatibility with existing valid token handling.",
    });
  }

  if (d.expectedOutput < 4) {
    suggestions.push({
      dimension: "expectedOutput",
      currentScore: d.expectedOutput,
      suggestion: "Describe what the result should look like",
      priority: "medium",
      example: "Expected: expired tokens return HTTP 401 with JSON error body.",
    });
  }

  if (d.verificationInstructions < 4) {
    suggestions.push({
      dimension: "verificationInstructions",
      currentScore: d.verificationInstructions,
      suggestion: "Tell the agent how to verify the result",
      priority: "low",
      example: "Run `pnpm test` and `pnpm typecheck` to verify.",
    });
  }

  if (d.technicalContext < 4) {
    suggestions.push({
      dimension: "technicalContext",
      currentScore: d.technicalContext,
      suggestion: "Mention the tech stack (React, TypeScript, REST API, etc.)",
      priority: "low",
      example: null,
    });
  }

  if (d.ambiguity < 7) {
    suggestions.push({
      dimension: "ambiguity",
      currentScore: d.ambiguity,
      suggestion: "Replace vague words (maybe, probably, something, stuff) with specifics",
      priority: "medium",
      example: null,
    });
  }

  return suggestions;
}

// ─── Improved prompt generation ─────────────────────────────────────

/** Generate an improved version of the prompt by incorporating suggestions.
 *  Only generates if there are high-priority suggestions. Returns null if
 *  the prompt is already good enough. */
function generateImprovedPrompt(original: string, suggestions: PromptSuggestion[]): string | null {
  const highPriority = suggestions.filter((s) => s.priority === "high");
  if (highPriority.length === 0) return null;

  // Build an improved prompt by appending missing elements
  const parts = [original.trim()];

  for (const s of highPriority) {
    if (s.example && !original.toLowerCase().includes(s.example.toLowerCase().slice(0, 20))) {
      parts.push(`\n${s.example}`);
    }
  }

  const improved = parts.join("\n").trim();
  return improved !== original.trim() ? improved : null;
}

// ─── Outcome correlation ────────────────────────────────────────────

function correlateWithOutcomes(
  assessment: PromptAssessment,
  sessionAnalytics: SessionAnalytics | null
): OutcomeCorrelation | null {
  if (!sessionAnalytics) return null;

  const observations: string[] = [];
  const failRate = sessionAnalytics.toolCallCount > 0
    ? sessionAnalytics.failedToolCalls / sessionAnalytics.toolCallCount
    : 0;

  if (assessment.overallScore < 40 && failRate > 0.3) {
    observations.push(
      `Low prompt score (${assessment.overallScore}/100) correlated with high tool failure rate (${Math.round(failRate * 100)}%). Consider adding specifics.`
    );
  }

  if (assessment.dimensions.acceptanceCriteria < 3 && sessionAnalytics.toolCallCount > 20) {
    observations.push(
      "No acceptance criteria defined. Session had many tool calls — agent may have been exploring without clear direction."
    );
  }

  if (assessment.dimensions.scopeDefinition < 3 && sessionAnalytics.subagentCount > 2) {
    observations.push(
      "No scope boundaries. Multiple subagents spawned — task may have been broader than intended."
    );
  }

  return {
    failedToolCalls: sessionAnalytics.failedToolCalls,
    totalToolCalls: sessionAnalytics.toolCallCount,
    retryCount: sessionAnalytics.failedToolCalls, // approximation
    observations,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/** Generate full prompt improvement recommendation.
 *  Never auto-modifies or resubmits the prompt. */
export function generatePromptRecommendation(
  sessionId: string,
  prompt: string,
  sessionAnalytics?: SessionAnalytics | null
): PromptRecommendation {
  const assessment = assessPrompt(sessionId, prompt);
  const suggestions = generateSuggestions(assessment);
  const improvedPrompt = generateImprovedPrompt(prompt, suggestions);
  const outcomeCorrelation = correlateWithOutcomes(assessment, sessionAnalytics ?? null);

  return {
    sessionId,
    originalPrompt: prompt,
    qualityScore: assessment.overallScore,
    suggestions,
    improvedPrompt,
    outcomeCorrelation,
  };
}
