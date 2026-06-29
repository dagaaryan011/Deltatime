import { useState, useEffect, useRef } from "react";
import { useSession } from "./hooks/useSession";
import { useLiveSession } from "./hooks/useLiveSession";
import TrackMap from "./components/TrackMap";
import StandingsTable from "./components/StandingsTable";
import TelemetryPanel from "./components/TelemetryPanel";
import SessionHeader from "./components/SessionHeader";

const SESSION_TYPES = [
  { value: "R", label: "Race" },
  { value: "Q", label: "Qualifying" },
  { value: "S", label: "Sprint" },
];
const TYPE_LABEL = { R: "Race", Q: "Qualifying", S: "Sprint" };

const MONO = "'Courier New', monospace";
const SYS  = "system-ui, -apple-system, sans-serif";

function formatTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Style constants ────────────────────────────────────────────────────────────

const DROP = {
  background: "transparent",
  border: "none",
  borderRight: "0.5px solid rgba(255,255,255,0.08)",
  color: "white",
  fontSize: 12,
  height: 36,
  padding: "0 12px",
  fontFamily: SYS,
  cursor: "pointer",
  outline: "none",
  flexShrink: 0,
};

const CTRL_BTN = {
  background: "transparent",
  border: "none",
  borderRight: "0.5px solid rgba(255,255,255,0.08)",
  borderRadius: 0,
  color: "rgba(255,255,255,0.6)",
  fontSize: 13,
  width: 36,
  height: 36,
  cursor: "pointer",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: SYS,
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ViewerPage({ onBack, initialPick }) {
  const {
    events, sessionInfo, frames, track, standingsByLap, telemetry,
    loading, error, fetchEvents, loadSession, fetchTelemetry,
  } = useSession();

  const liveSession = useLiveSession();

  const [year, setYear]                   = useState(initialPick?.year ?? 2026);
  const [selectedRound, setSelectedRound] = useState(initialPick?.round ?? "");
  const [selectedType, setSelectedType]   = useState(initialPick?.type ?? "R");
  const [frameIdx, setFrameIdx]           = useState(0);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [playing, setPlaying]             = useState(false);
  const [viewMode, setViewMode]           = useState("historical");
  const playRef     = useRef(null);
  const autoLoaded  = useRef(false);

  useEffect(() => { fetchEvents(year); }, [year, fetchEvents]);

  // Auto-load the session pre-selected on the home screen
  useEffect(() => {
    if (initialPick?.round && !autoLoaded.current) {
      autoLoaded.current = true;
      loadSession(initialPick.year ?? 2026, String(initialPick.round), initialPick.type ?? "R");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    playRef.current = setInterval(() => {
      setFrameIdx((i) => (i >= frames.length - 1 ? 0 : i + 1));
    }, 200);
    return () => clearInterval(playRef.current);
  }, [playing, frames.length]);

  useEffect(() => {
    if (viewMode !== "historical" && liveSession.frames.length > 0) {
      setFrameIdx(liveSession.frames.length - 1);
    }
  }, [viewMode, liveSession.frames.length]);

  function handleLoad() {
    if (!selectedRound) return;
    setPlaying(false);
    setFrameIdx(0);
    setSelectedDriver(null);
    liveSession.disconnect();
    setViewMode("historical");
    loadSession(year, selectedRound, selectedType);
  }

  function handleStartLive(mode) {
    if (!sessionInfo) return;
    setPlaying(false);
    setViewMode(mode);
    liveSession.connect(sessionInfo.session_id, mode);
  }

  function handleSelectDriver(driver) {
    setSelectedDriver(driver);
    if (sessionInfo) fetchTelemetry(sessionInfo.session_id, driver);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const activeFrames   = viewMode === "historical" ? frames : liveSession.frames;
  const currentFrame   = activeFrames[frameIdx];
  const positions      = currentFrame?.positions ?? [];
  const raceTime       = currentFrame?.time ?? 0;
  const currentLap     = currentFrame?.lap ?? 1;
  const totalTime      = activeFrames.length > 0 ? activeFrames[activeFrames.length - 1].time : 0;
  const totalLaps      = activeFrames.length > 0 ? (activeFrames[activeFrames.length - 1]?.lap ?? null) : null;
  const maxStandingsLap = Object.keys(standingsByLap).length
    ? Math.max(...Object.keys(standingsByLap).map(Number)) : 1;
  const standings   = standingsByLap[String(Math.min(currentLap, maxStandingsLap))] ?? [];
  const driverColor = standings.find((s) => s.driver === selectedDriver)?.color;
  const isLive      = viewMode !== "historical";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Embedded CSS: flag pulse, dropdown chrome, scrubber, scrollbar hide */}
      <style>{`
        @keyframes flag-pulse { 0%,100% { opacity:1 } 50% { opacity:0.25 } }
        .flag-dot-green { animation: flag-pulse 2s ease-in-out infinite; }

        .vp-select {
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 26px !important;
        }
        .vp-select option { background: #0f0f0f; color: #ffffff; }

        .vp-scrubber {
          -webkit-appearance: none; appearance: none;
          height: 2px; background: rgba(255,255,255,0.12);
          border-radius: 0; outline: none; cursor: pointer;
          accent-color: #E8002D;
        }
        .vp-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px; height: 10px;
          background: #E8002D; border-radius: 0; cursor: pointer;
          transition: transform 100ms;
        }
        .vp-scrubber::-moz-range-thumb {
          width: 10px; height: 10px;
          background: #E8002D; border: none; border-radius: 0; cursor: pointer;
        }

        .st-scroll::-webkit-scrollbar { display: none; }
        .st-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      <div style={{
        height: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        background: "#0a0a0a", color: "white",
        fontFamily: SYS,
      }}>

        {/* ── SESSION HEADER — 44px ───────────────────────────────────────── */}
        <SessionHeader
          sessionInfo={sessionInfo}
          raceTime={raceTime}
          currentLap={currentLap}
          totalLaps={totalLaps}
          viewMode={viewMode}
          isConnected={liveSession.connected}
          onBack={onBack}
        />

        {/* ── CONTROLS BAR — 36px ─────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          height: 36, flexShrink: 0,
          background: "#0f0f0f",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        }}>

          {/* Year */}
          <select
            className="vp-select"
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setSelectedRound(""); }}
            style={DROP}
          >
            {[2026, 2025, 2024, 2023, 2022].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Round */}
          <select
            className="vp-select"
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value)}
            style={{ ...DROP, minWidth: 160 }}
          >
            <option value="">Round</option>
            {events.map((e) => (
              <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>
            ))}
          </select>

          {/* Session type */}
          <select
            className="vp-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={DROP}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Load button */}
          <button
            onClick={handleLoad}
            disabled={!selectedRound || loading}
            style={{
              background: "#E8002D", color: "white",
              border: "none",
              borderRadius: 0,
              padding: "0 16px", height: 36,
              fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
              cursor: !selectedRound || loading ? "not-allowed" : "pointer",
              opacity: !selectedRound || loading ? 0.4 : 1,
              fontFamily: SYS, flexShrink: 0,
            }}
          >
            {loading ? "—" : "Load"}
          </button>

          {/* ── Vertical separator ── */}
          <div style={{ width: "0.5px", height: 36, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

          {/* ── Playback controls — historical mode ── */}
          {viewMode === "historical" && (
            <>
              <button
                onClick={() => setPlaying((p) => !p)}
                disabled={frames.length === 0}
                style={{
                  ...CTRL_BTN,
                  opacity: frames.length === 0 ? 0.25 : 1,
                  cursor: frames.length === 0 ? "default" : "pointer",
                }}
              >
                {playing ? "⏸" : "▶"}
              </button>

              <div style={{
                flex: 1, display: "flex", alignItems: "center",
                gap: 12, padding: "0 14px",
              }}>
                {frames.length > 0 ? (
                  <>
                    <input
                      type="range"
                      className="vp-scrubber"
                      min={0}
                      max={frames.length - 1}
                      value={frameIdx}
                      onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
                      style={{ flex: 1 }}
                    />
                    <span style={{
                      fontFamily: MONO, fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      flexShrink: 0, letterSpacing: 0.5,
                    }}>
                      {formatTime(raceTime)} / {formatTime(totalTime)}
                    </span>
                  </>
                ) : (
                  <span style={{
                    fontSize: 10, letterSpacing: 1.5,
                    color: "rgba(255,255,255,0.2)", textTransform: "uppercase",
                    fontFamily: SYS,
                  }}>
                    Load a session
                  </span>
                )}
              </div>
            </>
          )}

          {/* ── Live / Replay indicator ── */}
          {viewMode !== "historical" && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              gap: 10, padding: "0 14px",
            }}>
              {liveSession.connected && (
                <div className="flag-dot-green" style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
                }} />
              )}
              <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontFamily: SYS }}>
                {viewMode === "live" ? "Live" : "Replay"}
              </span>
              {raceTime > 0 && (
                <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  {formatTime(raceTime)}
                </span>
              )}
              {activeFrames.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: MONO }}>
                  {activeFrames.length} frames
                </span>
              )}
            </div>
          )}

          {/* ── Mode switcher — only when session loaded ── */}
          {sessionInfo && [
            { id: "historical", label: "Hist" },
            { id: "replay",     label: "Replay" },
            { id: "live",       label: "Live" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() =>
                id === "historical"
                  ? (liveSession.disconnect(), setViewMode("historical"), setFrameIdx(0))
                  : handleStartLive(id)
              }
              style={{
                height: 36, padding: "0 12px",
                background: "transparent", border: "none",
                borderLeft: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: 0,
                color: viewMode === id ? "#E8002D" : "rgba(255,255,255,0.3)",
                fontSize: 10, letterSpacing: 1.5,
                textTransform: "uppercase",
                cursor: "pointer", fontFamily: SYS, flexShrink: 0,
              }}
            >
              {label}
            </button>
          ))}

          {/* Inline error */}
          {(error || liveSession.error) && (
            <span style={{
              fontSize: 10, color: "#ef4444",
              padding: "0 12px", letterSpacing: 0.5, flexShrink: 0,
            }}>
              {error || liveSession.error}
            </span>
          )}
        </div>

        {/* Loading banner */}
        {loading && (
          <div style={{
            flexShrink: 0,
            background: "rgba(255,200,0,0.04)",
            borderBottom: "0.5px solid rgba(255,180,0,0.12)",
            padding: "5px 16px",
            fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
            color: "rgba(255,200,0,0.45)", fontFamily: SYS,
          }}>
            Loading — first load takes 30–60 seconds
          </div>
        )}

        {/* ── MAIN GRID — fills all remaining height ───────────────────────── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Track Map — ~50% */}
          <div style={{
            flex: 2,
            borderRight: "0.5px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            <TrackMap
              track={track}
              positions={positions}
              selectedDriver={selectedDriver}
              onSelectDriver={handleSelectDriver}
            />
          </div>

          {/* Standings — ~25% */}
          <div style={{
            flex: 1,
            borderRight: "0.5px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            <StandingsTable
              standings={standings}
              selectedDriver={selectedDriver}
              onSelectDriver={handleSelectDriver}
            />
          </div>

          {/* Telemetry — ~25% */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <TelemetryPanel
              telemetry={telemetry}
              driver={selectedDriver}
              driverColor={driverColor}
              fetchError={error}
            />
          </div>
        </div>
      </div>
    </>
  );
}
