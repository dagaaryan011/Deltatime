import { useState, useRef, useCallback, useEffect } from "react";
import { getWsUrl } from "../utils/api";

export function useLiveSession() {
  const [frames, setFrames] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const wsRef = useRef(null);

  const connect = useCallback((sessionId, mode = "replay", speed = 10) => {
    wsRef.current?.close();
    setFrames([]);
    setError(null);
    setBackendOffline(false);

    const path = mode === "live"
      ? `/api/ws/live/${sessionId}`
      : `/api/ws/replay/${sessionId}?speed=${speed}`;

    const ws = new WebSocket(getWsUrl(path));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code !== 1000) setBackendOffline(true);
    };
    ws.onerror = () => {
      setError("WebSocket connection failed");
      setBackendOffline(true);
    };
    ws.onmessage = (e) => {
      const frame = JSON.parse(e.data);
      setFrames((prev) => [...prev, frame]);
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setFrames([]);
    setConnected(false);
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  return { frames, connected, error, backendOffline, connect, disconnect };
}
