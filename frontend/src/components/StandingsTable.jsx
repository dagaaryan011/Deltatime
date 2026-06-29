const MONO = "'Courier New', monospace";
const SYS  = "system-ui, -apple-system, sans-serif";

const TYRE = {
  SOFT:         { color: "#E8002D",            label: "S" },
  MEDIUM:       { color: "#FFC906",            label: "M" },
  HARD:         { color: "rgba(255,255,255,0.7)", label: "H" },
  INTERMEDIATE: { color: "#43b02a",            label: "I" },
  WET:          { color: "#0067ff",            label: "W" },
};

function TyreCircle({ compound, age }) {
  if (!compound) return null;
  const key = compound.toUpperCase();
  const { color, label } = TYRE[key] ?? { color: "#666", label: key[0] ?? "?" };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        border: `1.5px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 8, color, fontFamily: MONO, fontWeight: 700, lineHeight: 1,
        }}>
          {label}
        </span>
      </div>
      {age != null && (
        <span style={{ fontSize: 8, fontFamily: MONO, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>
          {age}
        </span>
      )}
    </div>
  );
}

const COL_HDR = {
  fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", fontFamily: SYS,
};

export default function StandingsTable({ standings, selectedDriver, onSelectDriver }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: "#0a0a0a", fontFamily: SYS, color: "white",
    }}>
      {/* Top accent bar — muted, secondary panel */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />

      {/* Section label */}
      <div style={{ padding: "10px 16px 6px", flexShrink: 0 }}>
        <span style={COL_HDR}>Standings</span>
      </div>

      {/* Column headers */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 16px 8px",
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <span style={{ ...COL_HDR, minWidth: 24 }}>P</span>
        <span style={{ ...COL_HDR, flex: 1, paddingLeft: 13 }}>Driver</span>
        <span style={{ ...COL_HDR, minWidth: 64, textAlign: "right" }}>Gap</span>
        <span style={{ ...COL_HDR, minWidth: 36, textAlign: "center" }}>Tyre</span>
      </div>

      {/* Driver rows */}
      <div
        className="st-scroll"
        style={{ flex: 1, overflowY: "auto" }}
      >
        {standings.map((entry) => {
          const sel = entry.driver === selectedDriver;
          return (
            <div
              key={entry.driver}
              onClick={() => onSelectDriver(entry.driver)}
              style={{
                display: "flex", alignItems: "center",
                height: 32, padding: "0 16px",
                borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
                background: sel ? "rgba(255,255,255,0.04)" : "transparent",
                boxShadow: sel ? "inset 2px 0 0 #E8002D" : "none",
                transition: "background 100ms",
              }}
            >
              {/* Position */}
              <span style={{
                fontSize: 12, color: "rgba(255,255,255,0.4)",
                fontFamily: MONO, minWidth: 24, flexShrink: 0,
              }}>
                {entry.position}
              </span>

              {/* Team colour slab */}
              <div style={{
                width: 3, height: 18, flexShrink: 0,
                marginRight: 10,
                background: entry.color ?? "rgba(255,255,255,0.2)",
              }} />

              {/* Driver code */}
              <span style={{
                fontSize: 13, fontWeight: 500, color: "white",
                fontFamily: MONO, flex: 1, overflow: "hidden",
                whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}>
                {entry.driver}
              </span>

              {/* Gap */}
              <div style={{
                fontSize: 12, fontFamily: MONO,
                color: "rgba(255,255,255,0.5)",
                minWidth: 64, textAlign: "right", flexShrink: 0,
              }}>
                {entry.gap === "LEADER" ? (
                  <span style={{ fontSize: 10, color: "#E8002D", letterSpacing: 1 }}>
                    LEADER
                  </span>
                ) : entry.gap}
              </div>

              {/* Tyre */}
              <div style={{ minWidth: 36, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <TyreCircle compound={entry.tyre} age={entry.tyre_age} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
