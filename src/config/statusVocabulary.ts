import type {
  BodyId,
  BodyLayerConfig,
  CelestialTarget,
  DeviceRecord,
  EvidenceKind,
  MissionRelationship,
  RepresentationKind,
  RuntimeLoadStatus,
} from '../types/cosmos.types';

export interface UnifiedEntryStatus {
  representation: RepresentationKind;
  representationLabel: string;
  representationShortTag: string;
  evidenceKind: EvidenceKind;
  evidenceLabel: string;
  runtimeState: RuntimeLoadStatus;
  runtimeLabel: string;
  missionRelationship: MissionRelationship;
  missionRelationshipLabel: string;
}

const REPRESENTATION_LABELS: Record<
  RepresentationKind,
  { label: string; shortTag: string }
> = {
  source_model: {
    label: 'Source 3D model',
    shortTag: 'Source model',
  },
  procedural_reconstruction: {
    label: 'Illustrative reconstruction',
    shortTag: 'Illustrative reconstruction',
  },
  record_only: {
    label: 'Record only',
    shortTag: 'Record only',
  },
  illustrative_layer: {
    label: 'Illustrative layer',
    shortTag: 'Illustrative layer',
  },
};

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  measured: 'Published measurements',
  reported: 'Mission report',
  derived: 'Derived',
  illustrative: 'Illustrative / synthesized',
  unknown: 'Unverified',
};

const MISSION_RELATIONSHIP_DEFAULTS: Record<MissionRelationship, string> = {
  planetary_body: 'Primary celestial body',
  surface_feature: 'Surface feature · Reference center',
  surface_deployed: 'Surface deployment',
  surface_record_only: 'Surface equipment record',
  active_orbiter: 'Active orbiter',
  historical_orbiter: 'Historical orbiter',
  flyby_encounter: 'Flyby encounter context',
  natural_moon: 'Natural satellite',
  conceptual_proxy: 'Illustrative concept · Structural proxy',
  reference_archive: 'Off-world reference spacecraft',
};

export function resolveDeviceBodyId(
  device: Pick<DeviceRecord, 'bodyId'> | null | undefined,
  fallback: BodyId,
): BodyId {
  if (device?.bodyId === 'mars' || device?.bodyId === 'moon') {
    return device.bodyId;
  }
  return fallback;
}

export function getDeviceRepresentation(
  device: Pick<DeviceRecord, 'status' | 'modelPath' | 'proceduralModel'>,
): RepresentationKind {
  if (device.status === 'available' && device.modelPath) {
    return 'source_model';
  }
  if (device.proceduralModel) {
    return 'procedural_reconstruction';
  }
  return 'record_only';
}

export function getRepresentationLabel(kind: RepresentationKind): string {
  return REPRESENTATION_LABELS[kind].label;
}

export function getRepresentationShortTag(kind: RepresentationKind): string {
  return REPRESENTATION_LABELS[kind].shortTag;
}

export function getEvidenceKindLabel(kind: EvidenceKind): string {
  return EVIDENCE_LABELS[kind];
}

export function getMissionRelationshipLabel(
  relationship: MissionRelationship,
  override?: string,
): string {
  return override || MISSION_RELATIONSHIP_DEFAULTS[relationship];
}

export function formatRuntimeLoadStatus(
  status: RuntimeLoadStatus,
  representation: RepresentationKind,
  progress?: number,
): string {
  if (status === 'loading') {
    return (
      'Loading / decoding 3D model' +
      (progress === undefined ? '…' : ` · ${progress}%`)
    );
  }
  if (status === 'ready') {
    return '3D model loaded';
  }
  if (status === 'error') {
    return '3D model failed to load (fallback to record only)';
  }
  if (representation === 'procedural_reconstruction') {
    return 'No GLB loaded · Local illustrative reconstruction';
  }
  if (representation === 'record_only') {
    return 'No 3D model · View record and sources only';
  }
  return 'GLB will load when the inspection view opens';
}

export function classifyDeviceStatus(
  device: DeviceRecord,
  assetLoad?: { status: RuntimeLoadStatus; progress?: number; message?: string },
): UnifiedEntryStatus {
  const baseRepresentation = getDeviceRepresentation(device);
  const runtimeState: RuntimeLoadStatus = assetLoad?.status ?? 'idle';
  // If an expected source GLB failed at runtime, render status explicitly reflects record-only fallback
  const representation: RepresentationKind =
    runtimeState === 'error' && baseRepresentation === 'source_model'
      ? 'record_only'
      : baseRepresentation;

  const evidenceKind: EvidenceKind =
    representation === 'source_model'
      ? device.transform.physicalScaleVerified
        ? 'reported'
        : 'illustrative'
      : representation === 'procedural_reconstruction'
        ? 'illustrative'
        : 'reported';

  return {
    representation,
    representationLabel: getRepresentationLabel(representation),
    representationShortTag: getRepresentationShortTag(representation),
    evidenceKind,
    evidenceLabel: getEvidenceKindLabel(evidenceKind),
    runtimeState,
    runtimeLabel: formatRuntimeLoadStatus(runtimeState, representation, assetLoad?.progress),
    missionRelationship: device.missionRelationship,
    missionRelationshipLabel: getMissionRelationshipLabel(
      device.missionRelationship,
      device.missionRelationshipLabel,
    ),
  };
}

export function classifyTargetStatus(
  target: CelestialTarget,
  assetLoad?: { status: RuntimeLoadStatus; progress?: number },
): UnifiedEntryStatus {
  const hasModel = Boolean(target.modelPath);
  const runtimeState: RuntimeLoadStatus = assetLoad?.status ?? 'idle';
  const representation: RepresentationKind =
    target.representation ??
    (runtimeState === 'error' && hasModel
      ? 'record_only'
      : hasModel
        ? 'source_model'
        : 'illustrative_layer');

  const evidenceKind: EvidenceKind =
    target.evidenceKind ??
    (target.missionRelationship === 'conceptual_proxy'
      ? 'illustrative'
      : hasModel
        ? 'illustrative'
        : target.category === 'SURFACE_POI'
          ? 'reported'
          : 'illustrative');

  const missionRelationship: MissionRelationship =
    target.missionRelationship ??
    (target.category === 'SURFACE_POI'
      ? 'surface_feature'
      : target.category === 'MOON'
        ? 'natural_moon'
        : target.category === 'SPACECRAFT'
          ? 'active_orbiter'
          : 'planetary_body');

  return {
    representation,
    representationLabel: getRepresentationLabel(representation),
    representationShortTag: getRepresentationShortTag(representation),
    evidenceKind,
    evidenceLabel: getEvidenceKindLabel(evidenceKind),
    runtimeState,
    runtimeLabel: formatRuntimeLoadStatus(runtimeState, representation, assetLoad?.progress),
    missionRelationship,
    missionRelationshipLabel: getMissionRelationshipLabel(
      missionRelationship,
      target.missionRelationshipLabel,
    ),
  };
}

export function classifyLayerStatus(layer: BodyLayerConfig) {
  return {
    representationLabel: getRepresentationLabel(layer.representation),
    representationShortTag: getRepresentationShortTag(layer.representation),
    evidenceLabel: getEvidenceKindLabel(layer.evidenceKind),
    datasetStateLabel:
      layer.datasetStatus === 'illustrative_active'
        ? 'Using a synthesized illustrative layer (not original measurement data)'
        : 'Measured scientific data not integrated',
  };
}

export function isDeviceSurfaceDeployable(device: DeviceRecord | null | undefined): boolean {
  if (!device) return false;
  return device.catalogScope === 'body_surface' && Boolean(device.coordinates);
}

/**
 * Visitor-facing plain-language description for primary navigation controls
 * (technical file/format identifiers such as GLB, WebP, or 8K remain in the dossier/evidence panel).
 */
export function getVisitorNavDescription(kind: RepresentationKind): string {
  if (kind === 'source_model') {
    return 'View reference 3D model';
  }
  if (kind === 'procedural_reconstruction') {
    return 'Illustrative 3D reconstruction';
  }
  if (kind === 'record_only') {
    return 'Location record & sources';
  }
  return 'Illustrative viewing layer';
}
