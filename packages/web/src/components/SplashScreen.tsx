import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Splash screen shown on first load. Three ceiling lamps turn on
 * one by one, illuminating the "Mimir" title, then fades out.
 */
export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0); // 0=dark, 1-3=lamps, 4=title, 5=done

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),   // lamp 1
      setTimeout(() => setPhase(2), 800),   // lamp 2
      setTimeout(() => setPhase(3), 1200),  // lamp 3
      setTimeout(() => setPhase(4), 1600),  // title fully lit
      setTimeout(() => setPhase(5), 2800),  // fade out
      setTimeout(onComplete, 3300),          // remove
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  if (phase >= 5) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="splash-screen"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        animate={{ opacity: phase >= 5 ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <svg width="600" height="300" viewBox="0 0 600 300" className="splash-svg">
          {/* Dark room background */}
          <rect x="0" y="0" width="600" height="300" fill="#0d0f14" />

          {/* Three ceiling lamps */}
          {[150, 300, 450].map((x, i) => {
            const isOn = phase > i;
            return (
              <g key={x}>
                {/* Cord */}
                <line x1={x} y1="0" x2={x} y2="30" stroke="#333" strokeWidth="2" />
                {/* Shade */}
                <path d={`M${x - 20},30 L${x - 14},50 L${x + 14},50 L${x + 20},30 Z`} fill="#2a2d36" />
                {/* Bulb */}
                <circle cx={x} cy="44" r="5" fill={isOn ? "#f5c842" : "#333"}>
                  {isOn && (
                    <animate attributeName="opacity" values="0;1" dur="0.3s" fill="freeze" />
                  )}
                </circle>
                {/* Light cone */}
                {isOn && (
                  <path
                    d={`M${x - 16},50 L${x - 80},280 L${x + 80},280 L${x + 16},50 Z`}
                    fill="rgba(245,200,66,0.04)"
                  >
                    <animate attributeName="opacity" values="0;1" dur="0.4s" fill="freeze" />
                  </path>
                )}
                {/* Glow circle */}
                {isOn && (
                  <circle cx={x} cy="44" r="30" fill="rgba(245,200,66,0.08)">
                    <animate attributeName="opacity" values="0;1" dur="0.3s" fill="freeze" />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Title — visible once all lamps are on */}
          <text
            x="300"
            y="180"
            textAnchor="middle"
            fill={phase >= 3 ? "#e8e0d4" : "#1a1c22"}
            fontSize="56"
            fontWeight="800"
            fontFamily="sans-serif"
            letterSpacing="8"
          >
            {phase >= 3 && (
              <animate attributeName="opacity" values="0;1" dur="0.5s" fill="freeze" />
            )}
            MIMIR
          </text>

          {/* Subtitle */}
          {phase >= 4 && (
            <text
              x="300"
              y="215"
              textAnchor="middle"
              fill="#9298a6"
              fontSize="14"
              fontFamily="sans-serif"
              letterSpacing="3"
            >
              <animate attributeName="opacity" values="0;1" dur="0.4s" fill="freeze" />
              THE ALL-SEEING ORACLE
            </text>
          )}

          {/* Floor line */}
          <line x1="0" y1="280" x2="600" y2="280" stroke="#1a1610" strokeWidth="1" opacity="0.3" />
        </svg>
      </motion.div>
    </AnimatePresence>
  );
}
