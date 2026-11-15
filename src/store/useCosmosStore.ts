import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as THREE from 'three';
import { ATLAS_POIS } from '../config/atlasPOIs';
import { BODY_CATALOG } from '../config/bodyCatalog';
import { ORBITAL_ACTORS_CATALOG } from '../config/celestialCatalog';
import { DEVICE_CATALOG } from '../config/deviceCatalog';
import { getDefaultMissionForBody, getMissionById, getStopById } from '../config/missions';
import { detectWebGLSupport } from '../core/canvas/rendererDiagnostics';
import type {
    BodyId,
    CameraMountMode,
    CelestialTarget,
    CelestialTargetId,
    DeviceCameraViewId,
    DevicePartGroupId,
    ExplorationMode,
    ExplorationRegionSizeKm,
    InspectionViewMode,
    ParsedUrlState,
    QualityRuntimeStats,
    QualityTier,
    RendererFailureState,
    ResolvedQualityTier,
    RotorSpinMode,
    RotorStepDeg,
    RuntimeLoadStatus,
    SensorFilterMode,
    SimulationCheckpoint,
    SpectralMode,
    SurfaceEquipmentItem,
    SurfaceTelemetrySnapshot,
    ViewStage,
} from '../types/cosmos.types';

export type {
    CameraMountMode,
    CelestialTarget,
    CelestialTargetId,
    ExplorationRegionSizeKm,
    InspectionViewMode,
    QualityRuntimeStats,
    QualityTier,
    ResolvedQualityTier,
    SensorFilterMode,
    SimulationCheckpoint,
    SpectralMode,
    SurfaceEquipmentItem,
    SurfaceTelemetrySnapshot,
    ViewStage,
};

export const INITIAL_SURFACE_TELEMETRY: SurfaceTelemetrySnapshot = {
  speedMs: 0,
  headingDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  altitudeAboveGroundM: 0,
  elevationM: 0,
  globalXM: 0,
  globalYM: 0,
  globalZM: 0,
  distanceTraveledM: 0,
  wheelsGroundedCount: 0,
  totalWheels: 0,
  slipRatio: 0,
  stabilityWarning: 'none',
  isStreamingColliderHold: false,
  isSimulatedMobilityActive: false,
  isFlightAirborne: false,
  activeCameraMount: 'first_person',
  pointerLocked: false,
  horizonStabilized: true,
  trailPoints: [],
  activeChunkCount: 0,
  originShiftCount: 0,
};

function detectInitialReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const CHECKPOINT_STORAGE_KEY = 'vantalumen_surface_checkpoints_v1';

function loadInitialCheckpoints(): Record<string, SimulationCheckpoint> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SimulationCheckpoint>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getCheckpointStorageKey(
  bodyId: BodyId,
  deviceId: string,
  regionSizeKm: ExplorationRegionSizeKm,
): string {
  return `${bodyId}::${deviceId}::${regionSizeKm}`;
}

const INITIAL_POV_STATE: {
  inspectionMode: InspectionViewMode;
  orbitalCloseup: boolean;
  povYawDeg: number;
  povPitchDeg: number;
  povFovZoom: 1 | 2 | 4;
  povSensorMode: SensorFilterMode;
  povArmDeployed: boolean;
  povScanActive: boolean;
} = {
  inspectionMode: 'MODEL_CLOSEUP',
  orbitalCloseup: false,
  povYawDeg: 0,
  povPitchDeg: -8,
  povFovZoom: 1,
  povSensorMode: 'OPTICAL_RGB',
  povArmDeployed: false,
  povScanActive: false,
};

const INITIAL_DEVICE_CONTROL_STATE: {
  deviceCameraViewId: DeviceCameraViewId;
  activePartGroupId: DevicePartGroupId;
  rotorSpinMode: RotorSpinMode;
  rotorStepDeg: RotorStepDeg;
} = {
  deviceCameraViewId: 'overview',
  activePartGroupId: 'all',
  rotorSpinMode: 'stopped',
  rotorStepDeg: 0,
};

interface BodyTransition {
  fromBodyId: BodyId;
  targetBodyId: BodyId;
  phase: 'departing' | 'loading' | 'arriving';
}

interface CosmosState {
  activeBodyId: BodyId;
  bodyTransition: BodyTransition | null;
  activeDeviceId: string | null;
  assetLoad: { status: RuntimeLoadStatus; progress?: number; message?: string };
  assetRetryTick: number;
  rendererFailure: RendererFailureState | null;
  rendererRetryTick: number;
  rendererBasicMode: boolean;
  rendererAlertDismissed: boolean;
  deviceCameraViewId: DeviceCameraViewId;
  deviceCameraTick: number;
  activePartGroupId: DevicePartGroupId;
  rotorSpinMode: RotorSpinMode;
  rotorStepDeg: RotorStepDeg;
  rotorStepTick: number;
  inspectionMode: InspectionViewMode;
  orbitalCloseup: boolean;
  povYawDeg: number;
  povPitchDeg: number;
  povFovZoom: 1 | 2 | 4;
  povSensorMode: SensorFilterMode;
  povArmDeployed: boolean;
  povScanActive: boolean;
  qualityTier: QualityTier;
  resolvedQualityTier: ResolvedQualityTier;
  reducedMotion: boolean;
  qualityStats: QualityRuntimeStats | null;
  explorationRegionSizeKm: ExplorationRegionSizeKm;
  simulationPaused: boolean;
  cameraMountMode: CameraMountMode;
  horizonStabilized: boolean;
  simulatedMobilityEnabled: boolean;
  pointerLocked: boolean;
  surfaceTelemetry: SurfaceTelemetrySnapshot;
  checkpointsByDevice: Record<string, SimulationCheckpoint>;
  regionBoundaryMessage: string | null;
  simulationRecoverTick: number;
  showOrbits: boolean;
  guidedOrbitsVisible: boolean;
  showPOIs: boolean;
  explorationMode: ExplorationMode;
  activeMissionId: string;
  activeStopId: string;
  urlNotice: string | null;
  selectBody: (bodyId: BodyId, options?: { animate?: boolean }) => void;
  beginBodyTransitionLoad: () => void;
  beginBodyTransitionArrival: (bodyId: BodyId) => void;
  completeBodyTransition: () => void;
  selectDevice: (id: string) => void;
  retryAsset: () => void;
  setAssetLoad: (id: string, load: CosmosState['assetLoad']) => void;
  reportRendererFailure: (
    failure: Omit<RendererFailureState, 'timestampMs'> & { timestampMs?: number },
  ) => void;
  clearRendererFailure: (surface?: RendererFailureState['surface']) => void;
  retryRenderer: () => void;
  enableBasicRenderMode: () => void;
  dismissRendererAlert: () => void;
  setDeviceCameraView: (viewId: DeviceCameraViewId) => void;
  setActivePartGroup: (groupId: DevicePartGroupId) => void;
  setRotorSpinMode: (mode: RotorSpinMode) => void;
  setRotorStepDeg: (deg: RotorStepDeg) => void;
  resetDeviceControl: () => void;
  setInspectionMode: (mode: InspectionViewMode) => void;
  setOrbitalCloseup: (enabled: boolean) => void;
  setPovOrientation: (yawDeg: number, pitchDeg: number) => void;
  setPovFovZoom: (zoom: 1 | 2 | 4) => void;
  setPovSensorMode: (mode: SensorFilterMode) => void;
  togglePovArm: () => void;
  togglePovScan: () => void;
  resetPovCamera: () => void;
  setQualityTier: (tier: QualityTier) => void;
  setResolvedQualityTier: (tier: ResolvedQualityTier) => void;
  setReducedMotion: (reduced: boolean) => void;
  setQualityStats: (stats: QualityRuntimeStats | null) => void;
  setExplorationRegionSizeKm: (sizeKm: ExplorationRegionSizeKm) => void;
  toggleSimulationPaused: () => void;
  setSimulationPaused: (paused: boolean) => void;
  setCameraMountMode: (mode: CameraMountMode) => void;
  toggleCameraMountMode: () => void;
  toggleHorizonStabilized: () => void;
  setSimulatedMobilityEnabled: (enabled: boolean) => void;
  toggleSimulatedMobilityEnabled: () => void;
  setPointerLocked: (locked: boolean) => void;
  setSurfaceTelemetry: (snapshot: Partial<SurfaceTelemetrySnapshot>) => void;
  saveSimulationCheckpoint: (checkpoint: SimulationCheckpoint) => void;
  clearSimulationCheckpoint: (key: string) => void;
  triggerSimulationRecovery: () => void;
  setRegionBoundaryMessage: (message: string | null) => void;
    toggleOrbits: () => void;
    togglePOIs: () => void;
    setExplorationMode: (mode: ExplorationMode) => void;
    selectMissionStop: (
      missionId: string,
      stopId: string,
      options?: { openSuggestedView?: boolean },
    ) => void;
    dismissUrlNotice: () => void;
    applyUrlState: (parsed: ParsedUrlState, options?: { skipPreloader?: boolean }) => void;
    viewStage: ViewStage;
    activeTarget: CelestialTarget | null;
    selectedSurfaceEquipment: SurfaceEquipmentItem | null;
    inspectionTransitionTarget: string | null;
    timeScale: number;          // Tốc độ tua thời gian (1 = thực tế, 1000 = tua nhanh quỹ đạo)
    simulationTime: number;     // Thời gian mô phỏng tích lũy (đọc trực tiếp trong useFrame)
    spectralMode: SpectralMode;
    audioMuted: boolean;
    controlsLocked: boolean;
    loadingProgress: number;
    requiredAssetsReady: boolean;
    loadingStatusLabel: string;
    loadingTasks: Record<string, number>;
    cameraAltitudeKm: number;
    cameraResetTick: number;
    floatingOriginOffset: THREE.Vector3;

    // Dynamic runtime positions of orbiting bodies & rotating surface POIs
    dynamicPositions: Record<string, THREE.Vector3>;

    // Actions
    reportAssetTaskProgress: (taskId: string, progressPct: number, label?: string) => void;
    setLoadingProgress: (progress: number) => void;
    startLaunchSequence: () => void;
    completeLaunchSequence: () => void;
    completePreloader: () => void;
    selectTarget: (target: CelestialTarget | null) => void;
    selectSurfaceTarget: (target: CelestialTarget) => void;
    setSelectedSurfaceEquipment: (equipment: SurfaceEquipmentItem | null) => void;
    setInspectionTransitionTarget: (targetName: string | null) => void;
    enterSurfaceLanding: () => void;
    returnToOrbit: () => void;
    setViewStage: (stage: ViewStage) => void;
    setTimeScale: (scale: number) => void;
    setSpectralMode: (mode: SpectralMode) => void;
    toggleAudio: () => void;
    advanceSimulationTime: (delta: number) => void;
    setCameraAltitudeKm: (altitudeKm: number) => void;
    setFloatingOriginOffset: (offset: THREE.Vector3) => void;
    updateDynamicPosition: (id: CelestialTargetId, position: THREE.Vector3) => void;
}

function isThreeRenderLoopUnavailable(state: Pick<CosmosState, 'rendererFailure'>): boolean {
  if (state.rendererFailure && state.rendererFailure.kind !== 'postprocessing-error') {
    return true;
  }
  return !detectWebGLSupport().available;
}

const REQUIRED_LOADING_TASKS = [
  'mars_surface_maps',
  'decoders_and_models',
] as const;

const INITIAL_SIMULATION_UI_STATE = {
  cameraMountMode: 'first_person' as CameraMountMode,
  horizonStabilized: true,
  simulatedMobilityEnabled: false,
  pointerLocked: false,
  regionBoundaryMessage: null as string | null,
  surfaceTelemetry: { ...INITIAL_SURFACE_TELEMETRY },
};

const INITIAL_DEFAULT_MISSION = getDefaultMissionForBody('mars');

export function selectEffectiveOrbitsVisible(
  state: Pick<CosmosState, 'explorationMode' | 'showOrbits' | 'guidedOrbitsVisible'>,
): boolean {
  return state.explorationMode === 'free' ? state.showOrbits : state.guidedOrbitsVisible;
}

export const useCosmosStore = create<CosmosState>()(
  subscribeWithSelector((set, get) => ({
    activeBodyId: 'mars',
    explorationMode: 'guided',
    activeMissionId: INITIAL_DEFAULT_MISSION.id,
    activeStopId: INITIAL_DEFAULT_MISSION.defaultStopId,
    urlNotice: null,
    bodyTransition: null,
    activeDeviceId: null,
    assetLoad: { status: 'idle' },
    assetRetryTick: 0,
    rendererFailure: null,
    rendererRetryTick: 0,
    rendererBasicMode: false,
    rendererAlertDismissed: false,
    ...INITIAL_DEVICE_CONTROL_STATE,
    ...INITIAL_POV_STATE,
    ...INITIAL_SIMULATION_UI_STATE,
    qualityTier: 'auto',
    resolvedQualityTier: 'high',
    reducedMotion: detectInitialReducedMotion(),
    qualityStats: null,
    explorationRegionSizeKm: 2,
    simulationPaused: false,
    checkpointsByDevice: loadInitialCheckpoints(),
    simulationRecoverTick: 0,
    deviceCameraTick: 0,
    rotorStepTick: 0,
    showOrbits: true,
    guidedOrbitsVisible: false,
    showPOIs: true,
        selectBody: (bodyId, options) => {
            if (!BODY_CATALOG[bodyId]) return;
            const current = get();
            const bodyDefaultMission = getDefaultMissionForBody(bodyId);
            const missionSync =
                bodyId !== current.activeBodyId
                    ? {
                          activeMissionId: bodyDefaultMission.id,
                          activeStopId: bodyDefaultMission.defaultStopId,
                      }
                    : {};
            const currentStage = current.viewStage;
            const keepPreloading = currentStage === 'PRELOADING' || currentStage === 'LAUNCHING';
            const isSurfaceView =
                currentStage === 'SURFACE_VIEW' || currentStage === 'SURFACE_CESIUM';
            if (
                options?.animate === true &&
                !isThreeRenderLoopUnavailable(current) &&
                bodyId !== current.activeBodyId &&
                !keepPreloading &&
                !isSurfaceView &&
                !current.bodyTransition
            ) {
                set((state) => ({
                    ...missionSync,
                    bodyTransition: {
                        fromBodyId: current.activeBodyId,
                        targetBodyId: bodyId,
                        phase: 'departing',
                    },
                    activeTarget: null,
                    activeDeviceId: null,
                    selectedSurfaceEquipment: null,
                    inspectionTransitionTarget: null,
                    assetLoad: { status: 'idle' },
                    ...INITIAL_DEVICE_CONTROL_STATE,
                    ...INITIAL_POV_STATE,
                    ...INITIAL_SIMULATION_UI_STATE,
                    rotorStepTick: state.rotorStepTick + 1,
                    dynamicPositions: {},
                    spectralMode: 'VISUAL_RGB',
                    viewStage: 'BODY_TRANSITION',
                    controlsLocked: true,
                }));
                return;
            }
            set((state) => ({
                ...missionSync,
                activeBodyId: bodyId,
                bodyTransition: null,
                activeTarget: null,
                activeDeviceId: null,
                selectedSurfaceEquipment: null,
                inspectionTransitionTarget: null,
                assetLoad: { status: 'idle' },
                ...INITIAL_DEVICE_CONTROL_STATE,
                ...INITIAL_POV_STATE,
                ...INITIAL_SIMULATION_UI_STATE,
                rotorStepTick: state.rotorStepTick + 1,
                dynamicPositions: {},
                viewStage: keepPreloading ? currentStage : 'ORBITAL_OVERVIEW',
                spectralMode: 'VISUAL_RGB',
                controlsLocked: keepPreloading,
                cameraResetTick: state.cameraResetTick + 1,
                floatingOriginOffset: new THREE.Vector3(),
            }));
        },
    beginBodyTransitionLoad: () =>
      set((state) => {
        const transition = state.bodyTransition;
        if (!transition || transition.phase !== 'departing') return state;
        const bodyDefaultMission = getDefaultMissionForBody(transition.targetBodyId);
        return {
          activeBodyId: transition.targetBodyId,
          activeMissionId: bodyDefaultMission.id,
          activeStopId: bodyDefaultMission.defaultStopId,
          bodyTransition: { ...transition, phase: 'loading' },
          activeTarget: null,
          activeDeviceId: null,
          selectedSurfaceEquipment: null,
          inspectionTransitionTarget: null,
          assetLoad: { status: 'idle' },
          ...INITIAL_DEVICE_CONTROL_STATE,
          ...INITIAL_POV_STATE,
          ...INITIAL_SIMULATION_UI_STATE,
          rotorStepTick: state.rotorStepTick + 1,
          dynamicPositions: {},
          spectralMode: 'VISUAL_RGB',
          cameraResetTick: state.cameraResetTick + 1,
          floatingOriginOffset: new THREE.Vector3(),
          controlsLocked: true,
        };
      }),
    beginBodyTransitionArrival: (bodyId) =>
      set((state) =>
        state.bodyTransition?.phase === 'loading' &&
        state.bodyTransition.targetBodyId === bodyId
          ? { bodyTransition: { ...state.bodyTransition, phase: 'arriving' } }
          : state,
      ),
    completeBodyTransition: () =>
      set((state) =>
        state.bodyTransition?.phase === 'arriving'
          ? {
              bodyTransition: null,
              viewStage: 'ORBITAL_OVERVIEW',
              controlsLocked: false,
            }
          : state,
      ),
    selectDevice: (id) => {
      const currentBodyId = get().activeBodyId;
      const device = DEVICE_CATALOG.find(
        (item) =>
          item.id === id &&
          (item.bodyId === currentBodyId || item.bodyId === 'reference'),
      );
      if (!device) return;
      const available = device.status === 'available';
      const current = get();
      const keepReady = current.activeDeviceId === id && current.assetLoad.status === 'ready';
      set((state) => ({
        activeDeviceId: id,
        activeTarget: null,
        viewStage: available ? 'SUB_SCENE' : 'ORBITAL_OVERVIEW',
        controlsLocked: false,
        assetLoad: keepReady ? current.assetLoad : { status: available ? 'loading' : 'idle' },
        ...(state.spectralMode === 'TERRAIN_MESH_3D' ? { spectralMode: 'VISUAL_RGB' as const } : {}),
        ...INITIAL_DEVICE_CONTROL_STATE,
        ...INITIAL_POV_STATE,
        ...INITIAL_SIMULATION_UI_STATE,
        deviceCameraTick: state.deviceCameraTick + 1,
        rotorStepTick: state.rotorStepTick + 1,
      }));
    },
    retryAsset: () => set((state) => ({ assetRetryTick: state.assetRetryTick + 1 })),
    setAssetLoad: (id, assetLoad) => { if (get().activeDeviceId === id) set({ assetLoad }); },
    reportRendererFailure: (failure) =>
      set({
        rendererFailure: {
          ...failure,
          timestampMs: failure.timestampMs ?? Date.now(),
        },
        rendererAlertDismissed: false,
      }),
    clearRendererFailure: (surface) =>
      set((state) => {
        if (!state.rendererFailure) return state;
        if (surface && state.rendererFailure.surface !== surface) return state;
        return { rendererFailure: null, rendererAlertDismissed: false };
      }),
    retryRenderer: () =>
      set((state) => ({
        rendererFailure: null,
        rendererAlertDismissed: false,
        rendererRetryTick: state.rendererRetryTick + 1,
      })),
    enableBasicRenderMode: () =>
      set((state) => ({
        rendererBasicMode: true,
        rendererFailure:
          state.rendererFailure?.kind === 'webgl-unavailable' ? state.rendererFailure : null,
        rendererAlertDismissed: false,
        rendererRetryTick: state.rendererRetryTick + 1,
      })),
    dismissRendererAlert: () => set({ rendererAlertDismissed: true }),
    setDeviceCameraView: (viewId) =>
      set((state) => ({
        deviceCameraViewId: viewId,
        deviceCameraTick: state.deviceCameraTick + 1,
      })),
    setActivePartGroup: (groupId) => set({ activePartGroupId: groupId }),
    setRotorSpinMode: (mode) => set({ rotorSpinMode: mode }),
    setRotorStepDeg: (deg) =>
      set((state) => ({
        rotorStepDeg: deg,
        rotorSpinMode: 'stopped',
        rotorStepTick: state.rotorStepTick + 1,
      })),
    resetDeviceControl: () =>
      set((state) => ({
        ...INITIAL_DEVICE_CONTROL_STATE,
        deviceCameraTick: state.deviceCameraTick + 1,
        rotorStepTick: state.rotorStepTick + 1,
      })),
    setOrbitalCloseup: (enabled) => set({ orbitalCloseup: enabled }),
    setInspectionMode: (mode) =>
      set((state) => {
        const hasDevice = Boolean(state.activeDeviceId);
        const hasTarget = Boolean(state.activeTarget);
        const nextStage =
          mode === 'CONTROL_ROOM_POV' || hasDevice || hasTarget
            ? 'SUB_SCENE'
            : state.viewStage;
        return {
          inspectionMode: mode,
          viewStage: nextStage,
          controlsLocked: false,
          ...(mode === 'CONTROL_ROOM_POV'
            ? {
                orbitalCloseup: false,
                povYawDeg: 0,
                povPitchDeg: -8,
                povFovZoom: 1 as const,
              }
            : {
                pointerLocked: false,
              }),
        };
      }),
    setPovOrientation: (yawDeg, pitchDeg) =>
      set({
        povYawDeg: Math.max(-180, Math.min(180, yawDeg)),
        povPitchDeg: Math.max(-45, Math.min(45, pitchDeg)),
      }),
    setPovFovZoom: (zoom) => set({ povFovZoom: zoom }),
    setPovSensorMode: (mode) => set({ povSensorMode: mode }),
    togglePovArm: () => set((state) => ({ povArmDeployed: !state.povArmDeployed })),
    togglePovScan: () => set((state) => ({ povScanActive: !state.povScanActive })),
    resetPovCamera: () =>
      set({
        povYawDeg: 0,
        povPitchDeg: -8,
        povFovZoom: 1,
        povArmDeployed: false,
        povScanActive: false,
        cameraMountMode: 'first_person',
        horizonStabilized: true,
        pointerLocked: false,
      }),
    setQualityTier: (tier) => set({ qualityTier: tier }),
    setResolvedQualityTier: (tier) =>
      set((state) => (state.resolvedQualityTier === tier ? state : { resolvedQualityTier: tier })),
    setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
    setQualityStats: (stats) => set({ qualityStats: stats }),
    setExplorationRegionSizeKm: (sizeKm) =>
      set({
        explorationRegionSizeKm: sizeKm,
        regionBoundaryMessage: null,
      }),
    toggleSimulationPaused: () =>
      set((state) => ({ simulationPaused: !state.simulationPaused })),
    setSimulationPaused: (paused) => set({ simulationPaused: paused }),
    setCameraMountMode: (mode) =>
      set((state) => ({
        cameraMountMode: mode,
        surfaceTelemetry: { ...state.surfaceTelemetry, activeCameraMount: mode },
      })),
    toggleCameraMountMode: () =>
      set((state) => {
        const next: CameraMountMode =
          state.cameraMountMode === 'first_person' ? 'third_person' : 'first_person';
        return {
          cameraMountMode: next,
          surfaceTelemetry: { ...state.surfaceTelemetry, activeCameraMount: next },
        };
      }),
    toggleHorizonStabilized: () =>
      set((state) => ({
        horizonStabilized: !state.horizonStabilized,
        surfaceTelemetry: {
          ...state.surfaceTelemetry,
          horizonStabilized: !state.horizonStabilized,
        },
      })),
    setSimulatedMobilityEnabled: (enabled) =>
      set((state) => ({
        simulatedMobilityEnabled: enabled,
        surfaceTelemetry: { ...state.surfaceTelemetry, isSimulatedMobilityActive: enabled },
      })),
    toggleSimulatedMobilityEnabled: () =>
      set((state) => {
        const next = !state.simulatedMobilityEnabled;
        return {
          simulatedMobilityEnabled: next,
          surfaceTelemetry: { ...state.surfaceTelemetry, isSimulatedMobilityActive: next },
        };
      }),
    setPointerLocked: (locked) =>
      set((state) => ({
        pointerLocked: locked,
        surfaceTelemetry: { ...state.surfaceTelemetry, pointerLocked: locked },
      })),
    setSurfaceTelemetry: (snapshot) =>
      set((state) => ({
        surfaceTelemetry: { ...state.surfaceTelemetry, ...snapshot },
      })),
    saveSimulationCheckpoint: (checkpoint) =>
      set((state) => {
        const key = getCheckpointStorageKey(
          checkpoint.bodyId,
          checkpoint.deviceId,
          checkpoint.regionSizeKm,
        );
        const next = { ...state.checkpointsByDevice, [key]: checkpoint };
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Ignore storage quota errors cleanly
          }
        }
        return { checkpointsByDevice: next };
      }),
    clearSimulationCheckpoint: (key) =>
      set((state) => {
        const next = { ...state.checkpointsByDevice };
        delete next[key];
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Ignore storage quota errors cleanly
          }
        }
        return { checkpointsByDevice: next };
      }),
    triggerSimulationRecovery: () =>
      set((state) => ({
        simulationRecoverTick: state.simulationRecoverTick + 1,
        regionBoundaryMessage: null,
      })),
    setRegionBoundaryMessage: (message) =>
      set((state) =>
        state.regionBoundaryMessage === message ? state : { regionBoundaryMessage: message },
      ),
    toggleOrbits: () =>
      set((state) =>
        state.explorationMode === 'free'
          ? { showOrbits: !state.showOrbits }
          : { guidedOrbitsVisible: !state.guidedOrbitsVisible },
      ),
    togglePOIs: () => set((state) => ({ showPOIs: !state.showPOIs })),
    setExplorationMode: (mode) =>
      set((state) => {
        const currentMission = getMissionById(state.activeMissionId);
        const bodyMission =
          currentMission && currentMission.bodyId === state.activeBodyId
            ? currentMission
            : getDefaultMissionForBody(state.activeBodyId);
        const validStop =
          getStopById(bodyMission, state.activeStopId) ?? bodyMission.stops[0];
        return {
          explorationMode: mode,
          activeMissionId: bodyMission.id,
          activeStopId: validStop.id,
          ...(mode === 'guided' ? { guidedOrbitsVisible: false } : {}),
        };
      }),
    selectMissionStop: (missionId, stopId, options) => {
      const mission = getMissionById(missionId);
      if (!mission) return;
      const stop = getStopById(mission, stopId);
      if (!stop) return;
      const state = get();
      const bodyChanged = state.activeBodyId !== mission.bodyId;
      const openSuggested = options?.openSuggestedView !== false;

      if (stop.targetKind === 'body') {
        set((prev) => ({
          activeBodyId: mission.bodyId,
          bodyTransition: null,
          explorationMode: 'guided',
          guidedOrbitsVisible: false,
          activeMissionId: mission.id,
          activeStopId: stop.id,
          activeTarget: null,
          activeDeviceId: null,
          selectedSurfaceEquipment: null,
          inspectionTransitionTarget: null,
          assetLoad: { status: 'idle' },
          ...INITIAL_DEVICE_CONTROL_STATE,
          ...INITIAL_POV_STATE,
          ...INITIAL_SIMULATION_UI_STATE,
          ...(bodyChanged ? { dynamicPositions: {} } : {}),
          spectralMode: stop.recommendedLayerMode ?? 'VISUAL_RGB',
          viewStage:
            openSuggested && stop.recommendedLayerMode === 'TERRAIN_MESH_3D'
              ? 'SUB_SCENE'
              : 'ORBITAL_OVERVIEW',
          controlsLocked: false,
          cameraResetTick: prev.cameraResetTick + 1,
          floatingOriginOffset: new THREE.Vector3(),
        }));
        return;
      }

      if (stop.targetKind === 'poi' || stop.targetKind === 'orbital') {
        const catalogTarget =
          stop.targetKind === 'poi'
            ? ATLAS_POIS.find((item) => item.id === stop.targetId)
            : ORBITAL_ACTORS_CATALOG.find((item) => item.id === stop.targetId);
        if (!catalogTarget || catalogTarget.bodyId !== mission.bodyId) return;
        const dynamicPos = bodyChanged ? undefined : state.dynamicPositions[catalogTarget.id];
        const syncedTarget: CelestialTarget = dynamicPos
          ? { ...catalogTarget, position: dynamicPos.clone() }
          : { ...catalogTarget, position: catalogTarget.position.clone() };
        const useTerrainBlock =
          openSuggested && stop.recommendedLayerMode === 'TERRAIN_MESH_3D';
        const skipWarp = useTerrainBlock || isThreeRenderLoopUnavailable(state);
        set((prev) => ({
          activeBodyId: mission.bodyId,
          bodyTransition: null,
          explorationMode: 'guided',
          guidedOrbitsVisible: false,
          activeMissionId: mission.id,
          activeStopId: stop.id,
          activeTarget: syncedTarget,
          activeDeviceId: null,
          selectedSurfaceEquipment: null,
          inspectionTransitionTarget: null,
          assetLoad: { status: 'idle' },
          ...INITIAL_DEVICE_CONTROL_STATE,
          ...INITIAL_POV_STATE,
          inspectionMode: stop.suggestedView === 'viewpoints' ? 'CONTROL_ROOM_POV' : 'MODEL_CLOSEUP',
          ...INITIAL_SIMULATION_UI_STATE,
          ...(bodyChanged ? { dynamicPositions: {} } : {}),
          spectralMode: stop.recommendedLayerMode ?? 'VISUAL_RGB',
          viewStage: useTerrainBlock
            ? 'SUB_SCENE'
            : stop.suggestedView === 'surface'
              ? 'SURFACE_VIEW'
              : skipWarp
                ? 'SUB_SCENE'
                : 'WARPING',
          controlsLocked:
            useTerrainBlock || stop.suggestedView === 'surface' ? false : !skipWarp,
          cameraResetTick: prev.cameraResetTick + 1,
          floatingOriginOffset: new THREE.Vector3(),
        }));
        return;
      }

      if (stop.targetKind === 'device') {
        const device = DEVICE_CATALOG.find(
          (item) =>
            item.id === stop.targetId &&
            (item.bodyId === mission.bodyId || item.bodyId === 'reference'),
        );
        if (!device) return;
        const available = device.status === 'available';
        const keepReady =
          state.activeDeviceId === device.id && state.assetLoad.status === 'ready';
        set((prev) => ({
          activeBodyId: mission.bodyId,
          bodyTransition: null,
          explorationMode: 'guided',
          guidedOrbitsVisible: false,
          activeMissionId: mission.id,
          activeStopId: stop.id,
          activeDeviceId: device.id,
          activeTarget: null,
          selectedSurfaceEquipment: null,
          inspectionTransitionTarget: null,
          assetLoad: keepReady
            ? state.assetLoad
            : { status: available ? 'loading' : 'idle' },
          ...INITIAL_DEVICE_CONTROL_STATE,
          ...INITIAL_POV_STATE,
          inspectionMode:
            stop.suggestedView === 'viewpoints' ? 'CONTROL_ROOM_POV' : 'MODEL_CLOSEUP',
          ...INITIAL_SIMULATION_UI_STATE,
          ...(bodyChanged ? { dynamicPositions: {} } : {}),
          spectralMode: stop.recommendedLayerMode ?? 'VISUAL_RGB',
          viewStage:
            stop.suggestedView === 'surface'
              ? 'SURFACE_VIEW'
              : available
                ? 'SUB_SCENE'
                : 'ORBITAL_OVERVIEW',
          controlsLocked: false,
          deviceCameraTick: prev.deviceCameraTick + 1,
          rotorStepTick: prev.rotorStepTick + 1,
          floatingOriginOffset: new THREE.Vector3(),
        }));
      }
    },
    dismissUrlNotice: () => set({ urlNotice: null }),
    applyUrlState: (parsed, options) => {
      const state = get();
      const bodyChanged = state.activeBodyId !== parsed.bodyId;
      const keepPreloading =
        !options?.skipPreloader &&
        (state.viewStage === 'PRELOADING' || state.viewStage === 'LAUNCHING');

      let resolvedTarget: CelestialTarget | null = null;
      let resolvedDeviceId: string | null = null;
      let resolvedViewStage: ViewStage = keepPreloading ? state.viewStage : 'ORBITAL_OVERVIEW';
      let resolvedInspection: InspectionViewMode = 'MODEL_CLOSEUP';
      let assetLoad: CosmosState['assetLoad'] = { status: 'idle' };

      if (parsed.targetKind === 'poi') {
        const poi = ATLAS_POIS.find((item) => item.id === parsed.targetId) ?? null;
        resolvedTarget = poi ? { ...poi, position: poi.position.clone() } : null;
      } else if (parsed.targetKind === 'orbital') {
        const orbital =
          ORBITAL_ACTORS_CATALOG.find((item) => item.id === parsed.targetId) ?? null;
        resolvedTarget = orbital ? { ...orbital, position: orbital.position.clone() } : null;
      } else if (parsed.targetKind === 'device' && parsed.targetId) {
        const device = DEVICE_CATALOG.find((item) => item.id === parsed.targetId);
        if (device) {
          resolvedDeviceId = device.id;
          const keepReady =
            state.activeDeviceId === device.id && state.assetLoad.status === 'ready';
          assetLoad = keepReady
            ? state.assetLoad
            : { status: device.status === 'available' ? 'loading' : 'idle' };
        }
      }

      if (!keepPreloading) {
        if (parsed.view === 'surface') {
          resolvedViewStage = 'SURFACE_VIEW';
        } else if (parsed.view === 'viewpoints') {
          resolvedInspection = 'CONTROL_ROOM_POV';
          if (resolvedDeviceId) {
            const dev = DEVICE_CATALOG.find((item) => item.id === resolvedDeviceId);
            resolvedViewStage = dev?.status === 'available' ? 'SUB_SCENE' : 'ORBITAL_OVERVIEW';
          } else {
            resolvedViewStage = 'SUB_SCENE';
          }
        } else if (parsed.view === 'inspect') {
          resolvedInspection = 'MODEL_CLOSEUP';
          if (parsed.spectralMode === 'TERRAIN_MESH_3D') {
            resolvedViewStage = 'SUB_SCENE';
          } else if (resolvedDeviceId) {
            const dev = DEVICE_CATALOG.find((item) => item.id === resolvedDeviceId);
            resolvedViewStage = dev?.status === 'available' ? 'SUB_SCENE' : 'ORBITAL_OVERVIEW';
          } else if (resolvedTarget) {
            resolvedViewStage = 'SUB_SCENE';
          }
        } else {
          resolvedViewStage = 'ORBITAL_OVERVIEW';
        }
      }

      set((prev) => ({
        activeBodyId: parsed.bodyId,
        bodyTransition: null,
        explorationMode: parsed.mode,
        ...(parsed.mode === 'guided' ? { guidedOrbitsVisible: false } : {}),
        activeMissionId: parsed.missionId,
        activeStopId: parsed.stopId,
        urlNotice: parsed.notice,
        activeTarget: resolvedTarget,
        activeDeviceId: resolvedDeviceId,
        selectedSurfaceEquipment: null,
        inspectionTransitionTarget: null,
        assetLoad,
        ...INITIAL_DEVICE_CONTROL_STATE,
        ...INITIAL_POV_STATE,
        inspectionMode: resolvedInspection,
        ...INITIAL_SIMULATION_UI_STATE,
        ...(bodyChanged ? { dynamicPositions: {} } : {}),
        spectralMode: parsed.spectralMode,
        viewStage: resolvedViewStage,
        controlsLocked: keepPreloading,
        cameraResetTick: prev.cameraResetTick + 1,
        deviceCameraTick: prev.deviceCameraTick + 1,
        rotorStepTick: prev.rotorStepTick + 1,
        floatingOriginOffset: new THREE.Vector3(),
      }));
    },
        viewStage: 'PRELOADING',
        activeTarget: null,
        selectedSurfaceEquipment: null,
        inspectionTransitionTarget: null,
        timeScale: 100,
        simulationTime: 0,
        spectralMode: 'VISUAL_RGB',
        audioMuted: false,
        controlsLocked: true,
        loadingProgress: 0,
        requiredAssetsReady: false,
        loadingStatusLabel: 'Initializing optical systems & decoders...',
        loadingTasks: {
            mars_surface_maps: 0,
            decoders_and_models: 0,
        },
        cameraAltitudeKm: 84610,
        cameraResetTick: 0,
        floatingOriginOffset: new THREE.Vector3(0, 0, 0),
        dynamicPositions: {},

        reportAssetTaskProgress: (taskId, progressPct, label) =>
            set((state) => {
                const clamped = Math.max(0, Math.min(100, progressPct));
                const nextTasks = { ...state.loadingTasks, [taskId]: clamped };
                const total = REQUIRED_LOADING_TASKS.reduce(
                    (sum, key) => sum + (nextTasks[key] ?? 0),
                    0,
                );
                const avgProgress = Math.round(total / REQUIRED_LOADING_TASKS.length);
                const allDone = REQUIRED_LOADING_TASKS.every((key) => (nextTasks[key] ?? 0) >= 100);

                return {
                    loadingTasks: nextTasks,
                    loadingProgress: avgProgress,
                    requiredAssetsReady: allDone,
                    loadingStatusLabel: allDone
                        ? 'Core assets ready • Awaiting Alpha Jump'
                        : (label ?? state.loadingStatusLabel),
                };
            }),

        setLoadingProgress: (progress) =>
            set((state) => ({
                loadingProgress: Math.max(state.loadingProgress, Math.min(100, progress)),
            })),

        startLaunchSequence: () => {
            if (!get().requiredAssetsReady) return;
            set({
                viewStage: 'LAUNCHING',
                controlsLocked: true,
            });
        },

        completeLaunchSequence: () =>
            set({
                viewStage: 'ORBITAL_OVERVIEW',
                loadingProgress: 100,
                controlsLocked: false,
            }),

        completePreloader: () =>
            set({
                viewStage: 'ORBITAL_OVERVIEW',
                loadingProgress: 100,
                controlsLocked: false,
            }),

        selectTarget: (target) => {
            if (target && target.bodyId !== get().activeBodyId) return;
            if (!target) {
                set({
                    activeTarget: null,
                    activeDeviceId: null,
                    selectedSurfaceEquipment: null,
                    assetLoad: { status: 'idle' },
                    ...INITIAL_DEVICE_CONTROL_STATE,
                    ...INITIAL_POV_STATE,
                    ...INITIAL_SIMULATION_UI_STATE,
                    viewStage: 'ORBITAL_OVERVIEW',
                    controlsLocked: false,
                });
                return;
            }

            // Sync target position with its latest dynamic orbital/rotational world position
            const dynamicPos = get().dynamicPositions[target.id];
            const syncedTarget: CelestialTarget = dynamicPos
                ? { ...target, position: dynamicPos.clone() }
                : { ...target, position: target.position.clone() };

            const skipWarp = isThreeRenderLoopUnavailable(get());
            set({
                activeTarget: syncedTarget,
                activeDeviceId: null,
                selectedSurfaceEquipment: null,
                assetLoad: { status: 'idle' },
                ...INITIAL_DEVICE_CONTROL_STATE,
                ...INITIAL_POV_STATE,
                ...INITIAL_SIMULATION_UI_STATE,
                ...(get().spectralMode === 'TERRAIN_MESH_3D' ? { spectralMode: 'VISUAL_RGB' as const } : {}),
                viewStage: skipWarp ? 'SUB_SCENE' : 'WARPING',
                controlsLocked: !skipWarp,
            });
        },

        selectSurfaceTarget: (target) => {
            if (target.bodyId !== get().activeBodyId) return;
            const dynamicPos = get().dynamicPositions[target.id];
            const syncedTarget: CelestialTarget = dynamicPos
                ? { ...target, position: dynamicPos.clone() }
                : { ...target, position: target.position.clone() };

            set({
                activeTarget: syncedTarget,
                activeDeviceId: null,
                selectedSurfaceEquipment: null,
                assetLoad: { status: 'idle' },
                ...INITIAL_DEVICE_CONTROL_STATE,
                ...INITIAL_POV_STATE,
                ...INITIAL_SIMULATION_UI_STATE,
                spectralMode: 'VISUAL_RGB',
                viewStage: 'SURFACE_VIEW',
                controlsLocked: false,
            });
        },

        setSelectedSurfaceEquipment: (equipment) =>
            set({ selectedSurfaceEquipment: equipment }),
        setInspectionTransitionTarget: (targetName) =>
            set({ inspectionTransitionTarget: targetName }),

        enterSurfaceLanding: () => {
            set({
                viewStage: 'SURFACE_VIEW',
                controlsLocked: false,
            });
        },

        returnToOrbit: () =>
            set((state) => ({
                activeTarget: null,
                activeDeviceId: null,
                selectedSurfaceEquipment: null,
                inspectionTransitionTarget: null,
                assetLoad: { status: 'idle' },
                ...INITIAL_DEVICE_CONTROL_STATE,
                ...INITIAL_POV_STATE,
                ...INITIAL_SIMULATION_UI_STATE,
                spectralMode: state.spectralMode === 'TERRAIN_MESH_3D' ? 'VISUAL_RGB' : state.spectralMode,
                viewStage: 'ORBITAL_OVERVIEW',
                controlsLocked: false,
                cameraResetTick: state.cameraResetTick + 1,
                floatingOriginOffset: new THREE.Vector3(),
            })),

    setViewStage: (stage) =>
      set({
        viewStage: stage,
        controlsLocked:
          stage === 'WARPING' ||
          stage === 'PRELOADING' ||
          stage === 'LAUNCHING' ||
          stage === 'BODY_TRANSITION',
      }),

    setTimeScale: (scale) => set({ timeScale: scale }),

    setSpectralMode: (mode) => {
      set((state) => ({
        spectralMode: mode,
        ...(mode === 'TERRAIN_MESH_3D'
          ? {
              activeDeviceId: null,
              inspectionMode: 'MODEL_CLOSEUP' as const,
              viewStage: 'SUB_SCENE' as const,
              controlsLocked: false,
              cameraResetTick: state.cameraResetTick + 1,
            }
          : state.spectralMode === 'TERRAIN_MESH_3D' && !state.activeTarget && !state.activeDeviceId
            ? {
                viewStage: 'ORBITAL_OVERVIEW' as const,
                controlsLocked: false,
              }
            : {}),
      }));
    },

    toggleAudio: () => set((state) => ({ audioMuted: !state.audioMuted })),

    advanceSimulationTime: (delta) =>
      set((state) =>
        state.simulationPaused
          ? state
          : {
              simulationTime: state.simulationTime + Math.min(Math.max(delta, 0), 0.1) * state.timeScale,
            },
      ),

    setCameraAltitudeKm: (altitudeKm) => set({ cameraAltitudeKm: altitudeKm }),

    setFloatingOriginOffset: (offset) => set({ floatingOriginOffset: offset.clone() }),

    updateDynamicPosition: (id, position) => {
      const dict = get().dynamicPositions;
      if (!dict[id]) {
        dict[id] = position.clone();
      } else {
        dict[id].copy(position);
      }
    },
  })),
);
