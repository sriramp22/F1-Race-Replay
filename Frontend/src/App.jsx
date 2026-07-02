import { useRaceData } from "./useRaceData"
import { TrackView } from "./TrackView"
import { Leaderboard } from "./Leaderboard"
import { PlaybackControls } from "./PlaybackControls"
import { TelemetryPanel } from "./TelemetryPanel"
import { RacePicker, RaceHeader, WeatherPanel, DriverHUD } from "./Panels"
import "./styles.css"

export default function App() {
  const race = useRaceData()

  const hasRace = !!race.metadata

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">PIT WALL</span>
        </div>
        <RacePicker
          availableYears={race.availableYears}
          raceList={race.raceList}
          selectedYear={race.selectedYear}
          selectedRace={race.selectedRace}
          selectYear={race.selectYear}
          selectRace={race.selectRace}
        />
      </header>

      {/*Error banner*/}
      {race.error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">!</span>
          {race.error}
        </div>
      )}

      {/*Loading state — first load is SLOW (FastF1)*/}
      {race.isLoading && (
        <div className="loading-screen">
          <div className="loading-bars">
            <span /><span /><span /><span /><span />
          </div>
          <p className="loading-title">Downloading race data</p>
          <p className="loading-sub">
            First load of a race pulls full telemetry from FastF1 and can take a
            few minutes. It's cached after this, so future loads are instant.
          </p>
        </div>
      )}

      {/*Empty state before any race chosen*/}
      {!hasRace && !race.isLoading && (
        <div className="empty-screen">
          <RaceHeader metadata={null} />
          <p className="empty-hint">
            Pick a season and Grand Prix above to load the replay.
          </p>
        </div>
      )}

      {/*Main dashboard*/}
      {hasRace && !race.isLoading && (
        <>
          <RaceHeader metadata={race.metadata} />

          <main className="grid">
            <section className="grid-track">
              <TrackView
                currentFrame={race.currentFrame}
                frames={race.frames}
                drivers={race.drivers}
                selectedDriverCode={race.selectedDriverCode}
                onSelectDriver={race.selectDriver}
              />
              <DriverHUD
                currentFrame={race.currentFrame}
                selectedDriverCode={race.selectedDriverCode}
              />
            </section>

            <aside className="grid-side">
              <Leaderboard
                currentFrame={race.currentFrame}
                drivers={race.drivers}
                selectedDriverCode={race.selectedDriverCode}
                onSelectDriver={race.selectDriver}
              />
              <WeatherPanel weather={race.weather} currentTime={race.currentTime} />
            </aside>

            <section className="grid-telemetry">
              <TelemetryPanel
                selectedDriverCode={race.selectedDriverCode}
                selectedTelemetry={race.selectedTelemetry}
                currentTime={race.currentTime}
                drivers={race.drivers}
                error={race.error}
              />
            </section>
          </main>

          <footer className="dock">
            <PlaybackControls
              isPlaying={race.isPlaying}
              currentTime={race.currentTime}
              duration={race.duration}
              playbackSpeed={race.playbackSpeed}
              play={race.play}
              pause={race.pause}
              seek={race.seek}
              setSpeed={race.setSpeed}
            />
          </footer>
        </>
      )}
    </div>
  )
}