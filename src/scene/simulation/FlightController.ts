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
 * Coaxial Mars helicopter physics controller (Ingenuity) with dynamic Rapier
 * landing collision, takeoff/hover/landing, vertical thrust ceiling, and aerodynamic drag.
 */
export class FlightController {
  private readonly rapier: typeof RAPIER;
  private readonly world: RAPIER.World;
  private readonly profile: DeviceSimulationProfile;
  private readonly bodyPhysics: BodyPhysicsConfig;
  public readonly body: RAPIER.RigidBody;
  public readonly collider: RAPIER.Collider;
  public readonly pose: VehiclePoseState;

  public airborne = false;
  public rotorSpinAngleRad = 0;
  public altitudeAboveGroundM = 0;
  private targetYawRad: number;
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
    this.targetYawRad = initialYawRad;

    const rig = profile.wheelRig;
    const initQuat = new THREE.Quaternion().setFromAxisAngle(_up, initialYawRad);
    const desc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(initialLocalPos.x, initialLocalPos.y, initialLocalPos.z)
      .setRotation({ x: initQuat.x, y: initQuat.y, z: initQuat.z, w: initQuat.w })
      .setLinearDamping(0.85)
      .setAngularDamping(3.5)
      .setCanSleep(false);

    this.body = world.createRigidBody(desc);

    const [hx, hy, hz] = rig.chassisBoxHalfExtentsM;
    this.collider = world.createCollider(
      rapier.ColliderDesc.cuboid(hx, hy, hz)
        .setMass(rig.chassisMassKg)
        .setFriction(bodyPhysics.surfaceFriction)
        .setRestitution(0.05),
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
    this.targetYawRad = yawRad;
    this.airborne = false;
    this.pose.localPos.copy(localPos);
    this.pose.prevLocalPos.copy(localPos);
    this.pose.quat.copy(q);
    this.pose.prevQuat.copy(q);
    this.pose.speedMs = 0;
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
    forceSafetyBrake = false,
  ): void {
    this.pose.prevLocalPos.copy(this.pose.localPos);
    this.pose.prevQuat.copy(this.pose.quat);
    // Clear previous tick user forces so landing disengages lift thrust immediately
    this.body.resetForces(false);
    this.body.resetTorques(false);

    const t = this.body.translation();
    this.pose.localPos.set(t.x, t.y, t.z);

    // Raycast directly downward for true radar/laser altimeter height above terrain
    const ray = new this.rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: _down.x, y: _down.y, z: _down.z });
    const hit = this.world.castRay(ray, 100, true, undefined, undefined, undefined, this.body);
    const halfY = this.profile.wheelRig.chassisBoxHalfExtentsM[1];
    this.altitudeAboveGroundM = hit ? Math.max(0, hit.timeOfImpact - halfY) : 0;

    if (input.ascend > 0.1 && !forceSafetyBrake) {
      this.airborne = true;
    } else if (this.altitudeAboveGroundM < 0.08 && input.ascend < -0.1) {
      this.airborne = false;
    }

    const mass = this.profile.wheelRig.chassisMassKg;
    const g = this.bodyPhysics.gravityMs2;
    const maxAlt = this.profile.flightMaxAltitudeM ?? 28;
    const linVelRaw = this.body.linvel();
    const linVel = new THREE.Vector3(linVelRaw.x, linVelRaw.y, linVelRaw.z);

    // Spin coaxial rotors whenever airborne or spooling up (keep monotonically increasing)
    const rotorRate = this.airborne ? 28.0 : 0;
    this.rotorSpinAngleRad += rotorRate * dt;

    this.targetYawRad += input.steer * 1.45 * dt;

    if (this.airborne) {
      const forward = _fwd.clone().applyAxisAngle(_up, this.targetYawRad);
      const right = _right.clone().applyAxisAngle(_up, this.targetYawRad);

      // Desired climb rate + soft altitude ceiling limiting
      let desiredVy = input.ascend * 3.4;
      if (forceSafetyBrake) {
        desiredVy = Math.max(-1.2, Math.min(0.4, (2.5 - this.altitudeAboveGroundM) * 0.8));
      } else if (this.altitudeAboveGroundM >= maxAlt && desiredVy > 0) {
        desiredVy = 0;
      }

      const fy = mass * (g + (desiredVy - linVel.y) * 5.2);
      const targetHorizSpeed = forceSafetyBrake ? 0 : input.throttle * (this.profile.flightMaxSpeedMs ?? 10);
      const desiredVx = forward.x * targetHorizSpeed;
      const desiredVz = forward.z * targetHorizSpeed;

      const fx = mass * (desiredVx - linVel.x) * 3.1;
      const fz = mass * (desiredVz - linVel.z) * 3.1;

      this.body.addForce({ x: fx, y: Math.max(0, fy), z: fz }, false);

      // Visual cyclic pitch/roll bank matching acceleration / wind trim
      const pitchBank = THREE.MathUtils.clamp(-linVel.dot(forward) * 0.045, -0.26, 0.26);
      const rollBank = THREE.MathUtils.clamp(-input.steer * 0.16, -0.24, 0.24);
      const desiredQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pitchBank, this.targetYawRad, rollBank, 'YXZ'),
      );
      this.body.setRotation(
        { x: desiredQuat.x, y: desiredQuat.y, z: desiredQuat.z, w: desiredQuat.w },
        false,
      );
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, false);

      this.pose.quat.copy(desiredQuat);
      this.pose.pitchDeg = (pitchBank * 180) / Math.PI;
      this.pose.rollDeg = (rollBank * 180) / Math.PI;
      this.pose.wheelsGroundedCount = 0;
      const nextVel = this.body.linvel();
      this.pose.speedMs = Math.hypot(nextVel.x, nextVel.z);
      this.pose.signedForwardSpeedMs = new THREE.Vector3(nextVel.x, 0, nextVel.z).dot(forward);
      void right;
    } else {
      // Grounded on skids: stabilize upright gently while touching terrain
      const desiredQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, this.targetYawRad, 0, 'YXZ'),
      );
      const r = this.body.rotation();
      const qCur = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      qCur.slerp(desiredQuat, Math.min(1, dt * 6));
      this.body.setRotation({ x: qCur.x, y: qCur.y, z: qCur.z, w: qCur.w }, false);
      this.pose.quat.copy(qCur);
      this.pose.wheelsGroundedCount = this.altitudeAboveGroundM < 0.15 ? 4 : 0;
      this.pose.speedMs = Math.hypot(linVel.x, linVel.z);
      this.pose.signedForwardSpeedMs = 0;
      this.pose.pitchDeg = 0;
      this.pose.rollDeg = 0;

      if (this.altitudeAboveGroundM < 0.2 && this.pose.speedMs < 0.5) {
        this.lastStableGlobalPos.copy(this.pose.localPos).add(originOffset);
        this.lastStableYaw = this.targetYawRad;
      }
    }

    this.body.wakeUp();
    _euler.setFromQuaternion(this.pose.quat, 'YXZ');
    this.pose.headingDeg = ((-_euler.y * 180) / Math.PI + 360) % 360;
    this.pose.stabilityWarning = 'none';
  }

  public dispose(): void {
    this.world.removeRigidBody(this.body);
  }
}
