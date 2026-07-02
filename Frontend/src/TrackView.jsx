import { useMemo } from "react"

const VIEW = 1000
const MARGIN = 60

export function TrackView({ currentFrame, frames, drivers, selectedDriverCode, onSelectDriver }) {
  const driverMeta = useMemo(() => {
    const m = {}
    for (const d of drivers) m[d.code] = d
    return m
  }, [drivers])

  // Compute track bounds ONCE from the entire race — stable, no warm-up, no loop.
  const bounds = useMemo(() => {
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    const step = Math.max(1, Math.floor(frames.length / 2000)) // sample for speed
    for (let i = 0; i < frames.length; i += step) {
      const f = frames[i]
      if (!f?.drivers) continue
      for (const code in f.drivers) {
        const { x, y } = f.drivers[code]
        if (x == null || y == null) continue
        if (x < b.minX) b.minX = x
        if (x > b.maxX) b.maxX = x
        if (y < b.minY) b.minY = y
        if (y > b.maxY) b.maxY = y
      }
    }
    return b
  }, [frames])

  const ready = bounds.minX !== Infinity

  // Convert a raw GPS coord into SVG viewport space.
  const project = (x, y) => {
    const spanX = bounds.maxX - bounds.minX || 1
    const spanY = bounds.maxY - bounds.minY || 1
    const span = Math.max(spanX, spanY) // keep aspect ratio square
    const px = MARGIN + ((x - bounds.minX) / span) * (VIEW - 2 * MARGIN)
    // Flip Y: GPS y grows upward, SVG y grows downward
    const py = MARGIN + ((bounds.maxY - y) / span) * (VIEW - 2 * MARGIN)
    return [px, py]
  }

  // Trace the circuit outline ONCE from one driver's full-race path.
  const trackPath = useMemo(() => {
    if (!frames.length) return ""
    const sampleFrame = frames.find(f => f?.drivers && Object.keys(f.drivers).length)
    if (!sampleFrame) return ""
    const code = Object.keys(sampleFrame.drivers)[0]

    const spanX = (bounds.maxX - bounds.minX) || 1
    const spanY = (bounds.maxY - bounds.minY) || 1
    const span = Math.max(spanX, spanY)
    const proj = (x, y) => [
      MARGIN + ((x - bounds.minX) / span) * (VIEW - 2 * MARGIN),
      MARGIN + ((bounds.maxY - y) / span) * (VIEW - 2 * MARGIN),
    ]

    const step = Math.max(1, Math.floor(frames.length / 1500))
    let d = ""
    let started = false
    for (let i = 0; i < frames.length; i += step) {
      const car = frames[i]?.drivers?.[code]
      if (!car || car.x == null || car.y == null) continue
      const [px, py] = proj(car.x, car.y)
      d += `${started ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)} `
      started = true
    }
    return d
  }, [frames, bounds])

  if (!currentFrame) {
    return (
      <div className="track-empty">
        <span>Track map appears once a race loads</span>
      </div>
    )
  }

  // Sort so selected driver renders last (on top)
  const codes = Object.keys(currentFrame.drivers).sort((a, b) => {
    if (a === selectedDriverCode) return 1
    if (b === selectedDriverCode) return -1
    return 0
  })

  return (
    <div className="track-view">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="track-svg">
        {/* Static circuit outline traced from the full race */}
        {trackPath && (
          <path d={trackPath} className="track-trail" fill="none" />
        )}

        {/* Cars */}
        {codes.map(code => {
          const car = currentFrame.drivers[code]
          if (car.x == null || car.y == null) return null
          const [px, py] = project(car.x, car.y)
          const meta = driverMeta[code]
          const color = meta?.team_color || "#888"
          const isSelected = code === selectedDriverCode
          const isLeader = currentFrame.leaderboard[0] === code

          return (
            <g
              key={code}
              transform={`translate(${px} ${py})`}
              className={`car ${isSelected ? "car-selected" : ""}`}
              onClick={() => onSelectDriver(code)}
              style={{ cursor: "pointer" }}
            >
              {isSelected && (
                <circle r="22" fill="none" stroke={color} strokeWidth="2" opacity="0.5" className="car-halo" />
              )}
              <circle r={isSelected ? 13 : 10} fill={color} stroke="#0a0a0a" strokeWidth="2" />
              <text className="car-label" textAnchor="middle" dy="0.35em" fill={contrastText(color)}>
                {code}
              </text>
              {isLeader && (
                <circle r="4" cx="13" cy="-13" fill="#FFD24A" stroke="#0a0a0a" strokeWidth="1" />
              )}
            </g>
          )
        })}
      </svg>
      {!ready && <div className="track-warmup">Mapping circuit…</div>}
    </div>
  )
}

// Choose black or white label text for legibility on a team color
function contrastText(hex) {
  const c = hex.replace("#", "")
  const r = parseInt(c.substr(0, 2), 16)
  const g = parseInt(c.substr(2, 2), 16)
  const b = parseInt(c.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? "#0a0a0a" : "#ffffff"
}