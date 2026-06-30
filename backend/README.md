# Deltatime — backend

FastAPI + FastF1 backend. Exposed to the internet via Cloudflare Tunnel.

## Permanent public URL
https://526edc09-1ce6-4947-bfd6-11ef494b3ac4.cfargotunnel.com

This URL never changes. Set it as VITE_API_URL in Vercel once and forget it.

## Prerequisites (one-time setup, already done on Sadaharu-03)
- Python deps: `pip install -r requirements.txt --break-system-packages`
- cloudflared installed via apt

## Every race weekend
```bash
cd backend
bash start.sh
```

Ctrl+C to stop both FastAPI and the tunnel together.

## Tunnel details
- Name: deltatime
- ID: 526edc09-1ce6-4947-bfd6-11ef494b3ac4
- Token: stored in start.sh (not committed to git)
- Edge locations: Mumbai (maa05, bom10) — optimal for India

## Health check
```bash
curl https://526edc09-1ce6-4947-bfd6-11ef494b3ac4.cfargotunnel.com/health
# Expected: {"status": "ok"}
```
