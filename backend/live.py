"""
Live timing bridge.

Two modes:
  - Replay  (/ws/replay/{session_id}): streams cached historical frames over
    WebSocket at configurable speed. Testable any time.
  - Live    (/ws/live/{session_id}):   connects to F1's SignalR stream during
    an active session and broadcasts real-time position frames.
    Only works on race weekends when livetiming.formula1.com is active.
"""

import asyncio
import base64
import json
import threading
import time
import zlib
from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect
from fastf1.livetiming.client import SignalRClient
from signalrcore.messages.completion_message import CompletionMessage

import historical


# ── Connection manager ────────────────────────────────────────────────────────

class _ConnManager:
    def __init__(self):
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self._rooms[room].add(ws)

    def disconnect(self, room: str, ws: WebSocket):
        self._rooms[room].discard(ws)

    async def broadcast(self, room: str, frame: dict):
        dead = set()
        for ws in list(self._rooms[room]):
            try:
                await ws.send_json(frame)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._rooms[room].discard(ws)


conn_manager = _ConnManager()


# ── Position.z decoder ────────────────────────────────────────────────────────

def _decode_position_z(raw: str) -> list[dict]:
    """Decompress a Position.z payload → list of {Timestamp, Entries} dicts."""
    try:
        return json.loads(
            zlib.decompress(base64.b64decode(raw), -zlib.MAX_WBITS)
        ).get('Position', [])
    except Exception:
        return []


# ── Live bridge (subclasses SignalRClient) ────────────────────────────────────

class _LiveBridge(SignalRClient):
    """
    Intercepts SignalR messages from F1's live timing service and broadcasts
    parsed position frames to all connected WebSocket clients for this session.
    """

    def __init__(self, session_id: str, loop: asyncio.AbstractEventLoop,
                 track_pts, track_cum, track_total, bounds, driver_info):
        import tempfile
        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        super().__init__(filename=tmp.name)
        tmp.close()

        self._sid = session_id
        self._loop = loop
        self._track_pts = track_pts
        self._track_cum = track_cum
        self._track_total = track_total
        self._bounds = bounds
        self._driver_info = driver_info  # {driver_num: {abbr, color}}

        self._prev_raw: dict = {}
        self._cum: dict = {}
        self._start: float | None = None
        self._lap = 1

    def _broadcast(self, frame: dict):
        asyncio.run_coroutine_threadsafe(
            conn_manager.broadcast(self._sid, frame), self._loop
        )

    def _on_message(self, msg):
        """Override: parse and broadcast instead of writing to file."""
        self._t_last_message = time.time()

        entries: list[tuple] = []
        if isinstance(msg, CompletionMessage):
            for k, v in msg.result.items():
                entries.append((k, v))
        elif isinstance(msg, list):
            for item in msg:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    entries.append((item[0], item[1]))

        for topic, data in entries:
            if topic == 'Position.z':
                self._handle_positions(data)
            elif topic == 'LapCount' and isinstance(data, dict):
                self._lap = int(data.get('CurrentLap', self._lap))

    def _handle_positions(self, raw):
        if self._start is None:
            self._start = time.time()
        x_min, x_max, y_min, y_max = self._bounds

        for entry in _decode_position_z(raw):
            positions = []
            for dnum, pos in entry.get('Entries', {}).items():
                if pos.get('Status') not in ('OnTrack', 'OffTrack'):
                    continue
                try:
                    x = historical._norm(pos['X'], x_min, x_max)
                    y = historical._norm(pos['Y'], y_min, y_max)
                    raw_pct = historical._project_to_track(
                        self._track_pts, self._track_cum, self._track_total, x, y
                    )
                    prev = self._prev_raw.get(dnum, raw_pct)
                    delta = raw_pct - prev
                    if delta < -0.5:
                        delta += 1.0
                    elif delta > 0.5:
                        delta = 0.0
                    self._cum[dnum] = self._cum.get(dnum, raw_pct) + delta
                    self._prev_raw[dnum] = raw_pct

                    info = self._driver_info.get(dnum, {})
                    positions.append({
                        'driver': info.get('abbr', dnum),
                        'track_pct': round(self._cum[dnum], 4),
                        'color': info.get('color', '#ffffff'),
                    })
                except Exception:
                    continue

            if positions:
                self._broadcast({
                    'time': int(time.time() - self._start),
                    'lap': self._lap,
                    'positions': positions,
                    'live': True,
                })


_active_bridges: dict[str, _LiveBridge] = {}


def _ensure_bridge(session_id: str, loop, session, bounds) -> None:
    """Start a bridge for this session if one isn't already running."""
    if session_id in _active_bridges:
        return

    driver_info = {}
    for num in session.drivers:
        try:
            d = session.get_driver(num)
            driver_info[num] = {
                'abbr': d['Abbreviation'],
                'color': historical.get_team_colour(d['TeamName']),
            }
        except Exception:
            pass

    track_pts_list = historical.get_track_outline(session, bounds)
    t_pts, t_cum, t_total = historical._build_track_index(track_pts_list)

    bridge = _LiveBridge(
        session_id=session_id, loop=loop,
        track_pts=t_pts, track_cum=t_cum, track_total=t_total,
        bounds=bounds, driver_info=driver_info,
    )
    _active_bridges[session_id] = bridge
    threading.Thread(target=bridge.start, daemon=True).start()


# ── WebSocket handlers (called from main.py) ──────────────────────────────────

async def handle_replay(ws: WebSocket, session_id: str, session, bounds, speed: float):
    """Stream cached historical frames as if they were arriving live."""
    frames = historical.get_all_positions(session, bounds, step=10)
    room = f'{session_id}:replay'
    await conn_manager.connect(room, ws)
    try:
        for frame in frames:
            await ws.send_json(frame)
            await asyncio.sleep(10.0 / speed)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        conn_manager.disconnect(room, ws)


async def handle_live(ws: WebSocket, session_id: str, session, bounds):
    """Connect to F1's live timing stream and relay frames. Active on race weekends."""
    loop = asyncio.get_running_loop()
    _ensure_bridge(session_id, loop, session, bounds)
    await conn_manager.connect(session_id, ws)
    try:
        # The bridge broadcasts independently; just keep the connection alive.
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        conn_manager.disconnect(session_id, ws)
