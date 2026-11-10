/**
 * Part 3: Intelligence Layer — Shared Data Contracts
 *
 * These types define the analytics, telemetry, token accounting, cost,
 * prompt intelligence, knowledge, and permission tracking models.
 *
 * DATA AVAILABILITY NOTE:
 * Token counts and model names are NOT present in Claude Code hook payloads.
 * Any type field that depends on this data is marked with DataAvailability
 * to distinguish measured, estimated, and unavailable values.
 * See: https://github.com/hmnshushrma-codes/mimir/issues/5
 */

import type { ActionCategory } from "./categories.js";
import type { DisplayState } from "./display-state.js";

// ─── Data availability ──────────────────────────────────────────────

/** Every analytics value that may not be directly measurable from hooks
 *  carries an availability tag so the UI never shows a guess as a fact. */
export type DataAvailability = "measured" | "estimated" | "unavailable";

export interface MaybeAvailable<T> {
  value: T;
  availability: DataAvailability;
  /** Where the value came from — e.g. "hook_event", "transcript", "pricing_table". */
  source: string;
}

// ─── Token usage ────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: MaybeAvailable<number>;
  outputTokens: MaybeAvailable<number>;
  cacheCreationTokens: MaybeAvailable<number>;
  cacheReadTokens: MaybeAvailable<number>;
}

export const EMPTY_TOKEN_USAGE: TokenUsage = {
  inputTokens: { value: 0, availability: "unavailable", source: "none" },
  outputTokens: { value: 0, availability: "unavailable", source: "none" },
  cacheCreationTokens: { value: 0, availability: "unavailable", source: "none" },
  cacheReadTokens: { value: 0, availability: "unavailable", source: "none" },
};

// ─── Cost intelligence ──────────────────────────────────────────────

export interface ModelPricing {
  provider: string;
  model: string;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  cacheCreationPricePerMToken: number;
  cacheReadPricePerMToken: number;
  currency: string;
  effectiveDate: string;
  source: string;
}

export interface CostBreakdown {
  inputCost: MaybeAvailable<number>;
  outputCost: MaybeAvailable<number>;
  cacheCost: MaybeAvailable<number>;
  totalCost: MaybeAvailable<number>;
  currency: string;
  model: string | null;
}

// ─── Session analytics ──────────────────────────────────────────────

export interface SessionAnalytics {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  agentCount: number;
  subagentCount: number;
  toolCallCount: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  permissionRequests: number;
  /** Prompt text from UserPromptSubmit, if captured. */
  prompt: string | null;
  tokenUsage: TokenUsage;
  cost: CostBreakdown | null;
}

// ─── Tool execution analytics ───────────────────────────────────────

export interface ToolCallAnalytics {
  toolUseId: string;
  sessionId: string;
  agentId: string;
  toolName: string;
  category: ActionCategory;
  status: "running" | "succeeded" | "failed";
  target: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  /** True if this call was a retry of a previously failed call to the same tool+target. */
  isRetry: boolean;
}

export interface ToolSummary {
  toolName: string;
  category: ActionCategory;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
  minDurationMs: number | null;
}

// ─── Agent performance analytics ────────────────────────────────────

export interface AgentAnalytics {
  agentId: string;
  sessionId: string;
  agentType: string | null;
  taskDescription: string | null;
  parentAgentId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  toolCallCount: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  /** Time spent in each display state (ms). */
  stateTimeline: Partial<Record<DisplayState, number>>;
  tokenUsage: TokenUsage;
}

// ─── Token waste detection ──────────────────────────────────────────

export type WasteConfidence = "confirmed" | "probable" | "potential" | "insufficient";

export type WasteCategory =
  | "repeated_tool_call"
  | "redundant_file_read"
  | "failed_retry"
  | "duplicate_subagent_work"
  | "abandoned_execution"
  | "excessive_output"
  | "repeated_instructions";

export interface WasteFinding {
  id: string;
  sessionId: string;
  category: WasteCategory;
  confidence: WasteConfidence;
  description: string;
  affectedAgentId: string | null;
  /** Evidence — e.g. the tool_use_ids of the repeated calls. */
  evidence: string[];
  estimatedWastedTokens: MaybeAvailable<number>;
  estimatedWastedCost: MaybeAvailable<number>;
}

// ─── Prompt quality intelligence ────────────────────────────────────

/** 10 scoring dimensions from the spec. Each 0–10. */
export interface PromptQualityDimensions {
  objectiveClarity: number;
  taskSpecificity: number;
  contextCompleteness: number;
  scopeDefinition: number;
  constraints: number;
  expectedOutput: number;
  acceptanceCriteria: number;
  ambiguity: number;        // inverted: 10 = no ambiguity
  technicalContext: number;
  verificationInstructions: number;
}

export interface PromptAssessment {
  sessionId: string;
  prompt: string;
  overallScore: number;   // 0–100, weighted sum
  dimensions: PromptQualityDimensions;
  missingRequirements: string[];
  ambiguities: string[];
  executionRisks: string[];
  /** Never auto-generated without opt-in. */
  suggestedImprovements: string[];
}

// ─── Knowledge intelligence ─────────────────────────────────────────

export type KnowledgeSourceType =
  | "claude_md"
  | "project_instructions"
  | "frequently_accessed_file"
  | "user_correction"
  | "documentation";

export interface KnowledgeItem {
  id: string;
  type: KnowledgeSourceType;
  path: string | null;
  description: string;
  firstSeen: string;
  accessCount: number;
}

export interface KnowledgeGap {
  id: string;
  sessionId: string;
  description: string;
  evidence: string[];
  /** The kind of gap: missing docs, outdated guidance, repeated rediscovery. */
  gapType: "missing_documentation" | "outdated_guidance" | "repeated_rediscovery" | "recurring_error" | "missing_rule";
  recommendation: string;
  /** Never modify files without this being explicitly approved. */
  requiresApproval: true;
}

// ─── Permission tracking ────────────────────────────────────────────

export type PermissionDecision = "approved" | "denied" | "cancelled" | "expired" | "pending";

export interface PermissionEvent {
  id: string;
  sessionId: string;
  agentId: string;
  toolName: string | null;
  /** The command or input that triggered the permission request. */
  commandPreview: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decision: PermissionDecision;
  waitingDurationMs: number | null;
  /** "permission" = tool execution approval, "user_input" = AskUserQuestion. */
  requestType: "permission" | "user_input";
}

// ─── Session timeline ───────────────────────────────────────────────

export type TimelineEventType =
  | "session_start"
  | "prompt"
  | "agent_spawn"
  | "agent_stop"
  | "tool_start"
  | "tool_end"
  | "tool_failure"
  | "permission_request"
  | "permission_decision"
  | "notification"
  | "session_end";

export interface TimelineEvent {
  id: string;
  sessionId: string;
  agentId: string;
  type: TimelineEventType;
  timestamp: string;
  label: string;
  detail: string | null;
  /** For tool events, the category. */
  category: ActionCategory | null;
  durationMs: number | null;
}

// ─── Session comparison ─────────────────────────────────────────────

export interface SessionComparisonMetrics {
  sessionId: string;
  prompt: string | null;
  durationMs: number | null;
  agentCount: number;
  toolCallCount: number;
  failedToolCalls: number;
  retryCount: number;
  permissionRequests: number;
  tokenUsage: TokenUsage;
  cost: CostBreakdown | null;
  promptScore: number | null;
  wasteFindings: number;
}

export interface SessionComparison {
  sessions: [SessionComparisonMetrics, SessionComparisonMetrics];
}

// ─── Aggregated dashboard metrics ───────────────────────────────────

export interface DashboardMetrics {
  totalSessions: number;
  totalAgents: number;
  totalToolCalls: number;
  totalDurationMs: number;
  avgSessionDurationMs: number | null;
  avgTaskDurationMs: number | null;
  completedTasks: number;
  failedTasks: number;
  tokenUsage: TokenUsage;
  totalCost: MaybeAvailable<number>;
  /** When these metrics were computed. */
  computedAt: string;
}
