import type {
  BodyId,
  ExplorationRegionSizeKm,
  ResolvedQualityTier,
} from '../../types/cosmos.types';
import {
  BASE_TILE_SEGMENTS,
  getRegionHalfExtentM,
  isTileWithinRegion,
  makeTileKey,
  tileBoundsFromIndex,
  tileIndexFromWorldM,
  type TerrainTilePayload,
} from './terrainDataPipeline';
import { TerrainProvider } from './TerrainProvider';
import type { TerrainLodLevel } from './TerrainTile';
import type {
  TerrainWorkerBuildRequest,
  TerrainWorkerCancelRequest,
  TerrainWorkerResult,
} from './terrain.worker';

export interface ActiveChunkDescriptor {
  payload: TerrainTilePayload;
  lod: TerrainLodLevel;
  distanceTiles: number;
  centerX: number;
  centerZ: number;
}

interface PendingJob {
  requestId: number;
  key: string;
  bodyId: BodyId;
  tx: number;
  tz: number;
  priority: number;
}

/**
 * Streams 256×256 m planetary tiles across 2×2, 16×16, or 64×64 km regions,
 * prioritizing look-ahead velocity tiles, cancelling obsolete worker tasks on
 * fast traversal or body switches, and capping cached LRU chunks by quality tier.
 */
export class ChunkManager {
  public readonly bodyId: BodyId;
  public regionSizeKm: ExplorationRegionSizeKm;
  public qualityTier: ResolvedQualityTier;
  public readonly provider: TerrainProvider;

  private worker: Worker | null = null;
  private workerAvailable = false;
  private nextRequestId = 1;
  private readonly loadedTiles = new Map<string, TerrainTilePayload>();
  private readonly pendingByKey = new Map<string, PendingJob>();
  private readonly pendingById = new Map<number, PendingJob>();
  private readonly activeChunks = new Map<string, ActiveChunkDescriptor>();
  private versionCounter = 0;

  constructor(
    bodyId: BodyId,
    regionSizeKm: ExplorationRegionSizeKm,
    qualityTier: ResolvedQualityTier,
    provider?: TerrainProvider,
    enableWorker = true,
  ) {
    this.bodyId = bodyId;
    this.regionSizeKm = regionSizeKm;
    this.qualityTier = qualityTier;
    this.provider = provider ?? new TerrainProvider(bodyId);
    if (enableWorker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (e: MessageEvent<TerrainWorkerResult>) => {
          this.handleWorkerResult(e.data);
        };
        this.worker.onerror = () => {
          // Degrade gracefully to synchronous provider generation if worker unavailable
          this.workerAvailable = false;
          this.worker?.terminate();
          this.worker = null;
        };
        this.workerAvailable = true;
      } catch {
        this.worker = null;
        this.workerAvailable = false;
      }
    }
  }

  public getVersion(): number {
    return this.versionCounter;
  }

  public getLoadedTilesMap(): Map<string, TerrainTilePayload> {
    return this.loadedTiles;
  }

  public getActiveChunks(): ActiveChunkDescriptor[] {
    return Array.from(this.activeChunks.values());
  }

  public getRegionRadiusM(): number {
    return getRegionHalfExtentM(this.regionSizeKm);
  }

  public setRegionSizeKm(sizeKm: ExplorationRegionSizeKm): void {
    if (this.regionSizeKm === sizeKm) return;
    this.regionSizeKm = sizeKm;
    this.versionCounter += 1;
  }

  public setQualityTier(tier: ResolvedQualityTier): void {
    if (this.qualityTier === tier) return;
    this.qualityTier = tier;
    this.versionCounter += 1;
  }

  private getTileRadiusForQuality(): number {
    if (this.qualityTier === 'low') return 2; // 5x5 = 1.28 km window
    if (this.qualityTier === 'medium') return 3; // 7x7 = 1.79 km window
    return 4; // 9x9 = 2.3 km window
  }

  private resolveLod(dx: number, dz: number, lookaheadBias: number): TerrainLodLevel {
    const chebyshev = Math.max(Math.abs(dx), Math.abs(dz));
    if (this.qualityTier === 'low') {
      return chebyshev === 0 ? 0 : chebyshev <= 1 ? 1 : 2;
    }
    if (this.qualityTier === 'medium') {
      if (chebyshev <= 1) return 0;
      if (chebyshev <= 2 && lookaheadBias <= 2.2) return 1;
      return 2;
    }
    // High quality: full LOD0 on inner 3x3 ring
    if (chebyshev <= 1) return 0;
    if (chebyshev <= 2) return 1;
    return 2;
  }

  /**
   * Ensures the tile directly under `(globalX, globalZ)` and its immediate 1-tile
   * neighbor buffer are ready synchronously (safe spawn / checkpoint teleport).
   */
  public primeImmediateNeighborhood(globalX: number, globalZ: number): void {
    const { tx, tz } = tileIndexFromWorldM(globalX, globalZ);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const nx = tx + dx;
        const nz = tz + dz;
        if (!isTileWithinRegion(nx, nz, this.regionSizeKm)) continue;
        const key = makeTileKey(this.bodyId, nx, nz);
        if (!this.loadedTiles.has(key)) {
          const payload = this.provider.getOrBuildTileSync(nx, nz);
          this.loadedTiles.set(key, payload);
        }
      }
    }
    this.update(globalX, globalZ, 0, 0);
  }

  public update(
    playerGlobalX: number,
    playerGlobalZ: number,
    velX = 0,
    velZ = 0,
  ): void {
    const lookAheadX = playerGlobalX + Math.max(-180, Math.min(180, velX * 4));
    const lookAheadZ = playerGlobalZ + Math.max(-180, Math.min(180, velZ * 4));
    const { tx: centerTx, tz: centerTz } = tileIndexFromWorldM(playerGlobalX, playerGlobalZ);
    const { tx: aheadTx, tz: aheadTz } = tileIndexFromWorldM(lookAheadX, lookAheadZ);
    const ringRadius = this.getTileRadiusForQuality();

    const desiredKeys = new Set<string>();
    const missingJobs: Array<{ tx: number; tz: number; key: string; priority: number }> = [];
    let activeChanged = false;

    const nextActive = new Map<string, ActiveChunkDescriptor>();

    for (let dx = -ringRadius; dx <= ringRadius; dx += 1) {
      for (let dz = -ringRadius; dz <= ringRadius; dz += 1) {
        const tx = centerTx + dx;
        const tz = centerTz + dz;
        if (!isTileWithinRegion(tx, tz, this.regionSizeKm)) continue;

        const key = makeTileKey(this.bodyId, tx, tz);
        desiredKeys.add(key);

        const distPlayer = Math.hypot(dx, dz);
        const distAhead = Math.hypot(tx - aheadTx, tz - aheadTz);
        const priority = distPlayer * 0.7 + distAhead * 0.45;
        const lod = this.resolveLod(dx, dz, distAhead);

        const existingPayload = this.loadedTiles.get(key) ?? this.provider.getCachedTile(tx, tz);
        if (existingPayload) {
          this.loadedTiles.delete(key);
          this.loadedTiles.set(key, existingPayload);

          const bounds = tileBoundsFromIndex(tx, tz);
          const prevActive = this.activeChunks.get(key);
          if (!prevActive || prevActive.lod !== lod) {
            activeChanged = true;
          }
          nextActive.set(key, {
            payload: existingPayload,
            lod,
            distanceTiles: distPlayer,
            centerX: bounds.centerX,
            centerZ: bounds.centerZ,
          });
        } else {
          missingJobs.push({ tx, tz, key, priority });
        }
      }
    }

    if (nextActive.size !== this.activeChunks.size) {
      activeChanged = true;
    } else {
      for (const k of this.activeChunks.keys()) {
        if (!nextActive.has(k)) {
          activeChanged = true;
          break;
        }
      }
    }

    if (activeChanged) {
      this.activeChunks.clear();
      for (const [k, v] of nextActive.entries()) {
        this.activeChunks.set(k, v);
      }
      this.versionCounter += 1;
    }

    // Cancel pending jobs no longer in the active desired window
    for (const [key, job] of this.pendingByKey.entries()) {
      if (!desiredKeys.has(key)) {
        this.cancelJob(job);
      }
    }

    // Prioritize nearest & lookahead chunks first
    missingJobs.sort((a, b) => a.priority - b.priority);

    // Ensure center tile under player is always built synchronously if somehow missing
    const centerKey = makeTileKey(this.bodyId, centerTx, centerTz);
    if (!this.loadedTiles.has(centerKey) && isTileWithinRegion(centerTx, centerTz, this.regionSizeKm)) {
      const syncTile = this.provider.getOrBuildTileSync(centerTx, centerTz);
      this.loadedTiles.set(centerKey, syncTile);
      const bounds = tileBoundsFromIndex(centerTx, centerTz);
      this.activeChunks.set(centerKey, {
        payload: syncTile,
        lod: 0,
        distanceTiles: 0,
        centerX: bounds.centerX,
        centerZ: bounds.centerZ,
      });
      this.versionCounter += 1;
    }

    // Dispatch missing tiles via worker (or bounded sync batch when worker unavailable)
    let syncFallbackCount = 0;
    for (const req of missingJobs) {
      if (this.loadedTiles.has(req.key) || this.pendingByKey.has(req.key)) continue;

      if (this.workerAvailable && this.worker) {
        if (this.pendingByKey.size >= 8) break;
        const requestId = this.nextRequestId++;
        const job: PendingJob = {
          requestId,
          key: req.key,
          bodyId: this.bodyId,
          tx: req.tx,
          tz: req.tz,
          priority: req.priority,
        };
        this.pendingByKey.set(req.key, job);
        this.pendingById.set(requestId, job);
        const msg: TerrainWorkerBuildRequest = {
          type: 'build',
          requestId,
          bodyId: this.bodyId,
          tx: req.tx,
          tz: req.tz,
          segments: BASE_TILE_SEGMENTS,
        };
        this.worker.postMessage(msg);
      } else {
        if (syncFallbackCount >= 6) break;
        syncFallbackCount += 1;
        const payload = this.provider.getOrBuildTileSync(req.tx, req.tz);
        this.loadedTiles.set(req.key, payload);
        const bounds = tileBoundsFromIndex(req.tx, req.tz);
        const dx = req.tx - centerTx;
        const dz = req.tz - centerTz;
        const distPlayer = Math.hypot(dx, dz);
        const distAhead = Math.hypot(req.tx - aheadTx, req.tz - aheadTz);
        this.activeChunks.set(req.key, {
          payload,
          lod: this.resolveLod(dx, dz, distAhead),
          distanceTiles: distPlayer,
          centerX: bounds.centerX,
          centerZ: bounds.centerZ,
        });
        this.versionCounter += 1;
      }
    }

    // Bounded LRU eviction keeping generous headroom beyond visible ring
    const maxCached = this.qualityTier === 'low' ? 36 : this.qualityTier === 'medium' ? 64 : 96;
    while (this.loadedTiles.size > maxCached) {
      const oldestKey = this.loadedTiles.keys().next().value;
      if (!oldestKey) break;
      if (this.activeChunks.has(oldestKey)) {
        // Move active key to end rather than evicting while still rendered
        const val = this.loadedTiles.get(oldestKey)!;
        this.loadedTiles.delete(oldestKey);
        this.loadedTiles.set(oldestKey, val);
        if (this.loadedTiles.size <= this.activeChunks.size + 4) break;
        continue;
      }
      this.loadedTiles.delete(oldestKey);
    }
  }

  private handleWorkerResult(res: TerrainWorkerResult): void {
    const pending = this.pendingById.get(res.requestId);
    if (!pending) return;
    this.pendingById.delete(res.requestId);
    this.pendingByKey.delete(pending.key);

    if (res.bodyId !== this.bodyId) return;

    const payload: TerrainTilePayload = {
      key: res.key,
      bodyId: res.bodyId,
      tx: res.tx,
      tz: res.tz,
      minX: res.minX,
      maxX: res.maxX,
      minZ: res.minZ,
      maxZ: res.maxZ,
      segments: res.segments,
      heights: new Float32Array(res.heightsBuffer),
      minHeight: res.minHeight,
      maxHeight: res.maxHeight,
      rocks: res.rocks,
    };

    this.provider.putTile(payload);
    this.loadedTiles.set(payload.key, payload);
    this.versionCounter += 1;
  }

  private cancelJob(job: PendingJob): void {
    this.pendingByKey.delete(job.key);
    this.pendingById.delete(job.requestId);
    if (this.worker && this.workerAvailable) {
      const cancelMsg: TerrainWorkerCancelRequest = {
        type: 'cancel',
        requestId: job.requestId,
      };
      this.worker.postMessage(cancelMsg);
    }
  }

  public cancelAll(): void {
    for (const job of Array.from(this.pendingByKey.values())) {
      this.cancelJob(job);
    }
  }

  public dispose(): void {
    this.cancelAll();
    this.worker?.terminate();
    this.worker = null;
    this.workerAvailable = false;
    this.loadedTiles.clear();
    this.activeChunks.clear();
  }
}
