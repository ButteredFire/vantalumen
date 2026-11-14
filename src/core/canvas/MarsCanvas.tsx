import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { CosmosSceneRoot } from '../../scene/CosmosSceneRoot';
import { PostProcessingRig } from '../postprocessing/PostProcessingRig';
import { SplineCameraRig } from '../camera/SplineCameraRig';
import { FloatingOriginManager } from './FloatingOriginManager';
import { registerRenderer } from './rendererDiagnostics';
import { useCosmosStore } from '../../store/useCosmosStore';
import { DeepSpaceStarfield } from '../../scene/environment/DeepSpaceStarfield';

export const MarsCanvas: React.FC = () => {
    const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
    const viewStage = useCosmosStore((state) => state.viewStage);
    const activeDeviceId = useCosmosStore((state) => state.activeDeviceId);
    const activeTarget = useCosmosStore((state) => state.activeTarget);
    const inspectionMode = useCosmosStore((state) => state.inspectionMode);
    const orbitalCloseup = useCosmosStore((state) => state.orbitalCloseup);

    const isSurface = viewStage === 'SURFACE_VIEW' || viewStage === 'SURFACE_CESIUM';
    const isControlRoomPov =
        inspectionMode === 'CONTROL_ROOM_POV' &&
        (Boolean(activeDeviceId) || Boolean(activeTarget));
    const isOrbitalCloseup =
        !activeDeviceId &&
        Boolean(activeTarget?.modelPath) &&
        orbitalCloseup &&
        inspectionMode === 'MODEL_CLOSEUP';
    const showStarfield =
        viewStage === 'BODY_TRANSITION' ||
        (!activeDeviceId && !isControlRoomPov && !isOrbitalCloseup);

    return (
        <div
            className={`mars-canvas-wrapper ${isSurface ? 'is-surface-mode' : ''}`}
            style={{
                display: isSurface ? 'none' : 'block',
            }}
        >
            <Canvas
                onCreated={({ gl }) => registerRenderer(gl)}
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
                dpr={[1, 2]}
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
                <SplineCameraRig />
                <PostProcessingRig />
            </Canvas>
        </div>
    );
};
