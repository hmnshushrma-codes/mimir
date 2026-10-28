import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { HookEventEnvelope, WorkshopModel } from "@agent-workshop/shared";

const SubagentMetaSchema = z.object({
  agentType: z.string().optional(),
  description: z.string().optional(),
  toolUseId: z.string().optional(),
  spawnDepth: z.number().optional()
});

/**
 * Candidate on-disk locations for a subagent's `agent-<id>.meta.json`, per
 * the empirical layout documented in docs/hook-events.md §4:
 *
 *   <projectDir>/<sessionId>.jsonl              (main transcript)
 *   <projectDir>/<sessionId>/subagents/agent-<agentId>.meta.json
 *
 * We don't know for certain whether a SubagentStart event's `transcript_path`
 * points at the main transcript or at the subagent's own transcript file
 * (docs/hook-events.md §7, open question 1), so we derive both candidates
 * and try each.
 */
export function candidateMetaPaths(transcriptPath: string, agentId: string): string[] {
  const fileName = `agent-${agentId}.meta.json`;
  const candidates: string[] = [];

  if (transcriptPath.includes(`${path.sep}subagents${path.sep}`)) {
    // transcript_path already looks like .../<sessionId>/subagents/agent-<x>.jsonl
    const sessionDir = path.dirname(path.dirname(transcriptPath));
    candidates.push(path.join(sessionDir, "subagents", fileName));
  }

  // transcript_path looks like .../<projectDir>/<sessionId>.jsonl
  const projectDir = path.dirname(transcriptPath);
  const sessionId = path.basename(transcriptPath, ".jsonl");
  candidates.push(path.join(projectDir, sessionId, "subagents", fileName));

  return candidates;
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
