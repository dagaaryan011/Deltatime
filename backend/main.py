from fastapi import FastAPI, HTTPException, WebSocket, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import historical
import live

app = FastAPI(title="F1 Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/sessions/{year}")
def list_sessions(year: int):
    try:
        return historical.list_events(year)
    except Exception as e:
        raise HTTPException(500, str(e))


# Routes with literal path segments must be defined BEFORE the 3-wildcard loader
# route, otherwise FastAPI matches /{year}/{round}/{type} first and 422s on type parsing.

@api.get("/session/{session_id}/positions")
def get_positions(session_id: str, lap: int = 1):
    if session_id not in historical._cache:
        raise HTTPException(404, "Session not loaded.")
    session, bounds = historical._cache[session_id]
    return historical.get_positions(session, bounds, lap)


@api.get("/session/{session_id}/track")
def get_track(session_id: str):
    if session_id not in historical._cache:
        raise HTTPException(404, "Session not loaded.")
    session, bounds = historical._cache[session_id]
    return historical.get_track_outline(session, bounds)


@api.get("/session/{session_id}/all_positions")
def get_all_positions(session_id: str, step: int = 10):
    if session_id not in historical._cache:
        raise HTTPException(404, "Session not loaded.")
    session, bounds = historical._cache[session_id]
    return historical.get_all_positions(session, bounds, step)


@api.get("/session/{session_id}/standings_by_lap")
def get_standings_by_lap(session_id: str):
    if session_id not in historical._cache:
        raise HTTPException(404, "Session not loaded.")
    session, _ = historical._cache[session_id]
    return historical.get_standings_by_lap(session)


@api.get("/session/{session_id}/standings")
def get_standings(session_id: str):
    if session_id not in historical._cache:
        raise HTTPException(404, "Session not loaded.")
    session, _ = historical._cache[session_id]
    return historical.get_standings(session)


@api.get("/session/{session_id}/telemetry/{driver}")
def get_telemetry(session_id: str, driver: str, lap: int = None):
    if session_id not in historical._cache:
        raise HTTPException(404, "Session not loaded.")
    session, bounds = historical._cache[session_id]
    try:
        return historical.get_telemetry(session, bounds, driver.upper(), lap)
    except Exception as e:
        raise HTTPException(500, str(e))


# 3-wildcard route last — must not shadow the specific routes above
@api.get("/session/{year}/{round_num}/{session_type}")
def load_session(year: int, round_num: int, session_type: str):
    """Load a session into memory. First call takes 30-60s (FastF1 downloads data)."""
    try:
        session, _ = historical.load_session(year, round_num, session_type)
        sid = historical._session_id(year, round_num, session_type)
        return historical.get_session_info(session, sid)
    except Exception as e:
        raise HTTPException(500, str(e))


app.include_router(api)


# ── WebSocket endpoints ───────────────────────────────────────────────────────

@app.websocket("/api/ws/replay/{session_id}")
async def ws_replay(websocket: WebSocket, session_id: str, speed: float = 10.0):
    """Stream cached historical frames over WebSocket (simulates live for testing)."""
    if session_id not in historical._cache:
        await websocket.close(code=1008, reason="Session not loaded")
        return
    session, bounds = historical._cache[session_id]
    await live.handle_replay(websocket, session_id, session, bounds, speed)


@app.websocket("/api/ws/live/{session_id}")
async def ws_live(websocket: WebSocket, session_id: str):
    """Connect to F1's live timing SignalR stream. Active only during sessions."""
    if session_id not in historical._cache:
        await websocket.close(code=1008, reason="Session not loaded")
        return
    session, bounds = historical._cache[session_id]
    await live.handle_live(websocket, session_id, session, bounds)


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Serve React frontend (production) ────────────────────────────────────────
# In dev, Vite serves the frontend directly. This only activates when dist/ exists.

DIST = Path(__file__).parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        f = DIST / full_path
        if f.is_file():
            return FileResponse(str(f))
        return FileResponse(str(DIST / "index.html"))
