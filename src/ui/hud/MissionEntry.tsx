import { BODY_CATALOG } from '../../config/bodyCatalog';
import { getDefaultMissionForBody, getMissionById } from '../../config/missions';
import { selectEffectiveOrbitsVisible, useCosmosStore } from '../../store/useCosmosStore';

export function MissionEntry() {
  const bodyId = useCosmosStore((state) => state.activeBodyId);
  const explorationMode = useCosmosStore((state) => state.explorationMode);
  const activeMissionId = useCosmosStore((state) => state.activeMissionId);
  const orbitsVisible = useCosmosStore(selectEffectiveOrbitsVisible);

  const setExplorationMode = useCosmosStore((state) => state.setExplorationMode);
  const toggleOrbits = useCosmosStore((state) => state.toggleOrbits);

  const body = BODY_CATALOG[bodyId];
  const currentMission = getMissionById(activeMissionId);
  const mission =
    currentMission && currentMission.bodyId === bodyId
      ? currentMission
      : getDefaultMissionForBody(bodyId);

  return (
    <section
      className="mission-entry-card"
      data-testid="mission-entry"
      aria-label="Main exploration journey"
    >
      <div className="mission-entry-kicker">
        {explorationMode === 'guided'
          ? `Guided journey · ${body.name}`
          : `Free exploration · ${body.name}`}
      </div>
      <h2 className="mission-entry-title">{mission.title}</h2>
      <p className="mission-entry-question">{mission.headlineQuestion}</p>

      <div
        className="mission-mode-toggle"
        role="group"
        aria-label="Exploration mode"
      >
        <button
          type="button"
          className="mission-mode-btn"
          data-testid="mode-guided-btn"
          aria-pressed={explorationMode === 'guided'}
          onClick={() => setExplorationMode('guided')}
        >
          Guided
        </button>
        <button
          type="button"
          className="mission-mode-btn"
          data-testid="explore-freely-btn"
          aria-pressed={explorationMode === 'free'}
          onClick={() => setExplorationMode('free')}
        >
          Explore freely
        </button>
      </div>

      {explorationMode === 'guided' && (
        <div className="mission-orbit-hint">
          <span>
            {orbitsVisible
              ? 'Reference orbital paths are visible.'
              : 'Orbital paths are temporarily hidden to keep the view clear.'}
          </span>
          <button
            type="button"
            className="mission-orbit-inline-btn"
            data-testid="guided-toggle-orbits-btn"
            aria-pressed={orbitsVisible}
            onClick={toggleOrbits}
          >
            {orbitsVisible ? 'Hide orbits' : 'Show orbits'}
          </button>
        </div>
      )}
    </section>
  );
}
