import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { truncate } from "../lib/text.js";
import type { AvatarConfig, Expression } from "../characters/avatarConfig.js";

const INK = "#2a2a2a";

/* ── Hair ─────────────────────────────────────────────────── */

function MaleHair({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "long":
      return (
        <g>
          <path d="M38,36 Q40,14 60,12 Q80,14 82,36" fill={color} />
          <path d="M38,36 Q36,50 38,60" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
          <path d="M82,36 Q84,50 82,60" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        </g>
      );
    case "curly":
      return (
        <g>
          <path d="M40,38 Q42,16 60,14 Q78,16 80,38" fill={color} />
          {[[44, 28], [54, 18], [66, 18], [76, 28], [42, 38], [78, 38]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="5" fill={color} />
          ))}
        </g>
      );
    case "bald":
      return null;
    default: // short
      return (
        <g>
          <path d="M40,36 Q42,16 60,14 Q78,16 80,36 L80,30 Q78,12 60,10 Q42,12 40,30 Z" fill={color} />
          {/* Textured top */}
          <path d="M48,18 Q55,8 65,12 Q72,10 76,18" fill={color} />
        </g>
      );
  }
}

function FemaleHair({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "long":
      return (
        <g>
          <path d="M36,36 Q38,14 60,12 Q82,14 84,36" fill={color} />
          <path d="M36,36 Q32,55 36,72" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
          <path d="M84,36 Q88,55 84,72" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
          <path d="M44,26 Q52,18 60,22 Q68,18 76,26" fill={color} />
        </g>
      );
    case "curly":
      return (
        <g>
          <path d="M36,38 Q38,14 60,12 Q82,14 84,38" fill={color} />
          {[[36, 42], [34, 54], [36, 64], [84, 42], [86, 54], [84, 64],
            [48, 14], [60, 12], [72, 14]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="5.5" fill={color} />
          ))}
        </g>
      );
    case "bald":
      return <path d="M42,34 Q44,20 60,18 Q76,20 78,34" fill={color} opacity="0.4" />;
    default: // short (bob)
      return (
        <g>
          <path d="M36,36 Q38,14 60,12 Q82,14 84,36" fill={color} />
          <path d="M36,36 Q34,50 38,58" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
          <path d="M84,36 Q86,50 82,58" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
          <path d="M44,26 Q52,18 62,22 Q70,18 76,24" fill={color} />
        </g>
      );
  }
}

/* ── Mouth expressions ────────────────────────────────────── */

function Mouth({ expression, isMale }: { expression: Expression; isMale: boolean }) {
  switch (expression) {
    case "grin":
      return (
        <g>
          <path d="M50,56 Q60,66 70,56" fill="#fff" stroke={INK} strokeWidth="1.2" />
          <path d="M50,56 Q60,60 70,56" fill="none" stroke={INK} strokeWidth="0.5" opacity="0.2" />
        </g>
      );
    case "focused":
      return <line x1="54" y1="58" x2="66" y2="58" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />;
    case "neutral":
      return <path d="M54,57 Q60,60 66,57" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />;
    default: // smile
      return isMale
        ? <path d="M52,56 Q60,64 68,56" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        : <path d="M54,56 Q60,62 66,56" fill="none" stroke="#c06060" strokeWidth="1.8" strokeLinecap="round" />;
  }
}

/* ── Main component ───────────────────────────────────────── */

export function UserDesk({
  latestPrompt,
  avatar,
  onEditAvatar
}: {
  latestPrompt: string | null;
  avatar: AvatarConfig;
  onEditAvatar: () => void;
}) {
  const isDark = usePrefersDarkMode();
  const { gender, skinTone, hairStyle, hairColor, glasses, shirtColor, expression } = avatar;

  const deskColor = isDark ? "#4a4038" : "#a88860";
  const deskTop = isDark ? "#5a5048" : "#c0a070";
  const chairColor = isDark ? "#333" : "#555";
  const isMale = gender === "male";

  return (
    <div className="user-desk">
      <svg width="140" height="200" viewBox="0 0 120 200" style={{ "--eyelid-color": skinTone } as React.CSSProperties}>

        {/* Chair back */}
        <rect x="40" y="34" width="40" height="36" rx="5" fill={chairColor} />
        <rect x="43" y="37" width="34" height="30" rx="3" fill={isDark ? "#444" : "#666"} />

        {/* === Character === */}

        {/* Neck */}
        <rect x={isMale ? "55" : "56"} y="62" width={isMale ? "10" : "8"} height="8" rx="3" fill={skinTone} />

        {/* Body */}
        {isMale ? (
          <g>
            {/* T-shirt */}
            <path d="M38,70 L52,68 Q60,72 68,68 L82,70 L84,98 Q84,100 82,100 L38,100 Q36,100 36,98 Z" fill={shirtColor} />
            {/* Collar */}
            <path d="M50,68 Q60,76 70,68" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
            {/* Arms */}
            <rect x="26" y="72" width="12" height="20" rx="6" fill={skinTone} />
            <rect x="82" y="72" width="12" height="20" rx="6" fill={skinTone} />
          </g>
        ) : (
          <g>
            {/* Blouse */}
            <path d="M40,70 L54,68 Q60,74 66,68 L80,70 L82,98 Q82,100 80,100 L40,100 Q38,100 38,98 Z" fill={shirtColor} />
            {/* Neckline */}
            <path d="M50,68 Q60,78 70,68" fill={skinTone} />
            <path d="M50,68 Q60,78 70,68" fill="none" stroke={shirtColor} strokeWidth="1" />
            {/* Arms */}
            <rect x="28" y="72" width="11" height="18" rx="5.5" fill={skinTone} />
            <rect x="81" y="72" width="11" height="18" rx="5.5" fill={skinTone} />
            {/* Blush */}
            <circle cx="44" cy="50" r="3.5" fill="#e88" opacity="0.2" />
            <circle cx="76" cy="50" r="3.5" fill="#e88" opacity="0.2" />
          </g>
        )}

        {/* Head — slightly oval, not perfectly round */}
        <ellipse cx="60" cy="44" rx="20" ry="22" fill={skinTone} />

        {/* Ears */}
        <ellipse cx="40" cy="46" rx="3.5" ry="4.5" fill={skinTone} />
        <ellipse cx="80" cy="46" rx="3.5" ry="4.5" fill={skinTone} />

        {/* Hair (rendered over head) */}
        {isMale
          ? <MaleHair style={hairStyle} color={hairColor} />
          : <FemaleHair style={hairStyle} color={hairColor} />
        }

        {/* Eyes */}
        <ellipse cx="52" cy="44" rx="4" ry="4.5" fill="#fff" />
        <ellipse cx="68" cy="44" rx="4" ry="4.5" fill="#fff" />
        <circle cx="53" cy="44" r="2.5" fill={INK} />
        <circle cx="69" cy="44" r="2.5" fill={INK} />
        {/* Shine */}
        <circle cx="54.2" cy="43" r="0.8" fill="#fff" />
        <circle cx="70.2" cy="43" r="0.8" fill="#fff" />
        {/* Blink */}
        <ellipse cx="52" cy="44" rx="5" ry="5.5" className="eyelid" />
        <ellipse cx="68" cy="44" rx="5" ry="5.5" className="eyelid" />

        {/* Eyebrows */}
        <path d={`M45,${isMale ? 36 : 37} Q52,${isMale ? 32 : 34} 58,${isMale ? 36 : 37}`}
          fill="none" stroke={hairColor} strokeWidth={isMale ? "1.8" : "1.2"} strokeLinecap="round" />
        <path d={`M62,${isMale ? 36 : 37} Q68,${isMale ? 32 : 34} 75,${isMale ? 36 : 37}`}
          fill="none" stroke={hairColor} strokeWidth={isMale ? "1.8" : "1.2"} strokeLinecap="round" />

        {/* Nose */}
        <path d="M58,50 Q60,53 62,50" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.35" strokeLinecap="round" />

        {/* Mouth */}
        <Mouth expression={expression} isMale={isMale} />

        {/* Glasses */}
        {glasses && (
          <g opacity="0.85">
            <circle cx="52" cy="44" r="8" fill="none" stroke={INK} strokeWidth="1.2" />
            <circle cx="68" cy="44" r="8" fill="none" stroke={INK} strokeWidth="1.2" />
            <line x1="60" y1="44" x2="60" y2="44" stroke={INK} strokeWidth="1.5" />
            <line x1="44" y1="44" x2="40" y2="43" stroke={INK} strokeWidth="1" />
            <line x1="76" y1="44" x2="80" y2="43" stroke={INK} strokeWidth="1" />
          </g>
        )}

        {/* === Desk === */}
        <rect x="6" y="96" width="108" height="5" rx="2" fill={deskTop} />

        {/* Coffee */}
        <rect x="14" y="87" width="8" height="10" rx="2" fill={isDark ? "#c06030" : "#e07040"} />
        <rect x="22" y="90" width="4" height="3.5" rx="1.5" fill={isDark ? "#c06030" : "#e07040"} />

        {/* Desk front */}
        <rect x="10" y="101" width="100" height="24" rx="2" fill={deskColor} />
        <rect x="16" y="125" width="5" height="18" rx="2" fill={deskColor} opacity="0.8" />
        <rect x="99" y="125" width="5" height="18" rx="2" fill={deskColor} opacity="0.8" />

        {/* Nameplate */}
        <rect x="32" y="106" width="56" height="14" rx="3" fill={isDark ? "#c9a84c" : "#d4a843"} opacity="0.85" />
        <text x="60" y="116" textAnchor="middle" fill={INK} fontSize="7.5" fontWeight="700" fontFamily="sans-serif">You</text>

        {/* Chair base */}
        <rect x="52" y="106" width="16" height="20" rx="3" fill={chairColor} />
        <rect x="46" y="124" width="28" height="3" rx="1.5" fill={chairColor} />
        <circle cx="50" cy="130" r="2" fill={chairColor} stroke={isDark ? "#555" : "#888"} strokeWidth="0.7" />
        <circle cx="70" cy="130" r="2" fill={chairColor} stroke={isDark ? "#555" : "#888"} strokeWidth="0.7" />
      </svg>

      <button className="avatar-edit-btn" onClick={onEditAvatar} title="Customize your avatar">
        ✏️
      </button>

      {latestPrompt ? (
        <div className="user-speech-bubble">{truncate(latestPrompt, 80)}</div>
      ) : (
        <div className="desk-label" style={{ fontWeight: 700 }}>You</div>
      )}
    </div>
  );
}
