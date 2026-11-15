import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { assetManager } from '../../core/loaders/AssetStreamManager';
import { detectWebGLSupport } from '../../core/canvas/rendererDiagnostics';
import { disposeModel, normalizePreview } from '../../core/loaders/modelResources';
import type { QualityTier } from '../../types/cosmos.types';

export const MASCOT_MODEL_PATH = '/assets/mascot/rise_plushie.glb';

export interface RiseMascotProps {
    isOpen: boolean;
    isDragging: boolean;
    isPressed: boolean;
    reducedMotion: boolean;
    resolvedQualityTier: QualityTier;
}

interface MascotBoundaryProps {
    onError: () => void;
    children: React.ReactNode;
}

interface MascotBoundaryState {
    hasError: boolean;
}

class MascotErrorBoundary extends Component<MascotBoundaryProps, MascotBoundaryState> {
    public state: MascotBoundaryState = { hasError: false };

    public static getDerivedStateFromError(): MascotBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(): void {
        this.props.onError();
    }

    public render(): React.ReactNode {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}

const MascotFallbackGlyph: React.FC = () => (
    <span className="project-chat-launcher-fallback" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="44" height="44" fill="none">
            <circle cx="20" cy="22" r="12.5" fill="#fde6d8" stroke="#38bdf8" strokeWidth="1.4" />
            <circle cx="20" cy="11.5" r="7.5" fill="#0073ff" />
            <path
                d="M15.5 9.2c1.6-1.4 4.1-1.3 5.2.3.8 1.2 2.4 1.6 3.7.8"
                stroke="#019f50"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
            <circle cx="15.8" cy="22" r="1.5" fill="#0f172a" />
            <circle cx="24.2" cy="22" r="1.5" fill="#0f172a" />
            <path
                d="M17.2 26c1.6 1.5 4 1.5 5.6 0"
                stroke="#0f172a"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    </span>
);

interface RiseMascotMeshProps {
    shouldAnimate: boolean;
    isPressed: boolean;
    reducedMotion: boolean;
    onReady: () => void;
    onFailure: () => void;
}

const RESTING_SCALE = new THREE.Vector3(1, 1, 1);
const PRESSED_SCALE = new THREE.Vector3(1.12, 0.78, 1.12);

const RiseMascotMesh: React.FC<RiseMascotMeshProps> = ({
    shouldAnimate,
    isPressed,
    reducedMotion,
    onReady,
    onFailure,
}) => {
    const gl = useThree((state) => state.gl);
    const invalidate = useThree((state) => state.invalidate);
    const poseGroupRef = useRef<THREE.Group | null>(null);
    const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        let ownedGroup: THREE.Group | null = null;

        assetManager.initWithRenderer(gl);
        void assetManager
            .loadModel(MASCOT_MODEL_PATH, controller.signal, () => {})
            .then((scene) => {
                if (!active || controller.signal.aborted) {
                    disposeModel(scene);
                    return;
                }
                const normalized = normalizePreview(scene);
                normalized.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.castShadow = false;
                        obj.receiveShadow = false;
                    }
                });
                ownedGroup = normalized;
                setModelGroup(normalized);
                onReady();
                invalidate();
            })
            .catch(() => {
                if (controller.signal.aborted || !active) return;
                if (ownedGroup) {
                    disposeModel(ownedGroup);
                    ownedGroup = null;
                }
                onFailure();
            });

        return () => {
            active = false;
            controller.abort();
            if (ownedGroup) {
                disposeModel(ownedGroup);
                ownedGroup = null;
            }
        };
    }, [gl, invalidate, onFailure, onReady]);

    useEffect(() => {
        const group = poseGroupRef.current;
        if (!group) return;
        if (!shouldAnimate) {
            group.position.set(0, 0, 0);
            group.rotation.set(0.06, 0.14, 0);
        }
        invalidate();
    }, [shouldAnimate, modelGroup, invalidate]);

    useFrame(({ clock }, delta) => {
        const group = poseGroupRef.current;
        if (!group) return;
        if (shouldAnimate) {
            const t = clock.getElapsedTime();
            group.rotation.y = 0.14 + Math.sin(t * 0.85) * 0.24;
            group.rotation.x = 0.06 + Math.sin(t * 1.1) * 0.04;
            group.rotation.z = Math.cos(t * 1.0) * 0.04;
        }
        const targetScale = isPressed ? PRESSED_SCALE : RESTING_SCALE;
        group.scale.lerp(targetScale, reducedMotion ? 1 : 1 - Math.exp(-delta * 18));
        const targetY = (shouldAnimate ? Math.sin(clock.getElapsedTime() * 1.45) * 0.08 : 0) -
            (isPressed ? 0.055 : 0);
        group.position.y += (targetY - group.position.y) * (reducedMotion ? 1 : 1 - Math.exp(-delta * 18));
    });

    if (!modelGroup) return null;

    return (
        <group ref={poseGroupRef} rotation={[0.06, 0.14, 0]}>
            <primitive object={modelGroup} />
        </group>
    );
};

/**
 * Lightweight 3D launcher avatar rendering /assets/mascot/rise_plushie.glb.
 * Pauses animation & renders on demand when hidden, dragged, opened, on Low tier,
 * or under prefers-reduced-motion, with automatic vector fallback if WebGL fails.
 */
export const RiseMascot: React.FC<RiseMascotProps> = ({
    isOpen,
    isDragging,
    isPressed,
    reducedMotion,
    resolvedQualityTier,
}) => {
    const hostRef = useRef<HTMLSpanElement | null>(null);
    const cleanupGlListenersRef = useRef<(() => void) | null>(null);
    const webglSupport = useMemo(() => detectWebGLSupport(), []);

    const [modelReady, setModelReady] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [contextLost, setContextLost] = useState(false);
    const [squeezeAnimationActive, setSqueezeAnimationActive] = useState(false);
    const [docVisible, setDocVisible] = useState(() =>
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
    );
    const handleReady = useCallback(() => setModelReady(true), []);
    const handleFailure = useCallback(() => setLoadFailed(true), []);

    useEffect(() => {
        if (isPressed) {
            setSqueezeAnimationActive(true);
            return undefined;
        }
        if (!squeezeAnimationActive) return undefined;
        const timer = window.setTimeout(() => setSqueezeAnimationActive(false), 260);
        return () => window.clearTimeout(timer);
    }, [isPressed, squeezeAnimationActive]);

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const onVisibilityChange = () => {
            setDocVisible(document.visibilityState !== 'hidden');
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    useEffect(() => {
        const el = hostRef.current;
        if (!el) return undefined;
        const onCreationError = () => {
            setLoadFailed(true);
        };
        el.addEventListener('webglcontextcreationerror', onCreationError, true);
        return () => {
            el.removeEventListener('webglcontextcreationerror', onCreationError, true);
        };
    }, []);

    useEffect(() => {
        return () => {
            cleanupGlListenersRef.current?.();
            cleanupGlListenersRef.current = null;
        };
    }, []);

    const canUseWebGL = webglSupport.available && !loadFailed && !contextLost;
    const shouldAnimate =
        canUseWebGL &&
        modelReady &&
        !isOpen &&
        !isPressed &&
        !isDragging &&
        !reducedMotion &&
        resolvedQualityTier !== 'low' &&
        docVisible;
    const mascotState = !canUseWebGL ? 'fallback' : modelReady ? 'ready' : 'loading';

    return (
        <span
            ref={hostRef}
            className="project-chat-mascot-stage"
            data-mascot-state={mascotState}
            data-mascot-animating={shouldAnimate ? 'true' : 'false'}
            aria-hidden="true"
        >
            {canUseWebGL ? (
                <MascotErrorBoundary onError={() => setLoadFailed(true)}>
                    <Canvas
                        className="project-chat-mascot-canvas"
                        frameloop={shouldAnimate || squeezeAnimationActive ? 'always' : 'demand'}
                        dpr={resolvedQualityTier === 'low' ? 1 : [1, 1.5]}
                        camera={{ position: [0, 0.14, 3.85], fov: 35, near: 0.1, far: 30 }}
                        gl={{
                            alpha: true,
                            antialias: resolvedQualityTier !== 'low',
                            powerPreference: 'low-power',
                            preserveDrawingBuffer: false,
                        }}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'block',
                            pointerEvents: 'none',
                        }}
                        onCreated={({ gl }) => {
                            cleanupGlListenersRef.current?.();
                            const canvas = gl.domElement;
                            const onLost = (event: Event) => {
                                event.preventDefault();
                                setContextLost(true);
                            };
                            const onRestored = () => {
                                setContextLost(false);
                            };
                            canvas.addEventListener('webglcontextlost', onLost, false);
                            canvas.addEventListener('webglcontextrestored', onRestored, false);
                            cleanupGlListenersRef.current = () => {
                                canvas.removeEventListener('webglcontextlost', onLost, false);
                                canvas.removeEventListener('webglcontextrestored', onRestored, false);
                            };
                        }}
                    >
                        <ambientLight intensity={1.15} color="#fff7ed" />
                        <hemisphereLight args={['#e0f2fe', '#334155', 0.85]} />
                        <directionalLight position={[2.4, 3.2, 4.0]} intensity={1.65} color="#ffffff" />
                        <directionalLight position={[-2.5, -1.2, 2.2]} intensity={0.75} color="#7dd3fc" />
                        <Suspense fallback={null}>
                            <RiseMascotMesh
                                shouldAnimate={shouldAnimate}
                                isPressed={isPressed}
                                reducedMotion={reducedMotion}
                                onReady={handleReady}
                                onFailure={handleFailure}
                            />
                        </Suspense>
                    </Canvas>
                </MascotErrorBoundary>
            ) : null}

            {(!canUseWebGL || !modelReady) && <MascotFallbackGlyph />}
        </span>
    );
};
