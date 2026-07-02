import { useEffect, useState } from "react"

const BASE_URL = "http://localhost:8000"

export function useRaceData() {
  const [availableYears, setAvailableYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [raceList, setRaceList] = useState([])
  const [selectedRace, setSelectedRace] = useState(null)

  const [metadata, setMetadata] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [weather, setWeather] = useState([])
  const [frames, setFrames] = useState([])

  const [selectedDriverCode, setSelectedDriverCode] = useState(null)
  const [selectedTelemetry, setSelectedTelemetry] = useState(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  async function loadYears() {
    try {
      const response = await fetch(`${BASE_URL}/years`)
      const yearsData = await response.json()
      setAvailableYears(yearsData)
    } catch (err) {
      setError("Failed to load years. Is the backend running?")
    }
  }

  useEffect(() => {
    loadYears()
  }, [])

  async function selectYear(year) {
    setSelectedYear(year)
    setSelectedRace(null)
    setRaceList([])
    setError(null)
    try {
      const response = await fetch(`${BASE_URL}/years/${year}/races`)
      const races = await response.json()
      setRaceList(races)
    } catch (err) {
      setError("Failed to load race list. Is the backend running?")
    }
  }

  async function selectRace(race) {
    setSelectedRace(race)
    setIsLoading(true)
    setError(null)
    setCurrentTime(0)
    setIsPlaying(false)
    setSelectedDriverCode(null)
    setSelectedTelemetry(null)

    try {
      const year = race.year
      const round = race.round

      const metaResponse = await fetch(`${BASE_URL}/years/${year}/races/${round}/metadata`)
      const metaData = await metaResponse.json()
      setMetadata(metaData)

      const driversResponse = await fetch(`${BASE_URL}/years/${year}/races/${round}/drivers`)
      const driversData = await driversResponse.json()
      setDrivers(driversData)

      const weatherResponse = await fetch(`${BASE_URL}/years/${year}/races/${round}/weather`)
      const weatherData = await weatherResponse.json()
      setWeather(weatherData)

      const framesResponse = await fetch(
        `${BASE_URL}/years/${year}/races/${round}/frames?start_time=0&end_time=${metaData.total_duration_seconds}`
      )
      const framesData = await framesResponse.json()
      setFrames(framesData)
    } catch (err) {
      setError("Failed to load race data. Is the backend running?")
    } finally {
      setIsLoading(false)
    }
  }

  async function selectDriver(code) {
    setSelectedDriverCode(code)
    setSelectedTelemetry(null)
    setError(null)

    const year = selectedRace.year
    const round = selectedRace.round

    try {
      const response = await fetch(
        `${BASE_URL}/years/${year}/races/${round}/drivers/${code}/telemetry`
      )
      if (!response.ok) {
        setError("Telemetry unavailable for this driver")
        return
      }
      const telemetryData = await response.json()
      setSelectedTelemetry(telemetryData)
    } catch (err) {
      setError("Failed to load telemetry. Is the backend running?")
    }
  }

  // Derived current frame
  const tickRate = metadata ? metadata.tick_rate_hz : 10
  const duration = metadata ? metadata.total_duration_seconds : 0
  const frameIndex = Math.round(currentTime * tickRate)
  const currentFrame = frames.length > 0 ? frames[frameIndex] : null

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return
    const intervalMs = 100
    const id = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + (intervalMs / 1000) * playbackSpeed
        if (next >= duration) {
          return duration
        }
        return next
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [isPlaying, playbackSpeed, duration])

  // Control functions
  function play() {
    setIsPlaying(true)
  }
  function pause() {
    setIsPlaying(false)
  }
  function seek(seconds) {
    setCurrentTime(seconds)
  }
  function setSpeed(multiplier) {
    setPlaybackSpeed(multiplier)
  }

  // ---- The contract: everything the visual layer consumes ----
  return {
    // Race selection
    availableYears,
    raceList,
    selectedYear,
    selectedRace,
    selectYear,
    selectRace,

    // Race data
    metadata,
    drivers,
    weather,

    // Current frame (the heart of the replay)
    currentFrame,
    frames,

    // Selected driver telemetry
    selectedDriverCode,
    selectedTelemetry,
    selectDriver,

    // Playback state + controls
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    play,
    pause,
    seek,
    setSpeed,

    // Loading / error
    isLoading,
    error,
  }
}