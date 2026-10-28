import type { HatPattern } from "./teamColor.js";
import type { Role, UnknownAccessory } from "./faceFeatures.js";

const INK = "#1b1d23";

function PatternOverlay({ pattern, clipId }: { pattern: HatPattern; clipId: string }) {
  if (pattern === "none") return null;
  if (pattern === "stripes") {
    return (
      <g clipPath={`url(#${clipId})`} stroke="#ffffff" strokeWidth={2} opacity={0.55}>
        <line x1={-10} y1={10} x2={10} y2={-10} />
        <line x1={0} y1={18} x2={20} y2={-2} />
        <line x1={10} y1={26} x2={30} y2={6} />
      </g>
    );
  }
  return (
    <g clipPath={`url(#${clipId})`} fill="#ffffff" opacity={0.55}>
      <circle cx={-4} cy={2} r={2} />
      <circle cx={6} cy={-2} r={2} />
      <circle cx={16} cy={4} r={2} />
      <circle cx={2} cy={10} r={2} />
    </g>
  );
}

/**
 * Every agent wears a baseball cap in `capColor` (a contrasting color chosen
 * by the caller). The foreman gets a wider brim and a small star badge;
 * everyone else gets the plain cap. Pattern overlays (stripes/dots) still
 * disambiguate same-colored teams beyond 8 concurrent sessions.
 */
export function RoleAccessory(props: {
  role: Role;
  unknownAccessory: UnknownAccessory | null;
  color: string;
  pattern: HatPattern;
  capColor: string;
}) {
  const { role, pattern, capColor } = props;
  const clipId = `cap-clip-${role}`;
  const isForeman = role === "foreman";

  return (
    <g transform="translate(60,22)">
      <defs>
        <clipPath id={clipId}>
          {/* crown of the cap */}
          <path d="M-24 10 a24 16 0 0 1 48 0 z" />
        </clipPath>
      </defs>
      {/* crown */}
      <path d="M-24 10 a24 16 0 0 1 48 0 z" fill={capColor} stroke={INK} strokeWidth={1.5} />
      {/* brim — wider for foreman */}
      {isForeman ? (
        <ellipse cx={16} cy={10} rx={18} ry={5} fill={capColor} stroke={INK} strokeWidth={1.5} />
      ) : (
        <ellipse cx={14} cy={10} rx={14} ry={4} fill={capColor} stroke={INK} strokeWidth={1.5} />
      )}
      <PatternOverlay pattern={pattern} clipId={clipId} />
      {/* foreman badge — small star on cap crown */}
      {isForeman && (
        <polygon
          points="0,-6 1.8,-1.8 7,-1.8 2.8,1.4 4.4,6 0,3.2 -4.4,6 -2.8,1.4 -7,-1.8 -1.8,-1.8"
          fill="#eda100"
          stroke={INK}
          strokeWidth={0.8}
          transform="translate(0,3) scale(0.7)"
        />
      )}
    </g>
  );
}
