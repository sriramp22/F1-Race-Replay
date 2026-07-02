"""
fetch_data.py
Fetches detailed race data using FastF1.
Replaces mock_fetch_data.py.
"""
 
import fastf1
import os
import pandas as pd
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
 
#this is going to use the same cache folder as fetch_race.py
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)
 
TRACK_LENGTHS_KM = {
    "Sakhir": 5.412,
    "Jeddah": 6.174,
    "Melbourne": 5.278,
    "Baku": 6.003,
    "Miami": 5.412,
    "Imola": 4.909,
    "Monaco": 3.337,
    "Barcelona": 4.657,
    "Montréal": 4.361,
    "Spielberg": 4.318,
    "Silverstone": 5.891,
    "Budapest": 4.381,
    "Spa-Francorchamps": 7.004,
    "Zandvoort": 4.259,
    "Monza": 5.793,
    "Marina Bay": 4.940,
    "Suzuka": 5.807,
    "Lusail": 5.419,
    "Austin": 5.513,
    "Mexico City": 4.304,
    "São Paulo": 4.309,
    "Las Vegas": 6.201,
    "Yas Island": 5.281,
    "Shanghai": 5.451,
}
 
def _build_telemetry_for_driver(session, driver_code: str, race_end_seconds: float) -> dict:
    """
    Build resampled telemetry arrays for one driver at 10Hz.
    Also records the driver's true last real-data time (for retirement detection).
    """
    import numpy as np
 
    #Get raw telemetry
    laps = session.laps.pick_drivers(driver_code)
    tel = laps.get_telemetry().copy()
    tel["time_s"] = tel["Time"].dt.total_seconds()
 
    # Capture the LAST REAL data time BEFORE we resample/pad to full race length.
    # A driver who finished has data to the end; a DNF's real data stops early.
    last_real_time = float(tel["time_s"].max()) if len(tel) else 0.0
 
    #picking columns and setting time as index 
    cols = ["time_s", "Speed", "Throttle", "Brake", "nGear", "RPM", "DRS", "X", "Y"]
    df = tel[cols].copy().set_index("time_s")
    df = df[~df.index.duplicated(keep="first")]
 
    # Build the 10Hz grid
    target_times = np.arange(0.0, race_end_seconds, 0.1)
 
    # Reindex onto the combined index (old + new)
    combined_index = df.index.union(target_times)
    df_combined = df.reindex(combined_index)
 
    # Continuous fields
    continuous_cols = ["Speed", "Throttle", "RPM", "X", "Y"]
    df_combined[continuous_cols] = df_combined[continuous_cols].interpolate(method="linear")
 
    # Discrete fields
    discrete_cols = ["Brake", "nGear", "DRS"]
    df_combined[discrete_cols] = df_combined[discrete_cols].ffill()
 
    #Trimming target times 
    df_resampled = df_combined.reindex(target_times)
 
    # Convert to our contract's shape (dict of arrays)
    return {
        "time":     target_times.tolist(),
        "speed":    df_resampled["Speed"].tolist(),
        "throttle": df_resampled["Throttle"].tolist(),
        "brake":    [bool(b) for b in df_resampled["Brake"].tolist()],
        "gear":     [int(g) if not pd.isna(g) else 0 for g in df_resampled["nGear"].tolist()],
        "rpm":      df_resampled["RPM"].tolist(),
        "drs":      [bool(d >= 10) if not pd.isna(d) else False for d in df_resampled["DRS"].tolist()],
        "x":        df_resampled["X"].tolist(),
        "y":        df_resampled["Y"].tolist(),
        "_last_real_time": last_real_time,   # internal; popped out during retirement detection
        # lap_number added separately
    }
   
def _build_telemetry_all_drivers(session, race_end_seconds: float, lap_timelines: dict):
    """
    Builds telemetry for all drivers AND a retirement_info dict.
 
    Returns:
        (telemetry, retirement_info)
        retirement_info[code] = {"retired": bool, "retire_time": float, "reason": str}
    """
    telemetry = {}
    retirement_info = {}
 
    # Status lookup from results: "Finished", "+1 Lap", "+2 Laps", "Gearbox", "Collision", ...
    status_by_code = {}
    for _, row in session.results.iterrows():
        status_by_code[row["Abbreviation"]] = str(row.get("Status", ""))
 
    for _, row in session.results.iterrows():
        code = row["Abbreviation"]
        try:
            t_dict = _build_telemetry_for_driver(session, code, race_end_seconds)
            # Add lap_number array
            timeline = lap_timelines.get(code, [])
            t_dict["lap_number"] = [
                _find_lap_at_time(timeline, t)["lap_number"] if _find_lap_at_time(timeline, t) else 1
                for t in t_dict["time"]
            ]
 
            # Pull out the internal retirement-detection field before storing telemetry.
            last_real_time = t_dict.pop("_last_real_time", race_end_seconds)
            telemetry[code] = t_dict
 
            # A genuine DNF: Status is NOT "Finished" and NOT a "+N Lap(s)" string.
            # Lapped finishers ("+1 Lap", "+2 Laps") DID finish and must stay in order.
            status = status_by_code.get(code, "")
            is_lapped = "Lap" in status         # "+1 Lap", "+2 Laps", ...
            is_finished = status == "Finished"
            retired = not (is_finished or is_lapped)
 
            retirement_info[code] = {
                "retired": retired,
                "retire_time": last_real_time,
                "reason": status if retired else "",
            }
        except Exception as e:
            print(f"  Warning: could not build telemetry for {code}: {e}")
            telemetry[code] = {
                "time": [], "speed": [], "throttle": [], "brake": [],
                "gear": [], "rpm": [], "drs": [], "x": [], "y": [], "lap_number": [],
            }
            retirement_info[code] = {"retired": False, "retire_time": race_end_seconds, "reason": ""}
 
    return telemetry, retirement_info
 
def _build_lap_timelines(session) -> dict:
    """
    For each driver, build a list of lap entries with timing info.
    """
    timelines = {}
    first_laps = session.laps[session.laps["LapNumber"]== 1]
    race_start_offset = first_laps["LapStartTime"].min().total_seconds()
    
    for _, row in session.results.iterrows():
        code = row["Abbreviation"]
        driver_laps = session.laps.pick_drivers(code).copy()
        
        # Sort by lap number to make sure they're in order
        driver_laps = driver_laps.sort_values("LapNumber")
        
        timeline = []
        best_lap_time = float("inf")
        
        for _, lap in driver_laps.iterrows():
            # Convert Timedeltas to seconds, handling NaN
            start = lap["LapStartTime"].total_seconds() - race_start_offset if pd.notna(lap["LapStartTime"]) else None
            end = lap["Time"].total_seconds() - race_start_offset if pd.notna(lap["Time"]) else None
            
            lap_time = lap["LapTime"].total_seconds() if pd.notna(lap["LapTime"]) else None
            
            if start is None or end is None:
                continue  # skip laps with missing timing
            
            # Track best lap time so far
            if lap_time is not None and lap_time < best_lap_time:
                best_lap_time = lap_time
            
            timeline.append({
                "start": start,
                "end": end,
                "lap_number": int(lap["LapNumber"]),
                "position": int(lap["Position"]) if pd.notna(lap["Position"]) else 20,
                "compound": str(lap["Compound"]) if pd.notna(lap["Compound"]) else "UNKNOWN",
                "tyre_life": int(lap["TyreLife"]) if pd.notna(lap["TyreLife"]) else 0,
                "lap_time": lap_time if lap_time is not None else 0.0,
                "best_so_far": best_lap_time if best_lap_time != float("inf") else 0.0,
            })
        
        timelines[code] = timeline
    
    return timelines
 
def _find_lap_at_time(timeline: list, t: float) -> dict:
    
    for lap in timeline:
        if lap["start"] <= t < lap["end"]:
            return lap
    # If t is past everything (driver retired), return last known lap
    if timeline:
        return timeline[-1]
    return None
 
def _build_frames_from_telemetry(telemetry: dict, lap_timelines: dict, tick_rate_hz: int, race_end_seconds: float, retirement_info: dict) -> list[dict]:
    """
    Build time-first frames from driver-first telemetry, enriched with
    lap numbers, leaderboard, tire info, and lap timing from lap_timelines.
 
    Retired drivers (past their retire_time) are marked status="RETIRED" and
    dropped to the bottom of the leaderboard, out of the running order.
    """
    tick = 1.0 / tick_rate_hz
    num_frames = int(race_end_seconds / tick)
    
    frames = []
    driver_codes = list(telemetry.keys())
    
    for i in range(num_frames):
        t = i * tick
        
        drivers_state = {}
        positions_for_leaderboard = []  # (code, position) pairs — RUNNING drivers only
        retired_codes = []              # retired drivers, appended at the bottom
        max_lap_seen = 1
        
        for code in driver_codes:
            tel = telemetry[code]
            if i >= len(tel["time"]):
                continue
 
            # Has this driver retired by time t?
            info = retirement_info.get(code, {"retired": False, "retire_time": race_end_seconds, "reason": ""})
            has_retired_by_now = info["retired"] and t > info["retire_time"]
            
            # Look up lap info for this driver at this time
            lap_info = _find_lap_at_time(lap_timelines.get(code, []), t)
            
            if lap_info is None:
                # No lap data — use defaults
                lap_number = 1
                position = 20
                compound = "UNKNOWN"
                tyre_life = 0
                last_lap_time = 0.0
                best_lap_time = 0.0
                current_lap_elapsed = 0.0
            else:
                lap_number = lap_info["lap_number"]
                position = lap_info["position"]
                compound = lap_info["compound"]
                tyre_life = lap_info["tyre_life"]
                last_lap_time = lap_info["lap_time"]
                best_lap_time = lap_info["best_so_far"]
                current_lap_elapsed = t - lap_info["start"]
            
            max_lap_seen = max(max_lap_seen, lap_number)
            
            drivers_state[code] = {
                "x": tel["x"][i],
                "y": tel["y"][i],
                "speed": tel["speed"][i],
                "gear": tel["gear"][i],
                "throttle": tel["throttle"][i],
                "brake": tel["brake"][i],
                "drs": tel["drs"][i],
                "tire_compound": compound,
                "tire_age_laps": tyre_life,
                "last_lap_time": round(last_lap_time, 3),
                "current_lap_elapsed": round(current_lap_elapsed, 3),
                "best_lap_time": round(best_lap_time, 3),
                "status": "RETIRED" if has_retired_by_now else "RUNNING",
            }
 
            if has_retired_by_now:
                retired_codes.append(code)
            else:
                positions_for_leaderboard.append((code, position))
        
        # Running drivers sorted by position; retired drivers appended at the bottom.
        leaderboard = [code for code, _ in sorted(positions_for_leaderboard, key=lambda p: p[1])]
        leaderboard += retired_codes
        
        frames.append({
            "time": round(t, 2),
            "lap": max_lap_seen,
            "leaderboard": leaderboard,
            "drivers": drivers_state,
        })
    
    return frames
 
 
def get_race_data(year: int, round_number: int) -> dict:
    session = fastf1.get_session(year, round_number, 'R')
    session.load()
    
    event = session.event
    
    # Compute race duration
    results = session.results
    winner_time = results.iloc[0]["Time"]
    if pd.isna(winner_time):
        duration = float(session.laps["Time"].max().total_seconds())
    else:
        duration = float(winner_time.total_seconds())
    
    metadata = {
        "race_name": event["EventName"],
        "circuit": event["Location"],
        "year": int(event["EventDate"].year),
        "round": int(event["RoundNumber"]),
        "date": event["EventDate"].strftime("%Y-%m-%d"),
        "total_laps": int(session.total_laps),
        "total_duration_seconds": duration,
        "track_length_km": TRACK_LENGTHS_KM.get(event["Location"], 0.0),
        "tick_rate_hz": 10,
    }
    
    # Build lap timelines (used by both telemetry and frames)
    lap_timelines = _build_lap_timelines(session)
    
    # Build all data sections
    drivers_info = _build_drivers_info(session)
    weather = _build_weather(session)
    telemetry, retirement_info = _build_telemetry_all_drivers(session, duration, lap_timelines)
    frames = _build_frames_from_telemetry(telemetry, lap_timelines, 10, duration, retirement_info)
    
    return {
        "metadata": metadata,
        "drivers_info": drivers_info,
        "weather": weather,
        "frames": frames,
        "telemetry": telemetry,
    }
 
def _build_drivers_info(session) -> list[dict]:
    """
    Builds the drivers_info list from session.results.
    Returns one dict per driver matching the contract.
    """
    drivers = []
    for _, row in session.results.iterrows():
        driver = {
            "code": row["Abbreviation"],
            "name": row["FullName"],
            "team": row["TeamName"],
            "team_color": "#" + row["TeamColor"],
            "number": int(row["DriverNumber"]),
        }
        drivers.append(driver)
    return drivers 
 
def _degrees_to_compass(degrees: float) -> str:
    """
    Convert wind direction in degrees (0-360) to a compass string.
    """
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    index = int((degrees + 22.5) // 45) % 8
    return directions[index]
 
def _build_weather(session) -> list[dict]:
    """
    Builds the weather list and converts to the contract format
    """
    weather_df = session.weather_data
    weather = []
    for _, row in weather_df.iterrows():
        weather.append({
            "time": float(row["Time"].total_seconds()),
            "track_temp": float(row["TrackTemp"]),
            "air_temp": float(row["AirTemp"]),
            "humidity": int(row["Humidity"]),
            "wind_speed": float(row["WindSpeed"]) * 3.6,
            "wind_direction": _degrees_to_compass(float(row["WindDirection"])),
            "rainfall": bool(row["Rainfall"]),
        })
    return weather
 
if __name__ == "__main__":
    data = get_race_data(2018, 5)
    
    print("=" * 60)
    print("METADATA")
    print("=" * 60)
    print(data["metadata"])
    
    print(f"\n{'=' * 60}")
    print(f"RETIREMENT CHECK (last frame)")
    print(f"{'=' * 60}")
    last_frame = data["frames"][-1]
    print(f"  Final leaderboard order: {last_frame['leaderboard']}")
    retired = [c for c, d in last_frame["drivers"].items() if d["status"] == "RETIRED"]
    print(f"  Marked RETIRED at end: {retired}")