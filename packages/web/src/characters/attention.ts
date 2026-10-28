import type { Mood } from "@agent-workshop/shared";

/** Lower = more urgent. Mirrors the brief's ordering: waiting for permission
 *  -> error -> working -> idle (proud/neutral/sleepy trail behind "working"
 *  since there's nothing actionable about a mood that isn't itself a
 *  request for attention). */
const MOOD_RANK: Record<Mood, number> = {
  worried: 0,
  dizzy: 1,
  frustrated: 1,
  excited: 2,
  concentrating: 2,
  focused: 2,
  proud: 3,
  neutral: 3,
  sleepy: 4
};

export function worstMoodRank(moods: Mood[]): number {
  if (moods.length === 0) return 5;
  return Math.min(...moods.map((m) => MOOD_RANK[m]));
}

export function sortByAttention<T>(items: T[], moodsOf: (item: T) => Mood[]): T[] {
  return [...items].sort((a, b) => worstMoodRank(moodsOf(a)) - worstMoodRank(moodsOf(b)));
}
