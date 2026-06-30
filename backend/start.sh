#!/bin/bash
# Start FastAPI + Cloudflare tunnel together.
# Killing this script (Ctrl-C) kills both processes.
uvicorn main:app --host 0.0.0.0 --port 8000 &
cloudflared tunnel --url http://localhost:8000
