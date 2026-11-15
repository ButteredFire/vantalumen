import { useEffect, useState } from 'react';
import { BODY_CATALOG } from '../../config/bodyCatalog';
import { getBodyPhysicsConfig } from '../../config/bodyPhysicsConfig';
import { LINKED_ORBITAL_DEVICE_IDS } from '../../config/celestialCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { getDeviceSimulationProfile } from '../../config/deviceSimulationProfiles';
import {
  classifyDeviceStatus,
  classifyTargetStatus,
  isDeviceSurfaceDeployable,
  resolveDeviceBodyId,
} from '../../config/statusVocabulary';
import { useCosmosStore } from '../../store/useCosmosStore';
import type {
  DevicePartGroupId,
  ExplorationRegionSizeKm,
  QualityTier,
  SensorFilterMode,
  SourceReference,
} from '../../types/cosmos.types';
import { DeviceControlPanel } from './DeviceControlPanel';
import { DeviceDossierPanel } from './DeviceDossierPanel';

const PROCEDURAL_PART_GROUPS: Array<{ id: DevicePartGroupId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'optics_mast', label: 'Optics mast / cameras' },
  { id: 'mobility_chassis', label: 'Chassis & wheels' },
  { id: 'power_thermal', label: 'Power (RTG / batteries) & thermal' },
  { id: 'payload_science', label: 'Robotic arm & science' },
];

const SENSOR_OPTIONS: Array<{ id: SensorFilterMode; label: string }> = [
  { id: 'OPTICAL_RGB', label: 'Optical (WebP/color)' },
  { id: 'NAVCAM_MONO', label: 'Navcam monochrome' },
  { id: 'ELEVATION_GRID', label: '3D elevation grid' },
  { id: 'THERMAL_FALSE', label: 'Thermal infrared' },
];

function Source({ source }: { source: SourceReference }) {
  return (
    <div className="source-note">
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.title}
      </a>
      <small>
        Version: {source.version} · Checked: {source.checked}
      </small>
    </div>
  );
}

export function SubSceneInfoPanel() {
  const bodyId = useCosmosStore((state) => state.activeBodyId);
  const target = useCosmosStore((state) => state.activeTarget) ?? BODY_CATALOG[bodyId].target;
  const rawTarget = useCosmosStore((state) => state.activeTarget);
  const deviceId = useCosmosStore((state) => state.activeDeviceId);
  const load = useCosmosStore((state) => state.assetLoad);
  const retry = useCosmosStore((state) => state.retryAsset);
    const returnToOrbit = useCosmosStore((state) => state.returnToOrbit);
    const enterSurfaceLanding = useCosmosStore((state) => state.enterSurfaceLanding);
    const selectDevice = useCosmosStore((state) => state.selectDevice);

  const viewStage = useCosmosStore((state) => state.viewStage);
  const spectralMode = useCosmosStore((state) => state.spectralMode);
  const inspectionMode = useCosmosStore((state) => state.inspectionMode);
  const activePartGroupId = useCosmosStore((state) => state.activePartGroupId);
  const rotorSpinMode = useCosmosStore((state) => state.rotorSpinMode);

  const povYawDeg = useCosmosStore((state) => state.povYawDeg);
  const povPitchDeg = useCosmosStore((state) => state.povPitchDeg);
  const povFovZoom = useCosmosStore((state) => state.povFovZoom);
  const povSensorMode = useCosmosStore((state) => state.povSensorMode);
  const povArmDeployed = useCosmosStore((state) => state.povArmDeployed);
  const povScanActive = useCosmosStore((state) => state.povScanActive);

  const setViewStage = useCosmosStore((state) => state.setViewStage);
  const setSpectralMode = useCosmosStore((state) => state.setSpectralMode);
  const setInspectionMode = useCosmosStore((state) => state.setInspectionMode);
  const setOrbitalCloseup = useCosmosStore((state) => state.setOrbitalCloseup);
  const setActivePartGroup = useCosmosStore((state) => state.setActivePartGroup);
  const setRotorSpinMode = useCosmosStore((state) => state.setRotorSpinMode);
  const setPovOrientation = useCosmosStore((state) => state.setPovOrientation);
  const setPovFovZoom = useCosmosStore((state) => state.setPovFovZoom);
  const setPovSensorMode = useCosmosStore((state) => state.setPovSensorMode);
  const togglePovArm = useCosmosStore((state) => state.togglePovArm);
  const togglePovScan = useCosmosStore((state) => state.togglePovScan);
  const resetPovCamera = useCosmosStore((state) => state.resetPovCamera);
  const orbitalCloseup = useCosmosStore((state) => state.orbitalCloseup);
  const qualityTier = useCosmosStore((state) => state.qualityTier);
  const resolvedQualityTier = useCosmosStore((state) => state.resolvedQualityTier);
  const reducedMotion = useCosmosStore((state) => state.reducedMotion);
  const qualityStats = useCosmosStore((state) => state.qualityStats);
  const explorationRegionSizeKm = useCosmosStore((state) => state.explorationRegionSizeKm);
  const setQualityTier = useCosmosStore((state) => state.setQualityTier);
  const setExplorationRegionSizeKm = useCosmosStore((state) => state.setExplorationRegionSizeKm);

  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
  );
  useEffect(() => {
    if (inspectionMode !== 'CONTROL_ROOM_POV') {
      setPanelCollapsed(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
    }
  }, [inspectionMode]);

  const device = DEVICE_CATALOG.find((item) => item.id === deviceId);
  const isNonPlanetTarget = Boolean(rawTarget && rawTarget.id !== bodyId);
  const showDualModeSwitcher = Boolean(device) || isNonPlanetTarget;
  const linkedOrbitalDeviceId = rawTarget ? LINKED_ORBITAL_DEVICE_IDS[rawTarget.id] : undefined;
  const isOrbitalTargetWithoutDevice = Boolean(
    rawTarget &&
      !linkedOrbitalDeviceId &&
      (rawTarget.category === 'MOON' || rawTarget.category === 'SPACECRAFT'),
  );

  const isCloseupPressed =
    inspectionMode === 'MODEL_CLOSEUP' &&
    (!device ||
      device.status === 'available' ||
      Boolean(device.proceduralModel) ||
      viewStage === 'SUB_SCENE') &&
    (!rawTarget || rawTarget.category !== 'SURFACE_POI' || spectralMode === 'TERRAIN_MESH_3D') &&
    (!isOrbitalTargetWithoutDevice || orbitalCloseup);

  const handleSelectInspectModel = () => {
    if (device) {
      setInspectionMode('MODEL_CLOSEUP');
      if (device.status === 'unavailable' && !device.proceduralModel) {
        setViewStage('SUB_SCENE');
      }
      return;
    }
    if (rawTarget && linkedOrbitalDeviceId) {
      selectDevice(linkedOrbitalDeviceId);
      return;
    }
    if (rawTarget?.category === 'SURFACE_POI') {
      setOrbitalCloseup(false);
      setInspectionMode('MODEL_CLOSEUP');
      setSpectralMode('TERRAIN_MESH_3D');
      return;
    }
    if (rawTarget) {
      setOrbitalCloseup(true);
      setInspectionMode('MODEL_CLOSEUP');
      setViewStage('SUB_SCENE');
    }
  };

  const handleSelectExploreViewpoints = () => {
    setInspectionMode('CONTROL_ROOM_POV');
  };

  const showDeviceSimControls = Boolean(device) || isNonPlanetTarget || spectralMode === 'TERRAIN_MESH_3D';

  const profile = getDeviceSimulationProfile(device?.id ?? rawTarget?.id ?? null, device);
  const resolvedBodyId = resolveDeviceBodyId(device, rawTarget?.bodyId ?? bodyId);
  const bodyPhysics = getBodyPhysicsConfig(resolvedBodyId);
  const isSurfaceProfile = showDeviceSimControls && profile.mobilityKind !== 'orbital';
  const entryStatus = device
    ? classifyDeviceStatus(device, load)
    : classifyTargetStatus(target, load);
  const canExploreSurface = device
    ? isDeviceSurfaceDeployable(device)
    : rawTarget?.category === 'SURFACE_POI' || spectralMode === 'TERRAIN_MESH_3D';
  const formatMb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

  return (
    <aside
      className={`hud-right-panel glass-panel ${panelCollapsed ? 'is-collapsed' : ''}`}
      data-testid="subscene-info-panel"
      aria-label="Information and sources"
    >
      <div className="sim-drawer-head">
        <h2 className="info-panel-title" style={{ margin: 0 }}>{device?.name ?? target.name}</h2>
        <button
          type="button"
          className="drawer-collapse-btn"
          data-testid="subscene-drawer-toggle"
          onClick={() => setPanelCollapsed((prev) => !prev)}
        >
          {panelCollapsed ? 'Open' : 'Collapse'}
        </button>
      </div>

      {!panelCollapsed && (
        <>
          <div className="status-vocabulary-badges" data-testid="status-vocabulary-badges">
            <span className="status-badge status-badge-relationship">
              {entryStatus.missionRelationshipLabel}
            </span>
            <span className="status-badge status-badge-representation">
              {entryStatus.representationLabel}
            </span>
            <span className="status-badge status-badge-evidence">
              {entryStatus.evidenceLabel}
            </span>
          </div>

          <div className="control-facts-box sim-settings-box" data-testid="simulation-settings-card">
            {isSurfaceProfile && (
              <div className="sim-setting-group">
                <div className="device-control-label">EXPLORATION AREA</div>
                <div className="sim-chip-row">
                  {([2, 16, 64] as ExplorationRegionSizeKm[]).map((sizeKm) => (
                    <button
                      key={sizeKm}
                      type="button"
                      className={`pov-chip-btn ${explorationRegionSizeKm === sizeKm ? 'is-active' : ''}`}
                      data-testid={`region-size-${sizeKm}`}
                      onClick={() => setExplorationRegionSizeKm(sizeKm)}
                    >
                      {sizeKm}×{sizeKm} km
                    </button>
                  ))}
                </div>
                <div className="sim-provenance-note">
                  {bodyPhysics.regionCenterName} · {bodyPhysics.terrainSourceSummary}
                </div>
              </div>
            )}

            <div className="sim-setting-group">
              <div className="device-control-label">
                GRAPHICS QUALITY ({resolvedQualityTier.toUpperCase()}
                {reducedMotion ? ' · REDUCED MOTION' : ''})
              </div>
              <div className="sim-chip-row">
                {(['auto', 'low', 'medium', 'high'] as QualityTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`pov-chip-btn ${qualityTier === tier ? 'is-active' : ''}`}
                    data-testid={`quality-tier-${tier}`}
                    onClick={() => setQualityTier(tier)}
                  >
                    {tier === 'auto'
                      ? 'Auto'
                      : tier === 'low'
                        ? 'Low'
                        : tier === 'medium'
                          ? 'Medium'
                          : 'High'}
                  </button>
                ))}
              </div>
              {qualityStats && (
                <div className="sim-telemetry-line" data-testid="quality-runtime-stats">
                  p50 {qualityStats.p50FrameMs}ms · p95 {qualityStats.p95FrameMs}ms · DPR{' '}
                  {qualityStats.activeDpr} · Draw {qualityStats.drawCalls} · GPU ~
                  {formatMb(qualityStats.estimatedGpuBytes)}
                </div>
              )}
            </div>

            {showDeviceSimControls && (
              <div className="sim-provenance-note" data-testid="device-provenance-disclosure">
                <div>{profile.provenanceLabel}</div>
                <div>{profile.documentedSpeedNote}</div>
                {!profile.physicalTransform.physicalScaleVerified && (
                  <div>{profile.physicalTransform.dimensionsDisclaimer}</div>
                )}
              </div>
            )}
          </div>

      {showDualModeSwitcher && (
        <div
          className="dual-mode-switcher"
          data-testid="dual-view-mode-switcher"
          role="group"
          aria-label="Viewing mode"
        >
          <button
            type="button"
            className="dual-mode-btn"
            data-testid="view-mode-closeup"
            aria-pressed={isCloseupPressed}
            onClick={handleSelectInspectModel}
          >
            <strong>Inspect model</strong>
            <span>
              Inspect model ·{' '}
              {rawTarget?.category === 'SURFACE_POI'
                ? 'Inspect 3D terrain'
                : 'Rotate to inspect the 3D model'}
            </span>
          </button>

          <button
            type="button"
            className="dual-mode-btn"
            data-testid="view-mode-pov"
            aria-pressed={inspectionMode === 'CONTROL_ROOM_POV'}
            onClick={handleSelectExploreViewpoints}
          >
            <strong>Explore viewpoints</strong>
            <span>Control room &amp; first-person views</span>
          </button>
        </div>
      )}

      {showDualModeSwitcher && inspectionMode === 'CONTROL_ROOM_POV' && (
        <section
          className="pov-control-deck"
          data-testid="pov-control-deck"
          aria-label="Cockpit / first-person controls"
        >
          <div className="device-control-header">
            <span className="dock-section-title">CONTROL ROOM · FIRST-PERSON VIEW</span>
            <span className="control-pill-badge">Illustrative simulation</span>
          </div>
          <p className="control-disclaimer">
            Illustrative first-person view on {bodyId === 'mars' ? 'a baked 8K 3D terrain patch' : 'simulated crater terrain'}. Not real-time mission imagery.
          </p>

          <div className="control-section">
            <span className="control-section-label">
              View direction (yaw {Math.round(povYawDeg)}° · pitch {Math.round(povPitchDeg)}°)
            </span>
            <div className="control-chip-grid">
              <button
                type="button"
                className="control-chip-btn"
                data-testid="pov-yaw-left"
                onClick={() => setPovOrientation(povYawDeg - 15, povPitchDeg)}
              >
                ← Turn left 15°
              </button>
              <button
                type="button"
                className="control-chip-btn"
                data-testid="pov-yaw-right"
                onClick={() => setPovOrientation(povYawDeg + 15, povPitchDeg)}
              >
                Turn right 15° →
              </button>
              <button
                type="button"
                className="control-chip-btn"
                data-testid="pov-pitch-up"
                onClick={() => setPovOrientation(povYawDeg, povPitchDeg + 8)}
              >
                ↑ Look up 8°
              </button>
              <button
                type="button"
                className="control-chip-btn"
                data-testid="pov-pitch-down"
                onClick={() => setPovOrientation(povYawDeg, povPitchDeg - 8)}
              >
                ↓ Look down 8°
              </button>
            </div>
          </div>

          <div className="control-section">
            <span className="control-section-label">Optical zoom</span>
            <div className="control-step-grid">
              {([1, 2, 4] as const).map((zoom) => (
                <button
                  key={zoom}
                  type="button"
                  className="control-step-btn"
                  data-testid={`pov-zoom-${zoom}`}
                  aria-pressed={povFovZoom === zoom}
                  onClick={() => setPovFovZoom(zoom)}
                >
                  {zoom}×
                </button>
              ))}
              <button
                type="button"
                className="control-step-btn"
                data-testid="pov-reset"
                onClick={resetPovCamera}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="control-section">
            <span className="control-section-label">Viewing sensor channel</span>
            <div className="control-chip-grid">
              {SENSOR_OPTIONS.map((sensor) => (
                <button
                  key={sensor.id}
                  type="button"
                  className="control-chip-btn"
                  data-testid={`pov-sensor-${sensor.id}`}
                  aria-pressed={povSensorMode === sensor.id}
                  onClick={() => setPovSensorMode(sensor.id)}
                >
                  {sensor.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-section">
            <span className="control-section-label">Onboard Instrument Actuation (Illustrative)</span>
            <div className="control-chip-grid">
              <button
                type="button"
                className="control-chip-btn"
                data-testid="pov-action-arm"
                aria-pressed={povArmDeployed}
                onClick={togglePovArm}
              >
                {povArmDeployed ? 'Stow Robotic Arm / Boom' : 'Deploy Robotic Arm / Boom'}
              </button>
              <button
                type="button"
                className="control-chip-btn"
                data-testid="pov-action-scan"
                aria-pressed={povScanActive}
                onClick={togglePovScan}
              >
                {povScanActive ? 'Stop Spectrometer Scan' : 'Trigger Spectrometer Scan'}
              </button>
            </div>
          </div>
        </section>
      )}

      {device ? (
        <>
          <p>{device.summary}</p>
          <div role="status" aria-live="polite" data-testid="model-status">
            {load.status === 'error' ? (
              <>
                <p role="alert">
                  Could not load {device.name}. {load.message} (Showing as{' '}
                  {entryStatus.representationShortTag}).
                </p>
                <button className="hud-action-btn" onClick={retry}>
                  Try again
                </button>
              </>
            ) : (
              <span>
                {entryStatus.representationLabel} · {entryStatus.runtimeLabel}
              </span>
            )}
          </div>

          {device.status === 'available' ? (
            <>
              <p className="coverage-note">
                View the model independently at normalized scale. Physical scale and deployment location are unverified. Drag to rotate; scroll to zoom.
              </p>
              {load.status === 'ready' && inspectionMode === 'MODEL_CLOSEUP' && (
                <DeviceControlPanel deviceId={device.id} />
              )}
              <p>
                <strong>Credit:</strong> {device.credit}
              </p>
              <p>
                {device.license.url ? (
                  <a href={device.license.url} target="_blank" rel="noreferrer">
                    {device.license.label}
                  </a>
                ) : (
                  device.license.label
                )}
              </p>
              <p className="source-note">
                Model version: {device.version}. The source file is unmodified; only centered and scaled for viewing.
              </p>
            </>
          ) : (
            <>
              <p className="coverage-note">
                {device.proceduralModel
                  ? 'Illustrative reconstruction from supplied documentation; no original NASA 3D model file is available.'
                  : 'Documentation record only; no 3D model file is loaded.'}
              </p>
              {Boolean(device.proceduralModel) && inspectionMode === 'MODEL_CLOSEUP' && (
                <section
                  className="device-control-panel"
                  data-testid="procedural-device-controls"
                  aria-label="Illustrative reconstruction model"
                >
                  <div className="device-control-header">
                    <span className="dock-section-title">ILLUSTRATIVE RECONSTRUCTION</span>
                    <span className="control-pill-badge">Illustrative reconstruction</span>
                  </div>
                  <p className="control-disclaimer">
                    Reconstructed geometry illustrates the component layout when no official NASA GLB is available.
                  </p>
                  <div className="control-chip-grid">
                    {PROCEDURAL_PART_GROUPS.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className="control-chip-btn"
                        aria-pressed={activePartGroupId === group.id}
                        onClick={() => setActivePartGroup(group.id)}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="hud-action-btn control-spin-btn"
                    aria-pressed={rotorSpinMode === 'demo_slow'}
                    onClick={() =>
                      setRotorSpinMode(rotorSpinMode === 'demo_slow' ? 'stopped' : 'demo_slow')
                    }
                  >
                    {rotorSpinMode === 'demo_slow'
                      ? 'Stop illustrative axis rotation'
                      : 'Slowly rotate optics assembly (illustrative)'}
                  </button>
                </section>
              )}
              <p>
                <strong>Credit:</strong> {device.credit}
              </p>
              <p>{device.license.label}</p>
              <p className="source-note">
                Record version: {device.version}. No source file or geometry scale is available to verify.
              </p>
            </>
          )}

          <Source source={device.source} />
          <details>
            <summary>Source material</summary>
            <p>{device.evidence}</p>
            {device.attributionPath && (
              <a href={device.attributionPath} target="_blank" rel="noreferrer">
                Original attribution file
              </a>
            )}
          </details>
        </>
      ) : (
        <>
          <p className="info-panel-subtitle">{target.subtitle}</p>
          <p>{target.telemetry.missionSummary}</p>
          {target.coordinates && (
            <p className="coordinates-strip">
              Latitude {target.coordinates.lat.toFixed(2)}° · Longitude {target.coordinates.lon.toFixed(2)}°E
            </p>
          )}
          {!target.coordinates && <p>Gravity: {target.telemetry.surfaceGravityMs2}</p>}
          <ul className="highlights-list">
            {target.telemetry.keyHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {spectralMode === 'TERRAIN_MESH_3D' && (
            <div className="control-facts-box" data-testid="terrain-mesh-banner">
              <small>
                {bodyId === 'moon'
                  ? 'Showing the lunar 3D terrain mesh (`moon_terrain.glb` + baked 8K WebP textures: Albedo, Normals, Roughness). Drag to rotate the terrain mesh.'
                  : 'Showing the Mars 3D terrain mesh (`mars_terrain.glb` + baked 8K WebP textures: Albedo, Normals, Roughness). Drag to rotate the terrain mesh.'}
              </small>
            </div>
          )}
          {target.source && <Source source={target.source} />}
          {!rawTarget && !device && BODY_CATALOG[bodyId].unavailableDatasets.length > 0 && (
            <div className="unavailable-datasets-box" data-testid="overview-unavailable-datasets">
              <div className="unavailable-datasets-title">Measurement data not integrated</div>
              {BODY_CATALOG[bodyId].unavailableDatasets.map((ds) => (
                <div key={ds.id} className="unavailable-dataset-item">
                  <strong>{ds.label}</strong>
                  <span>{ds.instrumentReference} · {ds.detail}</span>
                </div>
              ))}
            </div>
          )}
          <p className="coverage-note">
            Quantitative imagery / terrain at its actual resolution is not available. Terrain layers and POV are illustrative.
          </p>
        </>
      )}

      {(device?.id ?? rawTarget?.id) && (
        <DeviceDossierPanel
          key={device?.id ?? rawTarget?.id ?? 'none'}
          targetId={device?.id ?? rawTarget?.id}
        />
      )}

            {canExploreSurface && (
                <button
                    type="button"
                    className="hud-action-btn primary-btn"
                    onClick={() => enterSurfaceLanding()}
                    style={{ marginBottom: '0.5rem' }}
                >
                    Explore 3D Surface Terrain
                </button>
            )}

            <button className="hud-action-btn secondary-btn" onClick={returnToOrbit}>
                Return to overview
            </button>
        </>
      )}
    </aside>
  );
}
