import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

const MONO = "'Courier New', monospace";
const SYS  = "system-ui, -apple-system, sans-serif";

const TOOLTIP_STYLE = {
  background: "#0a0a0a",
  border: "0.5px solid rgba(255,255,255,0.15)",
  borderRadius: 0,
  fontSize: 11,
  fontFamily: MONO,
  color: "white",
};

const CHART_LBL = {
  fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", fontFamily: SYS,
  marginBottom: 6, display: "block",
};

// Shared axis/grid props used on every chart
const AXIS_TICK = { fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: MONO };

function EmptyPanel({ children }) {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0a0a0a",
    }}>
      <span style={{
        fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
        color: "rgba(255,255,255,0.2)", fontFamily: SYS,
      }}>
        {children}
      </span>
    </div>
  );
}

export default function TelemetryPanel({ telemetry, driver, driverColor, fetchError }) {
  if (!driver)          return <EmptyPanel>Select a driver</EmptyPanel>;
  if (telemetry === null) {
    return (
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 6,
        background: "#0a0a0a",
      }}>
        <span style={{ fontSize: 11, color: "#ef4444", letterSpacing: 1, fontFamily: SYS }}>
          Telemetry unavailable
        </span>
        {fetchError && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: SYS }}>
            {fetchError}
          </span>
        )}
      </div>
    );
  }
  if (!telemetry.length) return <EmptyPanel>Loading {driver}…</EmptyPanel>;

  const color = driverColor ?? "#E8002D";

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: "#0a0a0a", fontFamily: SYS, color: "white",
      overflowY: "auto",
    }}>
      {/* Top accent bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px 8px", flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
        }}>
          Telemetry
        </span>
        <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 500, color }}>
          {driver}
        </span>
      </div>

      {/* Charts */}
      <div style={{ flex: 1, padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Speed */}
        <div>
          <span style={CHART_LBL}>Speed (km/h)</span>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={telemetry} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="distance" hide tick={AXIS_TICK} />
              <YAxis domain={[0, 380]} hide tick={AXIS_TICK} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                labelFormatter={(v) => `${v}m`}
                formatter={(v) => [`${v} km/h`, "Speed"]}
              />
              <Line
                type="monotone" dataKey="speed"
                stroke="#E8002D" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Throttle + Brake */}
        <div>
          <span style={CHART_LBL}>Throttle / Brake</span>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={telemetry} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="distance" hide tick={AXIS_TICK} />
              <YAxis domain={[0, 100]} hide tick={AXIS_TICK} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                labelFormatter={(v) => `${v}m`}
              />
              <Line
                type="monotone" dataKey="throttle"
                stroke="rgba(34,197,94,0.8)" strokeWidth={1}
                dot={false} isAnimationActive={false}
              />
              <Line
                type="monotone" dataKey={(d) => (d.brake ? 100 : 0)}
                name="brake"
                stroke="rgba(239,68,68,0.8)" strokeWidth={1}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gear */}
        <div>
          <span style={CHART_LBL}>Gear</span>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={telemetry} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="distance" hide tick={AXIS_TICK} />
              <YAxis domain={[0, 8]} hide tick={AXIS_TICK} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                labelFormatter={(v) => `${v}m`}
                formatter={(v) => [`G${v}`, "Gear"]}
              />
              <Line
                type="stepAfter" dataKey="gear"
                stroke="rgba(255,255,255,0.5)" strokeWidth={1}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
