import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type {
  BodyPhysicsConfig,
  DeviceSimulationProfile,
  StabilityWarningKind,
} from '../../types/cosmos.types';

export interface VehicleInputState {
  throttle: number; // -1..+1 (W=+1 forward, S=-1 reverse)
  steer: number; // -1..+1 (A=+1 left, D=-1 right)
  brake: boolean;
  ascend: number; // -1..+1 (Helicopter vertical input)
}

export interface WheelRuntimeSample {
  name: string;
  localAnchor: THREE.Vector3;
  steerableSign: number; // +1 front steer, -1 rear counter-steer, 0 middle
  isLeft: boolean;
  axleIndex: 0 | 1 | 2;
  grounded: boolean;
  compressionM: number;
  spinAngleRad: number;
  steerAngleRad: number;
  contactGlobalY: number;
}

export interface VehiclePoseState {
  localPos: THREE.Vector3;
  prevLocalPos: THREE.Vector3;
  quat: THREE.Quaternion;
  prevQuat: THREE.Quaternion;
  speedMs: number;
  signedForwardSpeedMs: number;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  wheelsGroundedCount: number;
  totalWheels: number;
  slipRatio: number;
  stabilityWarning: StabilityWarningKind;
  wheels: WheelRuntimeSample[];
  rockerLeftPitchRad: number;
  rockerRightPitchRad: number;
  bogieLeftPitchRad: number;
  bogieRightPitchRad: number;
}

const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _fwd = new THREE.Vector3(0, 0, -1);
const _right = new THREE.Vector3(1, 0, 0);
const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpV3 = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Dynamic Rapier physics controller supporting 6-wheel Rocker-Bogie Mars rovers
 * and 4-wheel Double-Wishbone Apollo Lunar Roving Vehicles.
 */
export class RoverController {
  private readonly rapier: typeof RAPIER;
  private readonly world: RAPIER.World;
  private readonly profile: DeviceSimulationProfile;
  private readonly bodyPhysics: BodyPhysicsConfig;
  public readonly chassisBody: RAPIER.RigidBody;
  public readonly chassisCollider: RAPIER.Collider;

  public readonly wheels: WheelRuntimeSample[] = [];
  public readonly pose: VehiclePoseState;
  private currentSteerAngle = 0;
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

    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(initialLocalPos.x, initialLocalPos.y, initialLocalPos.z)
      .setRotation({ x: initQuat.x, y: initQuat.y, z: initQuat.z, w: initQuat.w })
      .setLinearDamping(0.22)
      .setAngularDamping(2.8)
      .setCanSleep(false);

    this.chassisBody = world.createRigidBody(bodyDesc);

    const [hx, hy, hz] = rig.chassisBoxHalfExtentsM;
    const [cx, cy, cz] = rig.centerOfMassOffsetM;
    // Initialize 4-wheel or 6-wheel raycast anchors relative to chassis center
    const anchorY = -hy * 0.45;
    // Keep chassis belly collider well above nominal tire-ground plane so bumps use suspension travel cleanly
    const minColliderCenterY = anchorY - rig.suspensionRestLengthM * 0.35 - rig.wheelRadiusM * 0.4 + hy;
    const colliderY = Math.max(cy, minColliderCenterY);

    const colliderDesc = rapier.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(cx, colliderY, cz)
      .setMass(rig.chassisMassKg)
      .setFriction(bodyPhysics.surfaceFriction * 0.65)
      .setRestitution(0.02);

    this.chassisCollider = world.createCollider(colliderDesc, this.chassisBody);

    rig.wheelZPositionsM.forEach((zPos, axleIdx) => {
      const steerable =
        (axleIdx === 0 && rig.steerableAxles.includes('front'))
          ? 1
          : (axleIdx === rig.wheelZPositionsM.length - 1 && rig.steerableAxles.includes('rear'))
            ? -1
            : 0;

      for (const side of ['left', 'right'] as const) {
        const xSign = side === 'left' ? -1 : 1;
        this.wheels.push({
          name: `wheel_${axleIdx}_${side}`,
          localAnchor: new THREE.Vector3(xSign * rig.trackHalfWidthM, anchorY, zPos),
          steerableSign: steerable,
          isLeft: side === 'left',
          axleIndex: axleIdx as 0 | 1 | 2,
          grounded: true,
          compressionM: rig.suspensionRestLengthM * 0.45,
          spinAngleRad: 0,
          steerAngleRad: 0,
          contactGlobalY: initialGlobalPos.y - profile.physicalTransform.groundClearanceM,
        });
      }
    });

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
      wheelsGroundedCount: this.wheels.length,
      totalWheels: this.wheels.length,
      slipRatio: 0,
      stabilityWarning: 'none',
      wheels: this.wheels,
      rockerLeftPitchRad: 0,
      rockerRightPitchRad: 0,
      bogieLeftPitchRad: 0,
      bogieRightPitchRad: 0,
    };
  }

  public snapshotPreviousPose(): void {
    this.pose.prevLocalPos.copy(this.pose.localPos);
    this.pose.prevQuat.copy(this.pose.quat);
  }

  public shiftOrigin(deltaLocal: THREE.Vector3): void {
    const t = this.chassisBody.translation();
    this.chassisBody.setTranslation(
      { x: t.x - deltaLocal.x, y: t.y - deltaLocal.y, z: t.z - deltaLocal.z },
      true,
    );
    this.pose.localPos.sub(deltaLocal);
    this.pose.prevLocalPos.sub(deltaLocal);
  }

  public teleport(localPos: THREE.Vector3, yawRad: number): void {
    const q = new THREE.Quaternion().setFromAxisAngle(_up, yawRad);
    this.chassisBody.resetForces(true);
    this.chassisBody.resetTorques(true);
    this.chassisBody.setTranslation({ x: localPos.x, y: localPos.y, z: localPos.z }, true);
    this.chassisBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.currentSteerAngle = 0;
    this.pose.localPos.copy(localPos);
    this.pose.prevLocalPos.copy(localPos);
    this.pose.quat.copy(q);
    this.pose.prevQuat.copy(q);
    this.pose.speedMs = 0;
    this.pose.signedForwardSpeedMs = 0;
    this.pose.stabilityWarning = 'none';
  }

  public getLastStableCheckpoint(): { globalPos: THREE.Vector3; yawRad: number } {
    return {
      globalPos: this.lastStableGlobalPos.clone(),
      yawRad: this.lastStableYaw,
    };
  }

  public recordStableCheckpoint(globalPos: THREE.Vector3): void {
    _euler.setFromQuaternion(this.pose.quat, 'YXZ');
    this.lastStableGlobalPos.copy(globalPos);
    this.lastStableYaw = _euler.y;
  }

  public step(
    dt: number,
    input: VehicleInputState,
    originOffset: THREE.Vector3,
    forceSafetyBrake = false,
  ): void {
    this.snapshotPreviousPose();
    // Rapier accumulates user-added forces/torques permanently across steps unless cleared each tick
    this.chassisBody.resetForces(false);
    this.chassisBody.resetTorques(false);

    const rig = this.profile.wheelRig;
    const t = this.chassisBody.translation();
    const r = this.chassisBody.rotation();
    this.pose.localPos.set(t.x, t.y, t.z);
    this.pose.quat.set(r.x, r.y, r.z, r.w);

    const chassisDown = _tmpV1.copy(_down).applyQuaternion(this.pose.quat).normalize();
    const chassisUp = _tmpV2.copy(_up).applyQuaternion(this.pose.quat).normalize();
    const chassisForward = _tmpV3.copy(_fwd).applyQuaternion(this.pose.quat).normalize();
    const chassisRight = new THREE.Vector3().copy(_right).applyQuaternion(this.pose.quat).normalize();

    const linVelRaw = this.chassisBody.linvel();
    const angVelRaw = this.chassisBody.angvel();
    const linVel = new THREE.Vector3(linVelRaw.x, linVelRaw.y, linVelRaw.z);
    const angVel = new THREE.Vector3(angVelRaw.x, angVelRaw.y, angVelRaw.z);

    // Smooth steering target (A = positive left yaw -> positive wheel angle around Y)
    const targetSteer = input.steer * rig.maxSteerAngleRad;
    this.currentSteerAngle = THREE.MathUtils.lerp(this.currentSteerAngle, targetSteer, Math.min(1, dt * 8.5));

    const maxRayLen = rig.suspensionRestLengthM + rig.wheelRadiusM + 0.08;
    const weightPerWheelN =
      (rig.chassisMassKg * this.bodyPhysics.gravityMs2) / Math.max(1, this.wheels.length);
    // Keep spring forces well-bounded so 60Hz integration never overshoots on rocky impacts
    const maxWheelForceN = weightPerWheelN * 4.2;

    let groundedCount = 0;
    let totalSlipAccum = 0;

    // 1. Suspension spring-damper forces & Rocker-Bogie differential stabilization
    for (const wheel of this.wheels) {
      wheel.steerAngleRad = wheel.steerableSign * this.currentSteerAngle;
      const worldMount = wheel.localAnchor.clone().applyQuaternion(this.pose.quat).add(this.pose.localPos);

      const ray = new this.rapier.Ray(
        { x: worldMount.x, y: worldMount.y, z: worldMount.z },
        { x: chassisDown.x, y: chassisDown.y, z: chassisDown.z },
      );

      const hit = this.world.castRayAndGetNormal(
        ray,
        maxRayLen,
        true,
        undefined,
        undefined,
        undefined,
        this.chassisBody,
      );

      if (hit && hit.timeOfImpact <= rig.suspensionRestLengthM + rig.wheelRadiusM + 0.02) {
        wheel.grounded = true;
        groundedCount += 1;
        const targetDist = rig.suspensionRestLengthM + rig.wheelRadiusM;
        const rawComp = Math.max(0, Math.min(rig.suspensionRestLengthM + 0.04, targetDist - hit.timeOfImpact));
        wheel.compressionM = rawComp;
        wheel.contactGlobalY =
          worldMount.y + chassisDown.y * hit.timeOfImpact + originOffset.y;

        // Point velocity at wheel mount
        const relMount = worldMount.clone().sub(this.pose.localPos);
        const pointVel = linVel.clone().add(angVel.clone().cross(relMount));
        const vertSpeedAlongDown = pointVel.dot(chassisDown);

        const springForce =
          rig.suspensionStiffness * rawComp + rig.suspensionDamping * vertSpeedAlongDown;
        const clampedNormal = Math.max(0, Math.min(maxWheelForceN, springForce));

        // Rocker-bogie pitch decoupling reduces pitch moment leverage so rover climbs slabs calmly
        const leverageScale = rig.layout === 'rocker_bogie_6w' ? 0.55 : 0.72;
        const torquePoint = relMount.clone().multiplyScalar(leverageScale).add(this.pose.localPos);
        const forceVec = chassisUp.clone().multiplyScalar(clampedNormal);

        this.chassisBody.addForceAtPoint(
          { x: forceVec.x, y: forceVec.y, z: forceVec.z },
          { x: torquePoint.x, y: torquePoint.y, z: torquePoint.z },
          false,
        );

        // Tire direction with front/rear Ackermann steer
        const wheelFwd = chassisForward
          .clone()
          .applyAxisAngle(chassisUp, wheel.steerAngleRad)
          .normalize();
        const wheelLat = chassisRight
          .clone()
          .applyAxisAngle(chassisUp, wheel.steerAngleRad)
          .normalize();

        // Project onto surface normal plane if shallow enough for climbing
        const hitNorm = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
        const surfFwd = wheelFwd
          .clone()
          .addScaledVector(hitNorm, -wheelFwd.dot(hitNorm));
        if (surfFwd.lengthSq() > 1e-4) surfFwd.normalize();

        const vLat = pointVel.dot(wheelLat);
        const vFwd = pointVel.dot(surfFwd);

        // Lateral tire grip (prevent ice-skating sideways)
        const latGripCoeff = Math.min(
          maxWheelForceN * 1.15,
          this.bodyPhysics.surfaceFriction * weightPerWheelN * 1.45,
        );
        const latForceMag = Math.max(-latGripCoeff, Math.min(latGripCoeff, -vLat * rig.chassisMassKg * 2.1));
        const latVec = wheelLat.clone().multiplyScalar(latForceMag);

        // Longitudinal motor drive / braking / rolling resistance
        const targetMaxSpeed =
          input.throttle >= 0 ? this.profile.maxSpeedMs : this.profile.reverseSpeedMs;
        const brakeActive = input.brake || forceSafetyBrake;

        let desiredWheelSurfaceSpeed = 0;
        if (!brakeActive && Math.abs(input.throttle) > 0.02) {
          desiredWheelSurfaceSpeed = input.throttle * targetMaxSpeed;
        }

        let longForceMag = 0;
        if (brakeActive) {
          longForceMag = Math.max(
            -maxWheelForceN * 1.35,
            Math.min(maxWheelForceN * 1.35, -vFwd * rig.chassisMassKg * 2.8),
          );
        } else if (Math.abs(input.throttle) > 0.02) {
          const speedError = desiredWheelSurfaceSpeed - vFwd;
          // Slope gravity assist/opposition handled naturally by Rapier world gravity!
          const maxMotorForce =
            (rig.chassisMassKg * this.bodyPhysics.gravityMs2 * 1.45) / this.wheels.length;
          longForceMag = Math.max(
            -maxMotorForce,
            Math.min(maxMotorForce, speedError * (rig.chassisMassKg / this.wheels.length) * 5.2),
          );
        } else {
          // Gentle rolling resistance & park hold when no throttle
          const dragScale =
            Math.abs(vFwd) < 0.35 ? rig.chassisMassKg * 1.4 : rig.chassisMassKg * 0.35;
          longForceMag = Math.max(-weightPerWheelN * 0.7, Math.min(weightPerWheelN * 0.7, -vFwd * dragScale));
        }

        // Traction limit against surface friction
        const tractionLimit = clampedNormal * this.bodyPhysics.surfaceFriction * 1.35 + weightPerWheelN * 0.45;
        longForceMag = Math.max(-tractionLimit, Math.min(tractionLimit, longForceMag));

        const tractionVec = surfFwd.clone().multiplyScalar(longForceMag).add(latVec);
        // Apply tangential forces closer to ground/CG height to avoid unrealistic flip-overs under torque
        const drivePoint = relMount
          .clone()
          .setY(Math.min(relMount.y, rig.centerOfMassOffsetM[1] - rig.chassisBoxHalfExtentsM[1] * 0.3))
          .add(this.pose.localPos);

        this.chassisBody.addForceAtPoint(
          { x: tractionVec.x, y: tractionVec.y, z: tractionVec.z },
          { x: drivePoint.x, y: drivePoint.y, z: drivePoint.z },
          false,
        );

        // Update visual wheel spin from surface displacement (negated around X for -Z forward rotation)
        const wheelAngSpeed = vFwd / Math.max(0.03, rig.wheelRadiusM);
        wheel.spinAngleRad = (wheel.spinAngleRad - wheelAngSpeed * dt) % (Math.PI * 2);

        const speedGap = Math.abs(desiredWheelSurfaceSpeed - vFwd);
        totalSlipAccum +=
          !brakeActive && Math.abs(input.throttle) > 0.05
            ? Math.min(1, speedGap / Math.max(0.5, targetMaxSpeed))
            : 0;
      } else {
        wheel.grounded = false;
        wheel.compressionM = Math.max(0, wheel.compressionM - dt * 0.35);
      }
    }

    // Smooth responsive yaw steering torque assist when moving with grounded wheels
    if (groundedCount >= 2 && Math.abs(input.steer) > 0.02 && !(input.brake || forceSafetyBrake)) {
      const signedFwdSpeed = linVel.dot(chassisForward);
      const turnDir = Math.abs(signedFwdSpeed) > 0.15 ? Math.sign(signedFwdSpeed) : 1;
      const pivotBlend = Math.abs(signedFwdSpeed) > 0.25 ? 1.0 : 0.75; // Mars rovers can turn-in-place via front/rear oppose!
      const yawRateTarget = input.steer * 0.72 * turnDir * pivotBlend;
      const yawErr = yawRateTarget - angVel.y;
      const yawTorque = yawErr * rig.chassisMassKg * 0.85;
      this.chassisBody.applyTorqueImpulse(
        { x: chassisUp.x * yawTorque * dt, y: chassisUp.y * yawTorque * dt, z: chassisUp.z * yawTorque * dt },
        false,
      );
    }

    // Wake up once per tick so all forces integrate reliably
    this.chassisBody.wakeUp();

    // Update pose & telemetry metrics
    const nextLinVel = this.chassisBody.linvel();
    const speedVec = new THREE.Vector3(nextLinVel.x, nextLinVel.y, nextLinVel.z);
    const planarSpeed = Math.hypot(speedVec.x, speedVec.z);
    this.pose.speedMs = planarSpeed;
    this.pose.signedForwardSpeedMs = speedVec.dot(chassisForward);

    // Compute rocker-bogie visual angles from front/mid/rear wheel compressions
    this.updateRockerBogieAngles();

    // Compute pitch, roll, heading and stability alerts
    const fwdY = Math.max(-1, Math.min(1, chassisForward.y));
    const rightY = Math.max(-1, Math.min(1, chassisRight.y));
    this.pose.pitchDeg = (Math.asin(fwdY) * 180) / Math.PI;
    this.pose.rollDeg = (Math.asin(-rightY) * 180) / Math.PI;

    _euler.setFromQuaternion(this.pose.quat, 'YXZ');
    this.pose.headingDeg = ((-_euler.y * 180) / Math.PI + 360) % 360;
    this.pose.wheelsGroundedCount = groundedCount;
    this.pose.slipRatio = groundedCount > 0 ? totalSlipAccum / groundedCount : 1;

    const tiltDeg = Math.hypot(this.pose.pitchDeg, this.pose.rollDeg);
    if (chassisUp.y < 0.68 || tiltDeg >= 40) {
      this.pose.stabilityWarning = 'tip_over';
    } else if (groundedCount > 0 && groundedCount < Math.ceil(this.wheels.length / 2) && planarSpeed < 0.15) {
      this.pose.stabilityWarning = 'high_center';
    } else if (tiltDeg >= this.profile.maxClimbSlopeDeg * 0.88) {
      this.pose.stabilityWarning = 'steep_slope';
    } else {
      this.pose.stabilityWarning = 'none';
    }

    // Save stable global checkpoint automatically when safely grounded
    if (
      groundedCount >= Math.max(3, this.wheels.length - 1) &&
      tiltDeg < 16 &&
      planarSpeed < 2.2
    ) {
      const globalPos = this.pose.localPos.clone().add(originOffset);
      // Only update checkpoint if moved >= 4 m from previous checkpoint to stay clear of hazard traps
      if (globalPos.distanceToSquared(this.lastStableGlobalPos) >= 16) {
        this.recordStableCheckpoint(globalPos);
      }
    }
  }

  private updateRockerBogieAngles(): void {
    const comp = (isLeft: boolean, axle: 0 | 1 | 2) =>
      this.wheels.find((w) => w.isLeft === isLeft && w.axleIndex === axle)?.compressionM ?? 0;

    if (this.wheels.length === 6) {
      const l0 = comp(true, 0);
      const l1 = comp(true, 1);
      const l2 = comp(true, 2);
      const r0 = comp(false, 0);
      const r1 = comp(false, 1);
      const r2 = comp(false, 2);
      this.pose.rockerLeftPitchRad = THREE.MathUtils.clamp((l2 - l0) * 0.85, -0.35, 0.35);
      this.pose.rockerRightPitchRad = THREE.MathUtils.clamp((r2 - r0) * 0.85, -0.35, 0.35);
      this.pose.bogieLeftPitchRad = THREE.MathUtils.clamp((l1 - l0) * 1.1, -0.35, 0.35);
      this.pose.bogieRightPitchRad = THREE.MathUtils.clamp((r1 - r0) * 1.1, -0.35, 0.35);
    } else if (this.wheels.length === 4) {
      const l0 = comp(true, 0);
      const l1 = comp(true, 1);
      const r0 = comp(false, 0);
      const r1 = comp(false, 1);
      this.pose.rockerLeftPitchRad = THREE.MathUtils.clamp((l1 - l0) * 0.65, -0.25, 0.25);
      this.pose.rockerRightPitchRad = THREE.MathUtils.clamp((r1 - r0) * 0.65, -0.25, 0.25);
    }
  }

  public dispose(): void {
    this.world.removeRigidBody(this.chassisBody);
  }
}
