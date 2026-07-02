import { useMemo } from "react"

const W = 520
const H = 90

function downsample(times, values, maxPoints = 600) {
  const n = times.length
  if (n === 0) return []
  const step = Math.max(1, Math.floor(n / maxPoints))
  const pts = []
  for (let i = 0; i < n; i += step) {
    const t = times[i]
    const v = values[i]
    if (t == null || v == null) continue
    pts.push([t, typeof v === "boolean" ? (v ? 1 : 0) : v])
  }
  return pts
}

// Read the true value at currentTime from the FULL array (matches the HUD).
function valueAtTime(times, values, currentTime) {
  const n = times.length
  if (!n) return null
  // Find the sample whose time is nearest currentTime via binary search.
  let lo = 0, hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] < currentTime) lo = mid + 1
    else hi = mid
  }
  // lo is the first index with time >= currentTime; check neighbor for nearest.
  let idx = lo
  if (idx > 0 && Math.abs(times[idx - 1] - currentTime) < Math.abs(times[idx] - currentTime)) {
    idx = idx - 1
  }
  const v = values[idx]
  if (v == null) return null
  return typeof v === "boolean" ? (v ? 1 : 0) : v
}

function Trace({ label, unit, times, values, color, currentTime, fill }) {
  const { path, areaPath } = useMemo(() => {
    const pts = downsample(times, values)
    if (!pts.length) return { path: "", areaPath: "" }

    const ts = pts.map(p => p[0])
    const vs = pts.map(p => p[1])
    const tMin = ts[0], tMax = ts[ts.length - 1]
    const vMin = Math.min(...vs), vMax = Math.max(...vs)
    const tSpan = tMax - tMin || 1
    const vSpan = vMax - vMin || 1

    const x = t => ((t - tMin) / tSpan) * W
    const y = v => H - ((v - vMin) / vSpan) * (H - 8) - 4

    let d = ""
    pts.forEach((p, i) => {
      d += `${i === 0 ? "M" : "L"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)} `
    })
    const area = d + `L${W} ${H} L0 ${H} Z`
    return { path: d, areaPath: area }
  }, [times, values])

  // Current value read from the FULL array — matches the HUD, updates smoothly.
  const cur = useMemo(
    () => valueAtTime(times, values, currentTime),
    [times, values, currentTime]
  )

  const playheadX = useMemo(() => {
    if (!times.length) return 0
    const valid = times.filter(t => t != null)
    const tMin = valid[0], tMax = valid[valid.length - 1]
    const span = tMax - tMin || 1
    return Math.max(0, Math.min(W, ((currentTime - tMin) / span) * W))
  }, [times, currentTime])

  return (
    <div className="trace">
      <div className="trace-head">
        <span className="trace-label">{label}</span>
        <span className="trace-value" style={{ color }}>
          {cur != null ? `${Math.round(cur)}${unit}` : "—"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trace-svg" preserveAspectRatio="none">
        {fill && areaPath && <path d={areaPath} fill={color} opacity="0.12" />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="1.5" />}
        <line x1={playheadX} y1="0" x2={playheadX} y2={H} className="trace-playhead" />
      </svg>
    </div>
  )
}

export function TelemetryPanel({ selectedDriverCode, selectedTelemetry, currentTime, drivers, error }) {
  const meta = useMemo(
    () => drivers.find(d => d.code === selectedDriverCode),
    [drivers, selectedDriverCode]
  )

  if (!selectedDriverCode) {
    return (
      <div className="panel telemetry">
        <div className="panel-head">Telemetry</div>
        <div className="panel-empty">Select a driver to see their telemetry trace</div>
      </div>
    )
  }

  if (error && !selectedTelemetry) {
    return (
      <div className="panel telemetry">
        <div className="panel-head">Telemetry — {selectedDriverCode}</div>
        <div className="panel-empty panel-error-text">{error}</div>
      </div>
    )
  }

  if (!selectedTelemetry) {
    return (
      <div className="panel telemetry">
        <div className="panel-head">Telemetry — {selectedDriverCode}</div>
        <div className="panel-empty">Loading telemetry…</div>
      </div>
    )
  }

  const color = meta?.team_color || "#E8332E"
  const t = selectedTelemetry

  return (
    <div className="panel telemetry">
      <div className="panel-head">
        <span>Telemetry</span>
        <span className="tel-driver" style={{ color }}>{meta?.name || selectedDriverCode}</span>
      </div>
      <div className="traces">
        <Trace label="Speed" unit=" km/h" times={t.time} values={t.speed} color={color} currentTime={currentTime} fill />
        <Trace label="Throttle" unit="%" times={t.time} values={t.throttle} color="#3DB14A" currentTime={currentTime} fill />
        <Trace label="Brake" unit="" times={t.time} values={t.brake} color="#E8332E" currentTime={currentTime} fill />
        <Trace label="Gear" unit="" times={t.time} values={t.gear} color="#C9A4FF" currentTime={currentTime} />
      </div>
    </div>
  )
}