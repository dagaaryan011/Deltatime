"""
Run: conda run -n f1dashboard python diagnose.py
Loads the 2024 British GP and prints raw position data diagnostics.
"""
import fastf1
import pandas as pd
import numpy as np
from pathlib import Path

fastf1.Cache.enable_cache(str(Path(__file__).parent / "cache"))
fastf1.set_log_level("WARNING")

session = fastf1.get_session(2024, "British Grand Prix", "R")
session.load(telemetry=True, weather=False, messages=False)

print("=" * 60)
print("SESSION:", session.event["EventName"], session.name)
print("t0_date:", session.t0_date)
print()

# --- 1. Data coverage per driver ---
print("=== DRIVER DATA COVERAGE (pos_data) ===")
print(f"{'Driver':<8} {'Start':>20} {'End':>20} {'Points':>8} {'Gaps>5s':>8}")
print("-" * 68)

coverage = {}
for driver_num in sorted(session.drivers):
    if driver_num not in session.pos_data:
        print(f"{driver_num:<8} NO POS DATA")
        continue
    df = session.pos_data[driver_num]
    if df.empty:
        print(f"{driver_num:<8} EMPTY")
        continue
    # Find gaps larger than 5 seconds between consecutive timestamps
    diffs = df["Date"].diff().dt.total_seconds().dropna()
    big_gaps = diffs[diffs > 5]
    abbr = session.get_driver(driver_num)["Abbreviation"]
    start_offset = (df["Date"].iloc[0] - session.t0_date).total_seconds()
    end_offset = (df["Date"].iloc[-1] - session.t0_date).total_seconds()
    print(f"{abbr:<8} {start_offset:>+19.1f}s {end_offset:>+19.1f}s {len(df):>8} {len(big_gaps):>8}")
    coverage[driver_num] = {"start": df["Date"].iloc[0], "end": df["Date"].iloc[-1], "df": df}

print()

# --- 2. Show the largest gaps for a sample driver ---
sample_driver = session.laps.pick_fastest()["DriverNumber"]
sample_abbr = session.get_driver(sample_driver)["Abbreviation"]
print(f"=== TOP 10 BIGGEST GAPS IN POS DATA FOR {sample_abbr} ===")
df = session.pos_data[sample_driver]
diffs = df["Date"].diff().dt.total_seconds()
top_gaps = diffs.nlargest(10)
for idx, gap_s in top_gaps.items():
    offset = (df.loc[idx, "Date"] - session.t0_date).total_seconds()
    print(f"  gap={gap_s:.1f}s at race T+{offset:.0f}s ({offset/60:.1f} min)")

print()

# --- 3. Where does the race actually start vs t0_date? ---
print("=== RACE START DETECTION ===")
if len(session.laps) > 0:
    first_lap_start = session.laps["LapStartTime"].min()
    print(f"  First lap LapStartTime: T+{first_lap_start.total_seconds():.1f}s")
    print(f"  = {first_lap_start.total_seconds()/60:.1f} minutes after t0_date")

print()

# --- 4. Track_pct stability check (do cars actually move?) ---
print("=== TRACK_PCT MOVEMENT CHECK (sample 5 drivers, every 60s for first 300s) ===")

# Quick track index build
fastest = session.laps.pick_fastest()
driver_num_fast = fastest["DriverNumber"]
driver_laps = session.laps[session.laps["DriverNumber"] == driver_num_fast]
for lap_n in (2, 1):
    lap_row = driver_laps[driver_laps["LapNumber"] == lap_n]
    if not lap_row.empty:
        break
pos_df_track = lap_row.iloc[0].get_pos_data()

# Normalize bounds
all_x, all_y = [], []
for dn in session.drivers:
    if dn in session.pos_data:
        d = session.pos_data[dn]
        all_x.extend(d["X"].dropna().tolist())
        all_y.extend(d["Y"].dropna().tolist())
x_min, x_max = min(all_x), max(all_x)
y_min, y_max = min(all_y), max(all_y)

def norm(v, lo, hi):
    return (float(v) - lo) / (hi - lo) * 1000 if hi != lo else 500.0

track_pts = np.array([
    ((norm(r["X"], x_min, x_max)), (norm(r["Y"], y_min, y_max)))
    for _, r in pos_df_track.iterrows()
])
seg_lens = np.hypot(np.diff(track_pts[:, 0]), np.diff(track_pts[:, 1]))
cumulative = np.concatenate([[0.0], np.cumsum(seg_lens)])
total = float(cumulative[-1])

def project(x, y):
    dists = np.hypot(track_pts[:, 0] - x, track_pts[:, 1] - y)
    idx = int(np.argmin(dists))
    return float(cumulative[idx] / total)

min_date = min(v["start"] for v in coverage.values())

sample_drivers = list(coverage.keys())[:5]
times = list(range(0, 600, 30))  # every 30s for first 10 minutes

header = f"{'T+':>6}" + "".join(f"{session.get_driver(d)['Abbreviation']:>8}" for d in sample_drivers)
print(header)
print("-" * (8 + 8 * len(sample_drivers)))

for t in times:
    target = min_date + pd.Timedelta(seconds=t)
    row_vals = [f"T+{t:>4}"]
    for dn in sample_drivers:
        if dn not in coverage:
            row_vals.append("    N/A ")
            continue
        pf = coverage[dn]["df"].set_index("Date").sort_index()
        idx = min(pf.index.searchsorted(target), len(pf) - 1)
        r = pf.iloc[idx]
        x = norm(r["X"], x_min, x_max)
        y = norm(r["Y"], y_min, y_max)
        pct = project(x, y)
        row_vals.append(f"  {pct:.3f}")
    print("".join(row_vals))

print()
print("=== KEY TAKEAWAYS ===")
print(f"  t0_date is likely {first_lap_start.total_seconds()/60:.1f} min BEFORE the actual race start.")
print("  If all_positions starts at T+0 from the earliest pos_data, cars will appear")
print("  stationary on the grid until the race begins.")
print()
print("  Fix: offset t=0 to the actual race start (first LapStartTime).")
