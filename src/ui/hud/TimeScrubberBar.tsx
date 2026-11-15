import { useCosmosStore } from '../../store/useCosmosStore';

export function TimeScrubberBar() {
  const viewStage = useCosmosStore((state) => state.viewStage);
  const inspectionMode = useCosmosStore((state) => state.inspectionMode);
  const timeScale = useCosmosStore((state) => state.timeScale);
  const simulationPaused = useCosmosStore((state) => state.simulationPaused);
  const setTimeScale = useCosmosStore((state) => state.setTimeScale);
  const toggleSimulationPaused = useCosmosStore((state) => state.toggleSimulationPaused);

  if (
    viewStage === 'PRELOADING' ||
    viewStage === 'LAUNCHING' ||
    viewStage === 'BODY_TRANSITION' ||
    inspectionMode === 'CONTROL_ROOM_POV'
  ) {
    return null;
  }

  return (
    <footer className="hud-bottom-bar glass-panel" data-testid="time-scrubber-bar">
      <span>Keplerian orbital motion · independent of surface vehicle physics</span>
      <div className="time-preset-buttons" role="group" aria-label="Orbital speed & planetary rotation">
        <button
          type="button"
          className={'time-preset-btn ' + (simulationPaused ? 'is-active' : '')}
          data-testid="time-pause-toggle"
          aria-pressed={simulationPaused}
          onClick={toggleSimulationPaused}
        >
          {simulationPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        {[1, 100, 1000, 5000].map((speed) => (
          <button
            type="button"
            key={speed}
            className={'time-preset-btn ' + (!simulationPaused && speed === timeScale ? 'is-active' : '')}
            data-testid={`time-scale-${speed}`}
            aria-pressed={!simulationPaused && speed === timeScale}
            onClick={() => {
              if (simulationPaused) toggleSimulationPaused();
              setTimeScale(speed);
            }}
          >
            {speed}×
          </button>
        ))}
      </div>
    </footer>
  );
}
