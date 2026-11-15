import type RAPIER from '@dimforge/rapier3d-compat';
import {
  TILE_SIZE_M,
  tileIndexFromWorldM,
  type TerrainRockSpec,
  type TerrainTilePayload,
} from './terrainDataPipeline';

interface ColliderTileEntry {
  key: string;
  tx: number;
  tz: number;
  centerX: number;
  centerZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  heightfieldCollider: RAPIER.Collider;
  rockColliders: Array<{ collider: RAPIER.Collider; spec: TerrainRockSpec }>;
}

/**
 * Manages Rapier heightfield & rock fixed colliders in local floating-origin coordinates.
 * Holds active colliders alive until replacement chunks finish building and exposes
 * dynamic coverage checks so vehicles engage safety braking if streaming stalls.
 */
export class TerrainColliderManager {
  private readonly rapier: typeof RAPIER;
  private readonly world: RAPIER.World;
  private readonly surfaceFriction: number;
  private readonly tiles = new Map<string, ColliderTileEntry>();
  private originX = 0;
  private originY = 0;
  private originZ = 0;
  private activeRadiusM = 128;

  constructor(rapier: typeof RAPIER, world: RAPIER.World, surfaceFriction = 0.85) {
    this.rapier = rapier;
    this.world = world;
    this.surfaceFriction = surfaceFriction;
  }

  public setOrigin(originX: number, originY: number, originZ: number): void {
    this.originX = originX;
    this.originY = originY;
    this.originZ = originZ;
    for (const entry of this.tiles.values()) {
      entry.heightfieldCollider.setTranslation({
        x: entry.centerX - originX,
        y: -originY,
        z: entry.centerZ - originZ,
      });
      for (const item of entry.rockColliders) {
        item.collider.setTranslation({
          x: item.spec.globalX - originX,
          y: item.spec.globalY - originY,
          z: item.spec.globalZ - originZ,
        });
      }
    }
  }

  /**
   * Computes adaptive collider load radius (64 m stationary -> 128 m at higher speeds).
   */
  public computeTargetRadiusM(speedMs: number): number {
    return Math.max(64, Math.min(128, 68 + Math.abs(speedMs) * 14));
  }

  public syncActiveTiles(
    centerGlobalX: number,
    centerGlobalZ: number,
    speedMs: number,
    availableTiles: Map<string, TerrainTilePayload>,
    maxTileIndexRadius = 1,
  ): void {
    this.activeRadiusM = this.computeTargetRadiusM(speedMs);
    const { tx: centerTx, tz: centerTz } = tileIndexFromWorldM(centerGlobalX, centerGlobalZ);

    const desiredKeys = new Set<string>();
    for (let dx = -maxTileIndexRadius; dx <= maxTileIndexRadius; dx += 1) {
      for (let dz = -maxTileIndexRadius; dz <= maxTileIndexRadius; dz += 1) {
        const tx = centerTx + dx;
        const tz = centerTz + dz;
        // Include tiles overlapping the dynamic radius (up to 128 m) around player
        const tileCenterX = tx * TILE_SIZE_M;
        const tileCenterZ = tz * TILE_SIZE_M;
        const edgeDistX = Math.max(0, Math.abs(centerGlobalX - tileCenterX) - TILE_SIZE_M / 2);
        const edgeDistZ = Math.max(0, Math.abs(centerGlobalZ - tileCenterZ) - TILE_SIZE_M / 2);
        if (Math.hypot(edgeDistX, edgeDistZ) <= this.activeRadiusM + 32 || (dx === 0 && dz === 0)) {
          // Wait until payload is ready before registering/replacing collider
          const match = Array.from(availableTiles.values()).find(
            (tile) => tile.tx === tx && tile.tz === tz,
          );
          if (match) {
            desiredKeys.add(match.key);
            if (!this.tiles.has(match.key)) {
              this.mountTileCollider(match);
            }
          }
        }
      }
    }

    // Hold old colliders until desired nearby colliders exist; only remove distant tiles (> 1.6 * tile size away)
    for (const [key, entry] of this.tiles.entries()) {
      if (desiredKeys.has(key)) continue;
      const dist = Math.hypot(centerGlobalX - entry.centerX, centerGlobalZ - entry.centerZ);
      if (dist > TILE_SIZE_M * 1.85) {
        this.unmountTileCollider(key);
      }
    }
  }

  public mountTileCollider(payload: TerrainTilePayload): void {
    if (this.tiles.has(payload.key)) return;
    const centerX = (payload.minX + payload.maxX) * 0.5;
    const centerZ = (payload.minZ + payload.maxZ) * 0.5;

    const hfDesc = this.rapier.ColliderDesc.heightfield(
      payload.segments,
      payload.segments,
      payload.heights,
      { x: TILE_SIZE_M, y: 1.0, z: TILE_SIZE_M },
    )
      .setTranslation(centerX - this.originX, -this.originY, centerZ - this.originZ)
      .setFriction(this.surfaceFriction)
      .setRestitution(0.02);

    const heightfieldCollider = this.world.createCollider(hfDesc);
    const rockColliders: Array<{ collider: RAPIER.Collider; spec: TerrainRockSpec }> = [];

    for (const rock of payload.rocks) {
      if (!rock.collidable) continue;
      const desc =
        rock.shape === 'slab'
          ? this.rapier.ColliderDesc.cuboid(
              rock.scaleX * 0.5,
              rock.scaleY * 0.5,
              rock.scaleZ * 0.5,
            )
          : this.rapier.ColliderDesc.ball(Math.max(0.12, rock.scaleY * 0.72));

      desc
        .setTranslation(
          rock.globalX - this.originX,
          rock.globalY - this.originY,
          rock.globalZ - this.originZ,
        )
        .setRotation({ x: 0, y: Math.sin(rock.rotY * 0.5), z: 0, w: Math.cos(rock.rotY * 0.5) })
        .setFriction(this.surfaceFriction * 0.92)
        .setRestitution(0.05);

      rockColliders.push({
        collider: this.world.createCollider(desc),
        spec: rock,
      });
    }

    this.tiles.set(payload.key, {
      key: payload.key,
      tx: payload.tx,
      tz: payload.tz,
      centerX,
      centerZ,
      minX: payload.minX,
      maxX: payload.maxX,
      minZ: payload.minZ,
      maxZ: payload.maxZ,
      heightfieldCollider,
      rockColliders,
    });
  }

  public isPointCovered(globalX: number, globalZ: number, marginM = 2.5): boolean {
    for (const entry of this.tiles.values()) {
      if (
        globalX >= entry.minX + marginM &&
        globalX <= entry.maxX - marginM &&
        globalZ >= entry.minZ + marginM &&
        globalZ <= entry.maxZ - marginM
      ) {
        return true;
      }
      // If right on tile boundary, verify both tiles containing/bordering point or within interior
      if (
        globalX >= entry.minX &&
        globalX <= entry.maxX &&
        globalZ >= entry.minZ &&
        globalZ <= entry.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  public isColliderHandleTerrainOrRock(handle: number): boolean {
    for (const entry of this.tiles.values()) {
      if (entry.heightfieldCollider.handle === handle) return true;
      for (const r of entry.rockColliders) {
        if (r.collider.handle === handle) return true;
      }
    }
    return false;
  }

  public getMountedCount(): number {
    return this.tiles.size;
  }

  public unmountTileCollider(key: string): void {
    const entry = this.tiles.get(key);
    if (!entry) return;
    this.world.removeCollider(entry.heightfieldCollider, true);
    for (const item of entry.rockColliders) {
      this.world.removeCollider(item.collider, true);
    }
    this.tiles.delete(key);
  }

  public dispose(): void {
    for (const key of Array.from(this.tiles.keys())) {
      this.unmountTileCollider(key);
    }
  }
}
