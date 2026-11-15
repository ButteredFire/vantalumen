import type {
  BodyId,
  ExplorationRegionSizeKm,
  TerrainTileManifest,
} from '../../types/cosmos.types';

export const TILE_SIZE_M = 256;
export const HALF_TILE_M = TILE_SIZE_M / 2;
export const BASE_TILE_SEGMENTS = 96; // Exact multiple of LOD1 (32, step 3) and LOD2 (16, step 6)
export const LOD1_SEGMENTS = 32;
export const LOD2_SEGMENTS = 16;
export const BASE_GRID_POINTS = BASE_TILE_SEGMENTS + 1; // 97
export const ELEVATION_QUANTIZATION_M = 0.005; // 5 mm quantized step for manifest export

const BODY_RADIUS_M: Record<BodyId, number> = {
  mars: 3_389_500,
  moon: 1_737_400,
};

const BODY_SEED: Record<BodyId, number> = {
  mars: 409_731,
  moon: 823_157,
};

export interface TerrainRockSpec {
  id: number;
  globalX: number;
  globalY: number;
  globalZ: number;
  radiusM: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
  rotX: number;
  collidable: boolean;
  shape: 'rock' | 'slab';
}

export interface TerrainTilePayload {
  key: string;
  bodyId: BodyId;
  tx: number;
  tz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  segments: number;
  /** Column-major Rapier-compatible height array: heights[col * (segments + 1) + row]. */
  heights: Float32Array;
  minHeight: number;
  maxHeight: number;
  rocks: TerrainRockSpec[];
}

export function makeTileKey(bodyId: BodyId, tx: number, tz: number): string {
  return `${bodyId}:${tx}:${tz}`;
}

export function getRegionHalfExtentM(regionSizeKm: ExplorationRegionSizeKm): number {
  return (regionSizeKm * 1000) / 2;
}

export function tileIndexFromWorldM(worldX: number, worldZ: number): { tx: number; tz: number } {
  return {
    tx: Math.floor((worldX + HALF_TILE_M) / TILE_SIZE_M),
    tz: Math.floor((worldZ + HALF_TILE_M) / TILE_SIZE_M),
  };
}

export function tileBoundsFromIndex(tx: number, tz: number): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
} {
  const centerX = tx * TILE_SIZE_M;
  const centerZ = tz * TILE_SIZE_M;
  return {
    centerX,
    centerZ,
    minX: centerX - HALF_TILE_M,
    maxX: centerX + HALF_TILE_M,
    minZ: centerZ - HALF_TILE_M,
    maxZ: centerZ + HALF_TILE_M,
  };
}

export function isTileWithinRegion(
  tx: number,
  tz: number,
  regionSizeKm: ExplorationRegionSizeKm,
): boolean {
  const half = getRegionHalfExtentM(regionSizeKm);
  const bounds = tileBoundsFromIndex(tx, tz);
  return (
    bounds.maxX >= -half - TILE_SIZE_M &&
    bounds.minX <= half + TILE_SIZE_M &&
    bounds.maxZ >= -half - TILE_SIZE_M &&
    bounds.minZ <= half + TILE_SIZE_M
  );
}

/**
 * Numerically stable downward spherical curvature offset (-d² / (R + sqrt(R² - d²))).
 * Zero cancellation near origin; seamless across 64×64 km chunk boundaries.
 */
export function computeSphericalDropM(
  globalX: number,
  globalZ: number,
  bodyRadiusM: number,
): number {
  const d2 = globalX * globalX + globalZ * globalZ;
  const maxR2 = bodyRadiusM * bodyRadiusM * 0.99;
  const clampedD2 = Math.min(d2, maxR2);
  return clampedD2 / (bodyRadiusM + Math.sqrt(bodyRadiusM * bodyRadiusM - clampedD2));
}

export function getBodyMeanRadiusM(bodyId: BodyId): number {
  return BODY_RADIUS_M[bodyId] ?? BODY_RADIUS_M.mars;
}

function hash2D(ix: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374_761_393) ^ Math.imul(iz, 668_265_263) ^ Math.imul(seed, 1_442_695_041);
  n = (n ^ (n >>> 13)) * 1_274_126_177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4_294_967_295;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);
  const v00 = hash2D(ix, iz, seed);
  const v10 = hash2D(ix + 1, iz, seed);
  const v01 = hash2D(ix, iz + 1, seed);
  const v11 = hash2D(ix + 1, iz + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return (a + (b - a) * fz) * 2 - 1;
}

function fbm2D(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2D(x * freq, z * freq, seed + i * 97) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return norm > 0 ? sum / norm : 0;
}

function evalCrater(
  x: number,
  z: number,
  cx: number,
  cz: number,
  radius: number,
  depth: number,
  rimHeight: number,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist > radius * 1.48) return 0;
  const r = dist / radius;
  if (r < 1) {
    // Parabolic bowl floor
    const bowl = (r * r - 1) * depth;
    const rim = Math.exp(-Math.pow((r - 0.98) / 0.16, 2)) * rimHeight;
    return bowl + rim;
  }
  const ejecta = Math.exp(-Math.pow((r - 1.0) / 0.22, 2)) * rimHeight;
  return ejecta;
}

/**
 * Deterministic multi-scale planetary relief in meters (relative to local regional datum).
 * Includes near-spawn proving grounds (ramp, rille trench, test crater, deep hazard crater)
 * plus regional 64×64 km valleys, ridges, and impact craters.
 */
export function sampleReliefElevationM(
  bodyId: BodyId,
  globalX: number,
  globalZ: number,
): number {
  const seed = BODY_SEED[bodyId];
  const radialSpawn = Math.hypot(globalX, globalZ);
  // Keep central landing & proving zone [0..75m] free of steep macro cliffs; transition smoothly over 185m
  const macroBlend = smoothstep((radialSpawn - 75) / 185);
  const fineBlend = smoothstep((radialSpawn - 8) / 14);

  let h = 0;

  if (bodyId === 'mars') {
    // Ares Vallis regional macro slope & outflow channels (wavelengths 2km -> 18km)
    const macro = fbm2D(globalX * 0.00018, globalZ * 0.00018, seed, 4) * 58;
    const meso = fbm2D(globalX * 0.0014, globalZ * 0.0014, seed + 19, 3) * 11.5;
    const dunes =
      Math.sin(globalX * 0.045 + fbm2D(globalX * 0.008, globalZ * 0.008, seed + 31, 2) * 2.4) *
      0.16;
    const fine = fbm2D(globalX * 0.042, globalZ * 0.042, seed + 53, 2) * 0.42;

    // Regional broad outflow channel passing East-West around z = -1200 m
    const channelCenterZ = -1200 + Math.sin(globalX * 0.0007) * 420;
    const distChannel = Math.abs(globalZ - channelCenterZ);
    const channelCarve = distChannel < 650 ? -24 * Math.pow(Math.cos((distChannel / 650) * (Math.PI / 2)), 2) : 0;

    // Proving-ground features visible in 2×2 km sector:
    // 1. Climbable ramp ridge along z in [-38, -20], x in [-16, +16]
    let ramp = 0;
    if (Math.abs(globalX) < 18 && globalZ > -42 && globalZ < -14) {
      const xMask = 1 - smoothstep((Math.abs(globalX) - 10) / 8);
      const t = (globalZ + 14) / -28; // 0 at -14 -> 1 at -42
      const profile = t < 0.65 ? smoothstep(t / 0.65) : 1 - smoothstep((t - 0.65) / 0.35);
      ramp = 2.1 * xMask * profile;
    }

    // 2. Traversable shallow rille / trench across z ≈ -74m
    const trenchZ = -74 + Math.sin(globalX * 0.08) * 3.5;
    const trenchDist = Math.abs(globalZ - trenchZ);
    const trench = Math.abs(globalX) < 95 ? -1.35 * Math.exp(-Math.pow(trenchDist / 5.2, 2)) : 0;

    // 3. Proving test crater (NE) + Steep deep hazard crater (NW)
    const testCrater = evalCrater(globalX, globalZ, 52, -56, 18, 2.6, 0.55);
    const hazardCrater = evalCrater(globalX, globalZ, -92, -112, 26, 7.8, 1.35);

    // 4. Regional large craters (16×16 / 64×64 km scale)
    const cellX = Math.floor((globalX + 700) / 1400);
    const cellZ = Math.floor((globalZ + 700) / 1400);
    let regionalCraters = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const cx = (cellX + dx) * 1400 + (hash2D(cellX + dx, cellZ + dz, seed + 211) - 0.5) * 750;
        const cz = (cellZ + dz) * 1400 + (hash2D(cellX + dx, cellZ + dz, seed + 307) - 0.5) * 750;
        if (Math.hypot(cx, cz) > 360) {
          const rad = 110 + hash2D(cellX + dx, cellZ + dz, seed + 401) * 260;
          regionalCraters += evalCrater(globalX, globalZ, cx, cz, rad, rad * 0.14, rad * 0.032);
        }
      }
    }

    h =
      macro * macroBlend +
      meso * macroBlend +
      channelCarve * smoothstep((radialSpawn - 180) / 220) +
      (dunes + fine) * (0.15 + 0.85 * fineBlend) +
      ramp +
      trench +
      testCrater +
      hazardCrater +
      regionalCraters;
  } else {
    // Moon — Hadley–Apennine basin, Apennine massif slopes & winding Hadley Rille
    const massif =
      fbm2D(globalX * 0.00016, globalZ * 0.00016, seed, 4) * 95 +
      Math.max(0, (globalX - 1800) * 0.025);
    const hummocks = fbm2D(globalX * 0.0018, globalZ * 0.0018, seed + 41, 3) * 14.0;
    const regolith = fbm2D(globalX * 0.055, globalZ * 0.055, seed + 83, 2) * 0.36;

    // Hadley-like sinuous rille west of landing zone (~x = -420m southward -> deep gorge)
    const rilleCenterX = -460 + Math.sin(globalZ * 0.0014) * 240;
    const rilleDist = Math.abs(globalX - rilleCenterX);
    const hadleyRille =
      radialSpawn > 160
        ? -48 * Math.exp(-Math.pow(rilleDist / 125, 2)) * smoothstep((radialSpawn - 160) / 140)
        : 0;

    // Near-spawn Apollo LRV proving ground ramp + medium bowl crater + deep crater
    let ramp = 0;
    if (Math.abs(globalX) < 20 && globalZ > -44 && globalZ < -14) {
      const xMask = 1 - smoothstep((Math.abs(globalX) - 12) / 8);
      const t = (globalZ + 14) / -30;
      const profile = t < 0.6 ? smoothstep(t / 0.6) : 1 - smoothstep((t - 0.6) / 0.4);
      ramp = 2.4 * xMask * profile;
    }

    const trenchZ = -78 + Math.cos(globalX * 0.07) * 4;
    const trenchDist = Math.abs(globalZ - trenchZ);
    const trench = Math.abs(globalX) < 110 ? -1.45 * Math.exp(-Math.pow(trenchDist / 5.5, 2)) : 0;

    const testCrater = evalCrater(globalX, globalZ, 56, -60, 20, 3.0, 0.65);
    const deepCrater = evalCrater(globalX, globalZ, -95, -118, 28, 8.6, 1.45);

    const cellX = Math.floor((globalX + 600) / 1200);
    const cellZ = Math.floor((globalZ + 600) / 1200);
    let regionalCraters = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const cx = (cellX + dx) * 1200 + (hash2D(cellX + dx, cellZ + dz, seed + 509) - 0.5) * 620;
        const cz = (cellZ + dz) * 1200 + (hash2D(cellX + dx, cellZ + dz, seed + 607) - 0.5) * 620;
        if (Math.hypot(cx, cz) > 320) {
          const rad = 85 + hash2D(cellX + dx, cellZ + dz, seed + 701) * 230;
          regionalCraters += evalCrater(globalX, globalZ, cx, cz, rad, rad * 0.16, rad * 0.036);
        }
      }
    }

    h =
      massif * macroBlend +
      hummocks * macroBlend +
      hadleyRille +
      regolith * (0.12 + 0.88 * fineBlend) +
      ramp +
      trench +
      testCrater +
      deepCrater +
      regionalCraters;
  }

  return h;
}

/**
 * Total continuous planetary surface elevation at `(globalX, globalZ)` in meters,
 * combining geological relief and exact downward spherical curvature.
 */
export function sampleGlobalTerrainElevationM(
  bodyId: BodyId,
  globalX: number,
  globalZ: number,
  includeCurvature = true,
): number {
  const relief = sampleReliefElevationM(bodyId, globalX, globalZ);
  if (!includeCurvature) return relief;
  return relief - computeSphericalDropM(globalX, globalZ, getBodyMeanRadiusM(bodyId));
}

export function generateRocksForTile(
  bodyId: BodyId,
  tx: number,
  tz: number,
  heights: Float32Array,
  segments = BASE_TILE_SEGMENTS,
): TerrainRockSpec[] {
  const bounds = tileBoundsFromIndex(tx, tz);
  const seed = BODY_SEED[bodyId] + tx * 92821 + tz * 68917;
  const rockCount = bodyId === 'mars' ? 28 : 24;
  const rocks: TerrainRockSpec[] = [];

  for (let i = 0; i < rockCount; i += 1) {
    const ux = hash2D(i, 1, seed);
    const uz = hash2D(i, 2, seed + 13);
    const globalX = bounds.minX + 4 + ux * (TILE_SIZE_M - 8);
    const globalZ = bounds.minZ + 4 + uz * (TILE_SIZE_M - 8);

    // Leave central landing apron (r < 12m) clear so initial spawn never sits on a boulder
    if (Math.hypot(globalX, globalZ) < 12) continue;

    const uType = hash2D(i, 3, seed + 29);
    const radiusM =
      uType < 0.55
        ? 0.12 + hash2D(i, 4, seed) * 0.22 // small traversable rocks
        : uType < 0.88
          ? 0.42 + hash2D(i, 5, seed) * 0.65 // medium rocks
          : 1.15 + hash2D(i, 6, seed) * 1.45; // large boulders

    const groundY = sampleTileGridHeight(heights, segments, bounds.minX, bounds.minZ, globalX, globalZ);
    const squash = 0.48 + hash2D(i, 7, seed) * 0.42;

    rocks.push({
      id: i,
      globalX,
      globalY: groundY + radiusM * squash * 0.42,
      globalZ,
      radiusM,
      scaleX: radiusM * (0.85 + hash2D(i, 8, seed) * 0.4),
      scaleY: radiusM * squash,
      scaleZ: radiusM * (0.85 + hash2D(i, 9, seed) * 0.4),
      rotY: hash2D(i, 10, seed) * Math.PI * 2,
      rotX: (hash2D(i, 11, seed) - 0.5) * 0.35,
      collidable: radiusM >= 0.22,
      shape: 'rock',
    });
  }

  // Deterministic basalt step slabs on the central tile (0,0) for wheel step-climb validation
  if (tx === 0 && tz === 0) {
    const slabs: Array<{ x: number; z: number; sx: number; sy: number; sz: number }> = [
      { x: -1.8, z: -15.0, sx: 1.6, sy: 0.11, sz: 0.9 },
      { x: 3.5, z: -20.5, sx: 1.9, sy: 0.16, sz: 1.1 },
      { x: -4.2, z: -24.5, sx: 1.4, sy: 0.19, sz: 1.0 },
    ];
    slabs.forEach((slab, idx) => {
      const groundY = sampleTileGridHeight(heights, segments, bounds.minX, bounds.minZ, slab.x, slab.z);
      rocks.push({
        id: 1000 + idx,
        globalX: slab.x,
        globalY: groundY + slab.sy * 0.45,
        globalZ: slab.z,
        radiusM: Math.max(slab.sx, slab.sz) * 0.5,
        scaleX: slab.sx,
        scaleY: slab.sy,
        scaleZ: slab.sz,
        rotY: 0.08 * (idx - 1),
        rotX: 0,
        collidable: true,
        shape: 'slab',
      });
    });
  }

  return rocks;
}

export function generateTilePayload(
  bodyId: BodyId,
  tx: number,
  tz: number,
  segments = BASE_TILE_SEGMENTS,
): TerrainTilePayload {
  const bounds = tileBoundsFromIndex(tx, tz);
  const grid = segments + 1;
  const heights = new Float32Array(grid * grid);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  // Column-major layout [col * grid + row] matching RAPIER.ColliderDesc.heightfield(segments, segments, heights, scale)
  for (let col = 0; col <= segments; col += 1) {
    const wx = bounds.minX + (col / segments) * TILE_SIZE_M;
    for (let row = 0; row <= segments; row += 1) {
      const wz = bounds.minZ + (row / segments) * TILE_SIZE_M;
      const h = sampleGlobalTerrainElevationM(bodyId, wx, wz, true);
      heights[col * grid + row] = h;
      if (h < minHeight) minHeight = h;
      if (h > maxHeight) maxHeight = h;
    }
  }

  const rocks = generateRocksForTile(bodyId, tx, tz, heights, segments);

  return {
    key: makeTileKey(bodyId, tx, tz),
    bodyId,
    tx,
    tz,
    minX: bounds.minX,
    maxX: bounds.maxX,
    minZ: bounds.minZ,
    maxZ: bounds.maxZ,
    segments,
    heights,
    minHeight,
    maxHeight,
    rocks,
  };
}

/**
 * Samples height on a tile's column-major grid using the EXACT anti-diagonal split
 * `(col+1, row) - (col, row+1)` used by Rapier heightfield & TerrainTile geometry.
 */
export function sampleTileGridHeight(
  heights: Float32Array,
  segments: number,
  tileMinX: number,
  tileMinZ: number,
  worldX: number,
  worldZ: number,
): number {
  const grid = segments + 1;
  const cellSize = TILE_SIZE_M / segments;
  const fx = Math.max(0, Math.min(segments - 1e-6, (worldX - tileMinX) / cellSize));
  const fz = Math.max(0, Math.min(segments - 1e-6, (worldZ - tileMinZ) / cellSize));
  const col = Math.floor(fx);
  const row = Math.floor(fz);
  const u = fx - col;
  const v = fz - row;

  const h00 = heights[col * grid + row];
  const h10 = heights[(col + 1) * grid + row];
  const h01 = heights[col * grid + (row + 1)];
  const h11 = heights[(col + 1) * grid + (row + 1)];

  if (u + v <= 1) {
    return h00 + u * (h10 - h00) + v * (h01 - h00);
  }
  return h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
}

export function getGlobalLatLonFromLocalM(
  bodyId: BodyId,
  centerLatLon: { lat: number; lon: number },
  globalX: number,
  globalZ: number,
): { lat: number; lon: number } {
  const radius = getBodyMeanRadiusM(bodyId);
  const radToDeg = 180 / Math.PI;
  const dLat = (-globalZ / radius) * radToDeg;
  const cosLat = Math.max(0.2, Math.cos((centerLatLon.lat * Math.PI) / 180));
  const dLon = (globalX / (radius * cosLat)) * radToDeg;
  return {
    lat: centerLatLon.lat + dLat,
    lon: ((centerLatLon.lon + dLon) % 360 + 360) % 360,
  };
}

export function computeTileManifest(
  bodyId: BodyId,
  regionName: string,
  regionSizeKm: ExplorationRegionSizeKm,
  source: string,
  license: string,
  sha256: string,
): TerrainTileManifest {
  const half = getRegionHalfExtentM(regionSizeKm);
  // Sample sparse region summary across grid to record verified elevation bounds
  let minE = Infinity;
  let maxE = -Infinity;
  const steps = 32;
  for (let i = 0; i <= steps; i += 1) {
    const x = -half + (i / steps) * (half * 2);
    for (let j = 0; j <= steps; j += 1) {
      const z = -half + (j / steps) * (half * 2);
      const e = sampleGlobalTerrainElevationM(bodyId, x, z, true);
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
    }
  }
  return {
    bodyId,
    regionName,
    regionSizeKm,
    tileSizeM: TILE_SIZE_M,
    baseGridResolution: BASE_GRID_POINTS,
    boundsMeters: { minX: -half, maxX: half, minZ: -half, maxZ: half },
    elevationRangeM: {
      min: Number(minE.toFixed(3)),
      max: Number(maxE.toFixed(3)),
    },
    quantizationStepM: ELEVATION_QUANTIZATION_M,
    maxQuantizationErrorM: ELEVATION_QUANTIZATION_M / 2,
    source,
    license,
    isBaselinePlusSyntheticRelief: true,
    seed: BODY_SEED[bodyId],
    sha256,
  };
}
