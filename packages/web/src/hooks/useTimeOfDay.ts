import { useMemo } from "react";
import { useNow } from "./useNow.js";

export type TimeOfDay = "morning" | "day" | "evening" | "night";

/** Maps system hour to a time-of-day for lighting effects. */
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Returns current time-of-day, updating every minute. */
export function useTimeOfDay(): TimeOfDay {
  const nowMs = useNow();
  return useMemo(() => {
    const hour = new Date(nowMs).getHours();
    return getTimeOfDay(hour);
  }, [Math.floor(nowMs / 60_000)]); // recalc every minute
}
