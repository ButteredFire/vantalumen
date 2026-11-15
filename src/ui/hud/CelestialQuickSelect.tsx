import { BODY_CATALOG } from '../../config/bodyCatalog';
import { ATLAS_POIS } from '../../config/atlasPOIs';
import { getOrbitalActorsForBody } from '../../config/celestialCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { getDefaultMissionForBody, getMissionById } from '../../config/missions';
import {
  classifyDeviceStatus,
  classifyTargetStatus,
  getVisitorNavDescription,
} from '../../config/statusVocabulary';
import { selectEffectiveOrbitsVisible, useCosmosStore } from '../../store/useCosmosStore';

export function CelestialQuickSelect() {
  const bodyId = useCosmosStore((state) => state.activeBodyId);
  const explorationMode = useCosmosStore((state) => state.explorationMode);
  const activeMissionId = useCosmosStore((state) => state.activeMissionId);
  const target = useCosmosStore((state) => state.activeTarget);
  const deviceId = useCosmosStore((state) => state.activeDeviceId);
  const spectralMode = useCosmosStore((state) => state.spectralMode);
  const orbitsVisible = useCosmosStore(selectEffectiveOrbitsVisible);

  const selectBody = useCosmosStore((state) => state.selectBody);
  const selectTarget = useCosmosStore((state) => state.selectTarget);
  const selectDevice = useCosmosStore((state) => state.selectDevice);
  const setSpectralMode = useCosmosStore((state) => state.setSpectralMode);
  const toggleOrbits = useCosmosStore((state) => state.toggleOrbits);
  const enterSurfaceLanding = useCosmosStore((state) => state.enterSurfaceLanding);
  const setExplorationMode = useCosmosStore((state) => state.setExplorationMode);

  const body = BODY_CATALOG[bodyId];
  const candidateMission = getMissionById(activeMissionId);
  const mission =
    candidateMission && candidateMission.bodyId === bodyId
      ? candidateMission
      : getDefaultMissionForBody(bodyId);

  const pois = ATLAS_POIS.filter((poi) => poi.bodyId === bodyId);
  const orbitalActors = getOrbitalActorsForBody(bodyId);
  const surfaceDevices = DEVICE_CATALOG.filter(
    (device) => device.bodyId === bodyId && device.catalogScope === 'body_surface',
  );
  const encounterDevices = DEVICE_CATALOG.filter(
    (device) => device.bodyId === bodyId && device.catalogScope === 'encounter_context',
  );
  const referenceSpacecraft = DEVICE_CATALOG.filter(
    (device) => device.catalogScope === 'reference_spacecraft',
  );

  if (explorationMode === 'guided') {
    const featuredPois = pois.filter((poi) => mission.featuredPoiIds.includes(poi.id));
    const featuredDevices = surfaceDevices.filter((device) =>
      mission.featuredDeviceIds.includes(device.id),
    );

    return (
      <nav
        className="quick-select-section quick-select-guided"
        data-testid="guided-quick-destinations"
        aria-label="Suggested journey destinations"
      >
        <div className="dock-section-title">Suggested destinations</div>
        <button
          type="button"
          className="target-list-btn"
          data-testid="overview-reset-btn"
          aria-pressed={!target && !deviceId && spectralMode !== 'TERRAIN_MESH_3D'}
          onClick={() => selectBody(bodyId)}
        >
          <span className="target-btn-name">{body.name}</span>
          <span className="target-btn-sub">Return to the illustrative globe overview</span>
        </button>

        {featuredPois.map((poi) => (
          <button
            key={poi.id}
            type="button"
            className="target-list-btn"
            data-testid={`guided-poi-${poi.id}`}
            aria-pressed={target?.id === poi.id}
            onClick={() => selectTarget(poi)}
          >
            <span className="target-btn-name">{poi.name}</span>
            <span className="target-btn-sub">Reference feature center on the surface</span>
          </button>
        ))}

        {featuredDevices.map((device) => {
          const devStatus = classifyDeviceStatus(device);
          return (
            <button
              key={device.id}
              type="button"
              className="target-list-btn"
              data-testid={`device-btn-${device.id}`}
              aria-pressed={deviceId === device.id}
              onClick={() => selectDevice(device.id)}
            >
              <span className="target-btn-name">{device.name}</span>
              <span className="target-btn-sub">
                {getVisitorNavDescription(devStatus.representation)}
              </span>
            </button>
          );
        })}

        <div className="guided-catalog-gate" data-testid="guided-catalog-gate">
          <p className="guided-catalog-note">
            The full equipment library, surface layers, and orbital paths are grouped in expanded mode.
          </p>
          <button
            type="button"
            className="explore-freely-cta"
            data-testid="quickselect-explore-freely"
            onClick={() => setExplorationMode('free')}
          >
            Explore freely · Open full catalog
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="quick-select-section"
      data-testid="free-exploration-catalog"
      aria-label="Free exploration catalog"
    >
      <div className="free-mode-banner">
        <span>Full catalog is open</span>
        <button
          type="button"
          className="free-mode-back-btn"
          data-testid="return-guided-btn"
          onClick={() => setExplorationMode('guided')}
        >
          Return to guided mode
        </button>
      </div>

      <div className="dock-section-title">Celestial bodies</div>
      <button
        type="button"
        className="target-list-btn"
        aria-pressed={!target && !deviceId && spectralMode !== 'TERRAIN_MESH_3D'}
        onClick={() => selectBody(bodyId)}
      >
        <span className="target-btn-name">{body.name}</span>
        <span className="target-btn-sub">Orbital overview · {body.missionRelationshipLabel}</span>
      </button>

      <div className="dock-section-title">Orbits &amp; satellites</div>
      <button
        type="button"
        className="target-list-btn"
        data-testid="toggle-orbits-btn"
        aria-pressed={orbitsVisible}
        onClick={toggleOrbits}
      >
        <span className="target-btn-name">Planetary orbits &amp; satellites</span>
        <span className="target-btn-sub">
          {orbitsVisible ? 'Orbital paths are on' : 'Orbital paths are hidden'}
        </span>
      </button>
      {orbitalActors.map((actor) => {
        const actorStatus = classifyTargetStatus(actor);
        return (
          <button
            key={actor.id}
            type="button"
            className="target-list-btn"
            data-testid={`orbital-actor-${actor.id}`}
            aria-pressed={target?.id === actor.id}
            onClick={() => selectTarget(actor)}
          >
            <span className="target-btn-name">{actor.name}</span>
            <span className="target-btn-sub">
              {actorStatus.missionRelationshipLabel} · {getVisitorNavDescription(actorStatus.representation)}
            </span>
          </button>
        );
      })}
      {encounterDevices.map((device) => {
        const devStatus = classifyDeviceStatus(device);
        return (
          <button
            key={device.id}
            type="button"
            className="target-list-btn"
            data-testid={`encounter-device-${device.id}`}
            aria-pressed={deviceId === device.id}
            onClick={() => selectDevice(device.id)}
          >
            <span className="target-btn-name">{device.name}</span>
            <span className="target-btn-sub">
              {devStatus.missionRelationshipLabel} · {getVisitorNavDescription(devStatus.representation)}
            </span>
          </button>
        );
      })}

      <div className="dock-section-title">Features</div>
      {pois.map((poi) => (
        <button
          key={poi.id}
          type="button"
          className="target-list-btn"
          aria-pressed={target?.id === poi.id}
          onClick={() => selectTarget(poi)}
        >
          <span className="target-btn-name">{poi.name}</span>
          <span className="target-btn-sub">Reference feature center (IAU / USGS)</span>
        </button>
      ))}

      <div className="dock-section-title">Surface equipment ({body.name})</div>
      {surfaceDevices.map((device) => {
        const devStatus = classifyDeviceStatus(device);
        return (
          <button
            key={device.id}
            type="button"
            className="target-list-btn"
            data-testid={`device-btn-${device.id}`}
            aria-pressed={deviceId === device.id}
            onClick={() => selectDevice(device.id)}
          >
            <span className="target-btn-name">{device.name}</span>
            <span className="target-btn-sub">
              {getVisitorNavDescription(devStatus.representation)} · {device.credit}
            </span>
          </button>
        );
      })}

      <div className="dock-section-title">Surface viewing layers</div>
      {body.layers.map((layer) => {
        const mode = layer.mode;
        return (
          <button
            key={layer.id}
            type="button"
            className="target-list-btn"
            data-testid={`layer-btn-${mode ?? layer.id}`}
            aria-pressed={mode ? spectralMode === mode : false}
            onClick={() => {
              if (!mode) return;
              setSpectralMode(mode);
              if (mode === 'TERRAIN_MESH_3D') {
                enterSurfaceLanding();
              }
            }}
          >
            <span className="target-btn-name">{layer.label}</span>
            <span className="target-btn-sub">Illustrative visual layer (see details in the right panel)</span>
          </button>
        );
      })}

      {body.unavailableDatasets.length > 0 && (
        <div className="unavailable-datasets-box" data-testid="unavailable-datasets-box">
          <div className="unavailable-datasets-title">Measurement data not integrated</div>
          {body.unavailableDatasets.map((ds) => (
            <div key={ds.id} className="unavailable-dataset-item">
              <strong>{ds.label}</strong>
              <span>{ds.instrumentReference} · Not included in this release</span>
            </div>
          ))}
        </div>
      )}

      {referenceSpacecraft.length > 0 && (
        <details
          className="reference-spacecraft-group"
          data-testid="reference-spacecraft-group"
        >
          <summary>
            Off-world reference spacecraft ({referenceSpacecraft.length})
          </summary>
          <p className="reference-spacecraft-note">
            The models below are not deployed on Mars or the Moon; they are included for shape reference and original attribution only.
          </p>
          {referenceSpacecraft.map((device) => {
            const devStatus = classifyDeviceStatus(device);
            return (
              <button
                key={device.id}
                type="button"
                className="target-list-btn"
                data-testid={`reference-device-${device.id}`}
                aria-pressed={deviceId === device.id}
                onClick={() => selectDevice(device.id)}
              >
                <span className="target-btn-name">{device.name}</span>
                <span className="target-btn-sub">
                  {devStatus.missionRelationshipLabel} · {getVisitorNavDescription(devStatus.representation)}
                </span>
              </button>
            );
          })}
        </details>
      )}
    </nav>
  );
}
