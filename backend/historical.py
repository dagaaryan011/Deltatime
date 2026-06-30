import os
import fastf1
import numpy as np
import pandas as pd
from pathlib import Path

_cache_dir = os.environ.get("F1_CACHE_DIR", str(Path(__file__).parent / "cache"))
fastf1.Cache.enable_cache(_cache_dir)

TEAM_COLOURS = {
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Mercedes": "#27F4D2",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "Racing Bulls": "#6692FF",
    "RB": "#6692FF",
    "AlphaTauri": "#6692FF",
    "Haas": "#B6BABD",
    "Haas F1 Team": "#B6BABD",
    "Kick Sauber": "#52E252",
    "Sauber": "#52E252",
}

# in-memory session cache: session_id -> (session, bounds)
_cache: dict = {}


def _session_id(year: int, round_num: int, session_type: str) -> str:
    return f"{year}_{round_num}_{session_type}"


def get_team_colour(team: str) -> str:
    for key, colour in TEAM_COLOURS.items():
        if key.lower() in team.lower() or team.lower() in key.lower():
            return colour
    return "#FFFFFF"


def _compute_bounds(session) -> tuple:
    all_x, all_y = [], []
    for driver_num in session.drivers:
        if driver_num in session.pos_data:
            df = session.pos_data[driver_num]
            x = df["X"].dropna()
            y = df["Y"].dropna()
            if len(x):
                all_x.extend(x.tolist())
            if len(y):
                all_y.extend(y.tolist())
    if not all_x:
        return (0.0, 1000.0, 0.0, 1000.0)
    return (min(all_x), max(all_x), min(all_y), max(all_y))


def _norm(val, lo, hi) -> float:
    if hi == lo:
        return 500.0
    return round((float(val) - lo) / (hi - lo) * 1000, 1)


def load_session(year: int, round_num: int, session_type: str):
    sid = _session_id(year, round_num, session_type)
    if sid not in _cache:
        session = fastf1.get_session(year, round_num, session_type)
        session.load(telemetry=True, weather=False, messages=False)
        bounds = _compute_bounds(session)
        _cache[sid] = (session, bounds)
    return _cache[sid]


def list_events(year: int) -> list[dict]:
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    events = []
    for _, row in schedule.iterrows():
        date = row["EventDate"]
        events.append({
            "round": int(row["RoundNumber"]),
            "name": row["EventName"],
            "country": row["Country"],
            "date": str(date.date()) if hasattr(date, "date") else str(date),
        })
    return events


def get_session_info(session, session_id: str) -> dict:
    total_laps = int(session.laps["LapNumber"].max()) if len(session.laps) else 0
    drivers = [session.get_driver(d)["Abbreviation"] for d in session.drivers]
    year = int(session_id.split("_")[0])
    return {
        "session_id": session_id,
        "year": year,
        "round": int(session.event["RoundNumber"]),
        "name": session.event["EventName"],
        "session_type": session.name,
        "total_laps": total_laps,
        "drivers": drivers,
    }


def get_positions(session, bounds: tuple, lap_num: int) -> list[dict]:
    x_min, x_max, y_min, y_max = bounds
    positions = []

    for driver_num in session.drivers:
        try:
            driver_laps = session.laps[session.laps["DriverNumber"] == driver_num]
            lap_row = driver_laps[driver_laps["LapNumber"] == lap_num]
            if lap_row.empty:
                continue

            lap_start = lap_row["LapStartTime"].iloc[0]
            lap_time = lap_row["LapTime"].iloc[0]
            target_td = lap_start + lap_time if pd.notna(lap_time) else lap_start
            target_date = session.t0_date + target_td

            if driver_num not in session.pos_data:
                continue

            pos_df = session.pos_data[driver_num]
            idx = min(int(pos_df["Date"].searchsorted(target_date)), len(pos_df) - 1)
            row = pos_df.iloc[idx]

            driver_info = session.get_driver(driver_num)
            positions.append({
                "driver": driver_info["Abbreviation"],
                "number": driver_num,
                "x": _norm(row["X"], x_min, x_max),
                "y": _norm(row["Y"], y_min, y_max),
                "color": get_team_colour(driver_info["TeamName"]),
            })
        except Exception:
            continue

    return positions


def get_track_outline(session, bounds: tuple) -> list[dict]:
    x_min, x_max, y_min, y_max = bounds
    try:
        fastest = session.laps.pick_fastest()
        driver_num = fastest["DriverNumber"]
        driver_laps = session.laps[session.laps["DriverNumber"] == driver_num]
        # lap 2 avoids formation lap noise; fall back to lap 1
        for lap_n in (2, 1):
            lap_row = driver_laps[driver_laps["LapNumber"] == lap_n]
            if not lap_row.empty:
                break
        pos_df = lap_row.iloc[0].get_pos_data()
        return [
            {"x": _norm(r["X"], x_min, x_max), "y": _norm(r["Y"], y_min, y_max)}
            for _, r in pos_df.iterrows()
        ]
    except Exception:
        return []


def get_telemetry(session, bounds: tuple, driver: str, lap_num: int | None = None) -> list[dict]:
    x_min, x_max, y_min, y_max = bounds
    laps = session.laps.pick_driver(driver)

    if lap_num is not None:
        lap_rows = laps[laps["LapNumber"] == lap_num]
        if lap_rows.empty:
            return []
        lap = lap_rows.iloc[0]
    else:
        lap = laps.pick_fastest()

    tel = lap.get_telemetry()
    return [
        {
            "distance": round(float(r["Distance"]), 1),
            "speed": round(float(r["Speed"]), 1),
            "throttle": round(float(r["Throttle"]), 1),
            "brake": bool(r["Brake"]),
            "gear": int(r["nGear"]),
            "drs": int(r["DRS"]),
            "x": _norm(r["X"], x_min, x_max),
            "y": _norm(r["Y"], y_min, y_max),
        }
        for _, r in tel.iterrows()
    ]


def _build_track_index(track_points):
    """Precompute cumulative arc lengths for fast nearest-point projection."""
    if not track_points:
        return None, None, 0.0
    pts = np.array([(p["x"], p["y"]) for p in track_points], dtype=np.float64)
    seg_lengths = np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1]))
    cumulative = np.concatenate([[0.0], np.cumsum(seg_lengths)])
    return pts, cumulative, float(cumulative[-1])


def _project_to_track(pts, cumulative, total, x, y) -> float:
    """Return 0–1 fractional position along track for a given X,Y point."""
    if pts is None or total == 0:
        return 0.0
    dists = np.hypot(pts[:, 0] - x, pts[:, 1] - y)
    idx = int(np.argmin(dists))
    return float(cumulative[idx] / total)


def get_all_positions(session, bounds: tuple, step: int = 10) -> list[dict]:
    """Pre-sample ALL driver positions at `step`-second intervals for client-side playback.
    Returns track_pct (cumulative, can exceed 1.0 across laps) so the frontend can use
    SVG getPointAtLength for on-curve animation instead of raw x,y."""
    x_min, x_max, y_min, y_max = bounds

    # Build track index for nearest-point projection
    track_pts_list = get_track_outline(session, bounds)
    t_pts, t_cum, t_total = _build_track_index(track_pts_list)

    # Find actual data date range
    min_date = max_date = None
    for driver_num in session.drivers:
        if driver_num not in session.pos_data:
            continue
        df = session.pos_data[driver_num]
        if df.empty:
            continue
        d0, d1 = df["Date"].iloc[0], df["Date"].iloc[-1]
        if min_date is None or d0 < min_date:
            min_date = d0
        if max_date is None or d1 > max_date:
            max_date = d1

    if min_date is None:
        return []

    # Skip the pre-race period (formation lap, grid wait, etc.)
    # t0_date can be 30-60 min before race start; anchor to first LapStartTime instead
    if len(session.laps):
        first_lap_td = session.laps["LapStartTime"].min()
        race_start = session.t0_date + first_lap_td
        if race_start > min_date:
            min_date = race_start

    # Index pos_data by Date once for fast lookup
    driver_pos = {}
    driver_info_map = {}
    for driver_num in session.drivers:
        if driver_num not in session.pos_data:
            continue
        try:
            driver_info_map[driver_num] = session.get_driver(driver_num)
        except Exception:
            continue
        driver_pos[driver_num] = session.pos_data[driver_num].set_index("Date").sort_index()

    duration = (max_date - min_date).total_seconds()
    race_start_s = (min_date - session.t0_date).total_seconds()

    # Precompute lap start offsets relative to our min_date (race start)
    lap_boundaries = sorted([
        (td.total_seconds() - race_start_s, int(lap))
        for lap, td in session.laps.groupby("LapNumber")["LapStartTime"].min().items()
        if td.total_seconds() >= race_start_s
    ])

    # Cumulative track_pct per driver — survives lap crossings (e.g. 0.95 → 1.05 not → 0.05)
    prev_raw: dict = {}
    cumulative: dict = {}

    frames = []
    t = 0.0

    while t <= duration:
        target = min_date + pd.Timedelta(seconds=t)
        positions = []
        for driver_num, pos_df in driver_pos.items():
            try:
                idx = min(pos_df.index.searchsorted(target), len(pos_df) - 1)
                row = pos_df.iloc[idx]
                x = _norm(row["X"], x_min, x_max)
                y = _norm(row["Y"], y_min, y_max)
                raw_pct = _project_to_track(t_pts, t_cum, t_total, x, y)

                if driver_num in prev_raw:
                    delta = raw_pct - prev_raw[driver_num]
                    if delta < -0.5:   # crossed finish line forward
                        delta += 1.0
                    elif delta > 0.5:  # large backward jump — clamp (pit entry artifact)
                        delta = 0.0
                    cumulative[driver_num] = cumulative[driver_num] + delta
                else:
                    cumulative[driver_num] = raw_pct

                prev_raw[driver_num] = raw_pct
                info = driver_info_map[driver_num]
                positions.append({
                    "driver": info["Abbreviation"],
                    "track_pct": round(cumulative[driver_num], 4),
                    "color": get_team_colour(info["TeamName"]),
                })
            except Exception:
                continue
        # Current lap = latest lap that has started by this race-elapsed time
        current_lap = max(
            (lap for start_s, lap in lap_boundaries if start_s <= t),
            default=1,
        )
        frames.append({"time": int(t), "lap": current_lap, "positions": positions})
        t += step

    return frames


def get_standings_by_lap(session) -> dict:
    """Returns standings at each lap keyed by lap number (as string for JSON).
    Gap is computed from cumulative LapTime sums — accurate for cars on same lap."""
    max_lap = int(session.laps["LapNumber"].max()) if len(session.laps) else 0

    # Precompute cumulative race time per driver at end of each lap
    cum_times: dict = {}  # (driver_num, lap_n) -> cumulative seconds
    for driver_num in session.drivers:
        dl = session.laps[session.laps["DriverNumber"] == driver_num].sort_values("LapNumber")
        running = 0.0
        for _, row in dl.iterrows():
            lt = row["LapTime"]
            if pd.notna(lt):
                running += lt.total_seconds()
            cum_times[(driver_num, int(row["LapNumber"]))] = running

    result = {}
    for lap_n in range(1, max_lap + 1):
        lap_slice = session.laps[session.laps["LapNumber"] == lap_n]
        if lap_slice.empty:
            continue

        entries = []
        for _, row in lap_slice.iterrows():
            driver_num = row["DriverNumber"]
            cum_s = cum_times.get((driver_num, lap_n), 0.0)
            if cum_s <= 0:
                continue
            try:
                info = session.get_driver(driver_num)
            except Exception:
                continue
            tyre = row.get("Compound")
            tyre = tyre if tyre and pd.notna(tyre) else None
            tyre_age = row.get("TyreLife")
            tyre_age = int(tyre_age) if tyre_age and pd.notna(tyre_age) else None
            entries.append({
                "driver": info["Abbreviation"],
                "team": info["TeamName"],
                "color": get_team_colour(info["TeamName"]),
                "cum_s": cum_s,
                "tyre": tyre,
                "tyre_age": tyre_age,
            })

        entries.sort(key=lambda x: x["cum_s"])
        if not entries:
            continue
        leader_s = entries[0]["cum_s"]

        standings = []
        for pos, e in enumerate(entries, 1):
            gap_s = e["cum_s"] - leader_s
            standings.append({
                "position": pos,
                "driver": e["driver"],
                "team": e["team"],
                "color": e["color"],
                "gap": "LEADER" if pos == 1 else f"+{gap_s:.3f}",
                "tyre": e["tyre"],
                "tyre_age": e["tyre_age"],
                "status": "Racing",
            })
        result[str(lap_n)] = standings

    return result


def get_standings(session) -> list[dict]:
    results = session.results.sort_values("Position")
    standings = []

    for _, row in results.iterrows():
        driver_num = row["DriverNumber"]
        driver_laps = session.laps[session.laps["DriverNumber"] == driver_num]

        tyre = tyre_age = None
        if not driver_laps.empty:
            last = driver_laps.loc[driver_laps["LapNumber"].idxmax()]
            raw_tyre = last.get("Compound")
            tyre = raw_tyre if raw_tyre and pd.notna(raw_tyre) else None
            raw_life = last.get("TyreLife")
            tyre_age = int(raw_life) if raw_life and pd.notna(raw_life) else None

        pos = row.get("Position")
        gap_val = row.get("Time", "")
        gap = str(gap_val) if pd.notna(gap_val) and gap_val != "" else str(row.get("Status", ""))

        standings.append({
            "position": int(pos) if pd.notna(pos) else 0,
            "driver": row["Abbreviation"],
            "team": row["TeamName"],
            "color": get_team_colour(row["TeamName"]),
            "gap": gap,
            "tyre": tyre,
            "tyre_age": tyre_age,
            "status": str(row.get("Status", "Finished")),
        })

    return standings
