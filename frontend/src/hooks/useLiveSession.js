import { useState, useRef, useCallback, useEffect } from "react";

function wsUrl(path) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api${path}`;
}

export function useLiveSession() {
  const [frames, setFrames] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const connect = useCallback((sessionId, mode = "replay", speed = 10) => {
    wsRef.current?.close();
    setFrames([]);
    setError(null);

    const path = mode === "live"
      ? `/ws/live/${sessionId}`
      : `/ws/replay/${sessionId}?speed=${speed}`;

    const ws = new WebSocket(wsUrl(path));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("WebSocket connection failed");
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

  // Clean up on unmount
  useEffect(() => () => wsRef.current?.close(), []);

  return { frames, connected, error, connect, disconnect };
}
