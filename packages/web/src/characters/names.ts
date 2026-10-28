import { hashString } from "./palette.js";

const NAME_POOL = [
  "Pip",
  "Rune",
  "Fig",
  "Milo",
  "Nia",
  "Otto",
  "Juno",
  "Remy",
  "Teal",
  "Wisp",
  "Dash",
  "Coda",
  "Bolt",
  "Nova",
  "Finn",
  "Zephyr",
  "Echo",
  "Pixel",
  "Spruce",
  "Bramble"
];

export function nameFor(seed: string): string {
  return NAME_POOL[hashString(seed) % NAME_POOL.length];
}

/** "Worker #3 · Pip" per the brief's naming example. */
export function workerLabel(agentId: string, ordinal: number): string {
  return `Worker #${ordinal} · ${nameFor(agentId)}`;
}
