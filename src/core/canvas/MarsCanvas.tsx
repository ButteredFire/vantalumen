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

export const MarsCanvas: React.FC = () => {
    const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
    const viewStage = useCosmosStore((state) => state.viewStage);

    const isSurface = viewStage === 'SURFACE_VIEW' || viewStage === 'SURFACE_CESIUM';

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
                <Suspense fallback={null}>
                    <FloatingOriginManager>
                        <CosmosSceneRoot sunLightRef={directionalLightRef} />
                    </FloatingOriginManager>
                    <SplineCameraRig />
                    <PostProcessingRig />
                </Suspense>
            </Canvas>
        </div>
    );
};
