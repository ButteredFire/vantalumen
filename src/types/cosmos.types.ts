import type * as THREE from 'three';

export type SpectralMode =
  | 'VISUAL_RGB'
  | 'THERMAL_IR'
  | 'MOLA_ELEVATION'
  | 'TERRAIN_MESH_3D';

export type InspectionViewMode = 'MODEL_CLOSEUP' | 'CONTROL_ROOM_POV';

export type SensorFilterMode =
  | 'OPTICAL_RGB'
  | 'NAVCAM_MONO'
  | 'ELEVATION_GRID'
  | 'THERMAL_FALSE';

export type ProceduralModelKind =
  | 'mars_rover_rtg'
  | 'apollo_lrv'
  | 'apollo_lrv_deploy'
  | 'apollo_surface_pack'
  | 'apollo_lm_mesa';

export type ViewStage =
    | 'PRELOADING'
    | 'LAUNCHING'
    | 'BODY_TRANSITION'
    | 'ORBITAL_OVERVIEW'
    | 'WARPING'
    | 'SUB_SCENE'
    | 'SURFACE_VIEW'
    | 'SURFACE_CESIUM';

export interface SurfaceEquipmentItem {
    id: string;
    name: string;
    bodyId?: BodyId;
    realCoords: { lat: number; lon: number };
    status: string;
    mission: string;
    description: string;
    elevationM?: number;
    coords?: [number, number, number];
}

export type CelestialTargetId = string;

export type LegacyCelestialTargetId =
  | 'mars'
  | 'phobos'
  | 'deimos'
  | 'mro_orbiter'
  | 'ares_station'
  | 'olympus_mons'
  | 'valles_marineris'
  | 'jezero_crater'
  | 'hellas_planitia'
  | 'gale_crater';

export type CelestialCategory = 'PLANET' | 'MOON' | 'SPACECRAFT' | 'SURFACE_POI';

export interface SurfaceCoordinates {
  lat: number;
  lon: number;
  height: number;
  elevationKm?: number;
}

export interface OrbitalElements {
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  ascendingNodeDeg: number;
  argumentOfPeriapsisDeg: number;
  meanAnomalyAtEpochDeg: number;
  orbitalPeriodHours: number;
}

export interface ScientificTelemetry {
  classification: string;
  meanTemperatureC: string;
  atmosphericPressurePa: string;
  surfaceGravityMs2: string;
  orbitalVelocityKms: string;
  geologicalAge: string;
  missionSummary: string;
  keyHighlights: string[];
}

export interface CelestialTarget {
  id: CelestialTargetId;
  name: string;
  subtitle: string;
  category: CelestialCategory;
  position: THREE.Vector3;
  radius: number;
  safeViewDistance: number;
  isSurfaceLanding?: boolean;
  coordinates?: SurfaceCoordinates;
  orbitalElements?: OrbitalElements;
  modelPath?: string;
  telemetry: ScientificTelemetry;
  bodyId?: BodyId;
  source?: SourceReference;
}

export type BodyId = 'mars' | 'moon';

export interface SourceReference {
  title: string;
  url: string;
  checked: string;
  version: string;
}

export interface BodyConfig {
  id: BodyId;
  name: string;
  radiusKm: number;
  rotationSeconds: number;
  color: string;
  textureStyle: 'illustrative-mars' | 'illustrative-moon' | 'plain';
  source: SourceReference;
  target: CelestialTarget;
  layers: { id: string; label: string; status: 'illustrative' | 'unavailable'; detail: string }[];
}

export interface DeviceRecord {
  id: string;
  bodyId: BodyId;
  name: string;
  kind: string;
  summary: string;
  evidence: string;
  source: SourceReference;
  status: 'available' | 'unavailable';
  modelPath?: string;
  bytes?: number;
  sha256?: string;
  credit: string;
  license: { label: string; url: string; checked: string };
  /** Optional preserved attribution/provenance file for an available asset. */
  attributionPath?: string;
  /** Optional procedural reconstruction kind when no original GLB file is available. */
  proceduralModel?: ProceduralModelKind;
  /** Optional landing/deployment coordinates on the parent celestial body (deg). */
  coordinates?: { lat: number; lon: number };
  units: string;
  transform: { rotation: [number, number, number]; normalization: 'fit-longest-side-2'; physicalScaleVerified: false };
  /** Optional simulation capabilities and meter-scale metadata (distinct from Option 1 inspection normalization). */
  capabilities?: {
    mobilityKind: MobilityKind;
    supportsRealMobility: boolean;
    supportsSimulatedSurfaceDrive: boolean;
    supportsFlight: boolean;
  };
  simulationTransform?: {
    targetLongestSideM: number;
    forwardAxis: [number, number, number];
    physicalScaleVerified: boolean;
  };
  version: string;
}

export type QualityTier = 'auto' | 'low' | 'medium' | 'high';
export type ResolvedQualityTier = 'low' | 'medium' | 'high';
export type ExplorationRegionSizeKm = 2 | 16 | 64;
export type MobilityKind = 'rover_6w' | 'rover_4w' | 'helicopter' | 'lander_static' | 'orbital';
export type CameraMountMode = 'first_person' | 'third_person';

export interface DeviceSimulationCapabilities {
  supportsRealMobility: boolean;
  supportsSimulatedSurfaceDrive: boolean;
  supportsFlight: boolean;
  supportsArmDeploy: boolean;
  supportsSpectrometerScan: boolean;
  supportsHorizonStabilization: boolean;
  isProceduralModel: boolean;
}

export interface DevicePhysicalTransform {
  targetLongestSideM: number;
  dimensionsM: [number, number, number];
  forwardAxis: [number, number, number];
  yawOffsetRad: number;
  groundClearanceM: number;
  physicalScaleVerified: boolean;
  dimensionsDisclaimer: string;
}

export interface WheelRigSpec {
  layout: 'rocker_bogie_6w' | 'double_wishbone_4w' | 'skid_static' | 'rotorcraft' | 'orbital_rig';
  wheelCount: 0 | 4 | 6;
  wheelRadiusM: number;
  wheelWidthM: number;
  trackHalfWidthM: number;
  wheelZPositionsM: number[];
  steerableAxles: Array<'front' | 'mid' | 'rear'>;
  suspensionRestLengthM: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  maxSteerAngleRad: number;
  chassisMassKg: number;
  chassisBoxHalfExtentsM: [number, number, number];
  centerOfMassOffsetM: [number, number, number];
}

export interface DeviceSimulationProfile {
  id: string;
  bodyId?: BodyId;
  mobilityKind: MobilityKind;
  maxSpeedMs: number;
  documentedSpeedNote: string;
  reverseSpeedMs: number;
  maxClimbSlopeDeg: number;
  eyeHeightM: number;
  eyeForwardOffsetM: number;
  chaseDistanceM: number;
  chaseHeightM: number;
  defaultFovDeg: number;
  flightMaxAltitudeM?: number;
  flightMaxSpeedMs?: number;
  wheelRig: WheelRigSpec;
  physicalTransform: DevicePhysicalTransform;
  capabilities: DeviceSimulationCapabilities;
  provenanceLabel: string;
}

export interface BodyPhysicsConfig {
  bodyId: BodyId;
  gravityMs2: number;
  meanRadiusM: number;
  atmosphereDensityKgM3: number;
  airDragCoefficient: number;
  surfaceFriction: number;
  rollingResistance: number;
  skyZenithHex: string;
  skyHorizonHex: string;
  fogColorHex: string;
  fogDensity: number;
  sunColorHex: string;
  sunIntensity: number;
  ambientColorHex: string;
  ambientIntensity: number;
  regionCenterName: string;
  regionCenterLatLon: { lat: number; lon: number };
  terrainSourceSummary: string;
}

export interface TerrainTileManifest {
  bodyId: BodyId;
  regionName: string;
  regionSizeKm: ExplorationRegionSizeKm;
  tileSizeM: number;
  baseGridResolution: number;
  boundsMeters: { minX: number; maxX: number; minZ: number; maxZ: number };
  elevationRangeM: { min: number; max: number };
  quantizationStepM: number;
  maxQuantizationErrorM: number;
  source: string;
  license: string;
  isBaselinePlusSyntheticRelief: true;
  seed: number;
  sha256: string;
}

export type StabilityWarningKind =
  | 'none'
  | 'steep_slope'
  | 'high_center'
  | 'tip_over'
  | 'boundary_limit';

export interface SurfaceTelemetrySnapshot {
  speedMs: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  altitudeAboveGroundM: number;
  elevationM: number;
  globalXM: number;
  globalYM: number;
  globalZM: number;
  distanceTraveledM: number;
  wheelsGroundedCount: number;
  totalWheels: number;
  slipRatio: number;
  stabilityWarning: StabilityWarningKind;
  isStreamingColliderHold: boolean;
  isSimulatedMobilityActive: boolean;
  isFlightAirborne: boolean;
  activeCameraMount: CameraMountMode;
  pointerLocked: boolean;
  horizonStabilized: boolean;
  trailPoints: Array<{ x: number; z: number }>;
  activeChunkCount: number;
  originShiftCount: number;
}

export interface SimulationCheckpoint {
  deviceId: string;
  bodyId: BodyId;
  regionSizeKm: ExplorationRegionSizeKm;
  globalPos: [number, number, number];
  yawRad: number;
  odometerM: number;
  timestampMs: number;
}

export interface QualityRuntimeStats {
  p50FrameMs: number;
  p95FrameMs: number;
  drawCalls: number;
  triangles: number;
  estimatedGpuBytes: number;
  jsHeapBytes: number | null;
  activeDpr: number;
  resolvedTier: ResolvedQualityTier;
}

export interface LODTierConfig {
  level: 0 | 1 | 2 | 3;
  maxDistanceKm: number;
  segments: number;
  label: string;
}

export type DeviceCameraViewId =
  | 'overview'
  | 'coaxial_mast'
  | 'rte_horizon'
  | 'navcam_nadir'
  | 'arm_grapple'
  | 'solar_wings'
  | 'deck_overview'
  | 'mastcam_supercam'
  | 'arm_pixl_turret'
  | 'aft_rtg_rimfax'
  | 'chemcam_mast'
  | 'mahli_turret'
  | 'mast_optics'
  | 'wheel_bogie'
  | 'rtg_aft'
  | 'dish_high_gain'
  | 'nav_console'
  | 'mesa_bay';

export type DevicePartGroupId =
  | 'all'
  | 'rotor_system'
  | 'solar_power'
  | 'fuselage_avionics'
  | 'cameras_optics'
  | 'landing_gear'
  | 'robotic_arm'
  | 'grapple_claw'
  | 'solar_wings'
  | 'lander_deck'
  | 'optics_mast'
  | 'mobility_chassis'
  | 'power_thermal'
  | 'payload_science';

export type RotorSpinMode = 'stopped' | 'demo_slow';

export type RotorStepDeg = 0 | 45 | 90 | 180;

export interface DeviceCameraViewSpec {
  id: DeviceCameraViewId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  summary: string;
  sourceRef: string;
  isIllustrativeView: true;
}

export interface DevicePartGroupSpec {
  id: DevicePartGroupId;
  label: string;
  nodeNames: string[];
  documentedSpec: string;
  sourceRef: string;
  limitationNote: string;
  isControlVerified: boolean;
}

export interface DeviceRotorControlSpec {
  upperNodeName: string;
  lowerNodeName: string;
  localAxis: [number, number, number];
  documentedRpm: string;
  documentedDiameter: string;
  documentedFlightWindow: string;
  demoSpinRadPerSec: number;
  demoRevPerSecLabel: string;
  stepAnglesDeg: RotorStepDeg[];
  disclaimer: string;
}

export interface DeviceControlSpec {
  deviceId: string;
  modelVersion: string;
  generalDisclaimer: string;
  rotorControl?: DeviceRotorControlSpec;
  cameraViews: DeviceCameraViewSpec[];
  partGroups: DevicePartGroupSpec[];
  sources: SourceReference[];
}
