import { useEffect, useRef, useState } from "react";
import { searchEvents, type SearchResult } from "../data/search.js";

const DEBOUNCE_MS = 300;

function timeOf(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

export function SearchPanel({ onOpenSession }: { onOpenSession: (sessionId: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      searchEvents(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="panel search-panel">
      <div className="panel-header">Search session history</div>
      <div className="filters">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tool calls, commands, files..."
          className="search-input"
        />
        {searching && <span className="muted">Searching...</span>}
      </div>
      {query.trim() && (
        <div className="panel-body">
          {results.length === 0 && !searching && <div className="muted search-empty">No matches</div>}
          {results.map((r) => (
            <div className="event-row search-result-row" key={r.id} onClick={() => onOpenSession(r.sessionId)}>
              <span className="muted">{timeOf(r.timestamp)}</span>
              <span>{r.agentId}</span>
              <span>{r.hookEventName}</span>
              <span>{r.toolName ?? "—"}</span>
              <span className="tool-call-target">{r.target ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
