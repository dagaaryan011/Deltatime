export const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const API  = `${BASE}/api`;
// Skips ngrok's browser-warning interstitial, which has no CORS headers and blocks all fetches
export const HEADERS = { "ngrok-skip-browser-warning": "1" };

export function getWsUrl(path) {
  const ws = BASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  return `${ws}${path}`;
}
