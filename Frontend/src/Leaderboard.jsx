import { useMemo } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard — live race order from currentFrame.leaderboard (P1 first).
// Each row shows position, driver, tire compound + age, and last lap time.
// Clicking a row selects that driver (drives the telemetry panel).
// ─────────────────────────────────────────────────────────────────────────────

const TIRE_COLORS = {
  SOFT: "#E8332E",
  MEDIUM: "#F4D23C",
  HARD: "#EBEBEB",
  INTERMEDIATE: "#3DB14A",
  WET: "#3B8BD4",
}

function fmtLap(seconds) {
  if (seconds == null || seconds <= 0) return "—"
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${m}:${s.padStart(6, "0")}`
}

export function Leaderboard({ currentFrame, drivers, selectedDriverCode, onSelectDriver }) {
  const driverMeta = useMemo(() => {
    const m = {}
    for (const d of drivers) m[d.code] = d
    return m
  }, [drivers])

  if (!currentFrame?.leaderboard?.length) {
    return (
      <div className="panel leaderboard">
        <div className="panel-head">Running order</div>
        <div className="panel-empty">Waiting for race data</div>
      </div>
    )
  }

  // Compute leader's best lap to show gaps in a future iteration if desired
  const leaderCode = currentFrame.leaderboard[0]

  return (
    <div className="panel leaderboard">
      <div className="panel-head">
        Running order
        <span className="lap-counter">LAP {currentFrame.lap}</span>
      </div>
      <div className="lb-rows">
        {currentFrame.leaderboard.map((code, i) => {
          const car = currentFrame.drivers[code]
          const meta = driverMeta[code]
          if (!car) return null
          const tireColor = TIRE_COLORS[car.tire_compound] || "#888"
          const isSelected = code === selectedDriverCode
          const isRetired = car.status === "RETIRED"

          return (
            <div
              key={code}
              className={`lb-row ${isSelected ? "lb-row-selected" : ""} ${isRetired ? "lb-row-retired" : ""}`}
              onClick={() => onSelectDriver(code)}
            >
              <span className="lb-pos">{isRetired ? "—" : i + 1}</span>
              <span className="lb-bar" style={{ background: meta?.team_color || "#888" }} />
              <span className="lb-code">{code}</span>
              <span className="lb-team">{meta?.team || ""}</span>
              <span className="lb-tire">
                <span className="tire-dot" style={{ background: tireColor }} />
                <span className="tire-age">{car.tire_age_laps}L</span>
              </span>
              {isRetired
                ? <span className="lb-dnf">OUT</span>
                : <span className="lb-laptime">{fmtLap(car.last_lap_time)}</span>}
              {!isRetired && car.drs && <span className="lb-drs">DRS</span>}
            </div>
          )
        }
         )
         }
      </div>
    </div>
  )
}
