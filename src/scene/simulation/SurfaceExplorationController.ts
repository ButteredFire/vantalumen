import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type {
  BodyPhysicsConfig,
  DeviceSimulationProfile,
} from '../../types/cosmos.types';
import type { VehicleInputState, VehiclePoseState } from './RoverController';

const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _fwd = new THREE.Vector3(0, 0, -1);
const _right = new THREE.Vector3(1, 0, 0);
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Controller for stationary landers and lunar/Martian science equipment.
 * Remains stationary by default at true deployed terrain pose; only moves when
 * the user explicitly enables "Di chuyển giả lập" exploration mode.
 */
export class SurfaceExplorationController {
  private readonly rapier: typeof RAPIER;
  private readonly world: RAPIER.World;
  private readonly profile: DeviceSimulationProfile;
  private readonly bodyPhysics: BodyPhysicsConfig;
  public readonly body: RAPIER.RigidBody;
  public readonly collider: RAPIER.Collider;
  public readonly pose: VehiclePoseState;
  private lastStableGlobalPos = new THREE.Vector3();
  private lastStableYaw = 0;

  constructor(
    rapier: typeof RAPIER,
    world: RAPIER.World,
    profile: DeviceSimulationProfile,
    bodyPhysics: BodyPhysicsConfig,
    initialLocalPos: THREE.Vector3,
    initialGlobalPos: THREE.Vector3,
    initialYawRad = 0,
  ) {
    this.rapier = rapier;
    this.world = world;
    this.profile = profile;
    this.bodyPhysics = bodyPhysics;

    const rig = profile.wheelRig;
    const initQuat = new THREE.Quaternion().setFromAxisAngle(_up, initialYawRad);
    const desc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(initialLocalPos.x, initialLocalPos.y, initialLocalPos.z)
      .setRotation({ x: initQuat.x, y: initQuat.y, z: initQuat.z, w: initQuat.w })
      .setLinearDamping(1.8)
      .setAngularDamping(3.8)
      .setCanSleep(false);

    this.body = world.createRigidBody(desc);

    const [hx, hy, hz] = rig.chassisBoxHalfExtentsM;
    this.collider = world.createCollider(
      rapier.ColliderDesc.cuboid(hx, hy, hz)
        .setMass(rig.chassisMassKg)
        .setFriction(bodyPhysics.surfaceFriction)
        .setRestitution(0.01),
      this.body,
    );

    this.lastStableGlobalPos.copy(initialGlobalPos);
    this.lastStableYaw = initialYawRad;

    this.pose = {
      localPos: initialLocalPos.clone(),
      prevLocalPos: initialLocalPos.clone(),
      quat: initQuat.clone(),
      prevQuat: initQuat.clone(),
      speedMs: 0,
      signedForwardSpeedMs: 0,
      pitchDeg: 0,
      rollDeg: 0,
      headingDeg: ((-initialYawRad * 180) / Math.PI + 360) % 360,
      wheelsGroundedCount: 4,
      totalWheels: 4,
      slipRatio: 0,
      stabilityWarning: 'none',
      wheels: [],
      rockerLeftPitchRad: 0,
      rockerRightPitchRad: 0,
      bogieLeftPitchRad: 0,
      bogieRightPitchRad: 0,
    };
  }

  public shiftOrigin(deltaLocal: THREE.Vector3): void {
    const t = this.body.translation();
    this.body.setTranslation(
      { x: t.x - deltaLocal.x, y: t.y - deltaLocal.y, z: t.z - deltaLocal.z },
      true,
    );
    this.pose.localPos.sub(deltaLocal);
    this.pose.prevLocalPos.sub(deltaLocal);
  }

  public teleport(localPos: THREE.Vector3, yawRad: number): void {
    const q = new THREE.Quaternion().setFromAxisAngle(_up, yawRad);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.body.setTranslation({ x: localPos.x, y: localPos.y, z: localPos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.pose.localPos.copy(localPos);
    this.pose.prevLocalPos.copy(localPos);
    this.pose.quat.copy(q);
    this.pose.prevQuat.copy(q);
  }

  public getLastStableCheckpoint(): { globalPos: THREE.Vector3; yawRad: number } {
    return {
      globalPos: this.lastStableGlobalPos.clone(),
      yawRad: this.lastStableYaw,
    };
  }

  public step(
    dt: number,
    input: VehicleInputState,
    originOffset: THREE.Vector3,
    simulatedDriveEnabled: boolean,
    forceSafetyBrake = false,
  ): void {
    this.pose.prevLocalPos.copy(this.pose.localPos);
    this.pose.prevQuat.copy(this.pose.quat);
    // Prevent leftover drive forces after disabling simulated surface locomotion
    this.body.resetForces(false);
    this.body.resetTorques(false);

    const t = this.body.translation();
    const r = this.body.rotation();
    this.pose.localPos.set(t.x, t.y, t.z);
    this.pose.quat.set(r.x, r.y, r.z, r.w);

    const linVelRaw = this.body.linvel();
    const linVel = new THREE.Vector3(linVelRaw.x, linVelRaw.y, linVelRaw.z);
    const fwd = _fwd.clone().applyQuaternion(this.pose.quat).normalize();
    const right = _right.clone().applyQuaternion(this.pose.quat).normalize();
    const up = _up.clone().applyQuaternion(this.pose.quat).normalize();

    const ray = new this.rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: _down.x, y: _down.y, z: _down.z });
    const hit = this.world.castRayAndGetNormal(ray, 3.0, true, undefined, undefined, undefined, this.body);
    const grounded = Boolean(hit && hit.timeOfImpact <= this.profile.wheelRig.chassisBoxHalfExtentsM[1] + 0.35);

    const isSimulatedMoving = simulatedDriveEnabled && grounded && !forceSafetyBrake && !input.brake;
    this.collider.setFriction(isSimulatedMoving ? 0.05 : this.bodyPhysics.surfaceFriction);

    if (isSimulatedMoving) {
      const targetSpeed =
        input.throttle >= 0
          ? input.throttle * this.profile.maxSpeedMs
          : input.throttle * this.profile.reverseSpeedMs;

      const curFwdSpeed = linVel.dot(fwd);
      const speedErr = targetSpeed - curFwdSpeed;
      const mass = this.profile.wheelRig.chassisMassKg;
      const driveForce = fwd.clone().multiplyScalar(speedErr * mass * 4.5);

      const curLatSpeed = linVel.dot(right);
      const latStabilize = right.clone().multiplyScalar(-curLatSpeed * mass * 3.8);

      this.body.addForce(
        {
          x: driveForce.x + latStabilize.x,
          y: 0,
          z: driveForce.z + latStabilize.z,
        },
        false,
      );

      if (Math.abs(input.steer) > 0.02) {
        const ang = this.body.angvel();
        const yawTarget = input.steer * 0.7;
        const torque = (yawTarget - ang.y) * mass * 1.4;
        this.body.applyTorqueImpulse({ x: 0, y: torque * dt, z: 0 }, false);
      }
    } else if (grounded) {
      // Hold anchored in stationary lander mode (zero drift)
      this.body.setLinvel({ x: 0, y: Math.min(0, linVel.y), z: 0 }, false);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    }

    this.body.wakeUp();
    const vel = this.body.linvel();
    this.pose.speedMs = Math.hypot(vel.x, vel.z);
    this.pose.signedForwardSpeedMs = new THREE.Vector3(vel.x, 0, vel.z).dot(fwd);
    this.pose.wheelsGroundedCount = grounded ? 4 : 0;
    this.pose.pitchDeg = (Math.asin(Math.max(-1, Math.min(1, fwd.y))) * 180) / Math.PI;
    this.pose.rollDeg = (Math.asin(Math.max(-1, Math.min(1, -right.y))) * 180) / Math.PI;

    _euler.setFromQuaternion(this.pose.quat, 'YXZ');
    this.pose.headingDeg = ((-_euler.y * 180) / Math.PI + 360) % 360;

    const tiltDeg = Math.hypot(this.pose.pitchDeg, this.pose.rollDeg);
    this.pose.stabilityWarning =
      up.y < 0.7 || tiltDeg >= 38
        ? 'tip_over'
        : tiltDeg >= this.profile.maxClimbSlopeDeg
          ? 'steep_slope'
          : 'none';

    if (grounded && tiltDeg < 15 && this.pose.speedMs < 1.5) {
      const globalPos = this.pose.localPos.clone().add(originOffset);
      if (globalPos.distanceToSquared(this.lastStableGlobalPos) >= 16) {
        this.lastStableGlobalPos.copy(globalPos);
        this.lastStableYaw = _euler.y;
      }
    }

    void this.bodyPhysics;
  }

  public dispose(): void {
    this.world.removeRigidBody(this.body);
  }
}
