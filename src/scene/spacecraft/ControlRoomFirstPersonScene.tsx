import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY_CATALOG } from '../../config/bodyCatalog';
import { getBodyPhysicsConfig } from '../../config/bodyPhysicsConfig';
import {
  computeOrbitalPosition,
  LINKED_ORBITAL_DEVICE_IDS,
  MARS_AXIAL_TILT_RAD,
  MOON_AXIAL_TILT_RAD,
  ORBITAL_ACTORS_CATALOG,
} from '../../config/celestialCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { getDeviceSimulationProfile } from '../../config/deviceSimulationProfiles';
import { resolveDeviceBodyId } from '../../config/statusVocabulary';
import {
  clampDevicePixelRatio,
  FramePacingMonitor,
  getQualityPreset,
  resolveInitialTier,
} from '../../core/quality/QualityManager';
import { getCheckpointStorageKey, useCosmosStore } from '../../store/useCosmosStore';
import type {
  BodyId,
  CelestialTarget,
  DeviceRecord,
  DeviceSimulationProfile,
  OrbitalElements,
  ResolvedQualityTier,
  SensorFilterMode,
} from '../../types/cosmos.types';
import { MarsAtmosphereMesh } from '../mars/MarsAtmosphereMesh';
import { MarsLODMesh } from '../mars/MarsLODMesh';
import { computeOrbitalTimeStep } from '../simulation/SimulationClock';
import type { VehiclePoseState } from '../simulation/RoverController';
import {
  SimulationWorld,
  type SimulationRenderSnapshot,
} from '../simulation/SimulationWorld';
import { surfaceInputBridge } from '../simulation/surfaceInputBridge';
import type { TerrainRockSpec } from '../terrain/terrainDataPipeline';
import {
  acquireTerrainTileMaterial,
  buildTerrainTileGeometry,
  releaseTerrainTileMaterial,
  type TerrainLodLevel,
} from '../terrain/TerrainTile';
import { SimulationDeviceAssembly } from './SimulationDeviceAssembly';

interface TileMeshEntry {
  mesh: THREE.Mesh;
  lod: TerrainLodLevel;
  centerX: number;
  centerZ: number;
}

const MAX_ROCK_INSTANCES = 1400;
const MAX_SLAB_INSTANCES = 48;
const MAX_TRACK_INSTANCES = 760;

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function resolveSensorAppearance(
  sensorMode: SensorFilterMode,
  bodyId: BodyId,
): { tintHex: string; wireframe: boolean; skyHex: string; fogHex: string; fogDensity: number } {
  const cfg = getBodyPhysicsConfig(bodyId);
  switch (sensorMode) {
    case 'NAVCAM_MONO':
      return {
        tintHex: '#cfd6df',
        wireframe: false,
        skyHex: bodyId === 'mars' ? '#586270' : '#05070b',
        fogHex: bodyId === 'mars' ? '#525b68' : '#05070b',
        fogDensity: cfg.fogDensity * 1.15,
      };
    case 'ELEVATION_GRID':
      return {
        tintHex: '#38bdf8',
        wireframe: true,
        skyHex: '#0a1628',
        fogHex: '#0b182c',
        fogDensity: cfg.fogDensity * 0.8,
      };
    case 'THERMAL_FALSE':
      return {
        tintHex: '#fb923c',
        wireframe: false,
        skyHex: '#1f1024',
        fogHex: '#25122b',
        fogDensity: cfg.fogDensity * 0.9,
      };
    case 'OPTICAL_RGB':
    default:
      return {
        tintHex: '#ffffff',
        wireframe: false,
        skyHex: cfg.skyHorizonHex,
        fogHex: cfg.fogColorHex,
        fogDensity: cfg.fogDensity,
      };
  }
}

function buildSynthesizedSkyTexture(zenithHex: string, horizonHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, zenithHex);
  grad.addColorStop(0.46, horizonHex);
  grad.addColorStop(0.55, horizonHex);
  grad.addColorStop(1.0, zenithHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface SurfaceSimulationSceneProps {
  bodyId: BodyId;
  targetId: string;
  device: DeviceRecord | null;
  target: CelestialTarget | null;
  profile: DeviceSimulationProfile;
}

function SurfaceSimulationScene({
  bodyId,
  targetId,
  device,
  target,
  profile,
}: SurfaceSimulationSceneProps) {
  const { camera, gl, scene } = useThree();
  const bodyPhysics = useMemo(() => getBodyPhysicsConfig(bodyId), [bodyId]);

  const regionSizeKm = useCosmosStore((s) => s.explorationRegionSizeKm);
  const resolvedQualityTier = useCosmosStore((s) => s.resolvedQualityTier);
  const povSensorMode = useCosmosStore((s) => s.povSensorMode);
  const povArmDeployed = useCosmosStore((s) => s.povArmDeployed);
  const povScanActive = useCosmosStore((s) => s.povScanActive);
  const cameraMountMode = useCosmosStore((s) => s.cameraMountMode);
  const simulationRecoverTick = useCosmosStore((s) => s.simulationRecoverTick);

  const simWorldRef = useRef<SimulationWorld | null>(null);
  const poseRef = useRef<VehiclePoseState | null>(null);
  const rotorSpinAngleRef = useRef<number>(0);

  const chassisGroupRef = useRef<THREE.Group | null>(null);
  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rockMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const slabMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const trackMeshRef = useRef<THREE.InstancedMesh | null>(null);

  const tileEntriesRef = useRef<Map<string, TileMeshEntry>>(new Map());
  const tileMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const lastChunkVersionRef = useRef<number>(-1);
  const lastOriginShiftRef = useRef<number>(-1);
  const lastTrackCountRef = useRef<number>(-1);
  const telemetryAccumRef = useRef<number>(0);
  const checkpointAccumRef = useRef<number>(0);
  const lastSavedDistRef = useRef<number>(0);
  const dragStateRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const qualityPreset = useMemo(() => getQualityPreset(resolvedQualityTier), [resolvedQualityTier]);
  const paceMonitorRef = useRef<FramePacingMonitor>(new FramePacingMonitor(resolvedQualityTier));
  const statsAccumRef = useRef<number>(0);

  // Reusable scratch objects to keep per-frame heap allocations near zero
  const scratch = useMemo(
    () => ({
      chassisEuler: new THREE.Euler(0, 0, 0, 'YXZ'),
      lookQuat: new THREE.Quaternion(),
      lookEuler: new THREE.Euler(0, 0, 0, 'YXZ'),
      eyeLocal: new THREE.Vector3(),
      camPos: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      dummy: new THREE.Object3D(),
      upVec: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  // Compute equilibrium model base offset so visual tires touch physical heightfield at rest
  const baseModelOffsetY = useMemo(() => {
    const rig = profile.wheelRig;
    if (profile.mobilityKind === 'rover_6w' || profile.mobilityKind === 'rover_4w') {
      const hy = rig.chassisBoxHalfExtentsM[1];
      const eqComp =
        rig.wheelCount > 0 && rig.suspensionStiffness > 0
          ? Math.min(
              rig.suspensionRestLengthM * 0.65,
              (rig.chassisMassKg * bodyPhysics.gravityMs2) /
                Math.max(1, rig.wheelCount * rig.suspensionStiffness),
            )
          : 0;
      return -(hy * 0.45 + rig.suspensionRestLengthM + rig.wheelRadiusM - eqComp);
    }
    return -rig.chassisBoxHalfExtentsM[1];
  }, [bodyPhysics.gravityMs2, profile]);

  const skyTexture = useMemo(() => {
    const app = resolveSensorAppearance(povSensorMode, bodyId);
    const zenith =
      povSensorMode === 'OPTICAL_RGB' ? bodyPhysics.skyZenithHex : app.skyHex;
    return buildSynthesizedSkyTexture(zenith, app.skyHex);
  }, [bodyId, bodyPhysics.skyZenithHex, povSensorMode]);

  useEffect(() => {
    return () => {
      skyTexture.dispose();
    };
  }, [skyTexture]);

  // Apply atmospheric fog cleanly on Surface POV & restore on unmount
  useEffect(() => {
    const app = resolveSensorAppearance(povSensorMode, bodyId);
    const prevFog = scene.fog;
    const prevBg = scene.background;
    scene.fog = new THREE.FogExp2(app.fogHex, app.fogDensity);
    if (bodyId === 'mars') {
      scene.background = new THREE.Color(app.skyHex);
    }
    return () => {
      scene.fog = prevFog;
      scene.background = prevBg;
    };
  }, [bodyId, povSensorMode, scene]);

  // Shared refcounted tile material
  useEffect(() => {
    const mat = acquireTerrainTileMaterial(bodyId, resolvedQualityTier);
    tileMaterialRef.current = mat;
    for (const entry of tileEntriesRef.current.values()) {
      entry.mesh.material = mat;
    }
    return () => {
      releaseTerrainTileMaterial(bodyId, resolvedQualityTier);
      tileMaterialRef.current = null;
    };
  }, [bodyId, resolvedQualityTier]);

  // Apply sensor mode tint / wireframe onto active shared terrain material
  useEffect(() => {
    const mat = tileMaterialRef.current;
    if (!mat) return;
    const app = resolveSensorAppearance(povSensorMode, bodyId);
    mat.color.set(app.tintHex);
    mat.wireframe = app.wireframe;
    mat.needsUpdate = true;
  }, [bodyId, povSensorMode, resolvedQualityTier]);

  // Apply quality DPR clamp when surface POV initializes or tier changes
  useEffect(() => {
    gl.setPixelRatio(clampDevicePixelRatio(resolvedQualityTier));
  }, [gl, resolvedQualityTier]);

  // Shared procedural instanced geometries & materials for rocks, slabs, and wheel tracks
  const sharedInstancedResources = useMemo(() => {
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: bodyId === 'mars' ? '#6d4433' : '#6b7079',
      roughness: 0.92,
      metalness: 0.05,
    });
    const slabGeo = new THREE.BoxGeometry(1, 1, 1);
    const slabMat = new THREE.MeshStandardMaterial({
      color: bodyId === 'mars' ? '#7b5342' : '#7a7f88',
      roughness: 0.88,
      metalness: 0.08,
    });
    const trackWidth = Math.max(0.07, profile.wheelRig.wheelWidthM * 0.92);
    const trackGeo = new THREE.PlaneGeometry(trackWidth, 0.52);
    trackGeo.rotateX(-Math.PI / 2);
    const trackMat = new THREE.MeshStandardMaterial({
      color: bodyId === 'mars' ? '#4f2818' : '#3a3d45',
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    return { rockGeo, rockMat, slabGeo, slabMat, trackGeo, trackMat };
  }, [bodyId, profile.wheelRig.wheelWidthM]);

  useEffect(() => {
    return () => {
      sharedInstancedResources.rockGeo.dispose();
      sharedInstancedResources.rockMat.dispose();
      sharedInstancedResources.slabGeo.dispose();
      sharedInstancedResources.slabMat.dispose();
      sharedInstancedResources.trackGeo.dispose();
      sharedInstancedResources.trackMat.dispose();
    };
  }, [sharedInstancedResources]);

  // Async creation and deterministic lifecycle of Rapier SimulationWorld
  useEffect(() => {
    let cancelled = false;
    const storeState = useCosmosStore.getState();
    const cpKey = getCheckpointStorageKey(bodyId, targetId, storeState.explorationRegionSizeKm);
    const savedCheckpoint = storeState.checkpointsByDevice[cpKey] ?? null;
    const initTier: ResolvedQualityTier = resolveInitialTier(
      storeState.qualityTier,
      storeState.reducedMotion,
    );

    const tileMap = tileEntriesRef.current;
    const terrainGroup = terrainGroupRef.current;

    void SimulationWorld.create({
      bodyId,
      deviceId: targetId,
      profile,
      regionSizeKm: storeState.explorationRegionSizeKm,
      qualityTier: initTier,
      checkpoint: savedCheckpoint,
      enableWorker: true,
    }).then((simWorld) => {
      if (cancelled) {
        simWorld.dispose();
        return;
      }
      simWorldRef.current = simWorld;
      poseRef.current = simWorld.controller.pose;
      lastSavedDistRef.current = simWorld.distanceTraveledM;
      lastChunkVersionRef.current = -1;
      lastOriginShiftRef.current = -1;
      lastTrackCountRef.current = -1;

      const s = useCosmosStore.getState();
      s.setSurfaceTelemetry(
        simWorld.buildTelemetrySnapshot(
          s.cameraMountMode,
          s.pointerLocked,
          s.horizonStabilized,
          s.simulatedMobilityEnabled,
        ),
      );
    });

    return () => {
      cancelled = true;
      surfaceInputBridge.releaseAll();
      const sim = simWorldRef.current;
      if (sim) {
        const s = useCosmosStore.getState();
        s.saveSimulationCheckpoint(sim.buildCheckpoint(s.explorationRegionSizeKm));
        sim.dispose();
        simWorldRef.current = null;
      }
      poseRef.current = null;

      for (const entry of tileMap.values()) {
        terrainGroup?.remove(entry.mesh);
        entry.mesh.geometry.dispose();
      }
      tileMap.clear();
    };
  }, [bodyId, profile, targetId]);

  // Sync live region size changes without destroying simulation state
  useEffect(() => {
    simWorldRef.current?.setRegionSizeKm(regionSizeKm);
  }, [regionSizeKm]);

  // Sync live quality tier changes to chunk streaming ring
  useEffect(() => {
    simWorldRef.current?.setQualityTier(resolvedQualityTier);
    paceMonitorRef.current.setTierExplicit(resolvedQualityTier);
  }, [resolvedQualityTier]);

  // Handle HUD recovery button / R key trigger
  useEffect(() => {
    if (simulationRecoverTick <= 0) return;
    simWorldRef.current?.recoverToLastStablePose();
  }, [simulationRecoverTick]);

  // Surface driving keyboard, pointer drag, pointer-lock, wheel zoom & lifecycle safety release
  useEffect(() => {
    const dom = gl.domElement;
    dom.style.touchAction = 'none';

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingElement(e.target)) return;
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }
      surfaceInputBridge.setKeyDown(e.code);

      if (e.repeat) return;
      if (e.code === 'KeyC') {
        useCosmosStore.getState().toggleCameraMountMode();
      } else if (e.code === 'KeyR') {
        useCosmosStore.getState().triggerSimulationRecovery();
      } else if (e.code === 'KeyL') {
        if (document.pointerLockElement === dom) {
          document.exitPointerLock?.();
        } else {
          dom.requestPointerLock?.();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      surfaceInputBridge.setKeyUp(e.code);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (document.pointerLockElement === dom) return;
      if (e.button !== 0) return;
      dragStateRef.current = { active: true, x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const store = useCosmosStore.getState();
      if (document.pointerLockElement === dom) {
        store.setPovOrientation(
          store.povYawDeg + e.movementX * 0.16,
          store.povPitchDeg - e.movementY * 0.14,
        );
        return;
      }
      if (!dragStateRef.current.active) return;
      const dx = e.clientX - dragStateRef.current.x;
      const dy = e.clientY - dragStateRef.current.y;
      dragStateRef.current.x = e.clientX;
      dragStateRef.current.y = e.clientY;
      store.setPovOrientation(store.povYawDeg + dx * 0.24, store.povPitchDeg + dy * 0.18);
    };

    const stopDrag = () => {
      dragStateRef.current.active = false;
    };

    const onPointerCancel = () => {
      stopDrag();
      surfaceInputBridge.releaseAll();
    };

    const onPointerLockChange = () => {
      useCosmosStore.getState().setPointerLocked(document.pointerLockElement === dom);
      stopDrag();
    };

    const onBlur = () => {
      stopDrag();
      surfaceInputBridge.releaseAll();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopDrag();
        surfaceInputBridge.releaseAll();
      }
    };

    const onWheel = (e: WheelEvent) => {
      const s = useCosmosStore.getState();
      if (e.deltaY < 0) {
        s.setPovFovZoom(s.povFovZoom === 1 ? 2 : 4);
      } else if (e.deltaY > 0) {
        s.setPovFovZoom(s.povFovZoom === 4 ? 2 : 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    dom.addEventListener('pointercancel', onPointerCancel);
    dom.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      surfaceInputBridge.releaseAll();
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.();
      }
      useCosmosStore.getState().setPointerLocked(false);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      dom.removeEventListener('pointercancel', onPointerCancel);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  const syncTerrainSceneMeshes = (simWorld: SimulationWorld, snap: SimulationRenderSnapshot) => {
    const group = terrainGroupRef.current;
    const mat = tileMaterialRef.current;
    if (!group || !mat) return;

    const origin = snap.originOffset;
    const chunks = simWorld.chunkManager.getActiveChunks();
    const version = simWorld.chunkManager.getVersion();
    const originShiftCount = simWorld.originShiftCount;
    const originShifted = originShiftCount !== lastOriginShiftRef.current;

    if (version !== lastChunkVersionRef.current) {
      lastChunkVersionRef.current = version;
      const desired = new Set<string>();
      const allRocks: TerrainRockSpec[] = [];
      const allSlabs: TerrainRockSpec[] = [];

      for (const chunk of chunks) {
        desired.add(chunk.payload.key);
        const existing = tileEntriesRef.current.get(chunk.payload.key);
        if (!existing || existing.lod !== chunk.lod) {
          if (existing) {
            group.remove(existing.mesh);
            existing.mesh.geometry.dispose();
          }
          const geom = buildTerrainTileGeometry(chunk.payload, chunk.lod);
          const mesh = new THREE.Mesh(geom, mat);
          mesh.receiveShadow = true;
          mesh.castShadow = false;
          mesh.name = `terrain_tile_${chunk.payload.key}`;
          group.add(mesh);
          tileEntriesRef.current.set(chunk.payload.key, {
            mesh,
            lod: chunk.lod,
            centerX: chunk.centerX,
            centerZ: chunk.centerZ,
          });
        }

        if (chunk.distanceTiles <= 2.25) {
          for (const rock of chunk.payload.rocks) {
            if (rock.shape === 'slab') {
              if (allSlabs.length < MAX_SLAB_INSTANCES) allSlabs.push(rock);
            } else if (allRocks.length < MAX_ROCK_INSTANCES) {
              allRocks.push(rock);
            }
          }
        }
      }

      for (const [key, entry] of Array.from(tileEntriesRef.current.entries())) {
        if (!desired.has(key)) {
          group.remove(entry.mesh);
          entry.mesh.geometry.dispose();
          tileEntriesRef.current.delete(key);
        }
      }

      // Refresh rock & slab instanced matrices relative to current origin
      if (rockMeshRef.current) {
        rockMeshRef.current.count = allRocks.length;
        for (let i = 0; i < allRocks.length; i += 1) {
          const r = allRocks[i];
          scratch.dummy.position.set(
            r.globalX - origin.x,
            r.globalY - origin.y,
            r.globalZ - origin.z,
          );
          scratch.dummy.rotation.set(r.rotX, r.rotY, 0);
          scratch.dummy.scale.set(r.scaleX, r.scaleY, r.scaleZ);
          scratch.dummy.updateMatrix();
          rockMeshRef.current.setMatrixAt(i, scratch.dummy.matrix);
        }
        rockMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      if (slabMeshRef.current) {
        slabMeshRef.current.count = allSlabs.length;
        for (let i = 0; i < allSlabs.length; i += 1) {
          const s = allSlabs[i];
          scratch.dummy.position.set(
            s.globalX - origin.x,
            s.globalY - origin.y,
            s.globalZ - origin.z,
          );
          scratch.dummy.rotation.set(s.rotX, s.rotY, 0);
          scratch.dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
          scratch.dummy.updateMatrix();
          slabMeshRef.current.setMatrixAt(i, scratch.dummy.matrix);
        }
        slabMeshRef.current.instanceMatrix.needsUpdate = true;
      }
      lastOriginShiftRef.current = originShiftCount;
    } else if (originShiftCount !== lastOriginShiftRef.current) {
      // Shift already-built rock/slab instanced matrices on 1 km rebase without rebuilding tiles
      lastOriginShiftRef.current = originShiftCount;
      const nearbyRocks: TerrainRockSpec[] = [];
      const nearbySlabs: TerrainRockSpec[] = [];
      for (const chunk of chunks) {
        if (chunk.distanceTiles > 2.25) continue;
        for (const rock of chunk.payload.rocks) {
          if (rock.shape === 'slab') {
            if (nearbySlabs.length < MAX_SLAB_INSTANCES) nearbySlabs.push(rock);
          } else if (nearbyRocks.length < MAX_ROCK_INSTANCES) {
            nearbyRocks.push(rock);
          }
        }
      }
      if (rockMeshRef.current) {
        rockMeshRef.current.count = nearbyRocks.length;
        for (let i = 0; i < nearbyRocks.length; i += 1) {
          const r = nearbyRocks[i];
          scratch.dummy.position.set(
            r.globalX - origin.x,
            r.globalY - origin.y,
            r.globalZ - origin.z,
          );
          scratch.dummy.rotation.set(r.rotX, r.rotY, 0);
          scratch.dummy.scale.set(r.scaleX, r.scaleY, r.scaleZ);
          scratch.dummy.updateMatrix();
          rockMeshRef.current.setMatrixAt(i, scratch.dummy.matrix);
        }
        rockMeshRef.current.instanceMatrix.needsUpdate = true;
      }
      if (slabMeshRef.current) {
        slabMeshRef.current.count = nearbySlabs.length;
        for (let i = 0; i < nearbySlabs.length; i += 1) {
          const s = nearbySlabs[i];
          scratch.dummy.position.set(
            s.globalX - origin.x,
            s.globalY - origin.y,
            s.globalZ - origin.z,
          );
          scratch.dummy.rotation.set(s.rotX, s.rotY, 0);
          scratch.dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
          scratch.dummy.updateMatrix();
          slabMeshRef.current.setMatrixAt(i, scratch.dummy.matrix);
        }
        slabMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // Update each tile mesh translation relative to current 1 km origin every frame
    for (const entry of tileEntriesRef.current.values()) {
      entry.mesh.position.set(entry.centerX - origin.x, -origin.y, entry.centerZ - origin.z);
    }

    // Update wheel track decals when track buffer changes or origin shifts
    if (trackMeshRef.current) {
      const stamps = simWorld.trackStamps;
      if (stamps.length !== lastTrackCountRef.current || originShifted) {
        lastTrackCountRef.current = stamps.length;
        const count = Math.min(MAX_TRACK_INSTANCES, stamps.length * 2);
        trackMeshRef.current.count = count;
        let ptr = 0;
        for (let i = 0; i < stamps.length && ptr + 1 < MAX_TRACK_INSTANCES; i += 1) {
          const st = stamps[i];
          scratch.dummy.position.set(
            st.leftGlobal.x - origin.x,
            st.leftGlobal.y - origin.y,
            st.leftGlobal.z - origin.z,
          );
          scratch.dummy.rotation.set(0, st.yawRad, 0);
          scratch.dummy.scale.set(1, 1, 1);
          scratch.dummy.updateMatrix();
          trackMeshRef.current.setMatrixAt(ptr++, scratch.dummy.matrix);

          scratch.dummy.position.set(
            st.rightGlobal.x - origin.x,
            st.rightGlobal.y - origin.y,
            st.rightGlobal.z - origin.z,
          );
          scratch.dummy.updateMatrix();
          trackMeshRef.current.setMatrixAt(ptr++, scratch.dummy.matrix);
        }
        trackMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  };

  useFrame((_, rawDelta) => {
    const store = useCosmosStore.getState();

    // Update quality pacing & Auto tier switching
    const pace = paceMonitorRef.current.recordFrame(rawDelta, store.qualityTier);
    if (pace.switchedTo && pace.switchedTo !== store.resolvedQualityTier) {
      store.setResolvedQualityTier(pace.switchedTo);
    }
    statsAccumRef.current += rawDelta;
    if (statsAccumRef.current >= 0.75) {
      statsAccumRef.current = 0;
      store.setQualityStats(paceMonitorRef.current.buildRuntimeStats(gl));
    }

    const simWorld = simWorldRef.current;
    if (!simWorld) return;

    const input = surfaceInputBridge.sample(profile.mobilityKind === 'helicopter');
    const snap = simWorld.stepFixed(
      rawDelta,
      input,
      store.simulatedMobilityEnabled,
      typeof document !== 'undefined' ? document.hidden : false,
    );
    poseRef.current = snap.pose;
    rotorSpinAngleRef.current = snap.rotorSpinAngleRad;

    // Update vehicle chassis mesh transform
    if (chassisGroupRef.current) {
      chassisGroupRef.current.position.copy(snap.localPos);
      chassisGroupRef.current.quaternion.copy(snap.quat);
    }

    // Keep sunlight and shadow frustum tracking the rover cleanly across 64 km
    if (sunLightRef.current) {
      sunLightRef.current.position.set(
        snap.localPos.x + 85,
        snap.localPos.y + 110,
        snap.localPos.z + 55,
      );
      sunLightRef.current.target.position.copy(snap.localPos);
      sunLightRef.current.target.updateMatrixWorld();
    }

    // Keep atmospheric sky dome centered on camera
    if (skyDomeRef.current) {
      skyDomeRef.current.position.copy(camera.position);
    }

    // Update streamed chunk geometries, rocks, and wheel tracks
    syncTerrainSceneMeshes(simWorld, snap);

    // Position and orient POV camera (First-Person Eye Mount vs Third-Person Chase)
    const perspective = camera as THREE.PerspectiveCamera;
    const desiredFov = profile.defaultFovDeg / store.povFovZoom;
    if (Math.abs(perspective.fov - desiredFov) > 0.05 || perspective.far < 5000) {
      perspective.near = 0.05;
      perspective.far = 6500;
      perspective.fov = desiredFov;
      perspective.updateProjectionMatrix();
    }

    const yawLook = THREE.MathUtils.degToRad(-store.povYawDeg);
    const pitchLook = THREE.MathUtils.degToRad(store.povPitchDeg);
    scratch.chassisEuler.setFromQuaternion(snap.quat, 'YXZ');

    if (store.cameraMountMode === 'first_person') {
      const eyeYLocal = baseModelOffsetY + profile.eyeHeightM;
      scratch.eyeLocal
        .set(0, eyeYLocal, -profile.eyeForwardOffsetM)
        .applyQuaternion(snap.quat)
        .add(snap.localPos);

      // Guard eye height above terrain surface even on violent pitch transitions
      const globalEyeX = scratch.eyeLocal.x + snap.originOffset.x;
      const globalEyeZ = scratch.eyeLocal.z + snap.originOffset.z;
      const eyeGroundLocalY =
        simWorld.provider.sampleHeightAt(globalEyeX, globalEyeZ) - snap.originOffset.y;
      scratch.eyeLocal.y = Math.max(scratch.eyeLocal.y, eyeGroundLocalY + 0.25);

      camera.position.copy(scratch.eyeLocal);

      if (store.horizonStabilized) {
        scratch.lookEuler.set(
          pitchLook + scratch.chassisEuler.x * 0.14,
          scratch.chassisEuler.y + yawLook,
          0,
          'YXZ',
        );
        camera.quaternion.setFromEuler(scratch.lookEuler);
      } else {
        scratch.lookEuler.set(pitchLook, yawLook, 0, 'YXZ');
        scratch.lookQuat.setFromEuler(scratch.lookEuler);
        camera.quaternion.copy(snap.quat).multiply(scratch.lookQuat);
      }
    } else {
      // Third-person chase camera orbiting behind device with terrain occlusion clamp
      const orbitYaw = scratch.chassisEuler.y + yawLook;
      const horizDist = Math.max(1.2, profile.chaseDistanceM * Math.cos(pitchLook * 0.65));
      const vertHeight = Math.max(
        0.65,
        profile.chaseHeightM - profile.chaseDistanceM * Math.sin(pitchLook * 0.65),
      );
      scratch.camPos.set(
        snap.localPos.x + Math.sin(orbitYaw) * horizDist,
        snap.localPos.y + vertHeight,
        snap.localPos.z + Math.cos(orbitYaw) * horizDist,
      );

      // Clamp chase camera height above local heightfield + mid-ray to avoid terrain clipping
      const camGlobalX = scratch.camPos.x + snap.originOffset.x;
      const camGlobalZ = scratch.camPos.z + snap.originOffset.z;
      const camGroundLocalY =
        simWorld.provider.sampleHeightAt(camGlobalX, camGlobalZ) - snap.originOffset.y;
      const midGlobalX = (snap.localPos.x + scratch.camPos.x) * 0.5 + snap.originOffset.x;
      const midGlobalZ = (snap.localPos.z + scratch.camPos.z) * 0.5 + snap.originOffset.z;
      const midGroundLocalY =
        simWorld.provider.sampleHeightAt(midGlobalX, midGlobalZ) - snap.originOffset.y;
      const minAllowedCamY = Math.max(camGroundLocalY + 0.55, midGroundLocalY + 0.35);
      if (scratch.camPos.y < minAllowedCamY) {
        scratch.camPos.y = minAllowedCamY;
      }

      camera.position.copy(scratch.camPos);
      scratch.lookTarget.set(
        snap.localPos.x,
        snap.localPos.y + profile.wheelRig.chassisBoxHalfExtentsM[1] + 0.3,
        snap.localPos.z,
      );
      camera.lookAt(scratch.lookTarget);
    }

    // Publish 8-10 Hz HUD telemetry & boundary banners
    telemetryAccumRef.current += rawDelta;
    if (telemetryAccumRef.current >= 0.11) {
      telemetryAccumRef.current = 0;
      const telemetry = simWorld.buildTelemetrySnapshot(
        store.cameraMountMode,
        store.pointerLocked,
        store.horizonStabilized,
        store.simulatedMobilityEnabled,
      );
      store.setSurfaceTelemetry(telemetry);
      const boundaryMsg =
        telemetry.stabilityWarning === 'boundary_limit'
          ? `Reached the ${store.explorationRegionSizeKm}×${store.explorationRegionSizeKm} km area boundary — select a larger area in the information panel.`
          : null;
      if (store.regionBoundaryMessage !== boundaryMsg) {
        store.setRegionBoundaryMessage(boundaryMsg);
      }
    }

    // Save checkpoint periodically when traversing long distances
    checkpointAccumRef.current += rawDelta;
    if (
      checkpointAccumRef.current >= 2.5 &&
      Math.abs(simWorld.distanceTraveledM - lastSavedDistRef.current) >= 1.5
    ) {
      checkpointAccumRef.current = 0;
      lastSavedDistRef.current = simWorld.distanceTraveledM;
      store.saveSimulationCheckpoint(simWorld.buildCheckpoint(store.explorationRegionSizeKm));
    }
  });

  const isFirstPersonMount = cameraMountMode === 'first_person';

  return (
    <group>
      <ambientLight intensity={bodyPhysics.ambientIntensity} color={bodyPhysics.ambientColorHex} />
      <hemisphereLight
        args={[
          bodyId === 'mars' ? '#ffd2ad' : '#dbeafe',
          bodyId === 'mars' ? '#512a18' : '#1f232a',
          bodyId === 'mars' ? 0.55 : 0.32,
        ]}
      />
      <directionalLight
        ref={sunLightRef}
        position={[85, 110, 55]}
        intensity={bodyPhysics.sunIntensity}
        color={bodyPhysics.sunColorHex}
        castShadow={qualityPreset.enableShadows}
        shadow-mapSize={[qualityPreset.shadowMapSize, qualityPreset.shadowMapSize]}
        shadow-camera-near={10}
        shadow-camera-far={340}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
        shadow-bias={-0.0005}
      />

      {/* Mars dusty sky dome (Moon leaves dark airless sky so DeepSpaceStarfield shines cleanly) */}
      {bodyId === 'mars' && (
        <mesh ref={skyDomeRef} frustumCulled={false}>
          <sphereGeometry args={[2800, 32, 20]} />
          <meshBasicMaterial map={skyTexture} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}

      {/* Imperatively managed streaming terrain tiles, rocks, slabs & wheel tracks */}
      <group ref={terrainGroupRef}>
        <instancedMesh
          ref={rockMeshRef}
          args={[
            sharedInstancedResources.rockGeo,
            sharedInstancedResources.rockMat,
            MAX_ROCK_INSTANCES,
          ]}
          castShadow={qualityPreset.enableShadows}
          receiveShadow
          frustumCulled={false}
        />
        <instancedMesh
          ref={slabMeshRef}
          args={[
            sharedInstancedResources.slabGeo,
            sharedInstancedResources.slabMat,
            MAX_SLAB_INSTANCES,
          ]}
          castShadow={qualityPreset.enableShadows}
          receiveShadow
          frustumCulled={false}
        />
        <instancedMesh
          ref={trackMeshRef}
          args={[
            sharedInstancedResources.trackGeo,
            sharedInstancedResources.trackMat,
            MAX_TRACK_INSTANCES,
          ]}
          receiveShadow
          frustumCulled={false}
        />
      </group>

      {/* Live simulated rover/helicopter/lander assembly */}
      <group ref={chassisGroupRef} visible={!isFirstPersonMount || profile.mobilityKind !== 'helicopter' ? true : true}>
        <SimulationDeviceAssembly
          device={device}
          targetModelPath={target?.modelPath}
          targetId={targetId}
          profile={profile}
          bodyPhysics={bodyPhysics}
          poseRef={poseRef}
          rotorSpinAngleRef={rotorSpinAngleRef}
          povArmDeployed={povArmDeployed}
          povScanActive={povScanActive}
        />
      </group>
    </group>
  );
}

interface OrbitalCupolaSceneProps {
  bodyId: BodyId;
  targetId: string;
  device: DeviceRecord | null;
  target: CelestialTarget | null;
  profile: DeviceSimulationProfile;
}

const DEFAULT_FALLBACK_ORBIT: Record<BodyId, OrbitalElements> = {
  mars: {
    semiMajorAxisKm: 4350,
    eccentricity: 0.012,
    inclinationDeg: 64,
    ascendingNodeDeg: 28,
    argumentOfPeriapsisDeg: 45,
    meanAnomalyAtEpochDeg: 18,
    orbitalPeriodHours: 2.02,
  },
  moon: {
    semiMajorAxisKm: 2650,
    eccentricity: 0.004,
    inclinationDeg: 89.2,
    ascendingNodeDeg: 35,
    argumentOfPeriapsisDeg: 90,
    meanAnomalyAtEpochDeg: 35,
    orbitalPeriodHours: 1.88,
  },
};

function OrbitalCupolaScene({
  bodyId,
  targetId,
  device,
  target,
  profile,
}: OrbitalCupolaSceneProps) {
  const { camera, gl, scene } = useThree();
  const bodyConfig = BODY_CATALOG[bodyId];
  const bodyPhysics = useMemo(() => getBodyPhysicsConfig(bodyId), [bodyId]);
  const resolvedQualityTier = useCosmosStore((s) => s.resolvedQualityTier);
  const povSensorMode = useCosmosStore((s) => s.povSensorMode);
  const povArmDeployed = useCosmosStore((s) => s.povArmDeployed);
  const povScanActive = useCosmosStore((s) => s.povScanActive);

  const planetAnchorRef = useRef<THREE.Group | null>(null);
  const planetSpinRef = useRef<THREE.Group | null>(null);
  const craftGroupRef = useRef<THREE.Group | null>(null);
  const poseRef = useRef<VehiclePoseState | null>(null);
  const rotorSpinAngleRef = useRef<number>(0);

  const dragStateRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });
  const telemetryAccumRef = useRef<number>(0);
  const statsAccumRef = useRef<number>(0);
  const paceMonitorRef = useRef<FramePacingMonitor>(new FramePacingMonitor(resolvedQualityTier));

  const orbitalActor = useMemo(() => {
    const direct = ORBITAL_ACTORS_CATALOG.find(
      (a) => a.id === targetId || LINKED_ORBITAL_DEVICE_IDS[a.id] === targetId,
    );
    if (direct?.orbitalElements) return direct;
    if (target?.orbitalElements) return target;
    return null;
  }, [target, targetId]);

  const activeElements = orbitalActor?.orbitalElements ?? DEFAULT_FALLBACK_ORBIT[bodyId];

  const scratch = useMemo(
    () => ({
      craftOrbitPos: new THREE.Vector3(),
      nadirDir: new THREE.Vector3(),
      lookQuat: new THREE.Quaternion(),
      baseQuat: new THREE.Quaternion(),
      baseMat: new THREE.Matrix4(),
      lookEuler: new THREE.Euler(0, 0, 0, 'YXZ'),
      upVec: new THREE.Vector3(0, 1, 0),
      originVec: new THREE.Vector3(0, 0, 0),
      chaseVec: new THREE.Vector3(),
      fpVec: new THREE.Vector3(),
    }),
    [],
  );

  // Clean atmospheric dark space background without terrain fog
  useEffect(() => {
    const prevFog = scene.fog;
    const prevBg = scene.background;
    scene.fog = null;
    scene.background = new THREE.Color('#020307');
    return () => {
      scene.fog = prevFog;
      scene.background = prevBg;
    };
  }, [scene]);

  useEffect(() => {
    gl.setPixelRatio(clampDevicePixelRatio(resolvedQualityTier));
    paceMonitorRef.current.setTierExplicit(resolvedQualityTier);
  }, [gl, resolvedQualityTier]);

  useEffect(() => {
    const dom = gl.domElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingElement(e.target) || e.repeat) return;
      if (e.code === 'KeyC') {
        useCosmosStore.getState().toggleCameraMountMode();
      } else if (e.code === 'Space') {
        e.preventDefault();
        useCosmosStore.getState().toggleSimulationPaused();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragStateRef.current = { active: true, x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.active) return;
      const dx = e.clientX - dragStateRef.current.x;
      const dy = e.clientY - dragStateRef.current.y;
      dragStateRef.current.x = e.clientX;
      dragStateRef.current.y = e.clientY;
      const s = useCosmosStore.getState();
      s.setPovOrientation(s.povYawDeg + dx * 0.24, s.povPitchDeg + dy * 0.18);
    };
    const stopDrag = () => {
      dragStateRef.current.active = false;
    };
    const onWheel = (e: WheelEvent) => {
      const s = useCosmosStore.getState();
      if (e.deltaY < 0) {
        s.setPovFovZoom(s.povFovZoom === 1 ? 2 : 4);
      } else if (e.deltaY > 0) {
        s.setPovFovZoom(s.povFovZoom === 4 ? 2 : 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    dom.addEventListener('pointercancel', stopDrag);
    dom.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      dom.removeEventListener('pointercancel', stopDrag);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  useFrame((_, rawDelta) => {
    const store = useCosmosStore.getState();

    // Update unified SimulationClock cleanly across Orbital Overview & Orbital Cupola POV
    const simStepBase = computeOrbitalTimeStep(
      rawDelta,
      1,
      store.simulationPaused,
      typeof document !== 'undefined' ? document.hidden : false,
    );
    if (simStepBase > 0) {
      store.advanceSimulationTime(simStepBase);
    }

    const pace = paceMonitorRef.current.recordFrame(rawDelta, store.qualityTier);
    if (pace.switchedTo && pace.switchedTo !== store.resolvedQualityTier) {
      store.setResolvedQualityTier(pace.switchedTo);
    }
    statsAccumRef.current += rawDelta;
    if (statsAccumRef.current >= 0.75) {
      statsAccumRef.current = 0;
      store.setQualityStats(paceMonitorRef.current.buildRuntimeStats(gl));
    }

    const simTime = useCosmosStore.getState().simulationTime;
    computeOrbitalPosition(activeElements, simTime, scratch.craftOrbitPos);

    // Anchor planet at -craftOrbitPos so spacecraft & camera sit cleanly near floating origin (0,0,0)
    if (planetAnchorRef.current) {
      planetAnchorRef.current.position.copy(scratch.craftOrbitPos).multiplyScalar(-1);
    }
    if (planetSpinRef.current) {
      planetSpinRef.current.rotation.y =
        (simTime / bodyConfig.rotationSeconds) * Math.PI * 2;
    }

    // Orient spacecraft nadir toward planet center
    scratch.nadirDir.copy(scratch.craftOrbitPos).multiplyScalar(-1).normalize();
    scratch.baseMat.lookAt(scratch.originVec, scratch.nadirDir, scratch.upVec);
    scratch.baseQuat.setFromRotationMatrix(scratch.baseMat);

    if (craftGroupRef.current) {
      craftGroupRef.current.quaternion.copy(scratch.baseQuat);
    }

    const perspective = camera as THREE.PerspectiveCamera;
    const desiredFov = profile.defaultFovDeg / store.povFovZoom;
    if (Math.abs(perspective.fov - desiredFov) > 0.05 || perspective.far < 40000) {
      perspective.near = 0.25;
      perspective.far = 45000;
      perspective.fov = desiredFov;
      perspective.updateProjectionMatrix();
    }

    scratch.lookEuler.set(
      THREE.MathUtils.degToRad(store.povPitchDeg),
      THREE.MathUtils.degToRad(-store.povYawDeg),
      0,
      'YXZ',
    );
    scratch.lookQuat.setFromEuler(scratch.lookEuler);

    if (store.cameraMountMode === 'first_person') {
      scratch.fpVec
        .set(0, 1.35, -profile.physicalTransform.targetLongestSideM * 0.25)
        .applyQuaternion(scratch.baseQuat);
      camera.position.copy(scratch.fpVec);
      camera.quaternion.copy(scratch.baseQuat).multiply(scratch.lookQuat);
    } else {
      scratch.chaseVec
        .set(0, profile.chaseHeightM, profile.chaseDistanceM)
        .applyQuaternion(scratch.baseQuat)
        .applyQuaternion(scratch.lookQuat);
      camera.position.copy(scratch.chaseVec);
      camera.lookAt(0, 0, 0);
    }

    telemetryAccumRef.current += rawDelta;
    if (telemetryAccumRef.current >= 0.2) {
      telemetryAccumRef.current = 0;
      const distKm = scratch.craftOrbitPos.length();
      const altKm = Math.max(0, distKm - bodyConfig.radiusKm);
      store.setSurfaceTelemetry({
        speedMs: 0,
        altitudeAboveGroundM: Number((altKm * 1000).toFixed(0)),
        elevationM: Number(altKm.toFixed(1)),
        distanceTraveledM: Number(((simTime / 3600) * 1000).toFixed(1)),
        wheelsGroundedCount: 0,
        totalWheels: 0,
        slipRatio: 0,
        stabilityWarning: 'none',
        isStreamingColliderHold: false,
        isSimulatedMobilityActive: false,
        isFlightAirborne: true,
        activeCameraMount: store.cameraMountMode,
        pointerLocked: false,
        horizonStabilized: store.horizonStabilized,
        trailPoints: [],
        activeChunkCount: 0,
        originShiftCount: 0,
      });
    }
  });

  const tintColor =
    povSensorMode === 'THERMAL_FALSE'
      ? '#fb923c'
      : povSensorMode === 'NAVCAM_MONO'
        ? '#cbd5e1'
        : '#fff3e5';

  return (
    <group>
      <ambientLight intensity={0.42} color="#8ba3c7" />
      <directionalLight position={[12000, 6000, 9000]} intensity={3.2} color={tintColor} />
      <directionalLight position={[-40, -15, 25]} intensity={0.45} color="#38bdf8" />

      {/* Full rotating textured body & atmosphere synced to unified SimulationClock */}
      <group ref={planetAnchorRef} rotation={[0, 0, bodyId === 'mars' ? MARS_AXIAL_TILT_RAD : MOON_AXIAL_TILT_RAD]}>
        <group ref={planetSpinRef}>
          <MarsLODMesh body={bodyConfig} />
        </group>
        {bodyId === 'mars' && <MarsAtmosphereMesh />}
      </group>

      {/* Scaled Orbital Spacecraft Assembly at local cupola frame */}
      <group ref={craftGroupRef}>
        <SimulationDeviceAssembly
          device={device}
          targetModelPath={target?.modelPath ?? orbitalActor?.modelPath}
          targetId={targetId}
          profile={profile}
          bodyPhysics={bodyPhysics}
          poseRef={poseRef}
          rotorSpinAngleRef={rotorSpinAngleRef}
          povArmDeployed={povArmDeployed}
          povScanActive={povScanActive}
        />
      </group>
    </group>
  );
}

export function ControlRoomFirstPersonScene() {
  const activeBodyId = useCosmosStore((s) => s.activeBodyId);
  const activeTarget = useCosmosStore((s) => s.activeTarget);
  const activeDeviceId = useCosmosStore((s) => s.activeDeviceId);

  const device = useMemo(
    () => (activeDeviceId ? DEVICE_CATALOG.find((d) => d.id === activeDeviceId) ?? null : null),
    [activeDeviceId],
  );

  const bodyId: BodyId = resolveDeviceBodyId(device, activeTarget?.bodyId ?? activeBodyId);
  const targetId = device?.id ?? activeTarget?.id ?? 'perseverance_rover';
  const profile = useMemo(
    () => getDeviceSimulationProfile(targetId, device),
    [device, targetId],
  );

  if (profile.mobilityKind === 'orbital') {
    return (
      <OrbitalCupolaScene
        key={`orbital:${bodyId}:${targetId}`}
        bodyId={bodyId}
        targetId={targetId}
        device={device}
        target={activeTarget}
        profile={profile}
      />
    );
  }

  return (
    <SurfaceSimulationScene
      key={`surface:${bodyId}:${targetId}`}
      bodyId={bodyId}
      targetId={targetId}
      device={device}
      target={activeTarget}
      profile={profile}
    />
  );
}
