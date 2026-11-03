import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { HookEventEnvelope, WorkshopModel } from "@agent-workshop/shared";

/**
 * IMPORTANT — this file resolves PARENT LINKAGE ONLY (who spawned whom), not
 * event ownership. Event ownership (which agent a given hook event belongs
 * to) is already fully solved elsewhere: every hook event carries its own
 * `agent_id`, and `WorkshopModel.getOrCreateAgent()` (packages/shared/src/model.ts)
 * uses that `agent_id` as the sole key for creating/looking up the agent
 * record — there is no ambiguity or fallback involved in that path.
 *
 * What's genuinely uncertain is which agent *delegated* to a given subagent.
 * `WorkshopModel` resolves that with two layers:
 *   1. A live FIFO heuristic (`trackDelegation`/`claimDelegation` in model.ts):
 *      pairs a delegate-category `PreToolUse` with the next `SubagentStart`
 *      in the same session. Works immediately, no filesystem access, but is
 *      only a heuristic (wrong if calls interleave unexpectedly).
 *   2. This file's async enrichment: reads the subagent's own
 *      `agent-<id>.meta.json`, which names the exact `tool_use_id` that
 *      spawned it, and upgrades the heuristic pairing to "confirmed" via
 *      `WorkshopModel.confirmDelegation()`. Fire-and-forget — if the file
 *      can't be found or parsed, the heuristic pairing simply stands.
 */
const SubagentMetaSchema = z.object({
  agentType: z.string().optional(),
  description: z.string().optional(),
  toolUseId: z.string().optional(),
  spawnDepth: z.number().optional()
});

/**
 * On-disk location of a subagent's `agent-<id>.meta.json`:
 *   <projectDir>/<sessionId>/subagents/agent-<agentId>.meta.json
 *
 * Confirmed empirically (not just by the hook-events doc) by checking every
 * real `agent-*.meta.json` on this machine across 4 different projects
 * (including demo fixtures) — all matched this one shape. An earlier version
 * of this function also generated a second candidate for the case where
 * `transcript_path` already pointed inside a `subagents/` directory; zero
 * real occurrences of that shape were found, so it was removed. If a future
 * Claude Code version changes the on-disk layout, this is the first place
 * to look.
 */
export function candidateMetaPaths(transcriptPath: string, agentId: string): string[] {
  const fileName = `agent-${agentId}.meta.json`;
  const projectDir = path.dirname(transcriptPath);
  const sessionId = path.basename(transcriptPath, ".jsonl");
  return [path.join(projectDir, sessionId, "subagents", fileName)];
}

async function readSubagentMeta(transcriptPath: string, agentId: string) {
  for (const candidate of candidateMetaPaths(transcriptPath, agentId)) {
    try {
      const raw = await readFile(candidate, "utf-8");
      const parsed = SubagentMetaSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // best-effort: try the next candidate, or give up silently
    }
  }
  return null;
}

/**
 * Fire-and-forget enrichment: upgrades a heuristic parent/child pairing to
 * "confirmed" using the undocumented meta.json file, if present. Never
 * throws, never blocks the caller, and has no effect if the file can't be
 * found or parsed — the heuristic pairing from model.ts stands on its own.
 */
export function enrichSubagentCorrelation(
  model: WorkshopModel,
  envelope: HookEventEnvelope,
  onConfirmed: (sessionId: string, agentId: string) => void
): void {
  if (envelope.hook_event_name !== "SubagentStart") return;
  const transcriptPath = envelope.transcript_path;
  const agentId = envelope.agent_id;
  const sessionId = envelope.session_id;
  if (!transcriptPath || !agentId) return;

  void readSubagentMeta(transcriptPath, agentId).then((meta) => {
    if (!meta?.toolUseId) return;
    const parentAgentId = model.resolveParentByToolUseId(sessionId, meta.toolUseId);
    if (!parentAgentId) return;
    model.confirmDelegation(sessionId, agentId, parentAgentId, meta.description ?? null);
    onConfirmed(sessionId, agentId);
  });
}
