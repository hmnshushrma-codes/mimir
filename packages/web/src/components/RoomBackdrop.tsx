import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { useTimeOfDay } from "../hooks/useTimeOfDay.js";

/**
 * Decorative room elements — pegboard, window, lamps. The wall/floor
 * colors come from CSS variables on .workshop-floor so they never break
 * at different screen sizes. This SVG only draws the furniture.
 */
export function RoomBackdrop() {
  const isDark = usePrefersDarkMode();
  const tod = useTimeOfDay();

  const pegboard = isDark ? "#252830" : "#d4cbbe";
  const pegHole = isDark ? "#1a1c22" : "#bfb5a4";
  const windowFrame = isDark ? "#353a45" : "#8b7355";

  // Time-based window sky
  const windowSky = isDark
    ? (tod === "day" ? "#4a7ab0" : tod === "morning" ? "#5a8ac0" : tod === "evening" ? "#a05530" : "#0d1020")
    : (tod === "day" ? "#a8d4f0" : tod === "morning" ? "#c0ddf5" : tod === "evening" ? "#e8945a" : "#1a2040");

  // Lamps: on at night/evening, off during day
  const lampsOn = tod === "night" || tod === "evening" || isDark;
  const lampBulb = lampsOn ? "#f5c842" : (isDark ? "#888" : "#ccc");
  const lampGlow = lampsOn ? 0.08 : 0;

  // Sunbeams: only day/morning in light theme
  const sunbeam = !isDark && (tod === "day" || tod === "morning") ? 0.06 : (isDark && tod === "day" ? 0.03 : 0);

  return (
    <div className="room-backdrop" aria-hidden="true">
      <svg className="room-backdrop-svg" viewBox="0 0 1400 180" preserveAspectRatio="xMidYMin meet">
        {/* Pegboard */}
        <rect x="100" y="15" width="240" height="80" rx="4" fill={pegboard} stroke={pegHole} strokeWidth="1" />
        {Array.from({ length: 5 }, (_, c) =>
          Array.from({ length: 3 }, (_, r) => (
            <circle key={`p${c}${r}`} cx={120 + c * 50} cy={30 + r * 24} r="3" fill={pegHole} />
          ))
        )}
        {/* Tool silhouettes */}
        <rect x="135" y="35" width="3" height="25" rx="1.5" fill={pegHole} opacity="0.5" transform="rotate(-12 136 47)" />
        <rect x="245" y="32" width="3" height="28" rx="1.5" fill={pegHole} opacity="0.5" transform="rotate(8 246 46)" />
        <rect x="290" y="38" width="3" height="22" rx="1.5" fill={pegHole} opacity="0.5" />
        <rect x="284" y="34" width="14" height="5" rx="2" fill={pegHole} opacity="0.5" />

        {/* Window */}
        <rect x="950" y="15" width="110" height="80" rx="3" fill={windowFrame} />
        <rect x="955" y="20" width="100" height="70" rx="2" fill={windowSky} />
        <line x1="1005" y1="20" x2="1005" y2="90" stroke={windowFrame} strokeWidth="3" />
        <line x1="955" y1="55" x2="1055" y2="55" stroke={windowFrame} strokeWidth="3" />

        {/* Sunbeam */}
        {sunbeam > 0 && (
          <polygon points="955,20 1055,20 1140,160 870,160" fill="#fff" opacity={sunbeam} />
        )}

        {/* Lamps */}
        {[400, 700, 1000].map((lx) => (
          <g key={lx}>
            <line x1={lx} y1="0" x2={lx} y2="10" stroke="#555" strokeWidth="1.5" />
            <path d={`M${lx - 16},10 L${lx - 10},24 L${lx + 10},24 L${lx + 16},10 Z`} fill="#444" opacity="0.7" />
            <circle cx={lx} cy="20" r="3.5" fill={lampBulb} opacity={lampsOn ? 0.9 : 0.3} />
            {lampGlow > 0 && (
              <path d={`M${lx - 12},24 L${lx - 50},160 L${lx + 50},160 L${lx + 12},24 Z`}
                fill={`rgba(245,200,66,${lampGlow})`} />
            )}
          </g>
        ))}

        {/* Floor plank lines */}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={140 * i} y1="160" x2={140 * i} y2="180"
            stroke={isDark ? "#2a2318" : "#b09570"} strokeWidth="0.5" opacity="0.3" />
        ))}
      </svg>
    </div>
  );
}
