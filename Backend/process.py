# Cleans, filters, slices and routes race data between the data fetchers and the API server(main.py)
from fetch_race import get_available_years, get_races_for_year, has_telemetry
from fetch_data import get_race_data

cache = {}
def load_race(year, round_number):
    key = (year, round_number)
    if key in cache:
        return cache[key]
    else:
        data = get_race_data(year,round_number)
        cache[key] = data
        return data
    
def get_metadata(year, round_number):
    full_data = load_race(year, round_number)
    metadata = full_data['metadata']
    return metadata

def get_drivers(year, round_number):
    full_data = load_race(year, round_number)
    drivers_info = full_data['drivers_info']
    return drivers_info

def get_weather(year, round_number):
    full_data = load_race(year, round_number)
    weather = full_data['weather']
    return weather

def get_driver_telemetry(year, round_number, driver_code):
    full_data = load_race(year, round_number)
    telemetry_data = full_data['telemetry']
    selected_driver = telemetry_data.get(driver_code)
    return selected_driver

def get_frames(year, round_number, start_time, end_time):
    full_data = load_race(year, round_number)
    all_frames = full_data['frames']
    
    result = []
    for frame in all_frames:
        if start_time <= frame['time'] <= end_time:
            result.append(frame)
    return result

def get_leaderboard_at_time(year, round_number, target_time):
    full_data = load_race(year, round_number)
    all_frames = full_data['frames']
    closest_frame = min(all_frames, key=lambda frame:abs(frame['time'] - target_time))
    return closest_frame['leaderboard']

def get_year_options():
    return get_available_years()

def get_race_list(year):
    return get_races_for_year(year)

def check_telemetry(year):
    return has_telemetry(year)

# Test code
if __name__ == "__main__":
    import time as timer
    
    # First call - cache is cold
    start = timer.time()
    get_frames(2023, 10, 0, 5117)
    print(f"First call (cold cache): {timer.time() - start:.2f}s")
    
    # Second call - cache is warm
    start = timer.time()
    get_frames(2023, 10, 0, 5117)
    print(f"Second call (warm cache): {timer.time() - start:.2f}s")