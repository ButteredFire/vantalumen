import { ATLAS_POIS } from './atlasPOIs';
import { BODY_CATALOG } from './bodyCatalog';
import { ORBITAL_ACTORS_CATALOG } from './celestialCatalog';
import { DEVICE_CATALOG } from './deviceCatalog';
import {
  getDefaultMissionForBody,
  getMissionById,
  getStopById,
} from './missions';
import { isDeviceSurfaceDeployable } from './statusVocabulary';
import type {
  BodyId,
  ExplorationMode,
  ParsedUrlState,
  SpectralMode,
  UrlViewKind,
  ViewStage,
  InspectionViewMode,
  CelestialTarget,
} from '../types/cosmos.types';

export const URL_SCHEMA_VERSION = 1;

const VALID_VIEWS = new Set<UrlViewKind>(['overview', 'inspect', 'viewpoints', 'surface']);
const VALID_MODES = new Set<ExplorationMode>(['guided', 'free']);

const LAYER_TARGETS: Record<string, SpectralMode> = {
  'layer:visual': 'VISUAL_RGB',
  'layer:thermal': 'THERMAL_IR',
  'layer:mola': 'MOLA_ELEVATION',
  'layer:terrain': 'TERRAIN_MESH_3D',
};

const SPECTRAL_TO_LAYER_TARGET: Record<SpectralMode, string> = {
  VISUAL_RGB: 'layer:visual',
  THERMAL_IR: 'layer:thermal',
  MOLA_ELEVATION: 'layer:mola',
  TERRAIN_MESH_3D: 'layer:terrain',
};

function resolveTargetForBody(
  rawTarget: string,
  bodyId: BodyId,
): {
  valid: boolean;
  targetKind: ParsedUrlState['targetKind'];
  targetId: string | null;
  spectralMode: SpectralMode;
  reason?: string;
} {
  if (rawTarget in LAYER_TARGETS) {
    const layerMode = LAYER_TARGETS[rawTarget];
    return {
      valid: true,
      targetKind: 'layer',
      targetId: rawTarget,
      spectralMode: layerMode,
    };
  }

  const poi = ATLAS_POIS.find((item) => item.id === rawTarget);
  if (poi) {
    if (poi.bodyId !== bodyId) {
      return {
        valid: false,
        targetKind: 'none',
        targetId: null,
        spectralMode: 'VISUAL_RGB',
        reason: `Feature "${rawTarget}" does not belong to ${BODY_CATALOG[bodyId].name}`,
      };
    }
    return {
      valid: true,
      targetKind: 'poi',
      targetId: poi.id,
      spectralMode: 'VISUAL_RGB',
    };
  }

  const orbital = ORBITAL_ACTORS_CATALOG.find((item) => item.id === rawTarget);
  if (orbital) {
    if (orbital.bodyId !== bodyId) {
      return {
        valid: false,
        targetKind: 'none',
        targetId: null,
        spectralMode: 'VISUAL_RGB',
        reason: `Orbital target "${rawTarget}" does not belong to ${BODY_CATALOG[bodyId].name}`,
      };
    }
    return {
      valid: true,
      targetKind: 'orbital',
      targetId: orbital.id,
      spectralMode: 'VISUAL_RGB',
    };
  }

  const device = DEVICE_CATALOG.find((item) => item.id === rawTarget);
  if (device) {
    if (device.bodyId !== bodyId && device.bodyId !== 'reference') {
      return {
        valid: false,
        targetKind: 'none',
        targetId: null,
        spectralMode: 'VISUAL_RGB',
        reason: `Device "${rawTarget}" does not belong to ${BODY_CATALOG[bodyId].name}`,
      };
    }
    return {
      valid: true,
      targetKind: 'device',
      targetId: device.id,
      spectralMode: 'VISUAL_RGB',
    };
  }

  return {
    valid: false,
    targetKind: 'none',
    targetId: null,
    spectralMode: 'VISUAL_RGB',
    reason: `Target "${rawTarget}" was not found in the catalog`,
  };
}

function buildFallbackOverview(
  bodyId: BodyId,
  mode: ExplorationMode,
  notice: string,
): ParsedUrlState {
  const mission = getDefaultMissionForBody(bodyId);
  return {
    hasExplicitParams: true,
    version: URL_SCHEMA_VERSION,
    bodyId,
    mode,
    missionId: mission.id,
    stopId: mission.defaultStopId,
    targetKind: 'none',
    targetId: null,
    view: 'overview',
    spectralMode: 'VISUAL_RGB',
    notice,
  };
}

export function parseUrlState(search: string): ParsedUrlState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const trackedKeys = ['v', 'body', 'mission', 'stop', 'target', 'view', 'mode'];
  const hasExplicitParams = trackedKeys.some((key) => params.has(key));

  const defaultMission = getDefaultMissionForBody('mars');
  if (!hasExplicitParams) {
    return {
      hasExplicitParams: false,
      version: URL_SCHEMA_VERSION,
      bodyId: 'mars',
      mode: 'guided',
      missionId: defaultMission.id,
      stopId: defaultMission.defaultStopId,
      targetKind: 'none',
      targetId: null,
      view: 'overview',
      spectralMode: 'VISUAL_RGB',
      notice: null,
    };
  }

  const rawVersion = params.get('v');
  if (rawVersion !== null && rawVersion !== String(URL_SCHEMA_VERSION)) {
    return buildFallbackOverview(
      'mars',
      'guided',
      `Link version (${rawVersion}) is not supported; returned to the Mars overview.`,
    );
  }

  const rawBody = params.get('body');
  let bodyId: BodyId = 'mars';
  if (rawBody !== null) {
    if (rawBody !== 'mars' && rawBody !== 'moon') {
      return buildFallbackOverview(
        'mars',
        'guided',
        `The link contains an invalid celestial body ("${rawBody}"); returned to the Mars overview.`,
      );
    }
    bodyId = rawBody;
  }

  const rawMode = params.get('mode');
  const rawMission = params.get('mission');
  const rawStop = params.get('stop');
  const rawTarget = params.get('target');
  const rawView = params.get('view');

  let mode: ExplorationMode = 'guided';
  if (rawMode !== null) {
    if (!VALID_MODES.has(rawMode as ExplorationMode)) {
      return buildFallbackOverview(
        bodyId,
        'guided',
        `Mode "${rawMode}" is invalid; switched to the guided overview.`,
      );
    }
    mode = rawMode as ExplorationMode;
  } else if (rawTarget && !rawMission && !rawStop) {
    mode = 'free';
  }

  let mission = getDefaultMissionForBody(bodyId);
  if (rawMission !== null) {
    const matchedMission = getMissionById(rawMission);
    if (!matchedMission) {
      return buildFallbackOverview(
        bodyId,
        mode,
        `Journey "${rawMission}" was not found; returned to a valid starting point.`,
      );
    }
    if (matchedMission.bodyId !== bodyId) {
      return buildFallbackOverview(
        bodyId,
        mode,
        `Journey "${rawMission}" does not belong to ${BODY_CATALOG[bodyId].name}; returned to a valid overview.`,
      );
    }
    mission = matchedMission;
  }

  let stop = getStopById(mission, mission.defaultStopId) ?? mission.stops[0];
  let explicitStopValid = false;
  if (rawStop !== null) {
    const matchedStop = getStopById(mission, rawStop);
    if (!matchedStop) {
      return buildFallbackOverview(
        bodyId,
        mode,
        `Stop "${rawStop}" does not exist in journey "${mission.id}"; returned to a valid overview.`,
      );
    }
    stop = matchedStop;
    explicitStopValid = true;
  }

  let targetKind: ParsedUrlState['targetKind'] = 'none';
  let targetId: string | null = null;
  let spectralMode: SpectralMode = 'VISUAL_RGB';

  if (rawTarget !== null && rawTarget !== '') {
    const resolvedTarget = resolveTargetForBody(rawTarget, bodyId);
    if (!resolvedTarget.valid) {
      return buildFallbackOverview(
        bodyId,
        mode,
        `${resolvedTarget.reason}; returned to a valid overview.`,
      );
    }
    targetKind = resolvedTarget.targetKind;
    targetId = resolvedTarget.targetId;
    spectralMode = resolvedTarget.spectralMode;
  } else if (explicitStopValid && mode === 'guided' && rawView !== 'overview') {
    if (stop.targetKind === 'poi' || stop.targetKind === 'orbital' || stop.targetKind === 'device') {
      targetKind = stop.targetKind;
      targetId = stop.targetId;
    } else if (stop.targetKind === 'layer') {
      targetKind = 'layer';
      targetId = stop.targetId;
      spectralMode = stop.recommendedLayerMode ?? 'VISUAL_RGB';
    }
    if (stop.recommendedLayerMode) {
      spectralMode = stop.recommendedLayerMode;
    }
  }

  let view: UrlViewKind = 'overview';
  if (rawView !== null) {
    if (!VALID_VIEWS.has(rawView as UrlViewKind)) {
      return buildFallbackOverview(
        bodyId,
        mode,
        `View mode "${rawView}" is invalid; returned to a valid overview.`,
      );
    }
    view = rawView as UrlViewKind;
  } else if (explicitStopValid && mode === 'guided') {
    view = stop.suggestedView;
  } else if (targetId) {
    view = targetKind === 'layer' && spectralMode !== 'TERRAIN_MESH_3D' ? 'overview' : 'inspect';
  }

  // Validate compatibility between requested view and resolved target
  if (view === 'viewpoints' && (!targetId || targetKind === 'layer')) {
    return buildFallbackOverview(
      bodyId,
      mode,
      'Cannot open the control-room view without a valid device or feature selected; returned to the overview.',
    );
  }

  if (view === 'surface') {
    const isTerrainSurface = spectralMode === 'TERRAIN_MESH_3D' || targetKind === 'poi';
    const selectedDevice =
      targetKind === 'device' && targetId
        ? DEVICE_CATALOG.find((item) => item.id === targetId)
        : undefined;
    const isSurfaceDevice = Boolean(selectedDevice && isDeviceSurfaceDeployable(selectedDevice));
    if (!isTerrainSurface && !isSurfaceDevice) {
      return buildFallbackOverview(
        bodyId,
        mode,
        'The current target does not support 3D surface simulation; returned to a valid overview.',
      );
    }
  }

  if (view === 'inspect' && spectralMode === 'VISUAL_RGB' && !targetId) {
    return buildFallbackOverview(
      bodyId,
      mode,
      'Select a feature, device, or terrain layer to open Inspect Model mode; returned to the overview.',
    );
  }

  return {
    hasExplicitParams: true,
    version: URL_SCHEMA_VERSION,
    bodyId,
    mode,
    missionId: mission.id,
    stopId: stop.id,
    targetKind,
    targetId,
    view,
    spectralMode,
    notice: null,
  };
}

export function deriveUrlViewFromStoreState(params: {
  viewStage: ViewStage;
  inspectionMode: InspectionViewMode;
  activeTarget: CelestialTarget | null;
  activeDeviceId: string | null;
  spectralMode: SpectralMode;
}): UrlViewKind {
  const { viewStage, inspectionMode, activeTarget, activeDeviceId, spectralMode } = params;
  if (viewStage === 'SURFACE_VIEW' || viewStage === 'SURFACE_CESIUM') {
    return 'surface';
  }
  if (activeTarget || activeDeviceId || spectralMode === 'TERRAIN_MESH_3D') {
    if (inspectionMode === 'CONTROL_ROOM_POV') {
      return 'viewpoints';
    }
    if (viewStage === 'SUB_SCENE' || viewStage === 'WARPING' || spectralMode === 'TERRAIN_MESH_3D') {
      return 'inspect';
    }
  }
  return 'overview';
}

export function serializeUrlState(input: {
  bodyId: BodyId;
  mode: ExplorationMode;
  missionId: string;
  stopId: string;
  activeTarget: CelestialTarget | null;
  activeDeviceId: string | null;
  spectralMode: SpectralMode;
  viewStage: ViewStage;
  inspectionMode: InspectionViewMode;
}): string {
  const params = new URLSearchParams();
  params.set('v', String(URL_SCHEMA_VERSION));
  params.set('body', input.bodyId);

  const view = deriveUrlViewFromStoreState(input);
  const activeTargetId =
    input.activeDeviceId ??
    input.activeTarget?.id ??
    (input.spectralMode !== 'VISUAL_RGB'
      ? SPECTRAL_TO_LAYER_TARGET[input.spectralMode]
      : null);

  if (input.mode === 'free') {
    params.set('mode', 'free');
    if (activeTargetId) {
      params.set('target', activeTargetId);
    }
    if (view !== 'overview') {
      params.set('view', view);
    }
    return `?${params.toString()}`;
  }

  const mission = getMissionById(input.missionId) ?? getDefaultMissionForBody(input.bodyId);
  const stop = getStopById(mission, input.stopId) ?? mission.stops[0];
  params.set('mission', mission.id);
  params.set('stop', stop.id);

  const stopDefaultTargetId =
    stop.targetKind === 'body' ? null : stop.targetId;
  const targetDiffersFromStop = activeTargetId !== stopDefaultTargetId;
  const viewDiffersFromStop = view !== stop.suggestedView;

  if (targetDiffersFromStop && activeTargetId) {
    params.set('target', activeTargetId);
  } else if (!targetDiffersFromStop && input.spectralMode !== 'VISUAL_RGB' && !activeTargetId) {
    params.set('target', SPECTRAL_TO_LAYER_TARGET[input.spectralMode]);
  }
  if (viewDiffersFromStop || (view !== 'overview' && targetDiffersFromStop)) {
    params.set('view', view);
  }

  return `?${params.toString()}`;
}
