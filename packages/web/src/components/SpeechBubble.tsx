import { truncate } from "../lib/text.js";

export function SpeechBubble({ text, maxLen = 90 }: { text: string; maxLen?: number }) {
  return <div className="speech-bubble">{truncate(text, maxLen)}</div>;
}
