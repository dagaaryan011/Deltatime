import { useState, useEffect, useRef } from "react";

// ── utilities ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function shortName(name) {
  return name.replace(" Grand Prix", " GP");
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Copied from LivePage.jsx
function guessSession(daysToRace) {
  if (daysToRace === 0) return "R";
  if (daysToRace === 1) return new Date().getHours() >= 14 ? "Q" : "FP3";
  if (daysToRace === 2) return new Date().getHours() >= 15 ? "FP2" : "FP1";
  return null;
}

const SESSION_LABELS = {
  R: "Race", Q: "Qualifying",
  FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3",
};

function pad2(n) { return String(n).padStart(2, "0"); }

// ── style constants ───────────────────────────────────────────────────────────

const BASE = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "white",
};

const BTN_ON = {
  ...BASE,
  display: "block",
  width: "100%",
  background: "#E8002D",
  color: "white",
  border: "none",
  borderRadius: 0,
  padding: "16px 0",
  fontSize: 14,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
  textAlign: "center",
};

const BTN_OFF = {
  ...BTN_ON,
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.3)",
  border: "0.5px solid rgba(255,255,255,0.1)",
  pointerEvents: "none",
  cursor: "default",
};

function dropStyle(focused) {
  return {
    ...BASE,
    display: "block",
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `0.5px solid ${focused ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}`,
    borderRadius: 0,
    color: "white",
    padding: "11px 14px",
    fontSize: 13,
    marginBottom: 8,
    outline: "none",
    cursor: "pointer",
    transition: "border-color 150ms",
  };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function HomePage({ onNavigate }) {
  const [schedule, setSchedule]     = useState([]);
  const [countdown, setCountdown]   = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [hovered, setHovered]       = useState(null); // 'live' | 'historical' | null
  const [selYear, setSelYear]       = useState(2026);
  const [selRound, setSelRound]     = useState("");
  const [selSession, setSelSession] = useState("");
  const [focused, setFocused]       = useState(null); // which select is focused
  const calRef = useRef(null);

  // ── data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/sessions/2026")
      .then((r) => r.json())
      .then(setSchedule)
      .catch(() => {});
  }, []);

  const nextRace    = schedule.find((e) => daysUntil(e.date) >= 0) ?? schedule[schedule.length - 1];
  const daysToRace  = nextRace ? daysUntil(nextRace.date) : null;
  const inWeekend   = daysToRace !== null && daysToRace >= 0 && daysToRace <= 3;
  const sessionCode = inWeekend ? guessSession(daysToRace) : null;

  // Countdown ticker — only runs pre-weekend
  useEffect(() => {
    if (!nextRace || inWeekend) return;
    function tick() {
      const ms = new Date(nextRace.date) - Date.now();
      if (ms <= 0) { setCountdown({ d: 0, h: 0, m: 0, s: 0 }); return; }
      const s = Math.floor(ms / 1000);
      setCountdown({
        d: Math.floor(s / 86400),
        h: Math.floor((s % 86400) / 3600),
        m: Math.floor((s % 3600) / 60),
        s: s % 60,
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRace?.date, inWeekend]);

  // Scroll calendar strip to next race on load
  useEffect(() => {
    if (!calRef.current || !nextRace) return;
    const el = calRef.current.querySelector(`[data-round="${nextRace.round}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [nextRace?.round]);

  // ── historical panel ──────────────────────────────────────────────────────

  const rounds2026    = schedule;
  const roundsFallback = Array.from({ length: 24 }, (_, i) => ({
    round: i + 1, name: `Round ${i + 1}`, country: "", date: "",
  }));
  const availableRounds   = selYear === 2026 ? rounds2026 : roundsFallback;
  const selectedRoundData = availableRounds.find((e) => String(e.round) === selRound);
  const allSelected       = Boolean(selRound && selSession);

  // ── panel sizing ──────────────────────────────────────────────────────────

  const leftWidth = hovered === "historical" ? "45%" : hovered === "live" ? "55%" : "50%";

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Embedded CSS: keyframes, scrollbar hide, media query, select options */}
      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
        .live-dot {
          animation: livepulse 2s ease-in-out infinite;
        }
        .cal-strip::-webkit-scrollbar { display: none; }
        .cal-strip { scrollbar-width: none; }
        .drop-sel option { background: #111111; color: #ffffff; }
        @media (max-width: 768px) {
          .split-root      { flex-direction: column !important; height: auto !important; min-height: 100vh; }
          .panel-live      { width: 100% !important; min-height: 60vh; padding-bottom: 120px !important; }
          .panel-hist      { width: 100% !important; min-height: 50vh; }
          .split-divider   { width: 100% !important; height: 0.5px !important; flex-shrink: 0; }
        }
      `}</style>

      <div
        className="split-root"
        onMouseLeave={() => setHovered(null)}
        style={{
          position: "relative",
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "#0a0a0a",
          ...BASE,
        }}
      >
        {/* Wordmark — floats above both panels */}
        <div style={{
          position: "absolute",
          top: 24,
          left: 28,
          fontSize: 13,
          letterSpacing: 3,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          fontWeight: 400,
          userSelect: "none",
          zIndex: 30,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          F1 Analytics
        </div>

        {/* ── LEFT — LIVE ─────────────────────────────────────────────────── */}
        <div
          className="panel-live"
          onMouseEnter={() => setHovered("live")}
          style={{
            width: leftWidth,
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "88px 48px 148px",
            background: "radial-gradient(ellipse at 30% 50%, rgba(232,0,45,0.06) 0%, transparent 70%)",
            transition: "width 300ms ease",
          }}
        >
          {/* ── STATE A: race weekend active ── */}
          {inWeekend && nextRace && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                <span
                  className="live-dot"
                  style={{
                    display: "block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#E8002D",
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  Live
                </span>
              </div>

              <div style={{
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 700,
                lineHeight: 1.1,
                marginBottom: 10,
              }}>
                {nextRace.name}
              </div>

              {sessionCode && (
                <div style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 48,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  {SESSION_LABELS[sessionCode] ?? sessionCode}
                </div>
              )}

              <button onClick={() => onNavigate("live")} style={BTN_ON}>
                Go live →
              </button>
            </>
          )}

          {/* ── STATE B: pre-weekend countdown ── */}
          {!inWeekend && nextRace && (
            <>
              <div style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                marginBottom: 16,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}>
                Next race
              </div>

              <div style={{
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 700,
                lineHeight: 1.1,
                marginBottom: 52,
              }}>
                {nextRace.name}
              </div>

              {/* Countdown blocks */}
              <div style={{ display: "flex", gap: 32, marginBottom: 52 }}>
                {[
                  { value: countdown.d, label: "Days" },
                  { value: countdown.h, label: "Hrs" },
                  { value: countdown.m, label: "Min" },
                  { value: countdown.s, label: "Sec" },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <div style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: "clamp(36px, 5vw, 64px)",
                      fontWeight: 700,
                      color: "white",
                      lineHeight: 1,
                    }}>
                      {pad2(value)}
                    </div>
                    <div style={{
                      fontSize: 10,
                      letterSpacing: 2,
                      color: "rgba(255,255,255,0.35)",
                      textTransform: "uppercase",
                      marginTop: 6,
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <button style={BTN_OFF}>
                Race not started
              </button>
            </>
          )}

          {/* Loading skeleton — before schedule arrives */}
          {!nextRace && (
            <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 13 }}>—</div>
          )}

          {/* ── Calendar strip ── */}
          {schedule.length > 0 && (
            <div
              ref={calRef}
              className="cal-strip"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                overflowX: "auto",
                display: "flex",
                alignItems: "flex-end",
                gap: 28,
                padding: "16px 48px 20px",
                borderTop: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              {schedule.map((e) => {
                const d      = daysUntil(e.date);
                const isNext = nextRace && e.round === nextRace.round;
                const isPast = d < 0 && !isNext;
                return (
                  <div
                    key={e.round}
                    data-round={String(e.round)}
                    style={{
                      flexShrink: 0,
                      opacity: isPast ? 0.25 : isNext ? 1 : 0.5,
                      paddingBottom: 5,
                      borderBottom: isNext
                        ? "1.5px solid #E8002D"
                        : "1.5px solid transparent",
                    }}
                  >
                    <div style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: 0.5,
                      marginBottom: 2,
                    }}>
                      R{pad2(e.round)}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "white",
                      whiteSpace: "nowrap",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}>
                      {shortName(e.name)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── DIVIDER ─────────────────────────────────────────────────────── */}
        <div
          className="split-divider"
          style={{
            width: "0.5px",
            flexShrink: 0,
            background: "rgba(255,255,255,0.08)",
          }}
        />

        {/* ── RIGHT — HISTORICAL ──────────────────────────────────────────── */}
        <div
          className="panel-hist"
          onMouseEnter={() => setHovered("historical")}
          style={{
            flex: 1,
            position: "relative",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "88px 48px 60px",
            background: "#0a0a0a",
          }}
        >
          <div style={{
            fontSize: 11,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            marginBottom: 40,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
            Past races
          </div>

          {/* Year */}
          <select
            className="drop-sel"
            value={selYear}
            onChange={(e) => {
              setSelYear(Number(e.target.value));
              setSelRound("");
              setSelSession("");
            }}
            onFocus={() => setFocused("year")}
            onBlur={() => setFocused(null)}
            style={dropStyle(focused === "year")}
          >
            {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Round — unlocks after year is present (always true, but rounds may be empty) */}
          <select
            className="drop-sel"
            value={selRound}
            disabled={availableRounds.length === 0}
            onChange={(e) => { setSelRound(e.target.value); setSelSession(""); }}
            onFocus={() => setFocused("round")}
            onBlur={() => setFocused(null)}
            style={{
              ...dropStyle(focused === "round"),
              opacity: availableRounds.length === 0 ? 0.35 : 1,
              cursor: availableRounds.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            <option value="">Round</option>
            {availableRounds.map((e) => (
              <option key={e.round} value={String(e.round)}>
                R{pad2(e.round)} — {e.name}
              </option>
            ))}
          </select>

          {/* Session type — unlocks after round chosen */}
          <select
            className="drop-sel"
            value={selSession}
            disabled={!selRound}
            onChange={(e) => setSelSession(e.target.value)}
            onFocus={() => setFocused("session")}
            onBlur={() => setFocused(null)}
            style={{
              ...dropStyle(focused === "session"),
              opacity: !selRound ? 0.35 : 1,
              cursor: !selRound ? "not-allowed" : "pointer",
            }}
          >
            <option value="">Session type</option>
            <option value="R">Race</option>
            <option value="Q">Qualifying</option>
            <option value="S">Sprint</option>
          </select>

          {/* Preview card — fades in when all three are selected */}
          <div style={{
            maxHeight: allSelected && selectedRoundData ? 80 : 0,
            overflow: "hidden",
            opacity: allSelected && selectedRoundData ? 1 : 0,
            transition: "opacity 200ms, max-height 200ms",
            marginBottom: allSelected && selectedRoundData ? 16 : 0,
          }}>
            {selectedRoundData && (
              <div style={{
                padding: "12px 16px",
                background: "rgba(255,255,255,0.04)",
                borderLeft: "2px solid rgba(255,255,255,0.15)",
              }}>
                <div style={{ fontSize: 14, color: "white", fontWeight: 500 }}>
                  {selectedRoundData.name}
                </div>
                {(selectedRoundData.country || selectedRoundData.date) && (
                  <div style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                    marginTop: 4,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}>
                    {[
                      selectedRoundData.country,
                      selectedRoundData.date ? formatDate(selectedRoundData.date) : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => allSelected && onNavigate("historical", { year: selYear, round: selRound, type: selSession })}
            style={allSelected ? BTN_ON : BTN_OFF}
          >
            Load session →
          </button>
        </div>
      </div>
    </>
  );
}
