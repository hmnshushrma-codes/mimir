import { useMemo } from "react";
import { useNow } from "./useNow.js";

export type TimeOfDay = "morning" | "day" | "evening" | "night";

/** Boundary hours — keep in one place for easy adjustment. */
const DAY_START = 6;
const NIGHT_START = 18;

/** Maps system hour to a time-of-day for lighting effects. */
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= DAY_START && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < NIGHT_START + 3) return "evening";
  return "night";
}

/** Simple day/night check for lamp control. */
export function isDaytime(hour: number): boolean {
  return hour >= DAY_START && hour < NIGHT_START;
}

/** Returns current time-of-day, updating every minute.
 *  Supports `?time=day|night|morning|evening` URL override for dev testing. */
export function useTimeOfDay(): TimeOfDay {
  const nowMs = useNow();
  return useMemo(() => {
    // Dev override via URL param
    if (typeof window !== "undefined") {
      const override = new URLSearchParams(window.location.search).get("time");
      if (override === "day" || override === "night" || override === "morning" || override === "evening") {
        return override;
      }
    }
    const hour = new Date(nowMs).getHours();
    return getTimeOfDay(hour);
  }, [Math.floor(nowMs / 60_000)]);
}

/** Returns true if it's daytime. Supports ?time= override. */
export function useIsDaytime(): boolean {
  const tod = useTimeOfDay();
  return tod === "day" || tod === "morning";
}
