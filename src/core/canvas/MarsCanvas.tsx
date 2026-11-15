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
import { detectWebGLSupport, registerRenderer } from './rendererDiagnostics';
import { CanvasErrorBoundary, CanvasFallbackPanel } from './CanvasErrorBoundary';
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
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const rendererCleanupRef = useRef<(() => void) | null>(null);
    const viewStage = useCosmosStore((state) => state.viewStage);
    const activeBodyId = useCosmosStore((state) => state.activeBodyId);
    const activeDeviceId = useCosmosStore((state) => state.activeDeviceId);
    const activeTarget = useCosmosStore((state) => state.activeTarget);
    const inspectionMode = useCosmosStore((state) => state.inspectionMode);
    const orbitalCloseup = useCosmosStore((state) => state.orbitalCloseup);
    const resolvedQualityTier = useCosmosStore((state) => state.resolvedQualityTier);
    const rendererFailure = useCosmosStore((state) => state.rendererFailure);
    const rendererRetryTick = useCosmosStore((state) => state.rendererRetryTick);
    const rendererBasicMode = useCosmosStore((state) => state.rendererBasicMode);
    const rendererAlertDismissed = useCosmosStore((state) => state.rendererAlertDismissed);
    const reportRendererFailure = useCosmosStore((state) => state.reportRendererFailure);
    const clearRendererFailure = useCosmosStore((state) => state.clearRendererFailure);
    const retryRenderer = useCosmosStore((state) => state.retryRenderer);
    const enableBasicRenderMode = useCosmosStore((state) => state.enableBasicRenderMode);
    const dismissRendererAlert = useCosmosStore((state) => state.dismissRendererAlert);

    const webglSupport = useMemo(() => {
        void rendererRetryTick;
        return detectWebGLSupport();
    }, [rendererRetryTick]);

    useEffect(() => {
        if (!webglSupport.available) {
            reportRendererFailure({
                kind: 'webgl-unavailable',
                surface: 'orbital',
                message:
                    webglSupport.reason ??
                    'The browser or device did not provide a WebGL context for the 3D scene.',
                detail: 'You can still browse celestial bodies, coordinates, equipment records, and all cited sources in text mode.',
                recoverable: true,
            });
        }
    }, [webglSupport.available, webglSupport.reason, reportRendererFailure]);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const onContextCreationError = (event: Event) => {
            const msg = (event as { statusMessage?: string }).statusMessage;
            reportRendererFailure({
                kind: 'webgl-unavailable',
                surface: 'orbital',
                message: 'Unable to initialize the WebGL graphics context (webglcontextcreationerror).',
                detail: msg || 'The graphics driver refused to create a WebGL context.',
                recoverable: true,
            });
        };
        el.addEventListener('webglcontextcreationerror', onContextCreationError, true);
        return () => {
            el.removeEventListener('webglcontextcreationerror', onContextCreationError, true);
        };
    }, [reportRendererFailure, rendererRetryTick]);

    useEffect(() => {
        return () => {
            rendererCleanupRef.current?.();
            rendererCleanupRef.current = null;
        };
    }, [rendererRetryTick, rendererBasicMode]);

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

    const showFallback =
        !webglSupport.available ||
        (rendererFailure?.surface === 'orbital' && rendererFailure.kind !== 'postprocessing-error');

    const activeFailure =
        rendererFailure?.surface === 'orbital'
            ? rendererFailure
            : !webglSupport.available
              ? {
                    kind: 'webgl-unavailable' as const,
                    surface: 'orbital' as const,
                    message:
                        webglSupport.reason ??
                        'The browser or GPU does not currently support a WebGL context.',
                    detail: 'Celestial navigation, equipment records, and cited sources remain fully available.',
                    recoverable: true,
                    timestampMs: Date.now(),
                }
              : null;

    const fallbackElement = activeFailure ? (
        <CanvasFallbackPanel
            failure={activeFailure}
            surface="orbital"
            compact={rendererAlertDismissed}
            onRetry={retryRenderer}
            onEnableBasicMode={enableBasicRenderMode}
            onDismissTextMode={dismissRendererAlert}
        />
    ) : null;

    return (
        <div
            ref={wrapperRef}
            className={`mars-canvas-wrapper ${isSurface ? 'is-surface-mode' : ''}`}
            style={{
                display: isSurface ? 'none' : 'block',
            }}
        >
            {showFallback ? (
                fallbackElement
            ) : (
                <CanvasErrorBoundary
                    resetKey={`${rendererRetryTick}-${rendererBasicMode ? 'basic' : 'full'}`}
                    surface="orbital"
                    fallback={fallbackElement}
                    onCatchError={(error) => {
                        reportRendererFailure({
                            kind: 'render-error',
                            surface: 'orbital',
                            message: 'The 3D scene encountered an initialization or rendering error.',
                            detail: error.message,
                            recoverable: true,
                        });
                    }}
                >
                    <Canvas
                        key={`orbital-canvas-${rendererRetryTick}-${rendererBasicMode ? 'basic' : 'full'}`}
                        onCreated={({ gl }) => {
                            rendererCleanupRef.current?.();
                            rendererCleanupRef.current = registerRenderer(gl, {
                                surface: 'orbital',
                                onFailure: (record) => {
                                    reportRendererFailure({
                                        kind: record.kind,
                                        surface: record.surface,
                                        message: record.message,
                                        detail: record.detail,
                                        recoverable: true,
                                    });
                                },
                                onRestored: (surface) => {
                                    clearRendererFailure(surface);
                                },
                            });
                        }}
                        shadows={qualityPreset.enableShadows && !rendererBasicMode}
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
                        <PostProcessingRig enabled={!isSurface && !rendererBasicMode} />
                    </Canvas>
                </CanvasErrorBoundary>
            )}
        </div>
    );
};
