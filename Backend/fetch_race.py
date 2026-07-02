"""
fetch_race.py
Fetches F1 race metadata using FastF1.
This is the real version that replaces mock_fetch_race.py.
"""
import fastf1
import os 

#set up the cache directory.
# FastF1 saves downloaded data here so we don't re-download every time.
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

def has_telemetry(year: int) -> bool:
    """
    Tells us if telemetry data is available for a given year.
    2016-2017 don't have public telemetry - only 2018+.
    """
    return year >= 2018

def get_races_for_year(year: int) -> list[dict]:
    """
    Returns metadata for all races in a given F1 season.

    Args:
        year (int) : The F1 season year (e.g., 2023)

    Returns:
        list[dict]: One dict per race, matching the contract.
    """
    schedule = fastf1.get_event_schedule(year)

    races = []
    for _, row in schedule.iterrows():
        # Skip pre-season testing (RoundNumber == 0)
        if row["RoundNumber"] == 0:
            continue

        race = {
            "year": year,
            "round": int(row["RoundNumber"]),
            "race_name": row["EventName"],
            "circuit": row["Location"],
            "date": row["EventDate"].strftime("%Y-%m-%d"),

        }
        races.append(race)

    return races 
def get_available_years() -> list[int]:
    """
    returns the list of years for which we have race data.
    """
    return list(range(2018, 2025)) # 2018 through 2024 inclusive



if __name__=="__main__":
    print("Available years:", get_available_years())

    print("\n2023 races:")
    races_2023 = get_races_for_year(2023)
    for race in races_2023:
        print(f" Round {race['round']}: {race['race_name']} at {race['circuit']} ({race['date']})")
    print(f"\nTotal races in 2023: {len(races_2023)}")
    print(f"\n2017 has telemetry? {has_telemetry(2017)}")
    print(f"2023 has telemetry? {has_telemetry(2023)}")