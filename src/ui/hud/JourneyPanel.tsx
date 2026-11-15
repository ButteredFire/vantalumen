import { getDefaultMissionForBody, getMissionById, getStopById } from '../../config/missions';
import { useCosmosStore } from '../../store/useCosmosStore';

export function JourneyPanel() {
  const bodyId = useCosmosStore((state) => state.activeBodyId);
  const explorationMode = useCosmosStore((state) => state.explorationMode);
  const activeMissionId = useCosmosStore((state) => state.activeMissionId);
  const activeStopId = useCosmosStore((state) => state.activeStopId);
  const activeTarget = useCosmosStore((state) => state.activeTarget);
  const activeDeviceId = useCosmosStore((state) => state.activeDeviceId);
  const inspectionMode = useCosmosStore((state) => state.inspectionMode);

  const selectMissionStop = useCosmosStore((state) => state.selectMissionStop);
  const setInspectionMode = useCosmosStore((state) => state.setInspectionMode);

  if (explorationMode !== 'guided') {
    return null;
  }

  const candidateMission = getMissionById(activeMissionId);
  const mission =
    candidateMission && candidateMission.bodyId === bodyId
      ? candidateMission
      : getDefaultMissionForBody(bodyId);
  const activeStop = getStopById(mission, activeStopId) ?? mission.stops[0];
  const currentIdx = Math.max(
    0,
    mission.stops.findIndex((stop) => stop.id === activeStop.id),
  );
  const prevStop = currentIdx > 0 ? mission.stops[currentIdx - 1] : null;
  const nextStop =
    currentIdx < mission.stops.length - 1 ? mission.stops[currentIdx + 1] : null;

  const hasInspectableFocus = Boolean(activeDeviceId) || (Boolean(activeTarget) && activeTarget?.id !== bodyId);

  return (
    <section
      className="journey-panel"
      data-testid="journey-panel"
      aria-label="Journey stages"
    >
      <div className="journey-step-list" role="tablist" aria-label="Journey stops">
        {mission.stops.map((stop) => {
          const isCurrent = stop.id === activeStop.id;
          return (
            <button
              key={stop.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-current={isCurrent ? 'step' : undefined}
              className={`journey-step-pill ${isCurrent ? 'is-active' : ''}`}
              data-testid={`journey-step-${stop.id}`}
              onClick={() => selectMissionStop(mission.id, stop.id)}
            >
              {stop.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="journey-stop-card" data-testid="journey-active-stop">
        <div className="journey-stop-counter">
          Stop {currentIdx + 1}/{mission.stops.length}
        </div>
        <h3 className="journey-stop-title">{activeStop.title}</h3>
        <p className="journey-stop-question">{activeStop.questionPrompt}</p>
        <p className="journey-stop-summary">{activeStop.summary}</p>
        <div className="journey-stop-see">
          <strong>What you see:</strong> {activeStop.whatYouSee}
        </div>
        <div className="journey-stop-note">{activeStop.imageStatusNote}</div>

        {hasInspectableFocus && activeStop.targetKind === 'device' && (
          <div className="journey-view-actions">
            <button
              type="button"
              className="journey-view-btn"
              aria-pressed={inspectionMode === 'MODEL_CLOSEUP'}
              onClick={() => setInspectionMode('MODEL_CLOSEUP')}
            >
              Inspect model
            </button>
            <button
              type="button"
              className="journey-view-btn"
              aria-pressed={inspectionMode === 'CONTROL_ROOM_POV'}
              onClick={() => setInspectionMode('CONTROL_ROOM_POV')}
            >
              Explore viewpoints
            </button>
          </div>
        )}

        <div className="journey-nav-row">
          <button
            type="button"
            className="journey-nav-btn"
            data-testid="journey-prev-btn"
            disabled={!prevStop}
            onClick={() => prevStop && selectMissionStop(mission.id, prevStop.id)}
          >
            ← Previous stop
          </button>
          <button
            type="button"
            className="journey-nav-btn is-primary"
            data-testid="journey-next-btn"
            disabled={!nextStop}
            onClick={() => nextStop && selectMissionStop(mission.id, nextStop.id)}
          >
            {nextStop ? `Next: ${nextStop.shortLabel} →` : 'Journey complete'}
          </button>
        </div>
      </div>
    </section>
  );
}
