import type { BodyId } from '../../types/cosmos.types';
import {
  BASE_TILE_SEGMENTS,
  generateTilePayload,
  makeTileKey,
  sampleGlobalTerrainElevationM,
  sampleTileGridHeight,
  tileIndexFromWorldM,
  type TerrainRockSpec,
  type TerrainTilePayload,
} from './terrainDataPipeline';

const MAX_PROVIDER_CACHE_TILES = 96;

/**
 * Single authoritative terrain source across POV driving, collider generation,
 * 3D surface terrain showcase meshes, and terrain patches.
 */
export class TerrainProvider {
  public readonly bodyId: BodyId;
  private readonly cache = new Map<string, TerrainTilePayload>();

  constructor(bodyId: BodyId) {
    this.bodyId = bodyId;
  }

  public getCachedTile(tx: number, tz: number): TerrainTilePayload | undefined {
    const key = makeTileKey(this.bodyId, tx, tz);
    const existing = this.cache.get(key);
    if (existing) {
      // Refresh LRU ordering
      this.cache.delete(key);
      this.cache.set(key, existing);
    }
    return existing;
  }

  public putTile(payload: TerrainTilePayload): void {
    if (payload.bodyId !== this.bodyId) return;
    if (this.cache.has(payload.key)) {
      this.cache.delete(payload.key);
    }
    this.cache.set(payload.key, payload);
    while (this.cache.size > MAX_PROVIDER_CACHE_TILES) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }

  public getOrBuildTileSync(tx: number, tz: number): TerrainTilePayload {
    const cached = this.getCachedTile(tx, tz);
    if (cached) return cached;
    const built = generateTilePayload(this.bodyId, tx, tz, BASE_TILE_SEGMENTS);
    this.putTile(built);
    return built;
  }

  /**
   * Samples the exact triangulated height matching LOD0 mesh & Rapier heightfield when cached,
   * falling back seamlessly to the continuous deterministic relief function if uncached.
   */
  public sampleHeightAt(globalX: number, globalZ: number): number {
    const { tx, tz } = tileIndexFromWorldM(globalX, globalZ);
    const cached = this.getCachedTile(tx, tz);
    if (cached) {
      return sampleTileGridHeight(
        cached.heights,
        cached.segments,
        cached.minX,
        cached.minZ,
        globalX,
        globalZ,
      );
    }
    return sampleGlobalTerrainElevationM(this.bodyId, globalX, globalZ, true);
  }

  /**
   * Ensures tile is built synchronously and returns exact grid-triangulated height.
   */
  public sampleExactGridHeightAt(globalX: number, globalZ: number): number {
    const { tx, tz } = tileIndexFromWorldM(globalX, globalZ);
    const tile = this.getOrBuildTileSync(tx, tz);
    return sampleTileGridHeight(
      tile.heights,
      tile.segments,
      tile.minX,
      tile.minZ,
      globalX,
      globalZ,
    );
  }

  public sampleNormalAt(globalX: number, globalZ: number, epsM = 0.65): [number, number, number] {
    const hL = this.sampleHeightAt(globalX - epsM, globalZ);
    const hR = this.sampleHeightAt(globalX + epsM, globalZ);
    const hD = this.sampleHeightAt(globalX, globalZ - epsM);
    const hU = this.sampleHeightAt(globalX, globalZ + epsM);
    const nx = hL - hR;
    const ny = 2 * epsM;
    const nz = hD - hU;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  public sampleSlopeDegAt(globalX: number, globalZ: number): number {
    const [, ny] = this.sampleNormalAt(globalX, globalZ);
    return (Math.acos(Math.max(-1, Math.min(1, ny))) * 180) / Math.PI;
  }

  public getRocksForTile(tx: number, tz: number): TerrainRockSpec[] {
    return this.getOrBuildTileSync(tx, tz).rocks;
  }

  public clear(): void {
    this.cache.clear();
  }
}

const sharedProviders = new Map<BodyId, TerrainProvider>();

export function getSharedTerrainProvider(bodyId: BodyId): TerrainProvider {
  let provider = sharedProviders.get(bodyId);
  if (!provider) {
    provider = new TerrainProvider(bodyId);
    sharedProviders.set(bodyId, provider);
  }
  return provider;
}
