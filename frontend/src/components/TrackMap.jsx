import { useRef, useEffect, useState } from "react";

const VIEWBOX = "0 0 1000 1000";
const ANIM_MS = 190; // just under the 200ms frame interval

export default function TrackMap({ track, positions, selectedDriver, onSelectDriver }) {
  const pathRef = useRef(null);
  const [driverCoords, setDriverCoords] = useState({});

  // All refs — no state mutation triggers, just data for the RAF loop
  const currentPcts = useRef({}); // last rendered frac (0-1) per driver — updated every RAF tick
  const startPcts   = useRef({}); // frac at the moment the current animation began
  const targetPcts  = useRef({}); // frac we're animating toward
  const colorMap    = useRef({});
  const rafRef      = useRef(null);
  const animStart   = useRef(null);

  const trackPath = track.length
    ? track.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    : null;

  useEffect(() => {
    if (!pathRef.current || !positions.length) return;
    const path = pathRef.current;
    const total = path.getTotalLength();

    // Snapshot current visual position as start before updating targets
    for (const d of positions) {
      const frac = ((d.track_pct % 1) + 1) % 1;
      // Start from where the dot IS right now (captured by last RAF tick),
      // not from the previous target — this is what prevents jitter on interrupt
      startPcts.current[d.driver]  = currentPcts.current[d.driver] ?? frac;
      targetPcts.current[d.driver] = frac;
      colorMap.current[d.driver]   = d.color;
    }

    cancelAnimationFrame(rafRef.current);
    animStart.current = null;

    function animate(ts) {
      if (!animStart.current) animStart.current = ts;
      const progress = Math.min((ts - animStart.current) / ANIM_MS, 1);

      const coords = {};
      for (const [driver, tgtFrac] of Object.entries(targetPcts.current)) {
        const startFrac = startPcts.current[driver] ?? tgtFrac;

        // Shortest-arc delta so cars cross the finish line forward, not backward
        let delta = tgtFrac - startFrac;
        if (delta > 0.5)  delta -= 1.0;
        if (delta < -0.5) delta += 1.0;

        const frac = ((startFrac + delta * progress) + 1) % 1;
        currentPcts.current[driver] = frac; // keep in sync for next interrupt
        const pt = path.getPointAtLength(frac * total);
        coords[driver] = { x: pt.x, y: pt.y, color: colorMap.current[driver] };
      }

      setDriverCoords(coords);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [positions]);

  return (
    <div style={{
      height: "100%", position: "relative",
      display: "flex", flexDirection: "column",
      background: "#0a0a0a",
    }}>
      {/* 2px red top accent — primary panel */}
      <div style={{ height: 2, background: "#E8002D", flexShrink: 0 }} />

      <svg
        viewBox={VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        style={{ flex: 1, width: "100%", display: "block" }}
      >
        {trackPath && (
          <>
            {/* Outer track outline — etched into the dark field */}
            <path
              d={trackPath}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Inner track surface — barely lighter than void */}
            <path
              ref={pathRef}
              d={trackPath}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {Object.entries(driverCoords).map(([driver, { x, y, color }]) => {
          const sel = driver === selectedDriver;
          return (
            <g key={driver} onClick={() => onSelectDriver(driver)} style={{ cursor: "pointer" }}>
              <circle
                cx={x} cy={y}
                r={sel ? 13 : 9}
                fill={color}
                stroke={sel ? "white" : "none"}
                strokeWidth={sel ? 1.5 : 0}
                opacity={sel ? 1 : 0.9}
              />
              {sel && (
                <>
                  {/* Label background rect — 4px padding each side of ~18px monospace text */}
                  <rect
                    x={x - 13} y={y - 32}
                    width={26} height={14}
                    fill="rgba(0,0,0,0.6)"
                  />
                  <text
                    x={x} y={y - 21}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="'Courier New', monospace"
                    fill="white"
                    className="pointer-events-none select-none"
                  >
                    {driver}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* TRACK MAP label — absolute bottom-left, like a panel watermark */}
      <div style={{
        position: "absolute", bottom: 12, left: 14,
        fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
        color: "rgba(255,255,255,0.2)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        pointerEvents: "none", userSelect: "none",
      }}>
        Track Map
      </div>
    </div>
  );
}
