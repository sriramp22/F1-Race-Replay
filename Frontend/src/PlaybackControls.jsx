// ─────────────────────────────────────────────────────────────────────────────
// PlaybackControls — play/pause, timeline scrubber, speed selector.
// Reads isPlaying / currentTime / duration / playbackSpeed.
// Calls play / pause / seek / setSpeed (Contract §7).
// ─────────────────────────────────────────────────────────────────────────────

const SPEEDS = [1, 2, 4, 8]

function fmtClock(seconds) {
  if (!seconds || seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

export function PlaybackControls({
  isPlaying, currentTime, duration, playbackSpeed,
  play, pause, seek, setSpeed,
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="playback">
      <button
        className="pb-toggle"
        onClick={isPlaying ? pause : play}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 5l12 7-12 7V5z" fill="currentColor"/></svg>
        )}
      </button>

      <span className="pb-clock">{fmtClock(currentTime)}</span>

      <div className="pb-scrub-wrap">
        <input
          type="range"
          className="pb-scrub"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={e => seek(parseFloat(e.target.value))}
          style={{ "--pct": `${pct}%` }}
        />
      </div>

      <span className="pb-clock pb-duration">{fmtClock(duration)}</span>

      <div className="pb-speeds">
        {SPEEDS.map(s => (
          <button
            key={s}
            className={`pb-speed ${playbackSpeed === s ? "pb-speed-on" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
