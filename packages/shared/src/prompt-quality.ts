/**
 * Prompt Quality Assessment — Part 3, Issue #13
 *
 * Deterministic, explainable prompt scoring across 10 dimensions.
 * No LLM required — uses pattern matching and structural analysis.
 * Prompt length ≠ quality.
 */

import type { PromptQualityDimensions, PromptAssessment } from "./analytics.js";

// ─── Scoring helpers ────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v)));
}

/** Count how many of the given patterns appear in the text. */
function patternCount(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

const WORD_COUNT = (t: string) => t.split(/\s+/).filter(Boolean).length;

// ─── 10 scoring dimensions ──────────────────────────────────────────

function scoreObjectiveClarity(prompt: string): number {
  // Does the prompt state what it wants done?
  const hasVerb = /\b(fix|add|create|build|implement|update|refactor|remove|delete|write|test|deploy|migrate|debug|review|check|analyze|configure|setup|install)\b/i.test(prompt);
  const hasTarget = /\b(bug|feature|file|function|component|test|page|api|endpoint|route|config|style|error|issue|module)\b/i.test(prompt);
  let score = 3; // baseline
  if (hasVerb) score += 3;
  if (hasTarget) score += 2;
  if (WORD_COUNT(prompt) >= 5) score += 1;
  if (WORD_COUNT(prompt) >= 15) score += 1;
  return clamp(score);
}

function scoreTaskSpecificity(prompt: string): number {
  // Are there specific file names, function names, or identifiers?
  const hasFilePath = /[\w/]+\.\w{1,5}\b/.test(prompt);
  const hasCodeRef = /`[^`]+`/.test(prompt) || /\b(function|class|method|variable|const|let|var)\s+\w+/.test(prompt);
  const hasNumbers = /\b\d+\b/.test(prompt);
  let score = 2;
  if (hasFilePath) score += 3;
  if (hasCodeRef) score += 3;
  if (hasNumbers) score += 1;
  if (WORD_COUNT(prompt) >= 20) score += 1;
  return clamp(score);
}

function scoreContextCompleteness(prompt: string): number {
  // Does it provide background context?
  const contextPatterns = [
    /\bbecause\b/i, /\bsince\b/i, /\bcurrently\b/i, /\bright now\b/i,
    /\bthe existing\b/i, /\bthe current\b/i, /\bwe have\b/i, /\bour\b/i,
    /\bstack\b/i, /\bframework\b/i, /\busing\b/i, /\bwith\b/i,
  ];
  const count = patternCount(prompt, contextPatterns);
  return clamp(2 + Math.min(count * 2, 8));
}

function scoreScopeDefinition(prompt: string): number {
  // Does it define what's in/out of scope?
  const scopePatterns = [
    /\bonly\b/i, /\bjust\b/i, /\bdon'?t\b/i, /\bdo not\b/i, /\bavoid\b/i,
    /\bwithout\b/i, /\bexclude\b/i, /\binclude\b/i, /\bscope\b/i,
    /\bfocus on\b/i, /\blimit\b/i, /\bspecifically\b/i,
  ];
  const count = patternCount(prompt, scopePatterns);
  return clamp(2 + Math.min(count * 2, 8));
}

function scoreConstraints(prompt: string): number {
  // Does it mention constraints, requirements, or limitations?
  const constraintPatterns = [
    /\bmust\b/i, /\bshould\b/i, /\brequire\b/i, /\bensure\b/i,
    /\bkeep\b/i, /\bmaintain\b/i, /\bpreserve\b/i, /\bcompatib/i,
    /\bperformance\b/i, /\bsecurity\b/i, /\bbackward/i,
  ];
  const count = patternCount(prompt, constraintPatterns);
  return clamp(2 + Math.min(count * 2, 8));
}

function scoreExpectedOutput(prompt: string): number {
  // Does it describe what the result should look like?
  const outputPatterns = [
    /\boutput\b/i, /\breturn\b/i, /\bproduce\b/i, /\bgenerate\b/i,
    /\bshould\s+(show|display|render|look|output|return|produce)/i,
    /\bexpect\b/i, /\bresult\b/i, /\bformat\b/i,
  ];
  const count = patternCount(prompt, outputPatterns);
  return clamp(2 + Math.min(count * 2, 8));
}

function scoreAcceptanceCriteria(prompt: string): number {
  // Does it define when the task is "done"?
  const criteriaPatterns = [
    /\btest(s|ing)?\s+(pass|green|succeed)/i, /\ball\s+tests?\b/i,
    /\bno\s+(error|warning|failure)/i, /\bverif/i, /\bconfirm\b/i,
    /\baccept/i, /\bcriteria\b/i, /\bdone\s+when\b/i,
    /\bsuccess\b/i, /\bcomplete\b/i,
  ];
  const count = patternCount(prompt, criteriaPatterns);
  return clamp(1 + Math.min(count * 2, 9));
}

function scoreAmbiguity(prompt: string): number {
  // Inverted: 10 = no ambiguity. High ambiguity = low score.
  const ambiguousPatterns = [
    /\bmaybe\b/i, /\bprobably\b/i, /\bi think\b/i, /\bsomething like\b/i,
    /\bkind of\b/i, /\bsort of\b/i, /\bwhatever\b/i, /\betc\.?\b/i,
    /\bstuff\b/i, /\bthings?\b/i, /\bsome\s+(way|how|thing)/i,
  ];
  const count = patternCount(prompt, ambiguousPatterns);
  // More ambiguous words → lower score
  return clamp(10 - count * 2);
}

function scoreTechnicalContext(prompt: string): number {
  // Does it mention technical details?
  const techPatterns = [
    /\b(typescript|javascript|python|rust|go|react|node|sql|css|html)\b/i,
    /\b(api|rest|graphql|http|websocket|grpc)\b/i,
    /\b(database|sqlite|postgres|redis|mongo)\b/i,
    /\b(npm|pnpm|yarn|pip|cargo)\b/i,
    /\b(docker|kubernetes|ci|cd|git)\b/i,
    /\b(component|hook|middleware|router|controller|service)\b/i,
  ];
  const count = patternCount(prompt, techPatterns);
  return clamp(2 + Math.min(count * 2, 8));
}

function scoreVerificationInstructions(prompt: string): number {
  // Does it tell the agent how to verify the result?
  const verifyPatterns = [
    /\brun\b/i, /\btest\b/i, /\bbuild\b/i, /\blint\b/i, /\btypecheck\b/i,
    /\bverif/i, /\bcheck\b/i, /\bconfirm\b/i, /\bvalidate\b/i,
    /\bscreenshot\b/i, /\bdemo\b/i, /\bmanual/i,
  ];
  const count = patternCount(prompt, verifyPatterns);
  return clamp(1 + Math.min(count * 2, 9));
}

// ─── Assessment ─────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<keyof PromptQualityDimensions, number> = {
  objectiveClarity: 2.0,
  taskSpecificity: 1.5,
  contextCompleteness: 1.0,
  scopeDefinition: 1.0,
  constraints: 1.0,
  expectedOutput: 1.0,
  acceptanceCriteria: 1.5,
  ambiguity: 1.0,
  technicalContext: 0.5,
  verificationInstructions: 0.5,
};

function computeOverallScore(dims: PromptQualityDimensions): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    weightedSum += dims[key as keyof PromptQualityDimensions] * weight;
    totalWeight += weight * 10; // max per dimension is 10
  }
  return Math.round((weightedSum / totalWeight) * 100);
}

function findMissingRequirements(dims: PromptQualityDimensions): string[] {
  const missing: string[] = [];
  if (dims.objectiveClarity < 5) missing.push("Clear objective: state what action to take");
  if (dims.taskSpecificity < 4) missing.push("Specifics: mention file names, functions, or identifiers");
  if (dims.acceptanceCriteria < 3) missing.push("Acceptance criteria: define when the task is done");
  if (dims.scopeDefinition < 3) missing.push("Scope boundaries: specify what to include/exclude");
  if (dims.expectedOutput < 3) missing.push("Expected output: describe what the result should look like");
  return missing;
}

function findAmbiguities(prompt: string, dims: PromptQualityDimensions): string[] {
  const ambiguities: string[] = [];
  if (dims.ambiguity < 6) ambiguities.push("Prompt contains vague language (maybe, probably, something like)");
  if (dims.objectiveClarity < 4 && dims.taskSpecificity < 4) ambiguities.push("Unclear what specific action is being requested");
  if (/\b(it|this|that)\b/i.test(prompt) && WORD_COUNT(prompt) < 10) ambiguities.push("Short prompt with pronouns — what does 'it' refer to?");
  return ambiguities;
}

function suggestImprovements(dims: PromptQualityDimensions, missing: string[]): string[] {
  const suggestions: string[] = [];
  if (missing.length > 0) {
    suggestions.push(...missing.map((m) => `Add: ${m}`));
  }
  if (dims.technicalContext < 4) suggestions.push("Mention the tech stack or framework being used");
  if (dims.verificationInstructions < 4) suggestions.push("Add verification steps (run tests, build, typecheck)");
  if (dims.constraints < 4) suggestions.push("Specify constraints (performance, compatibility, security)");
  return suggestions;
}

/** Assess prompt quality across 10 dimensions. Deterministic, no LLM. */
export function assessPrompt(sessionId: string, prompt: string): PromptAssessment {
  const dimensions: PromptQualityDimensions = {
    objectiveClarity: scoreObjectiveClarity(prompt),
    taskSpecificity: scoreTaskSpecificity(prompt),
    contextCompleteness: scoreContextCompleteness(prompt),
    scopeDefinition: scoreScopeDefinition(prompt),
    constraints: scoreConstraints(prompt),
    expectedOutput: scoreExpectedOutput(prompt),
    acceptanceCriteria: scoreAcceptanceCriteria(prompt),
    ambiguity: scoreAmbiguity(prompt),
    technicalContext: scoreTechnicalContext(prompt),
    verificationInstructions: scoreVerificationInstructions(prompt),
  };

  const overallScore = computeOverallScore(dimensions);
  const missingRequirements = findMissingRequirements(dimensions);
  const ambiguities = findAmbiguities(prompt, dimensions);

  return {
    sessionId,
    prompt,
    overallScore,
    dimensions,
    missingRequirements,
    ambiguities,
    executionRisks: ambiguities.length > 0 ? ["Ambiguous instructions may lead to unexpected implementation"] : [],
    suggestedImprovements: suggestImprovements(dimensions, missingRequirements),
  };
}
