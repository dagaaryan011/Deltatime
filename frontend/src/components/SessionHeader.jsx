const MONO = "'Courier New', monospace";
const SYS  = "system-ui, -apple-system, sans-serif";
const LBL  = {
  fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", fontFamily: SYS,
};

export default function SessionHeader({
  sessionInfo, raceTime, currentLap, totalLaps,
  viewMode, isConnected, onBack,
}) {
  const { name, session_type, year } = sessionInfo ?? {};
  const typeLabel = { R: "Race", Q: "Qualifying", S: "Sprint" }[session_type] ?? session_type;
  const showLap   = !!sessionInfo && session_type === "R" && totalLaps != null;

  // Flag dot: green + pulsing when live+connected, amber when replay, none otherwise
  const flagColor = viewMode === "live" && isConnected ? "#22c55e"
                  : viewMode === "replay"              ? "#fbbf24"
                  : null;
  const modeLabel = { historical: "Historical", replay: "Replay", live: "Live" }[viewMode] ?? "Historical";

  return (
    <div style={{
      display: "flex", alignItems: "center",
      height: 44, flexShrink: 0,
      background: "#0a0a0a",
      borderBottom: "0.5px solid rgba(255,255,255,0.08)",
      fontFamily: SYS, color: "white",
    }}>
      {/* ── LEFT: F1 pill + session identity ─────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", flex: 1, minWidth: 0, overflow: "hidden",
      }}>
        <span style={{
          background: "#E8002D", color: "white",
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          padding: "2px 6px", flexShrink: 0,
        }}>
          F1
        </span>

        {name && (
          <span style={{
            fontSize: 13, color: "white",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {name}
          </span>
        )}

        {year && (
          <span style={{ ...LBL, flexShrink: 0 }}>{year}</span>
        )}

        {typeLabel && sessionInfo && (
          <span style={{
            ...LBL, flexShrink: 0,
            padding: "2px 6px",
            border: "0.5px solid rgba(255,255,255,0.12)",
          }}>
            {typeLabel}
          </span>
        )}
      </div>

      {/* ── CENTER: lap counter — race sessions only ───────────────────────── */}
      {showLap && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          flexShrink: 0, padding: "0 16px",
        }}>
          <span style={LBL}>Lap</span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: "white" }}>
            {currentLap}
          </span>
          <span style={{ ...LBL, fontSize: 11 }}>/</span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {totalLaps ?? "—"}
          </span>
        </div>
      )}

      {/* ── RIGHT: flag dot + mode label + back ───────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        {/* Flag status dot */}
        {flagColor && (
          <div style={{ padding: "0 12px 0 0", display: "flex", alignItems: "center" }}>
            <div
              className={viewMode === "live" && isConnected ? "flag-dot-green" : ""}
              style={{
                width: 7, height: 7, borderRadius: "50%",
                background: flagColor,
              }}
            />
          </div>
        )}

        {/* Mode label */}
        <span style={{ ...LBL, paddingRight: 16 }}>{modeLabel}</span>

        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to home"
          style={{
            background: "transparent", border: "none",
            borderLeft: "0.5px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: 17,
            padding: "0 16px", height: 44,
            display: "flex", alignItems: "center",
            fontFamily: SYS,
          }}
        >
          ←
        </button>
      </div>
    </div>
  );
}
