export const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const API  = `${BASE}/api`;

export function getWsUrl(path) {
  const ws = BASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  return `${ws}${path}`;
}
