# Backend — Local Setup

The FastAPI backend runs on your local machine. A Cloudflare Tunnel exposes it to the internet so the Vercel-hosted frontend can reach it.

## One-time setup

**1. Install cloudflared (Linux amd64)**

```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**2. Install Python dependencies**

```bash
cd backend
pip install -r requirements.txt
```

FastF1 will download session data to `backend/cache/` on first load (30–60 s per session).

## Running

From inside the `backend/` directory:

```bash
bash start.sh
```

This starts both uvicorn and the tunnel together. Output looks like:

```
INFO:     Started server process [12345]
INFO:     Application startup complete.
...
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some seconds to be active): |
|  https://abc-def-123.trycloudflare.com                                                    |
+--------------------------------------------------------------------------------------------+
```

Copy the `https://…trycloudflare.com` URL — that is your `VITE_API_URL`.

**Ctrl-C** stops both processes.

## After each restart

The tunnel URL changes every time you run `start.sh`. Update `VITE_API_URL` in:

- **Local dev**: `frontend/.env.local` → `VITE_API_URL=https://new-url.trycloudflare.com`
- **Vercel**: Project Settings → Environment Variables → update `VITE_API_URL`, then redeploy.
