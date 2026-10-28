import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";

/**
 * A hanging wooden sign showing the project name — displayed above desk areas
 * that share the same project.
 */
export function ProjectSign({ name, color }: { name: string; color: string }) {
  const isDark = usePrefersDarkMode();
  const board = isDark ? "#3a3228" : "#b89870";
  const boardStroke = isDark ? "#4a4238" : "#9e7e5a";
  const chain = isDark ? "#555" : "#888";
  const textColor = isDark ? "#e0d8cc" : "#3a2a18";

  return (
    <div className="project-sign">
      <svg width="200" height="50" viewBox="0 0 200 50">
        {/* Chains */}
        <line x1="40" y1="0" x2="40" y2="12" stroke={chain} strokeWidth="2" />
        <line x1="160" y1="0" x2="160" y2="12" stroke={chain} strokeWidth="2" />
        {/* Board */}
        <rect x="10" y="10" width="180" height="32" rx="4" fill={board} stroke={boardStroke} strokeWidth="1.5" />
        {/* Accent stripe */}
        <rect x="14" y="38" width="172" height="3" rx="1.5" fill={color} opacity="0.5" />
        {/* Text */}
        <text x="100" y="31" textAnchor="middle" fill={textColor} fontSize="13" fontWeight="700" fontFamily="sans-serif">
          {name.length > 22 ? name.slice(0, 21) + "\u2026" : name}
        </text>
      </svg>
    </div>
  );
}
