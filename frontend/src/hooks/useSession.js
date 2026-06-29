import { useState, useCallback } from "react";

const API = "/api";

export function useSession() {
  const [events, setEvents] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [frames, setFrames] = useState([]);
  const [track, setTrack] = useState([]);
  const [standingsByLap, setStandingsByLap] = useState({});
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (year) => {
    try {
      const res = await fetch(`${API}/sessions/${year}`);
      setEvents(await res.json());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadSession = useCallback(async (year, round, type) => {
    setLoading(true);
    setError(null);
    setSessionInfo(null);
    setFrames([]);
    setTrack([]);
    setStandingsByLap({});
    setTelemetry([]);
    try {
      const res = await fetch(`${API}/session/${year}/${round}/${type}`);
      if (!res.ok) throw new Error(await res.text());
      const info = await res.json();
      setSessionInfo(info);

      const sid = info.session_id;
      const [framesRes, trackRes, standRes] = await Promise.all([
        fetch(`${API}/session/${sid}/all_positions`),
        fetch(`${API}/session/${sid}/track`),
        fetch(`${API}/session/${sid}/standings_by_lap`),
      ]);
      setFrames(await framesRes.json());
      setTrack(await trackRes.json());
      setStandingsByLap(await standRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTelemetry = useCallback(async (sessionId, driver, lap) => {
    setTelemetry([]);
    setError(null);
    try {
      const url = lap
        ? `${API}/session/${sessionId}/telemetry/${driver}?lap=${lap}`
        : `${API}/session/${sessionId}/telemetry/${driver}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Telemetry ${res.status}: ${body.detail ?? res.statusText}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Telemetry: unexpected response format");
      setTelemetry(data);
    } catch (e) {
      setError(e.message);
      setTelemetry(null); // null = error state, [] = loading
    }
  }, []);

  return {
    events,
    sessionInfo,
    frames,
    track,
    standingsByLap,
    telemetry,
    loading,
    error,
    fetchEvents,
    loadSession,
    fetchTelemetry,
  };
}
