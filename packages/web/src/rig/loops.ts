import type { ActivityLoop } from "./types.js";

export const ACTIVITY_LOOPS: ActivityLoop[] = ["typing", "reading", "listening", "thinking", "supervising", null];

export const ACTIVITY_LOOP_LABELS: Record<string, string> = {
  typing: "Typing (forearms alternate, keys light up, monitor scrolls)",
  reading: "Reading (looks down at a book, turns a page every few seconds)",
  listening: "Listening (headphones, slight head bob)",
  thinking: "Thinking (looks up and to the side, taps chin)",
  supervising: "Supervising (glances between monitor and worker desks, nods)",
  none: "None (idle only)"
};
