/**
 * Prompt scoring configuration — 8 dimensions with configurable weights.
 * Maps to the existing assessPrompt() output and adds outcome-based dimensions.
 *
 * Dimensions:
 * 1. Clear goal: one concrete outcome stated up front
 * 2. Context given: file paths, function names, error text, versions
 * 3. Constraints: what not to touch, style, libraries, limits
 * 4. Acceptance criteria: how to know it is done
 * 5. Scope: one task vs many tasks mixed
 * 6. Ambiguity: vague words penalized
 * 7. Efficiency: tokens used vs result (outcome-based)
 * 8. Reuse: repeated boilerplate that belongs in CLAUDE.md
 */

import type { PromptAssessment } from "./analytics.js";
import type { PromptOutcome } from "./prompt-outcomes.js";

export interface ScoringDimension {
  key: string;
  label: string;
  weight: number;
  description: string;
}

/** The 8 scoring dimensions with default weights. */
export const SCORING_DIMENSIONS: ScoringDimension[] = [
  { key: "goal", label: "Clear goal", weight: 2.0, description: "One concrete outcome stated up front" },
  { key: "context", label: "Context given", weight: 1.5, description: "File paths, function names, error text, where to look" },
  { key: "constraints", label: "Constraints", weight: 1.0, description: "What not to touch, style, libraries, limits" },
  { key: "acceptance", label: "Acceptance criteria", weight: 1.5, description: "How to know it is done (tests, behavior, output)" },
  { key: "scope", label: "Scope", weight: 1.0, description: "One task vs many mixed; too broad gets flagged" },
  { key: "ambiguity", label: "Ambiguity", weight: 1.0, description: "Vague words ('fix it', 'make it better', 'everything')" },
  { key: "efficiency", label: "Efficiency", weight: 0.5, description: "Tokens used vs result, retries, corrections (outcome-based)" },
  { key: "reuse", label: "Reuse", weight: 0.5, description: "Repeated boilerplate that belongs in CLAUDE.md" },
];

export interface DimensionScore {
  key: string;
  label: string;
  score: number; // 0–10
  reason: string;
}

export interface EnhancedPromptScore {
  overallScore: number; // 0–100
  dimensions: DimensionScore[];
  missingRequirements: string[];
  suggestedImprovements: string[];
  outcomeNotes: string[];
}

/** Map the existing assessPrompt() output to the 8-dimension model. */
export function enhanceScore(
  assessment: PromptAssessment,
  outcome?: PromptOutcome | null,
): EnhancedPromptScore {
  const d = assessment.dimensions;

  // Map existing 10 dimensions to 8
  const scores: DimensionScore[] = [
    {
      key: "goal", label: "Clear goal", score: d.objectiveClarity,
      reason: d.objectiveClarity >= 7 ? "Goal is clear and actionable" : d.objectiveClarity >= 4 ? "Goal is present but could be more specific" : "No clear goal stated",
    },
    {
      key: "context", label: "Context given", score: Math.round((d.taskSpecificity + d.contextCompleteness + d.technicalContext) / 3),
      reason: d.taskSpecificity >= 7 ? "Good context with file paths and specifics" : d.taskSpecificity >= 4 ? "Some context, could add file paths or error details" : "Missing file paths, function names, or error context",
    },
    {
      key: "constraints", label: "Constraints", score: Math.round((d.constraints + d.scopeDefinition) / 2),
      reason: d.constraints >= 7 ? "Clear constraints defined" : d.constraints >= 4 ? "Some constraints, could be more explicit" : "No constraints or scope boundaries",
    },
    {
      key: "acceptance", label: "Acceptance criteria", score: Math.round((d.acceptanceCriteria + d.expectedOutput + d.verificationInstructions) / 3),
      reason: d.acceptanceCriteria >= 7 ? "Clear definition of done" : d.acceptanceCriteria >= 4 ? "Some acceptance criteria" : "No way to verify the task is done",
    },
    {
      key: "scope", label: "Scope", score: d.scopeDefinition,
      reason: d.scopeDefinition >= 7 ? "Well-scoped, single task" : d.scopeDefinition >= 4 ? "Scope could be tighter" : "Multiple tasks mixed or scope too broad",
    },
    {
      key: "ambiguity", label: "Ambiguity", score: d.ambiguity,
      reason: d.ambiguity >= 7 ? "Clear and unambiguous" : d.ambiguity >= 4 ? "Some vague language" : "Very vague ('fix it', 'make it better', 'everything')",
    },
    {
      key: "efficiency", label: "Efficiency",
      score: computeEfficiencyScore(outcome),
      reason: outcomeEfficiencyReason(outcome),
    },
    {
      key: "reuse", label: "Reuse",
      score: computeReuseScore(assessment.prompt),
      reason: computeReuseReason(assessment.prompt),
    },
  ];

  // Weighted overall
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of SCORING_DIMENSIONS) {
    const s = scores.find((sc) => sc.key === dim.key);
    if (s) {
      weightedSum += s.score * dim.weight;
      totalWeight += dim.weight;
    }
  }
  const overallScore = totalWeight > 0 ? Math.round((weightedSum / (totalWeight * 10)) * 100) : 0;

  // Outcome notes
  const outcomeNotes: string[] = [];
  if (outcome) {
    if (outcome.followedByCorrection) outcomeNotes.push("Followed by a correction prompt — the result wasn't what you wanted");
    if (outcome.failedToolCalls > 0) outcomeNotes.push(`${outcome.failedToolCalls} tool call(s) failed during this task`);
    if (outcome.filesReRead > 0) outcomeNotes.push(`${outcome.filesReRead} file(s) re-read — could have been avoided with better context`);
    if (outcome.subagentsSpawned > 2) outcomeNotes.push(`${outcome.subagentsSpawned} subagents spawned — consider if the task was too broad`);
  }

  return {
    overallScore,
    dimensions: scores,
    missingRequirements: assessment.missingRequirements,
    suggestedImprovements: assessment.suggestedImprovements,
    outcomeNotes,
  };
}

function computeEfficiencyScore(outcome?: PromptOutcome | null): number {
  if (!outcome) return 5; // neutral without data
  let score = 7; // baseline
  if (outcome.failedToolCalls > 0) score -= Math.min(3, outcome.failedToolCalls);
  if (outcome.followedByCorrection) score -= 2;
  if (outcome.filesReRead > 2) score -= 1;
  if (outcome.toolCalls > 30) score -= 1; // very many tool calls
  return Math.max(0, Math.min(10, score));
}

function outcomeEfficiencyReason(outcome?: PromptOutcome | null): string {
  if (!outcome) return "No outcome data available (heuristic)";
  if (outcome.followedByCorrection && outcome.failedToolCalls > 0) return "Correction needed + failures — prompt was unclear";
  if (outcome.followedByCorrection) return "Required a correction prompt — result wasn't right";
  if (outcome.failedToolCalls > 2) return `${outcome.failedToolCalls} failures — prompt may have been ambiguous`;
  if (outcome.toolCalls > 30) return "Many tool calls — task may be too broad for one prompt";
  return "Task completed efficiently";
}

/** Detect boilerplate that should be in CLAUDE.md */
const REUSE_PATTERNS = [
  /always use typescript/i,
  /use pnpm not npm/i,
  /don't add comments/i,
  /keep it simple/i,
  /follow the existing style/i,
  /no console\.log/i,
  /use.*testing.*framework/i,
  /prefer.*over/i,
];

function computeReuseScore(prompt: string): number {
  const boilerplateCount = REUSE_PATTERNS.filter((p) => p.test(prompt)).length;
  if (boilerplateCount >= 3) return 3; // lots of repeated instructions
  if (boilerplateCount >= 1) return 6;
  return 8; // no boilerplate detected
}

function computeReuseReason(prompt: string): string {
  const found = REUSE_PATTERNS.filter((p) => p.test(prompt));
  if (found.length >= 3) return `${found.length} repeated instructions that belong in CLAUDE.md`;
  if (found.length >= 1) return "Some instructions could go in CLAUDE.md";
  return "No repeated boilerplate detected";
}

/** Generate coaching tips based on patterns across multiple prompts. */
export function generateCoachingTips(scores: EnhancedPromptScore[], outcomes: PromptOutcome[]): string[] {
  const tips: string[] = [];
  if (scores.length < 3) return ["Send more prompts to get personalized coaching tips"];

  // Count low-scoring dimensions
  const dimCounts: Record<string, number> = {};
  for (const s of scores) {
    for (const d of s.dimensions) {
      if (d.score < 5) dimCounts[d.key] = (dimCounts[d.key] ?? 0) + 1;
    }
  }

  const total = scores.length;
  if ((dimCounts.context ?? 0) > total * 0.5) {
    tips.push(`${dimCounts.context}/${total} prompts lacked file paths or context — include them to avoid search calls`);
  }
  if ((dimCounts.scope ?? 0) > total * 0.4) {
    tips.push(`${dimCounts.scope}/${total} prompts mixed multiple tasks — split them for better results`);
  }
  if ((dimCounts.acceptance ?? 0) > total * 0.5) {
    tips.push(`${dimCounts.acceptance}/${total} prompts had no acceptance criteria — add "done when..." to save retries`);
  }

  const correctionRate = outcomes.filter((o) => o.followedByCorrection).length;
  if (correctionRate > total * 0.3) {
    tips.push(`${correctionRate}/${total} prompts needed corrections — be more specific upfront`);
  }

  if (tips.length === 0) tips.push("Your prompts are looking good! Keep including context and clear goals.");
  return tips.slice(0, 3);
}
