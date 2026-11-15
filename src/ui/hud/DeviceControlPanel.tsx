import { getDeviceControlSpec, getPartGroupSpec } from '../../config/deviceControlSpecs';
import { useCosmosStore } from '../../store/useCosmosStore';

/**
 * Source-backed device inspection & mechanism control panel.
 * Renders only when a verified control specification exists and the active GLB is ready.
 */
export function DeviceControlPanel({ deviceId }: { deviceId: string }) {
  const spec = getDeviceControlSpec(deviceId);
  const deviceCameraViewId = useCosmosStore((state) => state.deviceCameraViewId);
  const activePartGroupId = useCosmosStore((state) => state.activePartGroupId);
  const rotorSpinMode = useCosmosStore((state) => state.rotorSpinMode);
  const rotorStepDeg = useCosmosStore((state) => state.rotorStepDeg);
  const setDeviceCameraView = useCosmosStore((state) => state.setDeviceCameraView);
  const setActivePartGroup = useCosmosStore((state) => state.setActivePartGroup);
  const setRotorSpinMode = useCosmosStore((state) => state.setRotorSpinMode);
  const setRotorStepDeg = useCosmosStore((state) => state.setRotorStepDeg);
  const resetDeviceControl = useCosmosStore((state) => state.resetDeviceControl);

  if (!spec) return null;

  const activeView =
    spec.cameraViews.find((view) => view.id === deviceCameraViewId) ?? spec.cameraViews[0];
  const activeGroup = getPartGroupSpec(spec, activePartGroupId);

  return (
    <section
      className="device-control-panel"
      data-testid="device-control-panel"
      aria-label="Device component inspection and controls"
    >
      <div className="device-control-header">
        <span className="dock-section-title">INSPECTION &amp; CONTROLS (MVP)</span>
        <span className="control-pill-badge">Illustrative GLB view</span>
      </div>

      <p className="control-disclaimer">{spec.generalDisclaimer}</p>

      <div className="control-section">
        <span className="control-section-label">Documented views (illustrative)</span>
        <div className="control-chip-grid">
          {spec.cameraViews.map((view) => (
            <button
              key={view.id}
              type="button"
              className="control-chip-btn"
              data-testid={`camera-view-${view.id}`}
              aria-pressed={activeView.id === view.id}
              onClick={() => setDeviceCameraView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
        <div className="control-detail-card" data-testid="active-camera-details">
          <p>{activeView.summary}</p>
          <small>
            View source: {activeView.sourceRef} · Illustrative view from GLB geometry.
          </small>
        </div>
      </div>

      {spec.rotorControl && (
        <div className="control-section">
          <span className="control-section-label">
            Coaxial rotor mechanism (documented vs. illustrative)
          </span>
          <div className="control-facts-box">
            <small>
              <strong>NASA reference specifications:</strong> {spec.rotorControl.documentedDiameter} ·{' '}
              {spec.rotorControl.documentedRpm} · {spec.rotorControl.documentedFlightWindow}.
            </small>
          </div>

          <span className="control-sub-label">Step rotation (rotors_01 / rotors_02)</span>
          <div className="control-step-grid">
            {spec.rotorControl.stepAnglesDeg.map((deg) => {
              const isActive = rotorSpinMode === 'stopped' && rotorStepDeg === deg;
              return (
                <button
                  key={deg}
                  type="button"
                  className="control-step-btn"
                  data-testid={`rotor-step-${deg}`}
                  aria-pressed={isActive}
                  onClick={() => setRotorStepDeg(deg)}
                >
                  {deg}°
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="hud-action-btn control-spin-btn"
            data-testid="rotor-spin-toggle"
            aria-pressed={rotorSpinMode === 'demo_slow'}
            onClick={() =>
              setRotorSpinMode(rotorSpinMode === 'demo_slow' ? 'stopped' : 'demo_slow')
            }
          >
            {rotorSpinMode === 'demo_slow'
              ? 'Stop illustrative rotation'
              : 'Illustrative counter-rotation (0.5 rev/s)'}
          </button>

          <p className="control-note">
            <strong>Illustrative:</strong> {spec.rotorControl.demoRevPerSecLabel}.{' '}
            {spec.rotorControl.disclaimer}
          </p>
        </div>
      )}

      <div className="control-section">
        <span className="control-section-label">GLB component map ({spec.partGroups.length} groups)</span>
        <div className="control-chip-grid">
          {spec.partGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="control-chip-btn"
              data-testid={`part-group-${group.id}`}
              aria-pressed={activeGroup.id === group.id}
              onClick={() => setActivePartGroup(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className="control-detail-card" data-testid="active-part-details">
          <div className="control-node-row">
            <code>
              {activeGroup.nodeNames.length > 12
                ? `${activeGroup.nodeNames.slice(0, 8).join(', ')} (+${activeGroup.nodeNames.length - 8} node)`
                : activeGroup.nodeNames.join(', ')}
            </code>
            <span className="control-status-tag">
              {activeGroup.isControlVerified ? 'Articulated mechanism' : 'Static · Inspection only'}
            </span>
          </div>
          <p>
            <strong>Documented specifications:</strong> {activeGroup.documentedSpec}
          </p>
          <p className="control-limit-note">
            <strong>Model limitations:</strong> {activeGroup.limitationNote}
          </p>
          <small>Source: {activeGroup.sourceRef}</small>
        </div>
      </div>

      <button
        type="button"
        className="hud-action-btn control-reset-btn"
        data-testid="device-control-reset"
        onClick={resetDeviceControl}
      >
        Reset view &amp; mechanism
      </button>
    </section>
  );
}
