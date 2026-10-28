export function FilterChips({
  projects,
  activeFilter,
  onSelect
}: {
  projects: Array<{ id: string; name: string }>;
  activeFilter: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="filter-chips">
      <button className={`chip ${activeFilter === null ? "active" : ""}`} onClick={() => onSelect(null)}>
        All
      </button>
      {projects.map((p) => (
        <button key={p.id} className={`chip ${activeFilter === p.id ? "active" : ""}`} onClick={() => onSelect(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
