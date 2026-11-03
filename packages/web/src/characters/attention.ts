import { DISPLAY_STATES, type DisplayState } from "@agent-workshop/shared";

const STATE_RANK: Record<DisplayState, number> = Object.fromEntries(
  DISPLAY_STATES.map((state, index) => [state, index])
) as Record<DisplayState, number>;

export function worstStateRank(states: DisplayState[]): number {
  if (states.length === 0) return DISPLAY_STATES.length;
  return Math.min(...states.map((s) => STATE_RANK[s]));
}

export function sortByAttention<T>(items: T[], statesOf: (item: T) => DisplayState[]): T[] {
  return [...items].sort((a, b) => worstStateRank(statesOf(a)) - worstStateRank(statesOf(b)));
}
