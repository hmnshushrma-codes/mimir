import type { ActionCategory } from "./categories.js";
import { categorizeTool } from "./categories.js";
import type { AgentEvent } from "./agent-state.js";
import type { HookEventEnvelope } from "./raw-hook-events.js";
import {
  NotificationDetailSchema,
  PostToolUseDetailSchema,
  PostToolUseFailureDetailSchema,
  PreToolUseDetailSchema,
  SessionEndDetailSchema,
  StopDetailSchema,
  SubagentStartDetailSchema,
  SubagentStopDetailSchema,
  UserPromptSubmitDetailSchema
} from "./raw-hook-events.js";

/** Synthetic agent id used for the top-level (non-subagent) session. */
export const MAIN_AGENT_ID = "main";

export interface WorkshopEvent {
  sessionId: string;
  agentId: string;
  agentType: string | null;
  hookEventName: string;
  category: ActionCategory;
  toolName: string | null;
  toolUseId: string | null;
  target: string | null;
  timestamp: string;
  raw: HookEventEnvelope;
}

function fileLikeTarget(toolInput: unknown): string | null {
  if (!toolInput || typeof toolInput !== "object") return null;
  const input = toolInput as Record<string, unknown>;
  for (const key of ["file_path", "path", "notebook_path", "pattern", "command", "url", "query", "prompt", "description"]) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/** Best-effort "what is this agent doing" hint for hover/debug display. */
export function extractTarget(toolName: string | null, toolInput: unknown): string | null {
  if (!toolName) return null;
  return fileLikeTarget(toolInput);
}

/**
 * Strips system-injected XML tags (e.g. `<task-notification>...</task-notification>`,
 * `<system-reminder>...</system-reminder>`) from user prompts. These appear when
 * a prompt originates from a background-task resumption rather than a literal
 * user-typed message, and should never leak into the UI.
 */
export function stripSystemMessages(text: string | null): string | null {
  if (!text) return null;
  // Remove all XML-style system tags and their content (greedy within each tag pair)
  const cleaned = text
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeToWorkshopEvent(envelope: HookEventEnvelope): WorkshopEvent {
  const agentId = envelope.agent_id ?? MAIN_AGENT_ID;
  const agentType = envelope.agent_type ?? null;

  let toolName: string | null = null;
  let toolUseId: string | null = null;
  let toolInput: unknown = undefined;

  const pre = PreToolUseDetailSchema.safeParse(envelope);
  const post = PostToolUseDetailSchema.safeParse(envelope);
  const failure = PostToolUseFailureDetailSchema.safeParse(envelope);

  if (pre.success) {
    toolName = pre.data.tool_name;
    toolUseId = pre.data.tool_use_id ?? null;
    toolInput = pre.data.tool_input;
  } else if (post.success) {
    toolName = post.data.tool_name;
    toolUseId = post.data.tool_use_id ?? null;
    toolInput = post.data.tool_input;
  } else if (failure.success) {
    toolName = failure.data.tool_name;
    toolUseId = failure.data.tool_use_id ?? null;
    toolInput = failure.data.tool_input;
  }

  let target = extractTarget(toolName, toolInput);
  if (target === null && envelope.hook_event_name === "UserPromptSubmit") {
    const prompt = UserPromptSubmitDetailSchema.safeParse(envelope);
    target = prompt.success ? stripSystemMessages(prompt.data.prompt ?? null) : null;
  }
  if (target === null && envelope.hook_event_name === "Notification") {
    const notification = NotificationDetailSchema.safeParse(envelope);
    if (notification.success) {
      target = notification.data.message ?? notification.data.notification_type ?? null;
    }
  }

  return {
    sessionId: envelope.session_id,
    agentId,
    agentType,
    hookEventName: envelope.hook_event_name,
    category: categorizeTool(toolName),
    toolName,
    toolUseId,
    target,
    timestamp: envelope.timestamp,
    raw: envelope
  };
}

/**
 * Maps a raw hook envelope to the domain event that drives the per-agent
 * state machine (see agent-state.ts). Returns null for events that don't
 * change an agent's lifecycle (they're still recorded as WorkshopEvents for
 * the debug timeline, just not fed into the state machine).
 */
export function deriveAgentEvent(envelope: HookEventEnvelope): AgentEvent | null {
  const at = envelope.timestamp;

  switch (envelope.hook_event_name) {
    case "SessionStart":
      return { type: "SPAWNED", at };

    case "SubagentStart": {
      const parsed = SubagentStartDetailSchema.safeParse(envelope);
      if (!parsed.success) return null;
      return { type: "SPAWNED", at };
    }

    case "PreToolUse": {
      const parsed = PreToolUseDetailSchema.safeParse(envelope);
      if (!parsed.success) return null;
      return { type: "TOOL_STARTED", category: categorizeTool(parsed.data.tool_name), at };
    }

    case "PostToolUse": {
      const parsed = PostToolUseDetailSchema.safeParse(envelope);
      if (!parsed.success) return null;
      return { type: "TOOL_SUCCEEDED", at };
    }

    case "PostToolUseFailure": {
      const parsed = PostToolUseFailureDetailSchema.safeParse(envelope);
      const error = parsed.success && parsed.data.error != null ? String(parsed.data.error) : null;
      return { type: "TOOL_FAILED", error, at };
    }

    case "Notification": {
      const parsed = NotificationDetailSchema.safeParse(envelope);
      if (parsed.success && parsed.data.notification_type === "permission_prompt") {
        return { type: "PERMISSION_REQUIRED", at };
      }
      return null;
    }

    case "SubagentStop": {
      const parsed = SubagentStopDetailSchema.safeParse(envelope);
      if (!parsed.success) return null;
      return { type: "STOPPED", at };
    }

    case "Stop": {
      const parsed = StopDetailSchema.safeParse(envelope);
      if (!parsed.success) return null;
      return { type: "STOPPED", at };
    }

    case "SessionEnd": {
      const parsed = SessionEndDetailSchema.safeParse(envelope);
      if (!parsed.success) return null;
      return { type: "STOPPED", at };
    }

    default:
      return null;
  }
}
