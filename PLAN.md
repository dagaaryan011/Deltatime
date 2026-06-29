# F1 Live Dashboard — Project Plan

**Gift for:** Aryan's brother (birthday: 19 July)  
**Hard deadline:** British GP weekend, 4–6 July (v1 live for a real race)  
**Stack:** FastF1 + FastAPI backend · React 19 + Vite + Tailwind frontend · Render (backend) · Vercel (frontend)  
**Constraint:** Zero cost

---

## What We're Building

A live + historical F1 dashboard with:
- Driver positions on an SVG track map, updating in near-real-time during races
- Per-driver telemetry (speed, throttle, brake, gear, DRS)
- Standings, gaps, intervals
- Tyre compound + age tracker
- Historical race/qualifying replay (works between race weekends)

---

## Project Structure

```
f1-dashboard/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket endpoint
│   ├── live.py              # Live timing poller (FastF1 live session)
│   ├── historical.py        # Historical session loader (FastF1 cache)
│   ├── models.py            # Pydantic models for API responses
│   ├── cache/               # FastF1 local cache directory
│   ├── requirements.txt
│   └── render.yaml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TrackMap.jsx          # SVG track with driver dots
│   │   │   ├── TelemetryPanel.jsx    # Speed/throttle/brake traces
│   │   │   ├── StandingsTable.jsx    # Live gaps + intervals
│   │   │   ├── TyreTracker.jsx       # Compound + age per driver
│   │   │   ├── SessionHeader.jsx     # Race name, lap, flag status
│   │   │   └── DriverCard.jsx        # Per-driver mini summary
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js       # WS connection + reconnect logic
│   │   │   └── useSession.js         # Session state management
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
└── PLAN.md
```

---

## Phase 1 — Historical Mode (Days 1–4)

Get the dashboard working on past race data first. This is the foundation.

### Backend Tasks
- [ ] Set up FastAPI project with FastF1
- [ ] `GET /sessions/{year}` — list all sessions for a year
- [ ] `GET /session/{year}/{round}/{type}` — load a session (R=Race, Q=Qualifying, S=Sprint)
- [ ] `GET /session/{id}/positions` — all driver positions per lap (x, y, driver code, colour)
- [ ] `GET /session/{id}/telemetry/{driver}` — speed, throttle, brake, gear, DRS for a lap
- [ ] `GET /session/{id}/standings` — gap to leader, interval, tyre, lap count
- [ ] FastF1 cache configured to `/backend/cache/`

### Frontend Tasks
- [ ] Vite + React 19 + Tailwind setup
- [ ] Session picker (year → round → session type)
- [ ] SVG track map rendering driver positions (colour-coded by team)
- [ ] Lap scrubber — replay positions lap by lap
- [ ] Telemetry panel for selected driver
- [ ] Standings table with tyre compounds

### Key FastF1 APIs to use
```python
import fastf1

session = fastf1.get_session(2024, 'British Grand Prix', 'R')
session.load()

# Positions
pos = session.pos_data  # dict of driver -> DataFrame with X, Y, Time

# Telemetry
laps = session.laps.pick_driver('VER')
fastest = laps.pick_fastest()
tel = fastest.get_telemetry()  # Speed, Throttle, Brake, nGear, DRS, X, Y

# Results
session.results  # Final standings, gap, tyre info
```

---

## Phase 2 — Live Mode (Days 5–8)

### How FastF1 Live Works
FastF1 has a `SignalRClient` that connects to F1's live timing feed during race weekends. It streams:
- Position data (~3.7Hz, ~30s delay from broadcast)
- Timing data (gaps, intervals, sector times)
- Car data (speed, gear, DRS)
- Session status (flag, safety car, VSC)

### Backend Tasks
- [ ] `live.py` — SignalRClient wrapper that polls during active sessions
- [ ] WebSocket endpoint `WS /live` — pushes updates to frontend every ~1s
- [ ] Session detection — auto-detects if a live session is active
- [ ] Graceful fallback — if no live session, serves latest historical

### Frontend Tasks
- [ ] `useWebSocket.js` hook with auto-reconnect
- [ ] Live mode toggle (auto-detected from backend)
- [ ] Animated driver dots on track map (smooth interpolation between position updates)
- [ ] Live standings with delta highlighting (position changes flash)
- [ ] Flag status banner (green/yellow/red/SC/VSC)

### Live session setup
```python
from fastf1.livetiming.client import SignalRClient

client = SignalRClient(filename="live_data.txt")
client.start()  # Streams to file during active session
```

---

## Phase 3 — Polish + Deploy (Days 9–12)

### Design
- Dark theme (F1 aesthetic — near-black background, team colours for drivers)
- Team colour map for all 10 teams (hardcode from F1 2024/2025 season)
- Mobile-friendly layout (brother might watch on phone)
- Loading states for slow FastF1 cache misses

### Deployment
**Backend → Render (free tier)**
- FastAPI with uvicorn
- FastF1 cache persisted via Render disk (or rebuild on startup — first load slow but acceptable)
- GROQ_API_KEY not needed here — no LLM
- `render.yaml` configured

**Frontend → Vercel (free)**
- Vite build
- `VITE_API_URL` env var pointing to Render backend URL
- Auto-deploy from GitHub

### Environment Variables
```
# Backend (Render)
FASTF1_CACHE_PATH=/opt/render/project/cache

# Frontend (Vercel)
VITE_API_URL=https://your-render-app.onrender.com
```

---

## Phase 4 — Nice to Haves (if time permits before 19 July)

- [ ] Driver comparison mode (overlay two drivers' telemetry)
- [ ] Pit stop history timeline
- [ ] Weather panel (air temp, track temp, rainfall)
- [ ] Qualifying lap comparison (sector colours: purple/green/yellow)
- [ ] Season championship standings tracker

---

## Team Colour Map (2025 Season)

```python
TEAM_COLOURS = {
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Mercedes": "#27F4D2",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "Racing Bulls": "#6692FF",
    "Haas": "#B6BABD",
    "Kick Sauber": "#52E252",
}
```

---

## FastF1 Gotchas

1. **First load is slow** — FastF1 downloads telemetry from F1's CDN on first access, then caches. Budget 30–60s for first session load. Show a loading state.
2. **Live timing only works during race weekends** — outside of sessions, the SignalRClient has nothing to connect to. Always have historical fallback.
3. **Position data coordinate system** — X, Y are in F1's internal coordinate system, not GPS. You'll need to normalise them to fit your SVG viewBox. Each circuit has different scale.
4. **Cache size** — full season telemetry can be several GB. On Render free tier, don't persist cache across deploys. Fetch on demand and cache in memory per session.
5. **Driver codes** — use `session.drivers` to get the list for that session. Don't hardcode.

---

## First Steps for Claude Code

1. `cd /mnt/devdrive && mkdir f1-dashboard && cd f1-dashboard`
2. Create `backend/` and `frontend/` directories
3. `pip install fastf1 fastapi uvicorn pydantic --break-system-packages`
4. Start with `backend/historical.py` — load the 2024 British GP and verify you can extract positions + telemetry
5. Once data looks right, wrap it in FastAPI endpoints
6. Frontend comes after at least one endpoint is working

**First thing to verify in Claude Code:**
```python
import fastf1
fastf1.Cache.enable_cache('./cache')
session = fastf1.get_session(2024, 'British Grand Prix', 'R')
session.load(telemetry=True, weather=False, messages=False)
print(session.results[['Abbreviation', 'TeamName', 'Position']])
```

If that prints a standings table, the foundation works.
