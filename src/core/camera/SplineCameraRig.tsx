import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import gsap from 'gsap';
import { useCosmosStore } from '../../store/useCosmosStore';
import { BODY_CATALOG } from '../../config/bodyCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { getDeviceControlSpec } from '../../config/deviceControlSpecs';
import { buildSafeWarpSpline } from './warpPaths';
import { spatialAudio } from '../audio/SpatialAudioEngine';
import { OPENING_CAMERA_POS, OPENING_LOOK_TARGET } from '../../scene/opening/OpeningShipScene';

const INSPECTION_MIN_DISTANCE = 0.35;
const INSPECTION_MAX_DISTANCE = 24;

function isOrbitalDevice(deviceId: string | null): boolean {
  return (
    deviceId === 'mro_orbiter' ||
    deviceId === 'dawn_spacecraft' ||
    deviceId === 'near_shoemaker' ||
    deviceId === 'pioneer_10' ||
    deviceId === 'kepler_space_telescope'
  );
}

export function SplineCameraRig() {
    const { camera } = useThree();
    const controls = useRef<OrbitControlsImpl>(null);
    const prevDeviceIdRef = useRef<string | null>(null);
    const launchTimelineRef = useRef<gsap.core.Timeline | null>(null);

    const bodyId = useCosmosStore((state) => state.activeBodyId);
    const deviceId = useCosmosStore((state) => state.activeDeviceId);
    const deviceCameraViewId = useCosmosStore((state) => state.deviceCameraViewId);
    const deviceCameraTick = useCosmosStore((state) => state.deviceCameraTick);
    const inspectionMode = useCosmosStore((state) => state.inspectionMode);
    const orbitalCloseup = useCosmosStore((state) => state.orbitalCloseup);
    const povYawDeg = useCosmosStore((state) => state.povYawDeg);
    const povPitchDeg = useCosmosStore((state) => state.povPitchDeg);
    const povFovZoom = useCosmosStore((state) => state.povFovZoom);
    const spectralMode = useCosmosStore((state) => state.spectralMode);
    const target = useCosmosStore((state) => state.activeTarget);
    const reset = useCosmosStore((state) => state.cameraResetTick);
    const viewStage = useCosmosStore((state) => state.viewStage);

    const device = DEVICE_CATALOG.find((item) => item.id === deviceId);
    const hasPovSelection = Boolean(device) || Boolean(target);
    const isControlRoomPov = inspectionMode === 'CONTROL_ROOM_POV' && hasPovSelection;

    const isAvailableDevice = device?.status === 'available';
    const isProceduralDevice =
        device?.status === 'unavailable' && Boolean(device.proceduralModel);
    const isTerrainShowcase =
        spectralMode === 'TERRAIN_MESH_3D' &&
        !device &&
        (!target || target.category === 'SURFACE_POI');
    const isOrbitalCloseup =
        !device &&
        Boolean(target?.modelPath) &&
        orbitalCloseup &&
        inspectionMode === 'MODEL_CLOSEUP';

    const isNormalizedCloseup =
        !isControlRoomPov &&
        (isAvailableDevice || isProceduralDevice || isTerrainShowcase || isOrbitalCloseup);

    const radius = BODY_CATALOG[bodyId].radiusKm;

    // Cockpit camera setup on launch and alpha jump listener
    useEffect(() => {
        const perspective = camera as PerspectiveCamera;
        const initialStage = useCosmosStore.getState().viewStage;

        if (initialStage === 'PRELOADING' && controls.current) {
            perspective.position.copy(OPENING_CAMERA_POS);
            controls.current.target.copy(OPENING_LOOK_TARGET);
            controls.current.enabled = false;
            perspective.lookAt(OPENING_LOOK_TARGET);
        }

        const unsubStage = useCosmosStore.subscribe(
            (state) => state.viewStage,
            (stage, prevStage) => {
                if (stage !== 'LAUNCHING' || prevStage === 'LAUNCHING' || !controls.current) return;

                launchTimelineRef.current?.kill();
                controls.current.enabled = false;

                const reduced =
                    typeof window !== 'undefined' &&
                    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                const durationTotal = reduced ? 1.8 : 3.4;
                spatialAudio.playWarpTransition(durationTotal);

                const currentBody = useCosmosStore.getState().activeBodyId;
                const bodyRadius = BODY_CATALOG[currentBody].radiusKm;
                const destOverview =
                    currentBody === 'mars'
                        ? new Vector3(0, 8000, 22000)
                        : new Vector3(0, bodyRadius * 0.72, bodyRadius * 3.9);

                const jumpCurve = new CatmullRomCurve3(
                    [
                        OPENING_CAMERA_POS.clone(),
                        new Vector3(0, 8150, 56000),
                        destOverview.clone(),
                    ],
                    false,
                    'centripetal',
                    0.5,
                );

                const progressProxy = { t: 0 };
                const peakFov = reduced ? 52 : 76;

                launchTimelineRef.current = gsap
                    .timeline({
                        onComplete: () => {
                            if (!controls.current) return;
                            perspective.position.copy(destOverview);
                            controls.current.target.set(0, 0, 0);
                            controls.current.update();
                            controls.current.enabled = true;
                            useCosmosStore.getState().completeLaunchSequence();
                        },
                    })
                    .to(
                        progressProxy,
                        {
                            t: 1,
                            duration: durationTotal,
                            ease: 'power3.inOut',
                            onUpdate: () => {
                                const pt = jumpCurve.getPointAt(progressProxy.t);
                                perspective.position.copy(pt);
                                controls.current?.target.set(0, 0, 0);
                                perspective.lookAt(0, 0, 0);
                            },
                        },
                        0,
                    )
                    .to(
                        perspective,
                        {
                            fov: peakFov,
                            duration: durationTotal * 0.36,
                            ease: 'power2.in',
                            onUpdate: () => perspective.updateProjectionMatrix(),
                        },
                        0,
                    )
                    .to(
                        perspective,
                        {
                            fov: 45,
                            duration: durationTotal * 0.64,
                            ease: 'power3.out',
                            onUpdate: () => perspective.updateProjectionMatrix(),
                        },
                        durationTotal * 0.36,
                    );
            },
        );

        return () => {
            unsubStage();
            launchTimelineRef.current?.kill();
        };
    }, [camera]);

  // Apply real-time pan/tilt/zoom inside CONTROL_ROOM_POV without triggering warp animations
  useEffect(() => {
    if (!isControlRoomPov) return;
    const orbit = controls.current;
    if (orbit) orbit.enabled = false;

    const perspective = camera as PerspectiveCamera;
    perspective.near = 0.05;
    perspective.far = 160;
    perspective.fov = 52 / povFovZoom;
    perspective.updateProjectionMatrix();

    const isOrbitalCupola =
      isOrbitalDevice(device?.id ?? null) ||
      target?.category === 'MOON' ||
      target?.category === 'SPACECRAFT';
    const eyeY = isOrbitalCupola
      ? 0
      : device?.id === 'ingenuity_helicopter'
        ? 0.56
        : 1.12;

    camera.position.set(0, eyeY, 0);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(
      MathUtils.degToRad(povPitchDeg),
      MathUtils.degToRad(-povYawDeg),
      0,
    );
  }, [
    camera,
    device?.id,
    isControlRoomPov,
    povFovZoom,
    povPitchDeg,
    povYawDeg,
    target?.category,
  ]);

    useEffect(() => {
        if (isControlRoomPov) return;
        const orbit = controls.current;
        if (!orbit) return;

        const currentStage = useCosmosStore.getState().viewStage;
        if (currentStage === 'PRELOADING' || currentStage === 'LAUNCHING') {
            orbit.enabled = false;
            return;
        }
        if (currentStage === 'SURFACE_VIEW' || currentStage === 'SURFACE_CESIUM') {
            orbit.enabled = false;
            return;
        }

        camera.rotation.order = 'XYZ';
    const perspective = camera as PerspectiveCamera;
    perspective.near = isNormalizedCloseup ? 0.01 : 1;
    perspective.far = isNormalizedCloseup ? 180 : 1000000;
    perspective.fov = 45;
    perspective.updateProjectionMatrix();

    const overview =
      bodyId === 'mars'
        ? new Vector3(0, radius * 1.15, radius * 5.2)
        : new Vector3(0, radius * 0.72, radius * 3.9);
    orbit.enabled = true;

    if (isTerrainShowcase) {
      orbit.minDistance = 2.0;
      orbit.maxDistance = INSPECTION_MAX_DISTANCE;
      useCosmosStore.getState().setViewStage('SUB_SCENE');
      camera.position.set(0, 6.2, 10.5);
      orbit.target.set(0, 0.35, 0);
      orbit.update();
      return;
    }

    if ((isAvailableDevice || isProceduralDevice) && deviceId) {
      orbit.minDistance = INSPECTION_MIN_DISTANCE;
      orbit.maxDistance = INSPECTION_MAX_DISTANCE;
      if (isAvailableDevice) {
        useCosmosStore.getState().setViewStage('SUB_SCENE');
      }

      const spec = getDeviceControlSpec(deviceId);
      const activeView = spec
        ? (spec.cameraViews.find((view) => view.id === deviceCameraViewId) ?? spec.cameraViews[0])
        : null;
      const desiredPos = activeView ? new Vector3(...activeView.position) : new Vector3(2.8, 1.55, 2.8);
      const desiredTarget = activeView ? new Vector3(...activeView.target) : new Vector3(0, 0, 0);

      const sameDevice = prevDeviceIdRef.current === deviceId;
      prevDeviceIdRef.current = deviceId;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!sameDevice || reduced || !spec) {
        camera.position.copy(desiredPos);
        orbit.target.copy(desiredTarget);
        orbit.update();
        return;
      }

      const startPos = camera.position.clone();
      const startTarget = orbit.target.clone();
      const progress = { t: 0 };
      orbit.enabled = false;
      const tween = gsap.to(progress, {
        t: 1,
        duration: 0.45,
        ease: 'power2.out',
        onUpdate: () => {
          camera.position.lerpVectors(startPos, desiredPos, progress.t);
          orbit.target.lerpVectors(startTarget, desiredTarget, progress.t);
          camera.lookAt(orbit.target);
        },
        onComplete: () => {
          camera.position.copy(desiredPos);
          orbit.target.copy(desiredTarget);
          orbit.enabled = true;
          orbit.update();
        },
      });
      return () => {
        tween.kill();
        orbit.enabled = true;
      };
    }

    if (isOrbitalCloseup && !deviceId) {
      orbit.minDistance = INSPECTION_MIN_DISTANCE;
      orbit.maxDistance = INSPECTION_MAX_DISTANCE;
      useCosmosStore.getState().setViewStage('SUB_SCENE');
      camera.position.set(2.4, 1.35, 2.5);
      orbit.target.set(0, 0, 0);
      orbit.update();
      return;
    }

    prevDeviceIdRef.current = null;
    orbit.minDistance =
      target && (target.category === 'MOON' || target.category === 'SPACECRAFT')
        ? Math.max(40, target.radius * 1.35)
        : radius * 0.08;
    orbit.maxDistance = radius * 25;

    if (!target) {
      camera.position.copy(overview);
      orbit.target.set(0, 0, 0);
      orbit.update();
      useCosmosStore.getState().setViewStage('ORBITAL_OVERVIEW');
      return;
    }

    if (currentStage === 'SUB_SCENE' && !isNormalizedCloseup) {
      orbit.enabled = true;
      return;
    }

    // Returning from normalized unit modes or POV resets back to orbital scale before warping.
    if (camera.position.length() < radius) {
      camera.position.copy(overview);
    }

    const { curve } = buildSafeWarpSpline(camera.position, target, radius);
    const startLook = orbit.target.clone();
    const progress = { t: 0 };
    orbit.enabled = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = gsap.to(progress, {
      t: 1,
      duration: reduced ? 0 : 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.copy(curve.getPointAt(progress.t));
        orbit.target.lerpVectors(startLook, target.position, progress.t);
        camera.lookAt(orbit.target);
      },
      onComplete: () => {
        orbit.enabled = true;
        orbit.update();
        useCosmosStore.getState().setViewStage('SUB_SCENE');
      },
    });
    return () => {
      tween.kill();
      orbit.enabled = true;
    };
  }, [
    camera,
    bodyId,
    deviceId,
    deviceCameraViewId,
    deviceCameraTick,
    isAvailableDevice,
    isControlRoomPov,
    isNormalizedCloseup,
    isOrbitalCloseup,
    isProceduralDevice,
    isTerrainShowcase,
    target,
    viewStage,
    reset,
    radius,
  ]);

  useFrame((_, delta) => {
    const state = useCosmosStore.getState();
    if (
      state.viewStage === 'ORBITAL_OVERVIEW' &&
      !isNormalizedCloseup &&
      !isControlRoomPov
    ) {
      state.advanceSimulationTime(Math.min(delta, 0.1));
    }
    if (!isNormalizedCloseup && !isControlRoomPov && camera.position.length() < radius * 1.02) {
      camera.position.normalize().multiplyScalar(radius * 1.02);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={!isControlRoomPov}
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      rotateSpeed={0.6}
      zoomSpeed={0.9}
      minDistance={isNormalizedCloseup ? INSPECTION_MIN_DISTANCE : radius * 0.08}
      maxDistance={isNormalizedCloseup ? INSPECTION_MAX_DISTANCE : radius * 25}
    />
  );
}
