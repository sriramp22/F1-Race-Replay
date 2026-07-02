from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import process

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins = ['*'],
    allow_methods = ['*'],
    allow_headers = ['*']
)

@app.get("/years")
def get_years():
    return process.get_year_options()

@app.get('/years/{year}/races')
def get_races_for_year(year:int):
    return process.get_race_list(year)

@app.get('/years/{year}/has-telemetry')
def get_has_telemetry(year:int):
    return process.check_telemetry(year)

@app.get('/years/{year}/races/{round_number}/metadata')
def get_metadata(year:int, round_number:int):
    return process.get_metadata(year, round_number)

@app.get('/years/{year}/races/{round_number}/drivers')
def get_drivers(year:int, round_number:int):
    return process.get_drivers(year, round_number)

@app.get('/years/{year}/races/{round_number}/weather')
def get_weather(year:int, round_number:int):
    return process.get_weather(year, round_number)

@app.get('/years/{year}/races/{round_number}/leaderboard')
def get_leaderboard_at_t(year:int, round_number:int, target_time:float):
    return process.get_leaderboard_at_time(year, round_number, target_time)

@app.get('/years/{year}/races/{round_number}/frames')
def get_frames(year:int, round_number:int, start_time:float, end_time:float):
    return process.get_frames(year, round_number, start_time, end_time)  

@app.get('/years/{year}/races/{round_number}/drivers/{driver_code}/telemetry')
def get_driver_telemetry(year:int, round_number:int, driver_code:str):
    driver_result = process.get_driver_telemetry(year, round_number, driver_code)
    if driver_result is None:
        raise HTTPException(status_code=404, detail='Driver not found')
    else:
        return driver_result
    
@app.get("/")
def root():
    return {'message': 'F1 Race Replay API. See /docs for endpoints.'}