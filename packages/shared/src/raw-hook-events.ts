import { z } from "zod";

/**
 * Schemas follow docs/hook-events.md. Keep them loose (passthrough) — Claude
 * Code hook payloads evolve across versions and we must never drop or reject
 * an event just because it carries an unrecognized field or event name.
 */

export const PermissionModeSchema = z.enum([
  "default",
  "plan",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions"
]);

export const HookCommonFieldsSchema = z
  .object({
    session_id: z.string(),
    prompt_id: z.string().optional(),
    transcript_path: z.string().optional(),
    cwd: z.string().optional(),
    scratchpad_dir: z.string().optional(),
    permission_mode: PermissionModeSchema.optional(),
    hook_event_name: z.string(),
    agent_id: z.string().optional(),
    agent_type: z.string().optional()
  })
  .passthrough();

/** What Claude Code actually sends a hook command/HTTP endpoint on stdin/POST body. */
export const RawHookPayloadSchema = HookCommonFieldsSchema;
export type RawHookPayload = z.infer<typeof RawHookPayloadSchema>;

/**
 * What our hook script forwards to the collector: the raw payload plus a
 * timestamp it injects itself, because no hook event carries one natively
 * (see docs/hook-events.md §2 — timestamp is absent from the common fields).
 */
export const HookEventEnvelopeSchema = RawHookPayloadSchema.extend({
  timestamp: z.string()
});
export type HookEventEnvelope = z.infer<typeof HookEventEnvelopeSchema>;

// --- Per-event detail schemas, used by the normalizer for typed extraction.
// All are best-effort: if `.safeParse` fails, the normalizer falls back to
// treating the event as an untyped "other" event rather than rejecting it.

export const SessionStartDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("SessionStart"),
  source: z.enum(["startup", "resume", "clear", "compact", "fork"]).optional()
});

export const SessionEndDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("SessionEnd"),
  reason: z.enum(["clear", "resume", "logout", "prompt_input_exit", "other"]).optional()
});

export const UserPromptSubmitDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("UserPromptSubmit"),
  prompt: z.string().optional()
});

export const PreToolUseDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("PreToolUse"),
  tool_name: z.string(),
  tool_input: z.unknown().optional(),
  tool_use_id: z.string().optional()
});

export const PostToolUseDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("PostToolUse"),
  tool_name: z.string(),
  tool_input: z.unknown().optional(),
  tool_output: z.unknown().optional(),
  tool_use_id: z.string().optional(),
  error: z.unknown().optional()
});

export const PostToolUseFailureDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("PostToolUseFailure"),
  tool_name: z.string(),
  tool_input: z.unknown().optional(),
  tool_use_id: z.string().optional(),
  error: z.unknown().optional()
});

export const SubagentStartDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("SubagentStart"),
  agent_id: z.string(),
  agent_type: z.string(),
  agent_name: z.string().optional(),
  task_description: z.string().optional()
});

export const SubagentStopDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("SubagentStop"),
  agent_id: z.string(),
  agent_type: z.string(),
  exit_reason: z.string().optional(),
  last_assistant_message: z.string().optional()
});

export const NotificationDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("Notification"),
  notification_type: z.string().optional(),
  message: z.string().optional()
});

export const StopDetailSchema = HookCommonFieldsSchema.extend({
  hook_event_name: z.literal("Stop"),
  last_assistant_message: z.string().optional(),
  stop_hook_active: z.boolean().optional()
});

export const V1_SCOPE_EVENT_NAMES = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
  "Notification",
  "Stop"
] as const;

export type V1ScopeEventName = (typeof V1_SCOPE_EVENT_NAMES)[number];
