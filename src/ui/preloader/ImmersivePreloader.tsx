import React, { useEffect, useMemo, useRef, useState } from 'react';
import { detectWebGLSupport } from '../../core/canvas/rendererDiagnostics';
import { useCosmosStore } from '../../store/useCosmosStore';
import { spatialAudio } from '../../core/audio/SpatialAudioEngine';
import type { BodyId } from '../../types/cosmos.types';

export const ImmersivePreloader: React.FC = () => {
    const viewStage = useCosmosStore((state) => state.viewStage);
    const loadingProgress = useCosmosStore((state) => state.loadingProgress);
    const requiredAssetsReady = useCosmosStore((state) => state.requiredAssetsReady);
    const loadingStatusLabel = useCosmosStore((state) => state.loadingStatusLabel);
    const startLaunchSequence = useCosmosStore((state) => state.startLaunchSequence);
    const completePreloader = useCosmosStore((state) => state.completePreloader);
    const selectBody = useCosmosStore((state) => state.selectBody);
    const activeBodyId = useCosmosStore((state) => state.activeBodyId);
    const bodyTransition = useCosmosStore((state) => state.bodyTransition);
    const rendererFailure = useCosmosStore((state) => state.rendererFailure);
    const rendererRetryTick = useCosmosStore((state) => state.rendererRetryTick);

    const webglSupport = useMemo(() => {
        void rendererRetryTick;
        return detectWebGLSupport();
    }, [rendererRetryTick]);
    const hasWebglBlocker =
        !webglSupport.available ||
        Boolean(rendererFailure && rendererFailure.kind !== 'postprocessing-error');

    const [selectedDestination, setSelectedDestination] = useState<BodyId>(activeBodyId || 'mars');
    const [displayPct, setDisplayPct] = useState(0);
    const [hasMoved, setHasMoved] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [zoomDisplay, setZoomDisplay] = useState(100);

    const stageRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 0, y: 0 });
    const zoomRef = useRef(1.0);
    const hasMovedRef = useRef(false);
    const targetTiltRef = useRef({ rx: 5, ry: -3 });
    const currentTiltRef = useRef({ rx: 5, ry: -3 });
    const dragStartRef = useRef<{
        pointerX: number;
        pointerY: number;
        startX: number;
        startY: number;
    } | null>(null);

    // Smoothly interpolate display percentage up to the actual loading progress
    useEffect(() => {
        const interval = window.setInterval(() => {
            setDisplayPct((prev) => {
                if (prev === loadingProgress) return prev;
                if (prev < loadingProgress) {
                    return Math.min(
                        loadingProgress,
                        prev + Math.max(1, Math.ceil((loadingProgress - prev) * 0.25)),
                    );
                }
                return loadingProgress;
            });
        }, 35);

        return () => {
            window.clearInterval(interval);
        };
    }, [loadingProgress]);

    // 3D tilt and mouse scroll zoom interpolation via rAF & direct DOM transform updates
    useEffect(() => {
        if (viewStage !== 'PRELOADING') return;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            targetTiltRef.current = { rx: 0, ry: 0 };
            currentTiltRef.current = { rx: 0, ry: 0 };
        }

        let rafId = 0;
        const updateTiltLoop = () => {
            const cur = currentTiltRef.current;
            const tgt = targetTiltRef.current;
            cur.rx += (tgt.rx - cur.rx) * 0.14;
            cur.ry += (tgt.ry - cur.ry) * 0.14;

            if (cardRef.current) {
                const z = zoomRef.current;
                cardRef.current.style.transform = `perspective(1100px) scale(${z.toFixed(3)}) rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)`;
            }
            rafId = window.requestAnimationFrame(updateTiltLoop);
        };
        rafId = window.requestAnimationFrame(updateTiltLoop);

        const handlePointerMove = (e: PointerEvent) => {
            if (dragStartRef.current) {
                const dx = e.clientX - dragStartRef.current.pointerX;
                const dy = e.clientY - dragStartRef.current.pointerY;

                const maxX = Math.max(120, window.innerWidth * 0.45);
                const maxYUp = Math.max(120, window.innerHeight * 0.72);
                const maxYDown = 60;

                const nextX = Math.max(-maxX, Math.min(maxX, dragStartRef.current.startX + dx));
                const nextY = Math.max(-maxYUp, Math.min(maxYDown, dragStartRef.current.startY + dy));

                posRef.current.x = nextX;
                posRef.current.y = nextY;

                if (stageRef.current) {
                    stageRef.current.style.transform = `translate3d(${nextX.toFixed(1)}px, ${nextY.toFixed(1)}px, 0)`;
                }

                const movedNow = Math.abs(nextX) > 4 || Math.abs(nextY) > 4;
                if (movedNow !== hasMovedRef.current) {
                    hasMovedRef.current = movedNow;
                    setHasMoved(movedNow);
                }
                return;
            }

            if (!reduced) {
                const nx = (e.clientX / window.innerWidth - 0.5) * 2;
                const ny = (e.clientY / window.innerHeight - 0.5) * 2;
                targetTiltRef.current.rx = 5 - ny * 6;
                targetTiltRef.current.ry = -3 + nx * 8;
            }
        };

        const handlePointerUp = () => {
            if (!dragStartRef.current) return;
            dragStartRef.current = null;
            setIsDragging(false);
        };

        // Zoom holographic console with respect to camera on mouse wheel
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.0015;
            const nextZoom = Math.max(0.55, Math.min(2.2, zoomRef.current + delta));
            zoomRef.current = nextZoom;
            setZoomDisplay(Math.round(nextZoom * 100));
        };

        const stageEl = stageRef.current;
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        if (stageEl) {
            stageEl.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            if (stageEl) {
                stageEl.removeEventListener('wheel', handleWheel);
            }
        };
    }, [viewStage]);

    const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        dragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            startX: posRef.current.x,
            startY: posRef.current.y,
        };
        setIsDragging(true);
    };

    const handleResetPositionAndZoom = () => {
        posRef.current.x = 0;
        posRef.current.y = 0;
        zoomRef.current = 1.0;
        hasMovedRef.current = false;
        setHasMoved(false);
        setZoomDisplay(100);
        if (stageRef.current) {
            stageRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
    };

    const isReady = requiredAssetsReady && displayPct >= 100;

    const handleLaunch = () => {
        if (!isReady) return;
        selectBody(selectedDestination);
        spatialAudio.initAndStart();
        startLaunchSequence();
    };

    const handleEnterTextMode = () => {
        selectBody(selectedDestination);
        completePreloader();
    };

    if (viewStage === 'LAUNCHING') {
        const destLabel = selectedDestination === 'mars' ? 'MARS' : "THE MOON";
        return (
            <div className="alpha-jump-hud-notice" aria-live="polite">
                <span className="telemetry-tag">ALPHA JUMP ENGAGED</span>
                <strong>WARPING SPACE-TIME INTO {destLabel} ORBIT...</strong>
            </div>
        );
    }

    if (viewStage === 'BODY_TRANSITION' && bodyTransition) {
        const destLabel = bodyTransition.targetBodyId === 'mars' ? 'MARS' : "THE MOON";
        return (
            <div className="alpha-jump-hud-notice" aria-live="polite">
                <span className="telemetry-tag">INTERPLANETARY WARP ENGAGED</span>
                <strong>WARPING SPACE-TIME INTO {destLabel} ORBIT...</strong>
            </div>
        );
    }

    if (viewStage !== 'PRELOADING') return null;

    const isMoon = selectedDestination === 'moon';

    return (
        <div className="preloader-backdrop" role="dialog" aria-labelledby="preloader-title">
            <div className="preloader-warp-rings" aria-hidden="true">
                <div className="warp-ring ring-1" />
                <div className="warp-ring ring-2" />
            </div>

            <div
                ref={stageRef}
                className="preloader-3d-stage"
                style={{
                    transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
                }}
            >
                <div
                    ref={cardRef}
                    onPointerDown={handleCardPointerDown}
                    className={`preloader-card preloader-card-3d glass-panel ${
                        isDragging ? 'is-dragging' : ''
                    }`}
                    style={{
                        transform: `perspective(1100px) scale(${zoomRef.current.toFixed(3)}) rotateX(${currentTiltRef.current.rx.toFixed(2)}deg) rotateY(${currentTiltRef.current.ry.toFixed(2)}deg)`,
                    }}
                >
                    {/* 3D background depth plate & holographic grid */}
                    <div className="card-3d-depth-plate" aria-hidden="true" />
                    <div className="card-3d-holo-grid" aria-hidden="true" />

                    {/* Console drag & zoom handle bar */}
                    <div className="card-3d-drag-bar">
                        <span className="drag-grip-label">
                            ⋮⋮ DRAG TO MOVE • SCROLL TO ZOOM ({zoomDisplay}%)
                        </span>
                        {(hasMoved || zoomDisplay !== 100) && (
                            <button
                                type="button"
                                className="card-reset-pos-btn"
                                onClick={handleResetPositionAndZoom}
                                title="Reset console position and zoom"
                            >
                                ↺ Reset
                            </button>
                        )}
                    </div>

                    {/* Destination Selection Bar */}
                    <div className="preloader-destination-selector" role="group" aria-label="Target Destination">
                        <span className="destination-tag-label">SELECT DESTINATION:</span>
                        <div className="destination-btn-row">
                            <button
                                type="button"
                                className={`destination-choice-btn ${!isMoon ? 'is-active' : ''}`}
                                aria-pressed={!isMoon}
                                onClick={() => setSelectedDestination('mars')}
                            >
                                <span className="dest-dot dest-mars" />
                                <span>MARS</span>
                            </button>
                            <button
                                type="button"
                                className={`destination-choice-btn ${isMoon ? 'is-active' : ''}`}
                                aria-pressed={isMoon}
                                onClick={() => setSelectedDestination('moon')}
                            >
                                <span className="dest-dot dest-moon" />
                                <span>THE MOON</span>
                            </button>
                        </div>
                    </div>

                    <div className="card-3d-layer-mid">
                        <span className="telemetry-tag">
                            {isMoon
                                ? 'ARTEMIS TELEMETRY OS v4.2 • STANDBY FOR ALPHA JUMP'
                                : 'ARES TELEMETRY OS v4.2 • STANDBY FOR ALPHA JUMP'}
                        </span>
                        <h1 id="preloader-title" className="preloader-heading">
                            {isMoon ? 'LUNAR ORBITAL ATLAS' : 'MARS ORBITAL ATLAS'}
                        </h1>
                        <p className="preloader-subtitle">
                            {isMoon
                                ? "Expedition vessel has entered the cis-lunar approach corridor. Verifying 3D assets, orbital telemetry, and standing by for orbital insertion around Earth's Moon."
                                : 'Expedition vessel has entered the Mars approach corridor. Verifying 3D assets, orbital telemetry, and standing by for orbital insertion.'}
                        </p>
                    </div>

                    <div className="card-3d-layer-front">
                        <div className="preloader-progress-track">
                            <div
                                className="preloader-progress-fill"
                                style={{ width: `${displayPct}%` }}
                            />
                        </div>

                        <div className="preloader-diagnostics">
                            <span>[OK] Logarithmic Depth Buffer (0.1m – 10⁷ km)</span>
                            <span>[OK] Draco WASM &amp; KTX2 Worker Pool</span>
                            {hasWebglBlocker ? (
                                <span role="alert" data-testid="preloader-webgl-warning">
                                    [TEXT MODE] {rendererFailure?.message ?? webglSupport.reason}
                                </span>
                            ) : (
                                <span>{loadingStatusLabel}</span>
                            )}
                            <span>
                                {hasWebglBlocker
                                    ? 'EQUIPMENT RECORDS & SOURCE DATA READY'
                                    : `${displayPct}% SYSTEM ASSETS INITIALIZED`}
                            </span>
                        </div>

                        {hasWebglBlocker ? (
                            <button
                                type="button"
                                onClick={handleEnterTextMode}
                                className="preloader-launch-btn is-text-fallback"
                                data-testid="preloader-text-mode-btn"
                            >
                                {`OPEN TEXT & RECORDS MODE (${isMoon ? 'MOON' : 'MARS'})`}
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={!isReady}
                                onClick={handleLaunch}
                                className="preloader-launch-btn"
                            >
                                {isReady
                                    ? `ENGAGE ORBITAL INSERTION (ALPHA JUMP TO ${isMoon ? 'THE MOON' : 'MARS'})`
                                    : `INITIALIZING SHIP & TELEMETRY... ${displayPct}%`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
