import type { ReactNode } from "react";

/**
 * Workshop room backdrop — wraps the cluster floor content with a subtle
 * factory/workshop environment: a floor with tiles, a workbench surface,
 * and a back-wall shelf strip. All decorative (aria-hidden).
 */
export function WorkshopRoom({ teamColor, children }: { teamColor: string; children: ReactNode }) {
  return (
    <div className="workshop-room">
      {/* Decorative background — positioned behind the real content */}
      <svg className="workshop-room-bg" aria-hidden="true" preserveAspectRatio="none">
        {/* Back wall */}
        <rect x="0" y="0" width="100%" height="60%" fill="var(--surface-alt)" />
        {/* Wall shelf strip */}
        <rect x="3%" y="8" width="94%" height="4" rx="2" fill={teamColor} opacity="0.18" />
        {/* Shelf bracket left */}
        <rect x="8%" y="8" width="3" height="8" rx="1" fill={teamColor} opacity="0.25" />
        {/* Shelf bracket right */}
        <rect x="91%" y="8" width="3" height="8" rx="1" fill={teamColor} opacity="0.25" />
        {/* Workbench surface (the "desk") */}
        <rect x="2%" y="58%" width="96%" height="6" rx="3" fill={teamColor} opacity="0.15" />
        {/* Bench legs */}
        <rect x="6%" y="58%" width="4" height="42%" rx="2" fill={teamColor} opacity="0.10" />
        <rect x="93%" y="58%" width="4" height="42%" rx="2" fill={teamColor} opacity="0.10" />
        {/* Floor tiles — subtle grid lines */}
        <line x1="0" y1="64%" x2="100%" y2="64%" stroke={teamColor} strokeWidth="0.5" opacity="0.08" />
        <line x1="0" y1="78%" x2="100%" y2="78%" stroke={teamColor} strokeWidth="0.5" opacity="0.06" />
        <line x1="0" y1="92%" x2="100%" y2="92%" stroke={teamColor} strokeWidth="0.5" opacity="0.04" />
        {/* Floor */}
        <rect x="0" y="60%" width="100%" height="40%" fill={teamColor} opacity="0.04" />
      </svg>
      {/* Actual cluster content */}
      <div className="workshop-room-content">
        {children}
      </div>
    </div>
  );
}
