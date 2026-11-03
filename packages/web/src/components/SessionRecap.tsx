import { useEffect, useState } from "react";
import { fetchSessionRecap, generateSessionRecap } from "../data/recap.js";

type Status = "loading" | "idle" | "generating" | "error";

/** Splits a recap into bullet lines. Falls back to treating the whole text
 *  as one bullet for recaps generated before bullet-formatting was added. */
function recapBullets(recap: string): string[] {
  const lines = recap
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [recap];
}

export function SessionRecap({ sessionId }: { sessionId: string }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSessionRecap(sessionId)
      .then((result) => {
        if (cancelled) return;
        setRecap(result?.recap ?? null);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleGenerate = async () => {
    setStatus("generating");
    setError(null);
    try {
      const result = await generateSessionRecap(sessionId);
      setRecap(result.recap);
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  };

  if (status === "loading") return null;

  return (
    <div className="session-recap" onClick={(e) => e.stopPropagation()}>
      {recap && (
        <ul className="session-recap-text">
          {recapBullets(recap).map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      )}
      <button className="session-recap-button" onClick={handleGenerate} disabled={status === "generating"}>
        {status === "generating" ? "Generating..." : recap ? "Regenerate recap" : "Generate recap"}
      </button>
      {status === "error" && <span className="session-recap-error">{error}</span>}
    </div>
  );
}
