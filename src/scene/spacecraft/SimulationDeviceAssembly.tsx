import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getDeviceControlSpec } from '../../config/deviceControlSpecs';
import { assetManager } from '../../core/loaders/AssetStreamManager';
import { disposeModel } from '../../core/loaders/modelResources';
import type {
  BodyPhysicsConfig,
  DeviceRecord,
  DeviceSimulationProfile,
} from '../../types/cosmos.types';
import type { VehiclePoseState } from '../simulation/RoverController';
import { applyCoaxialRotorRotation, prepareControlledDeviceScene } from './deviceControlRuntime';
import { ProceduralDeviceModel } from './ProceduralDeviceModel';
import {
  applyWheelPivotSamples,
  partitionRoverWheelsIntoPivots,
  type ExtractedWheelPivot,
} from './wheelPivotExtractor';

export interface SimulationDeviceAssemblyProps {
  device: DeviceRecord | null;
  targetModelPath?: string;
  targetId?: string;
  profile: DeviceSimulationProfile;
  bodyPhysics: BodyPhysicsConfig;
  poseRef: React.RefObject<VehiclePoseState | null>;
  rotorSpinAngleRef: React.RefObject<number>;
  povArmDeployed: boolean;
  povScanActive: boolean;
}

/**
 * Renders the genuine catalog GLB (scaled to documented/simulated meter dimensions
 * with non-destructively extracted rotating/steering wheel pivots) or pedestal-free
 * articulated procedural hardware inside Option 2 (CONTROL_ROOM_POV).
 */
export function SimulationDeviceAssembly({
  device,
  targetModelPath,
  profile,
  bodyPhysics,
  poseRef,
  rotorSpinAngleRef,
  povArmDeployed,
  povScanActive,
}: SimulationDeviceAssemblyProps) {
  const { gl } = useThree();
  const [glbRoot, setGlbRoot] = useState<THREE.Group | null>(null);
  const proceduralRootRef = useRef<THREE.Group | null>(null);
  const visualOffsetGroupRef = useRef<THREE.Group | null>(null);
  const laserPulseRef = useRef<THREE.Mesh | null>(null);
  const armSweepGroupRef = useRef<THREE.Group | null>(null);

  const glbPivotsRef = useRef<ExtractedWheelPivot[]>([]);
  const glbNodeMapRef = useRef<Record<string, THREE.Object3D>>({});
  const procWheelRefs = useRef<Array<{
    steer: THREE.Group;
    spin: THREE.Group;
    sampleIndex: number;
    restY: number;
  }>>([]);

  const modelUrl = device?.status === 'available' ? device.modelPath : targetModelPath;
  const spec = useMemo(() => getDeviceControlSpec(device?.id ?? null), [device?.id]);

  // Compute physical equilibrium wheel compression so visual wheels rest cleanly on terrain
  const eqCompressionM = useMemo(() => {
    const rig = profile.wheelRig;
    if (rig.wheelCount === 0 || rig.suspensionStiffness <= 0) return 0;
    return Math.min(
      rig.suspensionRestLengthM * 0.65,
      (rig.chassisMassKg * bodyPhysics.gravityMs2) /
        Math.max(1, rig.wheelCount * rig.suspensionStiffness),
    );
  }, [bodyPhysics.gravityMs2, profile.wheelRig]);

  const baseModelOffsetY = useMemo(() => {
    const rig = profile.wheelRig;
    if (profile.mobilityKind === 'rover_6w' || profile.mobilityKind === 'rover_4w') {
      const hy = rig.chassisBoxHalfExtentsM[1];
      return -(hy * 0.45 + rig.suspensionRestLengthM + rig.wheelRadiusM - eqCompressionM);
    }
    return -rig.chassisBoxHalfExtentsM[1];
  }, [eqCompressionM, profile.mobilityKind, profile.wheelRig]);

  // Load real GLB asset when available, scale to meter dimensions, ground y=0, and split wheels
  useEffect(() => {
    if (!modelUrl) {
      setGlbRoot(null);
      glbPivotsRef.current = [];
      glbNodeMapRef.current = {};
      return;
    }

    const controller = new AbortController();
    let ownedContainer: THREE.Group | null = null;
    let createdGeoms: THREE.BufferGeometry[] = [];
    setGlbRoot(null);
    assetManager.initWithRenderer(gl);

    void assetManager
      .loadModel(modelUrl, controller.signal, () => {})
      .then((scene) => {
        if (controller.signal.aborted) {
          disposeModel(scene);
          return;
        }

        const rawContainer = new THREE.Group();
        rawContainer.add(scene);
        if (device?.transform.rotation) {
          scene.rotation.set(...device.transform.rotation);
        }
        rawContainer.updateMatrixWorld(true);

        const rawBox = new THREE.Box3().setFromObject(rawContainer);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawCenter = rawBox.getCenter(new THREE.Vector3());
        const longest = Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-4);
        const scale = profile.physicalTransform.targetLongestSideM / longest;

        scene.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
        rawContainer.scale.setScalar(scale);

        // Rotate into simulation chassis frame (-Z forward, +X right, +Y up)
        const alignedRoot = new THREE.Group();
        rawContainer.rotation.y = profile.physicalTransform.yawOffsetRad;
        alignedRoot.add(rawContainer);
        alignedRoot.updateMatrixWorld(true);

        // Isolate materials for clean lighting & rotor control
        glbNodeMapRef.current = prepareControlledDeviceScene(alignedRoot);

        // Non-destructively split GLB wheel geometry into rotatable + steerable pivots
        if (profile.mobilityKind === 'rover_6w' && profile.wheelRig.wheelCount > 0) {
          const rig = profile.wheelRig;
          const anchors: Array<{
            sampleIndex: number;
            localX: number;
            localZ: number;
            wheelRadiusM: number;
            wheelWidthM: number;
          }> = [];
          let idx = 0;
          for (const zPos of rig.wheelZPositionsM) {
            for (const xSign of [-1, 1]) {
              anchors.push({
                sampleIndex: idx++,
                localX: xSign * rig.trackHalfWidthM,
                localZ: zPos,
                wheelRadiusM: rig.wheelRadiusM,
                wheelWidthM: rig.wheelWidthM,
              });
            }
          }
          const onlyNode = device?.id === 'perseverance_rover' ? 'wheels_objs' : undefined;
          const extracted = partitionRoverWheelsIntoPivots(alignedRoot, anchors, onlyNode);
          glbPivotsRef.current = extracted.wheelPivots;
          createdGeoms = extracted.createdGeometries;
        } else {
          glbPivotsRef.current = [];
        }

        // Enhance mipmaps & shadow flags
        alignedRoot.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
        });

        ownedContainer = alignedRoot;
        setGlbRoot(alignedRoot);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGlbRoot(null);
        }
      });

    return () => {
      controller.abort();
      glbPivotsRef.current = [];
      glbNodeMapRef.current = {};
      createdGeoms.forEach((g) => g.dispose());
      if (ownedContainer) {
        disposeModel(ownedContainer);
      }
    };
  }, [device?.id, device?.transform.rotation, gl, modelUrl, profile]);

  // Align ProceduralDeviceModel to real meter dimensions & index LRV wheel pivots
  useEffect(() => {
    const root = proceduralRootRef.current;
    if (!root || modelUrl) {
      procWheelRefs.current = [];
      return;
    }

    root.scale.setScalar(1);
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 1e-4);
    const scale = profile.physicalTransform.targetLongestSideM / longest;

    const rotatedCenter = center
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), profile.physicalTransform.yawOffsetRad);
    root.scale.setScalar(scale);
    root.rotation.y = profile.physicalTransform.yawOffsetRad;
    root.position.set(
      -rotatedCenter.x * scale,
      -box.min.y * scale,
      -rotatedCenter.z * scale,
    );
    root.updateMatrixWorld(true);

    // Match named sim_wheel_steer_* pivots in procedural LRV to physics wheels by local XZ
    const refs: typeof procWheelRefs.current = [];
    const rig = profile.wheelRig;
    if (rig.wheelCount > 0) {
      const physicsCoords: Array<{ x: number; z: number }> = [];
      for (const zPos of rig.wheelZPositionsM) {
        for (const xSign of [-1, 1]) {
          physicsCoords.push({ x: xSign * rig.trackHalfWidthM, z: zPos });
        }
      }
      const rootWorldPos = new THREE.Vector3();
      const parentInverse = root.parent
        ? root.parent.matrixWorld.clone().invert()
        : new THREE.Matrix4();

      root.traverse((obj) => {
        if (!obj.name.startsWith('sim_wheel_steer_')) return;
        const steer = obj as THREE.Group;
        const spin = steer.children.find((c) => c.name.startsWith('sim_wheel_spin_')) as
          | THREE.Group
          | undefined;
        if (!spin) return;
        steer.getWorldPosition(rootWorldPos);
        const localPos = rootWorldPos.applyMatrix4(parentInverse);
        let bestIdx = 0;
        let bestDist = Infinity;
        physicsCoords.forEach((p, i) => {
          const d = Math.hypot(localPos.x - p.x, localPos.z - p.z);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        });
        refs.push({ steer, spin, sampleIndex: bestIdx, restY: steer.position.y });
      });
    }
    procWheelRefs.current = refs;
  }, [device?.id, device?.proceduralModel, modelUrl, profile]);

  useFrame(({ clock }, delta) => {
    const pose = poseRef.current;

    // 1. Keep visual model tire bottom aligned with dynamic average suspension compression
    if (visualOffsetGroupRef.current && pose) {
      let compAdjust = 0;
      if (pose.wheels.length > 0) {
        let sumComp = 0;
        let grounded = 0;
        for (const w of pose.wheels) {
          if (w.grounded) {
            sumComp += w.compressionM;
            grounded += 1;
          }
        }
        if (grounded > 0) {
          const avgComp = sumComp / grounded;
          compAdjust = avgComp - eqCompressionM;
        }
      }
      visualOffsetGroupRef.current.position.y = baseModelOffsetY + compAdjust;
    }

    // 2. Drive real extracted GLB wheel pivots on Mars rovers
    if (glbPivotsRef.current.length > 0 && pose) {
      applyWheelPivotSamples(
        glbPivotsRef.current,
        pose.wheels,
        eqCompressionM,
        profile.physicalTransform.yawOffsetRad,
      );
    }

    // 3. Drive procedural Apollo LRV wheels
    if (procWheelRefs.current.length > 0 && pose) {
      for (const item of procWheelRefs.current) {
        const sample = pose.wheels[item.sampleIndex];
        if (!sample) continue;
        item.steer.rotation.y = sample.steerAngleRad;
        // Procedural LRV group was rotated PI around Y so local wheel spin X matches or negates based on yaw
        const spinSign = Math.cos(profile.physicalTransform.yawOffsetRad) >= 0 ? 1 : -1;
        item.spin.rotation.x = sample.spinAngleRad * spinSign;
        item.steer.position.y = item.restY + (sample.compressionM - eqCompressionM) * 0.45;
      }
    }

    // 4. Drive coaxial Ingenuity rotors using real physics state
    if (spec?.rotorControl && Object.keys(glbNodeMapRef.current).length > 0) {
      applyCoaxialRotorRotation(
        glbNodeMapRef.current,
        spec.rotorControl,
        rotorSpinAngleRef.current ?? 0,
      );
    }

    // 5. Animate robotic sampling probe / spectrometer scan if toggled in HUD
    if (armSweepGroupRef.current) {
      const targetPitch = povArmDeployed ? 0.42 : 0;
      armSweepGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        armSweepGroupRef.current.rotation.x,
        targetPitch,
        Math.min(1, delta * 6),
      );
    }
    if (laserPulseRef.current) {
      laserPulseRef.current.visible = povScanActive;
      if (povScanActive) {
        const pulse = 0.8 + Math.sin(clock.elapsedTime * 7.5) * 0.25;
        laserPulseRef.current.scale.set(pulse, 1, pulse);
      }
    }
  });

  const rig = profile.wheelRig;
  const frontExtentZ = -(rig.chassisBoxHalfExtentsM[2] + 0.25);

  return (
    <group ref={visualOffsetGroupRef} position={[0, baseModelOffsetY, 0]}>
      {glbRoot ? (
        <primitive object={glbRoot} dispose={null} />
      ) : modelUrl ? (
        /* Fast meter-scale placeholder box frame strictly while local GLB finishes streaming (~30ms) */
        <group>
          <mesh position={[0, rig.chassisBoxHalfExtentsM[1] + profile.physicalTransform.groundClearanceM, 0]}>
            <boxGeometry
              args={[
                rig.chassisBoxHalfExtentsM[0] * 1.6,
                rig.chassisBoxHalfExtentsM[1] * 1.1,
                rig.chassisBoxHalfExtentsM[2] * 1.8,
              ]}
            />
            <meshStandardMaterial color="#94a3b8" roughness={0.65} metalness={0.35} />
          </mesh>
        </group>
      ) : device?.proceduralModel ? (
        <group ref={proceduralRootRef}>
          <ProceduralDeviceModel
            kind={device.proceduralModel}
            deviceId={device.id}
            name={device.name}
            hideDisplayPedestal
          />
        </group>
      ) : null}

      {/* Interactive forward sampling / ChemCam LIBS laser reticle aligned in real physical meters */}
      {profile.capabilities.supportsArmDeploy && (
        <group
          ref={armSweepGroupRef}
          position={[0, rig.wheelRadiusM * 2 + 0.22, frontExtentZ]}
        >
          <mesh position={[0, -0.08, -0.28]} rotation={[0.45, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.032, 0.56, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.22, -0.52]}>
            <cylinderGeometry args={[0.06, 0.075, 0.08, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      )}

      {profile.capabilities.supportsSpectrometerScan && (
        <mesh
          ref={laserPulseRef}
          visible={povScanActive}
          position={[0, 0.05, frontExtentZ - 1.15]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.014, 0.14, 2.2, 12, 1, true]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.48}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
