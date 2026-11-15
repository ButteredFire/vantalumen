import type { BodyId, BodyPhysicsConfig } from '../types/cosmos.types';

/**
 * Physical constants and regional simulation baseline per celestial body.
 * Terrain micro-relief combines regional MOLA/LOLA-derived baseline parameters
 * with deterministic seeded synthetic micro-detail (labeled in UI & docs/SOURCES.md).
 */
export const BODY_PHYSICS_CONFIG: Record<BodyId, BodyPhysicsConfig> = {
  mars: {
    bodyId: 'mars',
    gravityMs2: 3.72076,
    meanRadiusM: 3_389_500,
    atmosphereDensityKgM3: 0.02,
    airDragCoefficient: 0.45,
    surfaceFriction: 0.88,
    rollingResistance: 0.045,
    skyZenithHex: '#5b3926',
    skyHorizonHex: '#c8875a',
    fogColorHex: '#b97a52',
    fogDensity: 0.00055,
    sunColorHex: '#fff0dd',
    sunIntensity: 3.1,
    ambientColorHex: '#c88c66',
    ambientIntensity: 0.85,
    regionCenterName: 'Ares Vallis — Vùng hạ cánh Pathfinder',
    regionCenterLatLon: { lat: 19.13, lon: 326.78 },
    terrainSourceSummary:
      'Độ cao nền tham chiếu MOLA + chi tiết địa hình tổng hợp theo seed (mô phỏng)',
  },
  moon: {
    bodyId: 'moon',
    gravityMs2: 1.625,
    meanRadiusM: 1_737_400,
    atmosphereDensityKgM3: 0,
    airDragCoefficient: 0,
    surfaceFriction: 0.78,
    rollingResistance: 0.055,
    skyZenithHex: '#020408',
    skyHorizonHex: '#0a0f18',
    fogColorHex: '#06090f',
    fogDensity: 0.00008,
    sunColorHex: '#ffffff',
    sunIntensity: 3.65,
    ambientColorHex: '#7d8796',
    ambientIntensity: 0.42,
    regionCenterName: 'Hadley–Apennine — Apollo 15',
    regionCenterLatLon: { lat: 26.1322, lon: 3.6339 },
    terrainSourceSummary:
      'Độ cao nền tham chiếu LOLA + rãnh Hadley & miệng hố tổng hợp theo seed (mô phỏng)',
  },
};

export function getBodyPhysicsConfig(bodyId: BodyId): BodyPhysicsConfig {
  return BODY_PHYSICS_CONFIG[bodyId] ?? BODY_PHYSICS_CONFIG.mars;
}
