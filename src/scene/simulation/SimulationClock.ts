import type { BodyId, OrbitalElements } from '../../types/cosmos.types';

/** Gravitational parameters μ = G * M in km³/s² for Kepler period & velocity verification. */
export const BODY_MU_KM3_S2: Record<BodyId, number> = {
  mars: 42_828.375214,
  moon: 4_902.800066,
};

export const FIXED_PHYSICS_DT = 1 / 60;
export const MAX_RENDER_DT = 0.05;
export const MAX_PHYSICS_STEPS_PER_FRAME = 5;

export function clampFrameDelta(rawDeltaSec: number, isHidden = false): number {
  if (isHidden || !Number.isFinite(rawDeltaSec) || rawDeltaSec <= 0) {
    return 0;
  }
  return Math.min(rawDeltaSec, MAX_RENDER_DT);
}

/**
 * Advances orbital time strictly from frameDelta * timeScale while paused or hidden returns 0.
 * Never affects surface Rover/Helicopter physics dt (decoupled M4 requirement).
 */
export function computeOrbitalTimeStep(
  rawFrameDeltaSec: number,
  timeScale: number,
  paused: boolean,
  isHidden = false,
): number {
  if (paused) return 0;
  const clamped = clampFrameDelta(rawFrameDeltaSec, isHidden);
  return clamped * Math.max(0, timeScale);
}

/**
 * Theoretical orbital period T = 2π * sqrt(a³ / μ) in hours for Kepler verification.
 */
export function computeKeplerPeriodHours(semiMajorAxisKm: number, bodyId: BodyId): number {
  const mu = BODY_MU_KM3_S2[bodyId];
  const a3 = Math.pow(Math.max(1, semiMajorAxisKm), 3);
  const seconds = 2 * Math.PI * Math.sqrt(a3 / mu);
  return seconds / 3600;
}

export function computeOrbitalApsidesKm(elements: OrbitalElements): {
  periapsisKm: number;
  apoapsisKm: number;
} {
  return {
    periapsisKm: elements.semiMajorAxisKm * (1 - elements.eccentricity),
    apoapsisKm: elements.semiMajorAxisKm * (1 + elements.eccentricity),
  };
}
