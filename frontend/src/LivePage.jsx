import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "./hooks/useSession";
import { useLiveSession } from "./hooks/useLiveSession";
import { BASE, API } from "./utils/api";
import TrackMap from "./components/TrackMap";
import StandingsTable from "./components/StandingsTable";
import TelemetryPanel from "./components/TelemetryPanel";

// Sessions listed soonest → latest in a standard race weekend
const WEEKEND = [
  { type: "FP1", label: "Practice 1", daysBeforeRace: 2 },
  { type: "FP2", label: "Practice 2", daysBeforeRace: 2 },
  { type: "FP3", label: "Practice 3", daysBeforeRace: 1 },
  { type: "Q",   label: "Qualifying", daysBeforeRace: 1 },
  { type: "R",   label: "Race",       daysBeforeRace: 0 },
];

function daysBetween(dateStr) {
  const race = new Date(dateStr);
  race.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((race - today) / 86_400_000);
}

// Best guess at which session is likely live right now
function guessSession(daysToRace) {
  if (daysToRace === 0) return "R";
  if (daysToRace === 1) return new Date().getHours() >= 14 ? "Q" : "FP3";
  if (daysToRace === 2) return new Date().getHours() >= 15 ? "FP2" : "FP1";
  return null;
}

function formatCountdown(ms) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

function pad(n) { return String(n).padStart(2, "0"); }

function formatTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${pad(m)}:${pad(sec)}`
    : `${m}:${pad(sec)}`;
}

export default function LivePage({ onBack }) {
  const {
    sessionInfo, frames, track, standingsByLap, telemetry,
    loading, error, loadSession, fetchTelemetry,
  } = useSession();
  const liveSession = useLiveSession();

  const [schedule, setSchedule] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [backendOffline, setBackendOffline] = useState(false);
  const autoConnected = useRef(false);

  // Health check on mount — instant offline detection before WS timeout
  useEffect(() => {
    fetch(`${BASE}/health`)
      .then((r) => { if (!r.ok) setBackendOffline(true); })
      .catch(() => setBackendOffline(true));
  }, []);

  // Fetch schedule once
  useEffect(() => {
    fetch(`${API}/sessions/2026`)
      .then((r) => r.json())
      .then(setSchedule)
      .catch(() => {});
  }, []);

  // Find next/current race from schedule
  const nextRace = schedule.find(
    (e) => daysBetween(e.date) >= 0
  ) ?? schedule[schedule.length - 1];

  const daysToRace = nextRace ? daysBetween(nextRace.date) : null;
  const inWeekend = daysToRace !== null && daysToRace >= 0 && daysToRace <= 3;

  // Countdown ticker
  useEffect(() => {
    if (!nextRace || inWeekend) return;
    const raceDate = new Date(nextRace.date);
    raceDate.setHours(14, 0, 0, 0); // approximate race start local time
    const tick = () => setCountdown(formatCountdown(raceDate - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRace, inWeekend]);

  // Auto-select the most likely active session when entering a race weekend
  useEffect(() => {
    if (inWeekend && !selectedSession) {
      setSelectedSession(guessSession(daysToRace));
    }
  }, [inWeekend, daysToRace, selectedSession]);

  // Auto-load when we have a session type selected in weekend mode
  useEffect(() => {
    if (!inWeekend || !selectedSession || !nextRace || sessionInfo) return;
    loadSession(2026, nextRace.round, selectedSession);
  }, [inWeekend, selectedSession, nextRace]);

  // Auto-connect to live WebSocket once session is loaded
  useEffect(() => {
    if (sessionInfo && !autoConnected.current && !liveSession.connected) {
      autoConnected.current = true;
      liveSession.connect(sessionInfo.session_id, "live");
    }
  }, [sessionInfo]);

  // Reset auto-connect flag when session changes
  useEffect(() => {
    autoConnected.current = false;
    liveSession.disconnect();
  }, [selectedSession]);

  // Always show latest frame in live mode
  useEffect(() => {
    if (liveSession.frames.length > 0) {
      setFrameIdx(liveSession.frames.length - 1);
    }
  }, [liveSession.frames.length]);

  function handleSelectDriver(driver) {
    setSelectedDriver(driver);
    if (sessionInfo) fetchTelemetry(sessionInfo.session_id, driver);
  }

  function handleSwitchSession(type) {
    autoConnected.current = false;
    liveSession.disconnect();
    setSelectedDriver(null);
    setFrameIdx(0);
    setSelectedSession(type);
  }

  // Derive current display data
  const activeFrames = liveSession.frames;
  const currentFrame = activeFrames[frameIdx];
  const positions = currentFrame?.positions ?? [];
  const raceTime = currentFrame?.time ?? 0;
  const currentLap = currentFrame?.lap ?? 1;
  const maxStandingsLap = Object.keys(standingsByLap).length
    ? Math.max(...Object.keys(standingsByLap).map(Number)) : 1;
  const standings = standingsByLap[String(Math.min(currentLap, maxStandingsLap))] ?? [];
  const driverColor = standings.find((s) => s.driver === selectedDriver)?.color;
  const isConnected = liveSession.connected;
  const hasFrames = activeFrames.length > 0;
  const isOffline = backendOffline || liveSession.backendOffline;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <div className="h-[3px] bg-gradient-to-r from-red-600 to-red-900 flex-shrink-0" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#0d0d14] border-b border-[#1e1e2e] flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm"
          >
            <span>←</span>
            <div className="bg-red-600 px-1.5 py-0.5 rounded-sm">
              <span className="text-white font-black text-xs tracking-widest">F1</span>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-[0.25em] text-gray-600 uppercase">
              Live Timing
            </span>
            {isConnected && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-red-400 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>
        {raceTime > 0 && (
          <span className="font-mono text-sm text-gray-400">{formatTime(raceTime)}</span>
        )}
      </div>

      {/* ── BACKEND OFFLINE ── */}
      {isOffline && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
            Backend Offline
          </span>
          <span style={{ fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,0.15)", textTransform: "uppercase" }}>
            Start the server on the host machine to continue.
          </span>
        </div>
      )}

      {/* ── COUNTDOWN (pre-weekend) ── */}
      {!isOffline && !inWeekend && nextRace && countdown && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-4 h-[2px] bg-red-600" />
            <span className="text-[10px] text-red-500 tracking-[0.35em] uppercase font-semibold">
              Next Race
            </span>
          </div>

          <h2 className="text-4xl font-black tracking-tight uppercase text-center mb-1">
            {nextRace.name}
          </h2>
          <p className="text-gray-600 text-sm mb-12 text-center">
            Round {nextRace.round} · {nextRace.country} ·{" "}
            {new Date(nextRace.date).toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>

          {/* Countdown */}
          <div className="grid grid-cols-4 gap-3 mb-12 w-full max-w-md">
            {[
              { value: countdown.d, label: "Days" },
              { value: countdown.h, label: "Hours" },
              { value: countdown.m, label: "Min" },
              { value: countdown.s, label: "Sec" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4 text-center"
              >
                <div className="text-4xl font-black tabular-nums tracking-tight text-white">
                  {pad(value)}
                </div>
                <div className="text-[10px] text-gray-700 uppercase tracking-widest mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Weekend schedule preview */}
          <div className="w-full max-w-sm">
            <div className="text-[10px] text-[#2a2a3a] tracking-[0.3em] uppercase mb-3">
              Weekend Schedule
            </div>
            <div className="flex flex-col gap-1">
              {WEEKEND.map((s) => {
                const sessionDate = new Date(nextRace.date);
                sessionDate.setDate(sessionDate.getDate() - s.daysBeforeRace);
                const isRace = s.type === "R";
                return (
                  <div
                    key={s.type}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
                      isRace
                        ? "border-red-900/50 bg-red-950/20 text-white"
                        : "border-[#1e1e2e] bg-[#0d0d14] text-gray-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isRace && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span className={`font-semibold text-xs ${isRace ? "text-white" : "text-gray-600"}`}>
                        {s.label}
                      </span>
                    </div>
                    <span className="text-xs text-[#333]">
                      {sessionDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── RACE WEEKEND ── */}
      {!isOffline && inWeekend && (
        <div className="flex flex-col flex-1">
          {/* Session selector */}
          <div className="px-6 py-3 border-b border-[#1e1e2e] bg-[#0a0a0f] flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-600 tracking-[0.25em] uppercase mr-1">
              {nextRace?.name}
            </span>
            <div className="flex items-center gap-1 bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-1">
              {WEEKEND.map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleSwitchSession(s.type)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    selectedSession === s.type
                      ? s.type === "R"
                        ? "bg-red-900/50 text-red-300 border border-red-800/50"
                        : "bg-[#2a2a3a] text-white"
                      : "text-gray-600 hover:text-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {loading && (
              <span className="text-xs text-yellow-500/70">Loading session…</span>
            )}
            {error && (
              <span className="text-xs text-red-400">{error}</span>
            )}
            {isConnected && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Connected · {activeFrames.length} frames
              </span>
            )}
            {sessionInfo && !isConnected && !loading && (
              <span className="ml-auto text-xs text-gray-600">Connecting to live stream…</span>
            )}
          </div>

          {loading && (
            <div className="px-6 py-2.5 bg-[#12100a] border-b border-yellow-900/40 text-yellow-500/70 text-xs">
              Downloading session data — first load takes 30–60 seconds…
            </div>
          )}

          {/* Panels */}
          {hasFrames ? (
            <div className="flex flex-col flex-1 gap-3 p-4">
              {/* Live bar */}
              <div className="flex items-center gap-3 px-1">
                <span className="flex items-center gap-2 text-xs text-red-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
                <span className="text-xs text-gray-600 font-mono">{formatTime(raceTime)}</span>
                <div className="flex-1 h-px bg-[#1e1e2e]" />
                <span className="text-xs text-[#2a2a3a] font-mono">Lap {currentLap}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1">
                <TrackMap
                  track={track}
                  positions={positions}
                  selectedDriver={selectedDriver}
                  onSelectDriver={handleSelectDriver}
                />
                <StandingsTable
                  standings={standings}
                  selectedDriver={selectedDriver}
                  onSelectDriver={handleSelectDriver}
                />
                <TelemetryPanel
                  telemetry={telemetry}
                  driver={selectedDriver}
                  driverColor={driverColor}
                  fetchError={error}
                />
              </div>
            </div>
          ) : (
            !loading && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                <div className="w-3 h-3 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                <p className="text-gray-600 text-sm">
                  {sessionInfo
                    ? "Connecting to live stream…"
                    : "Select a session above to connect"}
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* No schedule loaded yet */}
      {!isOffline && !nextRace && !schedule.length && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
}
