import { useLayoutEffect, useState, useId, type RefObject } from "react";

interface WireEndpoint {
  key: string;
  x: number;
  y: number;
  delegating: boolean;
  returning: boolean;
}

/**
 * Cable-managed wiring: a main trunk runs from the foreman horizontally,
 * then individual branches split off vertically to each worker. Looks like
 * proper cable management rather than spaghetti wires.
 */
export function ConnectorLines({
  containerRef,
  foremanRef,
  subagentRefs,
  color,
  delegatingAgentIds,
  returningAgentIds
}: {
  containerRef: RefObject<HTMLElement | null>;
  foremanRef: RefObject<HTMLElement | null>;
  subagentRefs: Map<string, HTMLElement>;
  color: string;
  delegatingAgentIds?: Set<string>;
  returningAgentIds?: Set<string>;
}) {
  const [foremanPos, setForemanPos] = useState<{ x: number; y: number } | null>(null);
  const [endpoints, setEndpoints] = useState<WireEndpoint[]>([]);
  const svgId = useId();

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      const foreman = foremanRef.current;
      if (!container || !foreman) {
        setForemanPos(null);
        setEndpoints([]);
        return;
      }
      const cr = container.getBoundingClientRect();
      const fr = foreman.getBoundingClientRect();
      const fx = fr.left + fr.width / 2 - cr.left;
      const fy = fr.top + fr.height * 0.65 - cr.top;
      setForemanPos({ x: fx, y: fy });

      const pts: WireEndpoint[] = [];
      for (const [id, el] of subagentRefs) {
        const r = el.getBoundingClientRect();
        pts.push({
          key: id,
          x: r.left + r.width / 2 - cr.left,
          y: r.top + r.height * 0.45 - cr.top,
          delegating: delegatingAgentIds?.has(id) ?? false,
          returning: returningAgentIds?.has(id) ?? false
        });
      }
      // Sort left to right for clean branching
      pts.sort((a, b) => a.x - b.x);
      setEndpoints(pts);
    }

    recompute();
    const settleTimer = setTimeout(recompute, 600);
    const container = containerRef.current;
    const ro = new ResizeObserver(recompute);
    if (container) ro.observe(container);
    window.addEventListener("resize", recompute);

    return () => {
      clearTimeout(settleTimer);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [containerRef, foremanRef, subagentRefs.size, Array.from(subagentRefs.keys()).join(","), delegatingAgentIds, returningAgentIds]);

  if (!foremanPos || endpoints.length === 0) return null;

  // Trunk Y: horizontal cable runs between foreman and workers
  // Place it slightly below the foreman's desk level
  const trunkY = foremanPos.y + 20;
  const trunkStartX = foremanPos.x;
  const trunkEndX = endpoints[endpoints.length - 1].x;

  // Darker shade for the cable
  const cableColor = color;
  const cableW = 4;
  const branchW = 2.5;

  return (
    <svg className="connector-lines" aria-hidden="true">
      {/* === Main trunk: foreman down to trunk level, then horizontal === */}
      {/* Vertical drop from foreman */}
      <line x1={trunkStartX} y1={foremanPos.y} x2={trunkStartX} y2={trunkY}
        stroke={cableColor} strokeWidth={cableW} opacity={0.4} strokeLinecap="round" />
      {/* Horizontal trunk */}
      <line x1={trunkStartX} y1={trunkY} x2={trunkEndX} y2={trunkY}
        stroke={cableColor} strokeWidth={cableW} opacity={0.4} strokeLinecap="round" />
      {/* Trunk shadow */}
      <line x1={trunkStartX} y1={trunkY + 1.5} x2={trunkEndX} y2={trunkY + 1.5}
        stroke="#000" strokeWidth={cableW} opacity={0.06} strokeLinecap="round" />
      {/* Trunk highlight */}
      <line x1={trunkStartX} y1={trunkY - 1} x2={trunkEndX} y2={trunkY - 1}
        stroke="#fff" strokeWidth={1} opacity={0.12} strokeLinecap="round" />

      {/* Foreman connector dot */}
      <circle cx={trunkStartX} cy={foremanPos.y} r={4} fill={cableColor} opacity={0.5} />

      {/* === Branches: vertical drops from trunk to each worker === */}
      {endpoints.map((ep) => {
        const pathId = `${svgId}-branch-${ep.key}`;
        // Branch path: from trunk junction down to worker
        // Full path for blob animation: foreman → trunk → down to worker
        const fullForwardPath = `M${trunkStartX},${foremanPos.y} L${trunkStartX},${trunkY} L${ep.x},${trunkY} L${ep.x},${ep.y}`;
        const fullReturnPath = `M${ep.x},${ep.y} L${ep.x},${trunkY} L${trunkStartX},${trunkY} L${trunkStartX},${foremanPos.y}`;

        return (
          <g key={ep.key}>
            {/* Branch line */}
            <line x1={ep.x} y1={trunkY} x2={ep.x} y2={ep.y}
              stroke={cableColor} strokeWidth={branchW} opacity={0.35} strokeLinecap="round" />
            {/* Branch shadow */}
            <line x1={ep.x + 1} y1={trunkY} x2={ep.x + 1} y2={ep.y}
              stroke="#000" strokeWidth={branchW} opacity={0.04} strokeLinecap="round" />
            {/* Junction dot on trunk */}
            <circle cx={ep.x} cy={trunkY} r={3} fill={cableColor} opacity={0.45} />
            {/* Worker connector dot */}
            <circle cx={ep.x} cy={ep.y} r={3} fill={cableColor} opacity={0.5} />

            {/* Forward delegation blob */}
            {ep.delegating && (
              <>
                <path id={pathId} d={fullForwardPath} fill="none" stroke="none" />
                <circle r={5} fill={cableColor} opacity={0.85}>
                  <animateMotion dur="0.8s" repeatCount="indefinite" calcMode="linear">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
                <circle r={2.5} fill="#fff" opacity={0.9}>
                  <animateMotion dur="0.8s" repeatCount="indefinite" calcMode="linear">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              </>
            )}

            {/* Return result blob */}
            {ep.returning && (
              <>
                <path id={`${pathId}-ret`} d={fullReturnPath} fill="none" stroke="none" />
                <circle r={4} fill={cableColor} opacity={0.5}>
                  <animateMotion dur="1s" repeatCount="1" fill="freeze" calcMode="linear">
                    <mpath href={`#${pathId}-ret`} />
                  </animateMotion>
                </circle>
                <circle r={2} fill="#fff" opacity={0.7}>
                  <animateMotion dur="1s" repeatCount="1" fill="freeze" calcMode="linear">
                    <mpath href={`#${pathId}-ret`} />
                  </animateMotion>
                </circle>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
