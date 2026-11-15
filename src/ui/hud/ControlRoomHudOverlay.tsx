import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBodyPhysicsConfig } from '../../config/bodyPhysicsConfig';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { getDeviceSimulationProfile } from '../../config/deviceSimulationProfiles';
import { surfaceInputBridge } from '../../scene/simulation/surfaceInputBridge';
import { useCosmosStore } from '../../store/useCosmosStore';
import type { StabilityWarningKind } from '../../types/cosmos.types';

const WARNING_LABELS: Record<Exclude<StabilityWarningKind, 'none'>, string> = {
  steep_slope: 'Cảnh báo độ dốc lớn — giảm ga hoặc đánh lái nhẹ',
  high_center: 'Gầm xe chạm địa hình — nhấn R để đặt lại vị trí ổn định',
  tip_over: 'Cảnh báo nghiêng lật khung xe — nhấn R để khôi phục tư thế',
  boundary_limit: 'Đã chạm ranh giới vùng khám phá hiện tại',
};

function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

interface VirtualDrivePadProps {
  isHelicopter: boolean;
}

const VirtualDrivePad: React.FC<VirtualDrivePadProps> = ({ isHelicopter }) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      surfaceInputBridge.setVirtualJoystick(0, 0);
      surfaceInputBridge.setVirtualBrake(false);
      surfaceInputBridge.setVirtualAscend(0);
    };
  }, []);

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = Math.max(22, rect.width * 0.36);

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    const nx = dx / maxRadius;
    const ny = dy / maxRadius;
    // Upward drag (-ny) -> positive forward throttle; Left drag (-nx) -> positive left steer
    surfaceInputBridge.setVirtualJoystick(-ny, -nx);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    surfaceInputBridge.setVirtualJoystick(0, 0);
  };

  return (
    <div
      className="pov-touch-controls"
      data-testid="pov-virtual-controls"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={padRef}
        className="pov-joystick-pad"
        data-testid="pov-virtual-joystick"
        role="application"
        aria-label="Cần lái ảo"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          pointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStickFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          updateStickFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          resetStick();
        }}
        onPointerCancel={resetStick}
        onLostPointerCapture={resetStick}
      >
        <div className="pov-joystick-crosshair" />
        <div
          className="pov-joystick-knob"
          style={{
            transform: `translate(${knobOffset.x.toFixed(1)}px, ${knobOffset.y.toFixed(1)}px)`,
          }}
        />
      </div>

      <div className="pov-touch-actions">
        {isHelicopter ? (
          <>
            <button
              type="button"
              className="pov-touch-btn"
              data-testid="pov-btn-ascend"
              onPointerDown={(e) => {
                e.stopPropagation();
                surfaceInputBridge.setVirtualAscend(1);
              }}
              onPointerUp={() => surfaceInputBridge.setVirtualAscend(0)}
              onPointerLeave={() => surfaceInputBridge.setVirtualAscend(0)}
              onPointerCancel={() => surfaceInputBridge.setVirtualAscend(0)}
            >
              ▲ Bay lên
            </button>
            <button
              type="button"
              className="pov-touch-btn"
              data-testid="pov-btn-descend"
              onPointerDown={(e) => {
                e.stopPropagation();
                surfaceInputBridge.setVirtualAscend(-1);
              }}
              onPointerUp={() => surfaceInputBridge.setVirtualAscend(0)}
              onPointerLeave={() => surfaceInputBridge.setVirtualAscend(0)}
              onPointerCancel={() => surfaceInputBridge.setVirtualAscend(0)}
            >
              ▼ Hạ xuống
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pov-touch-btn is-brake"
            data-testid="pov-btn-brake"
            onPointerDown={(e) => {
              e.stopPropagation();
              surfaceInputBridge.setVirtualBrake(true);
            }}
            onPointerUp={() => surfaceInputBridge.setVirtualBrake(false)}
            onPointerLeave={() => surfaceInputBridge.setVirtualBrake(false)}
            onPointerCancel={() => surfaceInputBridge.setVirtualBrake(false)}
          >
            Phanh (Space)
          </button>
        )}
      </div>
    </div>
  );
};

interface SurfaceMinimapProps {
  globalXM: number;
  globalZM: number;
  headingDeg: number;
  trailPoints: Array<{ x: number; z: number }>;
  regionSizeKm: number;
}

const SurfaceMinimap: React.FC<SurfaceMinimapProps> = ({
  globalXM,
  globalZM,
  headingDeg,
  trailPoints,
  regionSizeKm,
}) => {
  const size = 104;
  const half = size / 2;
  // Adaptive span smoothly zooming from 120 m local up to trail spread
  const maxOffset = useMemo(() => {
    let maxD = 80;
    for (const pt of trailPoints) {
      maxD = Math.max(maxD, Math.abs(pt.x - globalXM), Math.abs(pt.z - globalZM));
    }
    return Math.min(2000, maxD * 1.2);
  }, [globalXM, globalZM, trailPoints]);

  const toMapX = (wx: number) => half + ((wx - globalXM) / maxOffset) * (half - 10);
  const toMapY = (wz: number) => half + ((wz - globalZM) / maxOffset) * (half - 10);

  const pathD = useMemo(() => {
    if (trailPoints.length < 2) return '';
    return trailPoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${toMapX(pt.x).toFixed(1)},${toMapY(pt.z).toFixed(1)}`)
      .join(' ');
  }, [trailPoints, globalXM, globalZM, maxOffset]);

  return (
    <div className="pov-minimap-card" data-testid="pov-minimap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Bản đồ mini hành trình">
        <circle cx={half} cy={half} r={half - 4} fill="rgba(4,12,24,0.86)" stroke="rgba(56,220,255,0.45)" />
        <circle cx={half} cy={half} r={(half - 4) * 0.5} fill="none" stroke="rgba(56,220,255,0.18)" strokeDasharray="3 3" />
        <line x1={half} y1={4} x2={half} y2={size - 4} stroke="rgba(148,163,184,0.2)" />
        <line x1={4} y1={half} x2={size - 4} y2={half} stroke="rgba(148,163,184,0.2)" />
        <text x={half} y={13} textAnchor="middle" fill="#7dd3fc" fontSize="8" fontWeight="700">
          B
        </text>
        {pathD && <path d={pathD} fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" />}
        <g transform={`translate(${half}, ${half}) rotate(${headingDeg})`}>
          <polygon points="0,-7 4.5,5 0,2.5 -4.5,5" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.7" />
        </g>
      </svg>
      <div className="pov-minimap-caption">
        ±{Math.round(maxOffset)}m · Vùng {regionSizeKm}×{regionSizeKm}km
      </div>
    </div>
  );
};

/**
 * Tactile telemetry, driving/flight controls, minimap trail, stability alerts,
 * and responsive virtual joystick overlay during Option 2 (CONTROL_ROOM_POV).
 */
export function ControlRoomHudOverlay() {
  const viewStage = useCosmosStore((s) => s.viewStage);
  const inspectionMode = useCosmosStore((s) => s.inspectionMode);
  const activeDeviceId = useCosmosStore((s) => s.activeDeviceId);
  const activeTarget = useCosmosStore((s) => s.activeTarget);
  const activeBodyId = useCosmosStore((s) => s.activeBodyId);

  const povYawDeg = useCosmosStore((s) => s.povYawDeg);
  const povPitchDeg = useCosmosStore((s) => s.povPitchDeg);
  const povFovZoom = useCosmosStore((s) => s.povFovZoom);
  const povSensorMode = useCosmosStore((s) => s.povSensorMode);

  const telemetry = useCosmosStore((s) => s.surfaceTelemetry);
  const regionSizeKm = useCosmosStore((s) => s.explorationRegionSizeKm);
  const regionBoundaryMessage = useCosmosStore((s) => s.regionBoundaryMessage);
  const resolvedQualityTier = useCosmosStore((s) => s.resolvedQualityTier);
  const qualityStats = useCosmosStore((s) => s.qualityStats);
  const cameraMountMode = useCosmosStore((s) => s.cameraMountMode);
  const horizonStabilized = useCosmosStore((s) => s.horizonStabilized);
  const simulatedMobilityEnabled = useCosmosStore((s) => s.simulatedMobilityEnabled);
  const pointerLocked = useCosmosStore((s) => s.pointerLocked);
  const simulationPaused = useCosmosStore((s) => s.simulationPaused);
  const timeScale = useCosmosStore((s) => s.timeScale);

  const toggleCameraMountMode = useCosmosStore((s) => s.toggleCameraMountMode);
  const toggleHorizonStabilized = useCosmosStore((s) => s.toggleHorizonStabilized);
  const toggleSimulatedMobilityEnabled = useCosmosStore((s) => s.toggleSimulatedMobilityEnabled);
  const triggerSimulationRecovery = useCosmosStore((s) => s.triggerSimulationRecovery);
  const toggleSimulationPaused = useCosmosStore((s) => s.toggleSimulationPaused);
  const setTimeScale = useCosmosStore((s) => s.setTimeScale);

  const [hudCompact, setHudCompact] = useState(false);

  const device = useMemo(
    () => (activeDeviceId ? DEVICE_CATALOG.find((item) => item.id === activeDeviceId) ?? null : null),
    [activeDeviceId],
  );
  const targetId = device?.id ?? activeTarget?.id ?? null;
  const bodyId = device?.bodyId ?? activeTarget?.bodyId ?? activeBodyId;
  const profile = useMemo(() => getDeviceSimulationProfile(targetId, device), [device, targetId]);
  const bodyPhysics = useMemo(() => getBodyPhysicsConfig(bodyId), [bodyId]);

  if (
    viewStage === 'PRELOADING' ||
    viewStage === 'LAUNCHING' ||
    viewStage === 'BODY_TRANSITION'
  ) {
    return null;
  }

  const visible =
    inspectionMode === 'CONTROL_ROOM_POV' && (Boolean(activeDeviceId) || Boolean(activeTarget));
  if (!visible) return null;

  const isOrbital = profile.mobilityKind === 'orbital';
  const isHelicopter = profile.mobilityKind === 'helicopter';
  const isStaticLander = profile.mobilityKind === 'lander_static';

  const sensorLabel =
    povSensorMode === 'OPTICAL_RGB'
      ? 'QUANG HỌC RGB'
      : povSensorMode === 'NAVCAM_MONO'
        ? 'NAVCAM ĐƠN SẮC'
        : povSensorMode === 'ELEVATION_GRID'
          ? 'LƯỚI ĐỘ CAO'
          : 'NHIỆT HỒNG NGOẠI';

  const warningText =
    telemetry.stabilityWarning === 'boundary_limit' && regionBoundaryMessage
      ? regionBoundaryMessage
      : telemetry.stabilityWarning !== 'none'
        ? WARNING_LABELS[telemetry.stabilityWarning]
        : null;

  return (
    <div
      className={`control-room-hud-overlay ${hudCompact ? 'is-compact' : ''}`}
      data-testid="control-room-hud"
    >
      {/* Top telemetry strip */}
      <div className="pov-top-bar" onPointerDown={(e) => e.stopPropagation()}>
        <div className="pov-top-telemetry">
          <span className="pov-pill">{device?.name ?? activeTarget?.name}</span>
          {!isOrbital ? (
            <>
              <span className="pov-pill" data-testid="pov-speed-readout" title={profile.documentedSpeedNote}>
                V: {telemetry.speedMs.toFixed(2)} m/s
              </span>
              <span className="pov-pill" data-testid="pov-odometer-readout">
                QUÃNG ĐƯỜNG: {formatDistanceLabel(telemetry.distanceTraveledM)}
              </span>
              <span className="pov-pill">
                HƯỚNG: {telemetry.headingDeg}° · P/R: {telemetry.pitchDeg.toFixed(1)}°/{telemetry.rollDeg.toFixed(1)}°
              </span>
              <span className="pov-pill">
                ĐỘ CAO: {telemetry.elevationM.toFixed(1)} m · AGL: {telemetry.altitudeAboveGroundM.toFixed(2)} m
              </span>
              {telemetry.totalWheels > 0 && (
                <span className="pov-pill" data-testid="pov-wheel-contact-readout">
                  BÁNH TIẾP ĐẤT: {telemetry.wheelsGroundedCount}/{telemetry.totalWheels} · TRƯỢT:{' '}
                  {Math.round(telemetry.slipRatio * 100)}%
                </span>
              )}
            </>
          ) : (
            <>
              <span className="pov-pill" data-testid="pov-orbital-altitude">
                QUỸ ĐẠO: ~{telemetry.elevationM.toFixed(0)} km
              </span>
              <span className="pov-pill">
                TUA THỜI GIAN: {simulationPaused ? 'ĐÃ TẠM DỪNG' : `${timeScale}×`}
              </span>
            </>
          )}
          <span className="pov-pill is-sensor">{sensorLabel} · {povFovZoom}×</span>
          <span className="pov-pill">
            YAW {povYawDeg.toFixed(0)}° · PITCH {povPitchDeg.toFixed(0)}°
          </span>
          {qualityStats && (
            <span className="pov-pill" data-testid="pov-quality-badge">
              {resolvedQualityTier.toUpperCase()} · p95 {qualityStats.p95FrameMs}ms · DPR {qualityStats.activeDpr}
            </span>
          )}
        </div>

        <button
          type="button"
          className="pov-compact-toggle"
          data-testid="pov-hud-collapse-toggle"
          onClick={() => setHudCompact((prev) => !prev)}
        >
          {hudCompact ? 'Mở HUD' : 'Thu gọn'}
        </button>
      </div>

      {/* Contextual status / hazard / simulated-mode notices */}
      <div className="pov-alerts-stack" onPointerDown={(e) => e.stopPropagation()}>
        <div className="pov-provenance-chip" data-testid="pov-provenance-banner">
          {bodyPhysics.regionCenterName} · {profile.provenanceLabel}
        </div>

        {telemetry.isStreamingColliderHold && (
          <div className="pov-alert-banner is-warning" role="status" data-testid="pov-streaming-brake-badge">
            Đang tải vùng tiếp theo — phanh an toàn đang kích hoạt
          </div>
        )}

        {warningText && (
          <div className="pov-alert-banner is-danger" role="alert" data-testid="pov-stability-warning">
            <span>{warningText}</span>
            <button type="button" className="pov-alert-action" onClick={triggerSimulationRecovery}>
              Khôi phục (R)
            </button>
          </div>
        )}

        {isStaticLander && (
          <div className="pov-alert-banner is-info" data-testid="pov-static-lander-banner">
            <span>
              {simulatedMobilityEnabled
                ? 'Chế độ Di chuyển giả lập đang bật (thiết bị thực tế đứng cố định)'
                : 'Trạm cố định — bật Di chuyển giả lập để khảo sát quanh bãi đáp'}
            </span>
            <button
              type="button"
              className="pov-alert-action"
              data-testid="pov-toggle-simulated-mobility"
              onClick={toggleSimulatedMobilityEnabled}
            >
              {simulatedMobilityEnabled ? 'Tắt giả lập' : 'Di chuyển giả lập'}
            </button>
          </div>
        )}
      </div>

      {/* Subtle centered HUD targeting reticle */}
      <div className="pov-reticle-center" aria-hidden="true">
        <div className="pov-reticle-ring" />
        <div className="pov-reticle-cross-h" />
        <div className="pov-reticle-cross-v" />
      </div>

      {/* Bottom control bars, minimap, and mobile/touch joystick */}
      {!hudCompact && (
        <div className="pov-bottom-dock" onPointerDown={(e) => e.stopPropagation()}>
          <div className="pov-action-toolbar">
            <button
              type="button"
              className={`pov-chip-btn ${cameraMountMode === 'third_person' ? 'is-active' : ''}`}
              data-testid="pov-camera-mount-btn"
              onClick={toggleCameraMountMode}
            >
              {cameraMountMode === 'first_person' ? 'Góc nhìn: Mắt/Mastcam (C)' : 'Góc nhìn: Theo sau Chase (C)'}
            </button>

            {!isOrbital ? (
              <>
                <button
                  type="button"
                  className={`pov-chip-btn ${horizonStabilized ? 'is-active' : ''}`}
                  data-testid="pov-horizon-btn"
                  onClick={toggleHorizonStabilized}
                >
                  Chân trời ổn định: {horizonStabilized ? 'Bật' : 'Tắt'}
                </button>
                <button
                  type="button"
                  className={`pov-chip-btn ${pointerLocked ? 'is-active' : ''}`}
                  data-testid="pov-pointer-lock-btn"
                  onClick={() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return;
                    if (document.pointerLockElement === canvas) {
                      document.exitPointerLock?.();
                    } else {
                      canvas.requestPointerLock?.();
                    }
                  }}
                >
                  {pointerLocked ? 'Thoát khóa chuột (Esc)' : 'Khóa chuột (L)'}
                </button>
                <button
                  type="button"
                  className="pov-chip-btn"
                  data-testid="pov-recover-btn"
                  onClick={triggerSimulationRecovery}
                >
                  Đặt lại tư thế (R)
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`pov-chip-btn ${simulationPaused ? 'is-active' : ''}`}
                  data-testid="pov-orbital-pause-btn"
                  onClick={toggleSimulationPaused}
                >
                  {simulationPaused ? '▶ Tiếp tục quỹ đạo (Space)' : '⏸ Tạm dừng quỹ đạo (Space)'}
                </button>
                {[1, 100, 1000, 5000].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    className={`pov-chip-btn ${timeScale === mult ? 'is-active' : ''}`}
                    data-testid={`pov-orbital-warp-${mult}`}
                    onClick={() => setTimeScale(mult)}
                  >
                    {mult}×
                  </button>
                ))}
              </>
            )}
          </div>

          {!isOrbital && (
            <div className="pov-side-widgets">
              <VirtualDrivePad isHelicopter={isHelicopter} />
              <SurfaceMinimap
                globalXM={telemetry.globalXM}
                globalZM={telemetry.globalZM}
                headingDeg={telemetry.headingDeg}
                trailPoints={telemetry.trailPoints}
                regionSizeKm={regionSizeKm}
              />
            </div>
          )}

          <div className="pov-bottom-hint">
            {isOrbital
              ? 'Kéo chuột xoay cửa sổ cupola · Lăn chuột zoom 1×/2×/4× · Phím C đổi góc nhìn · Space tạm dừng quỹ đạo'
              : isHelicopter
                ? 'WASD/Mũi tên bay tiến-lùi-xoay · Space/E bay lên · Q/F hạ cánh · C đổi Chase/RTE · R đặt lại · L khóa chuột'
                : 'WASD/Mũi tên lái · Space phanh · Kéo chuột xoay nhìn · C đổi Chase/Mastcam · R đặt lại tư thế an toàn · L khóa chuột'}
          </div>
        </div>
      )}
    </div>
  );
}
