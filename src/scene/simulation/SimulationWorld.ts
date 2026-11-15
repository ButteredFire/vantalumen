import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getBodyPhysicsConfig } from '../../config/bodyPhysicsConfig';
import type {
  BodyId,
  BodyPhysicsConfig,
  CameraMountMode,
  DeviceSimulationProfile,
  ExplorationRegionSizeKm,
  ResolvedQualityTier,
  SimulationCheckpoint,
  SurfaceTelemetrySnapshot,
} from '../../types/cosmos.types';
import { ChunkManager } from '../terrain/ChunkManager';
import { TerrainColliderManager } from '../terrain/TerrainCollider';
import { TerrainProvider } from '../terrain/TerrainProvider';
import { FlightController } from './FlightController';
import {
  RoverController,
  type VehicleInputState,
  type VehiclePoseState,
} from './RoverController';
import {
  FIXED_PHYSICS_DT,
  MAX_PHYSICS_STEPS_PER_FRAME,
  clampFrameDelta,
} from './SimulationClock';
import { SurfaceExplorationController } from './SurfaceExplorationController';

let rapierPromise: Promise<typeof RAPIER> | null = null;

export async function ensureRapierInitialized(): Promise<typeof RAPIER> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (mod) => {
      const api = (mod.default ?? mod) as unknown as typeof RAPIER;
      await api.init();
      return api;
    });
  }
  return rapierPromise;
}

export interface WheelTrackStamp {
  leftGlobal: THREE.Vector3;
  rightGlobal: THREE.Vector3;
  yawRad: number;
}

export interface SimulationRenderSnapshot {
  localPos: THREE.Vector3;
  globalPos: THREE.Vector3;
  originOffset: THREE.Vector3;
  quat: THREE.Quaternion;
  pose: VehiclePoseState;
  airborne: boolean;
  rotorSpinAngleRad: number;
  isStreamingColliderHold: boolean;
  alpha: number;
}

const MAX_TRAIL_POINTS = 180;
const MAX_TRACK_STAMPS = 360;
const ORIGIN_REBASE_THRESHOLD_M = 1000;

export function createInitialInputState(): VehicleInputState {
  return { throttle: 0, steer: 0, brake: false, ascend: 0 };
}

/**
 * Self-contained fixed-60Hz surface physics simulation runtime combining Rapier,
 * ChunkManager terrain streaming, dynamic collider management, 1km floating-origin
 * rebasing, bounded wheel-track & trail buffers, and recovery checkpoints.
 */
export class SimulationWorld {
  public readonly bodyId: BodyId;
  public readonly deviceId: string;
  public readonly profile: DeviceSimulationProfile;
  public readonly bodyPhysics: BodyPhysicsConfig;
  public readonly rapier: typeof RAPIER;
  public readonly world: RAPIER.World;
  public readonly provider: TerrainProvider;
  public readonly chunkManager: ChunkManager;
  public readonly colliderManager: TerrainColliderManager;

  public controller: RoverController | FlightController | SurfaceExplorationController;
  public originOffset = new THREE.Vector3(0, 0, 0);
  public originShiftCount = 0;
  public distanceTraveledM = 0;
  public readonly trailPoints: Array<{ x: number; z: number }> = [];
  public readonly trackStamps: WheelTrackStamp[] = [];

  private accumulator = 0;
  private lastGlobalPos = new THREE.Vector3();
  private lastTrailRecordPos = new THREE.Vector3();
  private lastTrackRecordPos = new THREE.Vector3();
  private streamingColliderHold = false;
  private boundaryLimited = false;
  private disposed = false;

  public static async create(params: {
    bodyId: BodyId;
    deviceId: string;
    profile: DeviceSimulationProfile;
    regionSizeKm: ExplorationRegionSizeKm;
    qualityTier: ResolvedQualityTier;
    checkpoint?: SimulationCheckpoint | null;
    enableWorker?: boolean;
  }): Promise<SimulationWorld> {
    const rapier = await ensureRapierInitialized();
    return new SimulationWorld(rapier, params);
  }

  private constructor(
    rapier: typeof RAPIER,
    params: {
      bodyId: BodyId;
      deviceId: string;
      profile: DeviceSimulationProfile;
      regionSizeKm: ExplorationRegionSizeKm;
      qualityTier: ResolvedQualityTier;
      checkpoint?: SimulationCheckpoint | null;
      enableWorker?: boolean;
    },
  ) {
    this.rapier = rapier;
    this.bodyId = params.bodyId;
    this.deviceId = params.deviceId;
    this.profile = params.profile;
    this.bodyPhysics = getBodyPhysicsConfig(params.bodyId);

    this.world = new rapier.World({ x: 0, y: -this.bodyPhysics.gravityMs2, z: 0 });
    this.world.integrationParameters.dt = FIXED_PHYSICS_DT;

    this.provider = new TerrainProvider(params.bodyId);
    this.chunkManager = new ChunkManager(
      params.bodyId,
      params.regionSizeKm,
      params.qualityTier,
      this.provider,
      params.enableWorker ?? true,
    );
    this.colliderManager = new TerrainColliderManager(
      rapier,
      this.world,
      this.bodyPhysics.surfaceFriction,
    );

    // Resolve initial global coordinates (clamp checkpoint safely inside current region)
    const halfLimit = Math.max(20, this.chunkManager.getRegionRadiusM() - 16);
    const cp = params.checkpoint;
    const startX = cp ? THREE.MathUtils.clamp(cp.globalPos[0], -halfLimit, halfLimit) : 0;
    const startZ = cp ? THREE.MathUtils.clamp(cp.globalPos[2], -halfLimit, halfLimit) : 0;
    const startYaw = cp ? cp.yawRad : 0;
    this.distanceTraveledM = cp ? cp.odometerM : 0;

    // Snap initial origin to nearest 1 km block so distant checkpoints spawn with sub-mm precision
    this.originOffset.set(
      Math.round(startX / ORIGIN_REBASE_THRESHOLD_M) * ORIGIN_REBASE_THRESHOLD_M,
      0,
      Math.round(startZ / ORIGIN_REBASE_THRESHOLD_M) * ORIGIN_REBASE_THRESHOLD_M,
    );

    this.chunkManager.primeImmediateNeighborhood(startX, startZ);
    const groundY = this.provider.sampleExactGridHeightAt(startX, startZ);
    this.originOffset.y = Math.round(groundY);
    this.colliderManager.setOrigin(this.originOffset.x, this.originOffset.y, this.originOffset.z);
    this.colliderManager.syncActiveTiles(startX, startZ, 0, this.chunkManager.getLoadedTilesMap(), 1);
    // Sync Rapier's query pipeline before the first raycast tick so wheel contact registers on tick 1
    this.syncQueryPipeline();

    const spawnGlobalY = this.computeSpawnY(groundY);
    const globalPos = new THREE.Vector3(startX, spawnGlobalY, startZ);
    const localPos = globalPos.clone().sub(this.originOffset);

    this.controller = this.buildController(localPos, globalPos, startYaw);
    this.lastGlobalPos.copy(globalPos);
    this.lastTrailRecordPos.copy(globalPos);
    this.lastTrackRecordPos.copy(globalPos);
    this.trailPoints.push({ x: globalPos.x, z: globalPos.z });
  }

  private syncQueryPipeline(): void {
    const prevDt = this.world.timestep;
    this.world.timestep = 0;
    this.world.step();
    this.world.timestep = prevDt;
  }

  private computeSpawnY(groundY: number): number {
    const rig = this.profile.wheelRig;
    if (this.profile.mobilityKind === 'rover_6w' || this.profile.mobilityKind === 'rover_4w') {
      const hy = rig.chassisBoxHalfExtentsM[1];
      const eqComp = Math.min(
        rig.suspensionRestLengthM * 0.65,
        (rig.chassisMassKg * this.bodyPhysics.gravityMs2) /
          Math.max(1, rig.wheelCount * Math.max(100, rig.suspensionStiffness)),
      );
      return groundY + hy * 0.45 + rig.suspensionRestLengthM + rig.wheelRadiusM - eqComp + 0.015;
    }
    if (this.profile.mobilityKind === 'helicopter') {
      return groundY + rig.chassisBoxHalfExtentsM[1] + 0.04;
    }
    return groundY + rig.chassisBoxHalfExtentsM[1] + 0.05;
  }

  private buildController(
    localPos: THREE.Vector3,
    globalPos: THREE.Vector3,
    yawRad: number,
  ): RoverController | FlightController | SurfaceExplorationController {
    if (this.profile.mobilityKind === 'helicopter') {
      return new FlightController(
        this.rapier,
        this.world,
        this.profile,
        this.bodyPhysics,
        localPos,
        globalPos,
        yawRad,
      );
    }
    if (this.profile.mobilityKind === 'lander_static') {
      return new SurfaceExplorationController(
        this.rapier,
        this.world,
        this.profile,
        this.bodyPhysics,
        localPos,
        globalPos,
        yawRad,
      );
    }
    return new RoverController(
      this.rapier,
      this.world,
      this.profile,
      this.bodyPhysics,
      localPos,
      globalPos,
      yawRad,
    );
  }

  public setRegionSizeKm(sizeKm: ExplorationRegionSizeKm): void {
    this.chunkManager.setRegionSizeKm(sizeKm);
    const halfLimit = Math.max(20, this.chunkManager.getRegionRadiusM() - 12);
    const globalPos = this.getCurrentGlobalPosition();
    if (Math.abs(globalPos.x) > halfLimit || Math.abs(globalPos.z) > halfLimit) {
      const clampedX = THREE.MathUtils.clamp(globalPos.x, -halfLimit, halfLimit);
      const clampedZ = THREE.MathUtils.clamp(globalPos.z, -halfLimit, halfLimit);
      this.teleportToGlobal(clampedX, clampedZ, 0);
    }
  }

  public setQualityTier(tier: ResolvedQualityTier): void {
    this.chunkManager.setQualityTier(tier);
  }

  public getCurrentGlobalPosition(): THREE.Vector3 {
    return this.controller.pose.localPos.clone().add(this.originOffset);
  }

  public teleportToGlobal(globalX: number, globalZ: number, yawRad = 0): void {
    if (this.disposed) return;
    const halfLimit = Math.max(20, this.chunkManager.getRegionRadiusM() - 12);
    const clampedX = THREE.MathUtils.clamp(globalX, -halfLimit, halfLimit);
    const clampedZ = THREE.MathUtils.clamp(globalZ, -halfLimit, halfLimit);

    this.chunkManager.primeImmediateNeighborhood(clampedX, clampedZ);
    const groundY = this.provider.sampleExactGridHeightAt(clampedX, clampedZ);

    // Rebase origin directly around teleport destination
    this.originOffset.set(
      Math.round(clampedX / ORIGIN_REBASE_THRESHOLD_M) * ORIGIN_REBASE_THRESHOLD_M,
      Math.round(groundY),
      Math.round(clampedZ / ORIGIN_REBASE_THRESHOLD_M) * ORIGIN_REBASE_THRESHOLD_M,
    );
    this.colliderManager.setOrigin(this.originOffset.x, this.originOffset.y, this.originOffset.z);
    this.colliderManager.syncActiveTiles(
      clampedX,
      clampedZ,
      0,
      this.chunkManager.getLoadedTilesMap(),
      1,
    );
    this.syncQueryPipeline();

    const spawnGlobalY = this.computeSpawnY(groundY);
    const localPos = new THREE.Vector3(
      clampedX - this.originOffset.x,
      spawnGlobalY - this.originOffset.y,
      clampedZ - this.originOffset.z,
    );
    this.controller.teleport(localPos, yawRad);
    this.lastGlobalPos.set(clampedX, spawnGlobalY, clampedZ);
    this.lastTrailRecordPos.set(clampedX, spawnGlobalY, clampedZ);
    this.lastTrackRecordPos.set(clampedX, spawnGlobalY, clampedZ);
    this.boundaryLimited = false;
  }

  public recoverToLastStablePose(): void {
    if (this.disposed) return;
    const stable = this.controller.getLastStableCheckpoint();
    const halfLimit = Math.max(20, this.chunkManager.getRegionRadiusM() - 16);
    const targetX = THREE.MathUtils.clamp(stable.globalPos.x, -halfLimit, halfLimit);
    const targetZ = THREE.MathUtils.clamp(stable.globalPos.z, -halfLimit, halfLimit);
    this.teleportToGlobal(targetX, targetZ, stable.yawRad);
  }

  public stepFixed(
    rawFrameDt: number,
    input: VehicleInputState,
    simulatedMobilityEnabled: boolean,
    isHidden = false,
  ): SimulationRenderSnapshot {
    if (this.disposed) {
      return this.buildRenderSnapshot(1);
    }

    const clampedDt = clampFrameDelta(rawFrameDt, isHidden);
    this.accumulator += clampedDt;
    let steps = 0;

    while (this.accumulator >= FIXED_PHYSICS_DT && steps < MAX_PHYSICS_STEPS_PER_FRAME) {
      this.stepSinglePhysicsTick(FIXED_PHYSICS_DT, input, simulatedMobilityEnabled);
      this.accumulator -= FIXED_PHYSICS_DT;
      steps += 1;
    }

    if (steps === MAX_PHYSICS_STEPS_PER_FRAME && this.accumulator > FIXED_PHYSICS_DT) {
      // Avoid spiral of death after sustained stalls
      this.accumulator = FIXED_PHYSICS_DT;
    }

    const alpha = Math.max(0, Math.min(1, this.accumulator / FIXED_PHYSICS_DT));
    return this.buildRenderSnapshot(alpha);
  }

  /**
   * Executes exactly one fixed 1/60s simulation tick (also callable directly by determinism tests).
   */
  public stepSinglePhysicsTick(
    dt: number,
    input: VehicleInputState,
    simulatedMobilityEnabled: boolean,
  ): void {
    const globalPos = this.getCurrentGlobalPosition();
    const body = this.getActiveBody();
    const vel = body.linvel();

    this.chunkManager.update(globalPos.x, globalPos.z, vel.x, vel.z);
    this.colliderManager.syncActiveTiles(
      globalPos.x,
      globalPos.z,
      Math.hypot(vel.x, vel.z),
      this.chunkManager.getLoadedTilesMap(),
      1,
    );

    // Check streaming safety look-ahead coverage
    const aheadX = globalPos.x + THREE.MathUtils.clamp(vel.x * 0.65, -18, 18);
    const aheadZ = globalPos.z + THREE.MathUtils.clamp(vel.z * 0.65, -18, 18);
    const coveredCurrent = this.colliderManager.isPointCovered(globalPos.x, globalPos.z, 0.5);
    const coveredAhead = this.colliderManager.isPointCovered(aheadX, aheadZ, 0.5);
    this.streamingColliderHold = !coveredCurrent || !coveredAhead;

    if (this.streamingColliderHold) {
      // Emergency synchronous prime if rover somehow outran async worker under current spot
      this.chunkManager.primeImmediateNeighborhood(globalPos.x, globalPos.z);
      this.colliderManager.syncActiveTiles(
        globalPos.x,
        globalPos.z,
        0,
        this.chunkManager.getLoadedTilesMap(),
        1,
      );
    }

    if (this.controller instanceof RoverController) {
      this.controller.step(dt, input, this.originOffset, this.streamingColliderHold);
    } else if (this.controller instanceof FlightController) {
      this.controller.step(dt, input, this.originOffset, this.streamingColliderHold);
    } else {
      this.controller.step(
        dt,
        input,
        this.originOffset,
        simulatedMobilityEnabled,
        this.streamingColliderHold,
      );
    }

    this.world.step();

    // Update pose translation/rotation immediately from solved Rapier body
    const postT = body.translation();
    const postR = body.rotation();
    this.controller.pose.localPos.set(postT.x, postT.y, postT.z);
    this.controller.pose.quat.set(postR.x, postR.y, postR.z, postR.w);

    // Enforce exploration region boundaries smoothly
    const nextGlobal = this.getCurrentGlobalPosition();
    const regionHalf = Math.max(20, this.chunkManager.getRegionRadiusM() - 10);
    let clamped = false;
    const clampedPos = nextGlobal.clone();
    if (Math.abs(nextGlobal.x) > regionHalf) {
      clampedPos.x = Math.sign(nextGlobal.x) * regionHalf;
      clamped = true;
    }
    if (Math.abs(nextGlobal.z) > regionHalf) {
      clampedPos.z = Math.sign(nextGlobal.z) * regionHalf;
      clamped = true;
    }
    this.boundaryLimited = clamped;
    if (clamped) {
      const localClamped = clampedPos.clone().sub(this.originOffset);
      body.setTranslation({ x: localClamped.x, y: postT.y, z: localClamped.z }, true);
      const curVel = body.linvel();
      body.setLinvel(
        {
          x: Math.abs(nextGlobal.x) > regionHalf ? 0 : curVel.x,
          y: curVel.y,
          z: Math.abs(nextGlobal.z) > regionHalf ? 0 : curVel.z,
        },
        true,
      );
      this.controller.pose.localPos.copy(localClamped);
    }

    // Distance traveled & wheel tracks & minimap trail
    const updatedGlobal = this.getCurrentGlobalPosition();
    const stepDist = Math.hypot(
      updatedGlobal.x - this.lastGlobalPos.x,
      updatedGlobal.z - this.lastGlobalPos.z,
    );
    if (stepDist > 0.0001 && stepDist < 20) {
      this.distanceTraveledM += stepDist;
    }
    this.lastGlobalPos.copy(updatedGlobal);

    if (
      Math.hypot(
        updatedGlobal.x - this.lastTrailRecordPos.x,
        updatedGlobal.z - this.lastTrailRecordPos.z,
      ) >= 3.0
    ) {
      this.lastTrailRecordPos.copy(updatedGlobal);
      this.trailPoints.push({ x: updatedGlobal.x, z: updatedGlobal.z });
      if (this.trailPoints.length > MAX_TRAIL_POINTS) {
        this.trailPoints.shift();
      }
    }

    const isAirborne = this.controller instanceof FlightController && this.controller.airborne;
    if (
      !isAirborne &&
      this.controller.pose.wheelsGroundedCount > 0 &&
      Math.hypot(
        updatedGlobal.x - this.lastTrackRecordPos.x,
        updatedGlobal.z - this.lastTrackRecordPos.z,
      ) >= 0.48
    ) {
      this.lastTrackRecordPos.copy(updatedGlobal);
      const halfTrack = this.profile.wheelRig.trackHalfWidthM;
      const rightDir = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(this.controller.pose.quat)
        .setY(0)
        .normalize();
      const groundL = this.provider.sampleHeightAt(
        updatedGlobal.x - rightDir.x * halfTrack,
        updatedGlobal.z - rightDir.z * halfTrack,
      );
      const groundR = this.provider.sampleHeightAt(
        updatedGlobal.x + rightDir.x * halfTrack,
        updatedGlobal.z + rightDir.z * halfTrack,
      );
      const yaw = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(this.controller.pose.quat).y;
      this.trackStamps.push({
        leftGlobal: new THREE.Vector3(
          updatedGlobal.x - rightDir.x * halfTrack,
          groundL + 0.02,
          updatedGlobal.z - rightDir.z * halfTrack,
        ),
        rightGlobal: new THREE.Vector3(
          updatedGlobal.x + rightDir.x * halfTrack,
          groundR + 0.02,
          updatedGlobal.z + rightDir.z * halfTrack,
        ),
        yawRad: yaw,
      });
      if (this.trackStamps.length > MAX_TRACK_STAMPS) {
        this.trackStamps.shift();
      }
    }

    // 1 km floating origin rebase across physics body, colliders, and chunk renderers
    const distFromOrigin = Math.hypot(
      this.controller.pose.localPos.x,
      this.controller.pose.localPos.z,
    );
    if (distFromOrigin >= ORIGIN_REBASE_THRESHOLD_M) {
      const snappedOrigin = new THREE.Vector3(
        Math.round(updatedGlobal.x / ORIGIN_REBASE_THRESHOLD_M) * ORIGIN_REBASE_THRESHOLD_M,
        Math.round(updatedGlobal.y),
        Math.round(updatedGlobal.z / ORIGIN_REBASE_THRESHOLD_M) * ORIGIN_REBASE_THRESHOLD_M,
      );
      const deltaOrigin = snappedOrigin.clone().sub(this.originOffset);
      if (deltaOrigin.lengthSq() > 1) {
        this.originOffset.copy(snappedOrigin);
        this.colliderManager.setOrigin(
          this.originOffset.x,
          this.originOffset.y,
          this.originOffset.z,
        );
        this.controller.shiftOrigin(deltaOrigin);
        this.originShiftCount += 1;
      }
    }
  }

  private getActiveBody(): RAPIER.RigidBody {
    if (this.controller instanceof RoverController) return this.controller.chassisBody;
    if (this.controller instanceof FlightController) return this.controller.body;
    return this.controller.body;
  }

  public buildRenderSnapshot(alpha: number): SimulationRenderSnapshot {
    const pose = this.controller.pose;
    const interpLocalPos = pose.prevLocalPos.clone().lerp(pose.localPos, alpha);
    const interpQuat = pose.prevQuat.clone().slerp(pose.quat, alpha);
    const airborne = this.controller instanceof FlightController && this.controller.airborne;
    const rotorSpinAngleRad =
      this.controller instanceof FlightController ? this.controller.rotorSpinAngleRad : 0;

    return {
      localPos: interpLocalPos,
      globalPos: interpLocalPos.clone().add(this.originOffset),
      originOffset: this.originOffset.clone(),
      quat: interpQuat,
      pose,
      airborne,
      rotorSpinAngleRad,
      isStreamingColliderHold: this.streamingColliderHold,
      alpha,
    };
  }

  public buildTelemetrySnapshot(
    cameraMount: CameraMountMode,
    pointerLocked: boolean,
    horizonStabilized: boolean,
    simulatedMobilityEnabled: boolean,
  ): SurfaceTelemetrySnapshot {
    const globalPos = this.getCurrentGlobalPosition();
    const groundY = this.provider.sampleHeightAt(globalPos.x, globalPos.z);
    const airborne = this.controller instanceof FlightController && this.controller.airborne;
    const altAboveGround =
      this.controller instanceof FlightController
        ? this.controller.altitudeAboveGroundM
        : Math.max(0, globalPos.y - groundY - this.profile.wheelRig.chassisBoxHalfExtentsM[1]);

    return {
      speedMs: Number(this.controller.pose.speedMs.toFixed(2)),
      headingDeg: Math.round(this.controller.pose.headingDeg),
      pitchDeg: Number(this.controller.pose.pitchDeg.toFixed(1)),
      rollDeg: Number(this.controller.pose.rollDeg.toFixed(1)),
      altitudeAboveGroundM: Number(altAboveGround.toFixed(2)),
      elevationM: Number(groundY.toFixed(1)),
      globalXM: Number(globalPos.x.toFixed(1)),
      globalYM: Number(globalPos.y.toFixed(1)),
      globalZM: Number(globalPos.z.toFixed(1)),
      distanceTraveledM: Number(this.distanceTraveledM.toFixed(1)),
      wheelsGroundedCount: this.controller.pose.wheelsGroundedCount,
      totalWheels: this.controller.pose.totalWheels,
      slipRatio: Number(this.controller.pose.slipRatio.toFixed(2)),
      stabilityWarning: this.boundaryLimited
        ? 'boundary_limit'
        : this.controller.pose.stabilityWarning,
      isStreamingColliderHold: this.streamingColliderHold,
      isSimulatedMobilityActive:
        this.profile.mobilityKind === 'lander_static' ? simulatedMobilityEnabled : true,
      isFlightAirborne: airborne,
      activeCameraMount: cameraMount,
      pointerLocked,
      horizonStabilized,
      trailPoints: [...this.trailPoints],
      activeChunkCount: this.chunkManager.getActiveChunks().length,
      originShiftCount: this.originShiftCount,
    };
  }

  public buildCheckpoint(regionSizeKm: ExplorationRegionSizeKm): SimulationCheckpoint {
    const globalPos = this.getCurrentGlobalPosition();
    const yaw = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(this.controller.pose.quat).y;
    return {
      deviceId: this.deviceId,
      bodyId: this.bodyId,
      regionSizeKm,
      globalPos: [globalPos.x, globalPos.y, globalPos.z],
      yawRad: yaw,
      odometerM: this.distanceTraveledM,
      timestampMs: Date.now(),
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.dispose();
    this.colliderManager.dispose();
    this.chunkManager.dispose();
    this.provider.clear();
    this.world.free();
  }
}
