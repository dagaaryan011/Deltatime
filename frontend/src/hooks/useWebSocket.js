import { useEffect, useRef, useCallback } from "react";

// ponytail: stub for Phase 2 live mode
export function useWebSocket(url, onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!url) return;
    ws.current = new WebSocket(url);
    ws.current.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}
