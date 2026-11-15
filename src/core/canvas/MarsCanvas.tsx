import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { getDeviceSimulationProfile } from '../../config/deviceSimulationProfiles';
import { CosmosSceneRoot } from '../../scene/CosmosSceneRoot';
import { PostProcessingRig } from '../postprocessing/PostProcessingRig';
import { SplineCameraRig } from '../camera/SplineCameraRig';
import {
    clampDevicePixelRatio,
    FramePacingMonitor,
    getQualityPreset,
} from '../quality/QualityManager';
import { FloatingOriginManager } from './FloatingOriginManager';
import { registerRenderer } from './rendererDiagnostics';
import { useCosmosStore } from '../../store/useCosmosStore';
import { DeepSpaceStarfield } from '../../scene/environment/DeepSpaceStarfield';

const CanvasQualityMonitorBridge: React.FC = () => {
    const { gl } = useThree();
    const resolvedQualityTier = useCosmosStore((s) => s.resolvedQualityTier);
    const qualityTier = useCosmosStore((s) => s.qualityTier);
    const inspectionMode = useCosmosStore((s) => s.inspectionMode);
    const monitorRef = useRef<FramePacingMonitor>(new FramePacingMonitor(resolvedQualityTier));
    const accumRef = useRef(0);

    useEffect(() => {
        monitorRef.current.setTierExplicit(resolvedQualityTier);
        gl.setPixelRatio(clampDevicePixelRatio(resolvedQualityTier));
    }, [gl, resolvedQualityTier]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = (e: MediaQueryListEvent) => {
            useCosmosStore.getState().setReducedMotion(e.matches);
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    useFrame((_, delta) => {
        // ControlRoomFirstPersonScene manages frame pacing directly while in POV mode
        if (inspectionMode === 'CONTROL_ROOM_POV') return;
        const pace = monitorRef.current.recordFrame(delta, qualityTier);
        if (pace.switchedTo && pace.switchedTo !== resolvedQualityTier) {
            useCosmosStore.getState().setResolvedQualityTier(pace.switchedTo);
        }
        accumRef.current += delta;
        if (accumRef.current >= 0.75) {
            accumRef.current = 0;
            useCosmosStore.getState().setQualityStats(monitorRef.current.buildRuntimeStats(gl));
        }
    });

    return null;
};

export const MarsCanvas: React.FC = () => {
    const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
    const viewStage = useCosmosStore((state) => state.viewStage);
    const activeBodyId = useCosmosStore((state) => state.activeBodyId);
    const activeDeviceId = useCosmosStore((state) => state.activeDeviceId);
    const activeTarget = useCosmosStore((state) => state.activeTarget);
    const inspectionMode = useCosmosStore((state) => state.inspectionMode);
    const orbitalCloseup = useCosmosStore((state) => state.orbitalCloseup);
    const resolvedQualityTier = useCosmosStore((state) => state.resolvedQualityTier);

    const isSurface = viewStage === 'SURFACE_VIEW' || viewStage === 'SURFACE_CESIUM';
    const isControlRoomPov =
        inspectionMode === 'CONTROL_ROOM_POV' &&
        (Boolean(activeDeviceId) || Boolean(activeTarget));
    const isOrbitalCloseup =
        !activeDeviceId &&
        Boolean(activeTarget?.modelPath) &&
        orbitalCloseup &&
        inspectionMode === 'MODEL_CLOSEUP';
    const povProfile = useMemo(
        () => getDeviceSimulationProfile(activeDeviceId ?? activeTarget?.id ?? null),
        [activeDeviceId, activeTarget?.id],
    );
    const showStarfield =
        viewStage === 'BODY_TRANSITION' ||
        (isControlRoomPov && (activeBodyId === 'moon' || povProfile.mobilityKind === 'orbital')) ||
        (!activeDeviceId && !isControlRoomPov && !isOrbitalCloseup);

    const qualityPreset = useMemo(
        () => getQualityPreset(resolvedQualityTier),
        [resolvedQualityTier],
    );
    const canvasDpr = useMemo(
        () => clampDevicePixelRatio(resolvedQualityTier),
        [resolvedQualityTier],
    );

    return (
        <div
            className={`mars-canvas-wrapper ${isSurface ? 'is-surface-mode' : ''}`}
            style={{
                display: isSurface ? 'none' : 'block',
            }}
        >
            <Canvas
                onCreated={({ gl }) => registerRenderer(gl)}
                shadows={qualityPreset.enableShadows}
                frameloop={isSurface ? 'never' : 'always'}
                gl={{
                    powerPreference: 'high-performance',
                    antialias: false, // Disabled default MSAA in favor of Postprocessing SMAA
                    stencil: false,
                    depth: true,
                    logarithmicDepthBuffer: true, // Eliminates Z-fighting across astronomical scales
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.15,
                }}
                camera={{
                    fov: 45,
                    near: 0.1,
                    far: 1e10,
                    position: [0, 8000, 88000],
                }}
                dpr={canvasDpr}
            >
                <color attach="background" args={['#020205']} />
                <AdaptiveDpr pixelated />
                <AdaptiveEvents />
                <DeepSpaceStarfield visible={showStarfield} showTransitionStreaks />
                <Suspense fallback={null}>
                    <FloatingOriginManager>
                        <CosmosSceneRoot sunLightRef={directionalLightRef} />
                    </FloatingOriginManager>
                </Suspense>
                <CanvasQualityMonitorBridge />
                <SplineCameraRig />
                <PostProcessingRig enabled={!isSurface} />
            </Canvas>
        </div>
    );
};
