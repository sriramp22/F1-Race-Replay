import { useMemo } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Smaller panels: RacePicker, RaceHeader, WeatherPanel, DriverHUD
// ─────────────────────────────────────────────────────────────────────────────

// ── Race picker (year + race dropdowns) — Contract §1 ──
export function RacePicker({ availableYears, raceList, selectedYear, selectedRace, selectYear, selectRace }) {
  return (
    <div className="picker">
      <select
        className="picker-select"
        value={selectedYear ?? ""}
        onChange={e => selectYear(Number(e.target.value))}
      >
        <option value="" disabled>Year</option>
        {availableYears.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select
        className="picker-select picker-race"
        value={selectedRace?.round ?? ""}
        onChange={e => {
          const race = raceList.find(r => r.round === Number(e.target.value))
          if (race) selectRace(race)
        }}
        disabled={!raceList.length}
      >
        <option value="" disabled>{raceList.length ? "Select race" : "Pick a year first"}</option>
        {raceList.map(r => (
          <option key={r.round} value={r.round}>
            R{r.round} · {r.race_name}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Race header / metadata — Contract §2 ──
export function RaceHeader({ metadata }) {
  if (!metadata) {
    return (
      <div className="race-header race-header-empty">
        <span className="rh-title">F1 Race Replay</span>
        <span className="rh-sub">Select a season and race to begin</span>
      </div>
    )
  }
  return (
    <div className="race-header">
      <div className="rh-main">
        <span className="rh-round">R{metadata.round}</span>
        <div className="rh-titles">
          <span className="rh-title">{metadata.race_name}</span>
          <span className="rh-sub">{metadata.circuit} · {metadata.year}</span>
        </div>
      </div>
      <div className="rh-stats">
        <Stat label="Laps" value={metadata.total_laps} />
        <Stat label="Length" value={`${metadata.track_length_km?.toFixed(3)} km`} />
        <Stat label="Date" value={metadata.date} />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rh-stat">
      <span className="rh-stat-val">{value}</span>
      <span className="rh-stat-lbl">{label}</span>
    </div>
  )
}

// ── Weather panel — Contract §6 ──
const WIND_ARROWS = { N: "↓", NE: "↙", E: "←", SE: "↖", S: "↑", SW: "↗", W: "→", NW: "↘" }

export function WeatherPanel({ weather, currentTime }) {
  // Find the weather sample closest to currentTime
  const current = useMemo(() => {
    if (!weather?.length) return null
    let best = weather[0]
    for (const w of weather) {
      if (w.time <= currentTime) best = w
      else break
    }
    return best
  }, [weather, currentTime])

  if (!current) {
    return (
      <div className="panel weather">
        <div className="panel-head">Conditions</div>
        <div className="panel-empty">No weather data</div>
      </div>
    )
  }

  return (
    <div className="panel weather">
      <div className="panel-head">
        Conditions
        {current.rainfall && <span className="rain-flag">RAIN</span>}
      </div>
      <div className="weather-grid">
        <WStat label="Track" value={`${current.track_temp?.toFixed(0)}°`} accent />
        <WStat label="Air" value={`${current.air_temp?.toFixed(0)}°`} />
        <WStat label="Humidity" value={`${current.humidity?.toFixed(0)}%`} />
        <WStat
          label="Wind"
          value={`${current.wind_speed?.toFixed(0)}`}
          sub={`${WIND_ARROWS[current.wind_direction] || ""} ${current.wind_direction}`}
        />
      </div>
    </div>
  )
}

function WStat({ label, value, sub, accent }) {
  return (
    <div className={`wstat ${accent ? "wstat-accent" : ""}`}>
      <span className="wstat-val">{value}</span>
      <span className="wstat-lbl">{label}{sub ? ` ${sub}` : ""}</span>
    </div>
  )
}

// ── Per-car HUD for the selected (or leading) driver — Contract §4 ──
export function DriverHUD({ currentFrame, selectedDriverCode }) {
  if (!currentFrame) return null
  const code = selectedDriverCode || currentFrame.leaderboard?.[0]
  const car = code ? currentFrame.drivers[code] : null
  if (!car) return null

  return (
    <div className="hud">
      <div className="hud-code">{code}</div>
      <div className="hud-speed">
        <span className="hud-speed-val">{Math.round(car.speed)}</span>
        <span className="hud-speed-unit">km/h</span>
      </div>
      <div className="hud-gear">
        <span className="hud-gear-val">{car.gear}</span>
        <span className="hud-gear-lbl">gear</span>
      </div>
      <div className="hud-bars">
        <div className="hud-bar">
          <span className="hud-bar-lbl">THR</span>
          <div className="hud-bar-track"><div className="hud-bar-fill hud-thr" style={{ width: `${car.throttle}%` }} /></div>
        </div>
        <div className="hud-bar">
          <span className="hud-bar-lbl">BRK</span>
          <div className="hud-bar-track"><div className="hud-bar-fill hud-brk" style={{ width: car.brake ? "100%" : "0%" }} /></div>
        </div>
      </div>
      {car.drs && <div className="hud-drs">DRS OPEN</div>}
    </div>
  )
}
