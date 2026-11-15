import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Loader } from '@react-three/drei';
import * as THREE from 'three';
import { useCosmosStore } from '../../store/useCosmosStore';
import { surfaceAudio } from '../../core/audio/SurfaceAudioController';
import { detectWebGLSupport, registerRenderer } from '../../core/canvas/rendererDiagnostics';
import { CanvasErrorBoundary, CanvasFallbackPanel } from '../../core/canvas/CanvasErrorBoundary';
import {
    getSurfaceEquipmentForBody,
    findSurfaceEquipmentByCoords,
    latLonToMapCoords,
} from '../../config/surfaceEquipment';
import type { SurfaceEquipmentItem } from '../../types/cosmos.types';
import { PlanetaryTerrainMesh } from './PlanetaryTerrainMesh';
import { MartianDustParticles } from './MartianDustParticles';
import { MartianAtmosphericFog } from './MartianAtmosphericFog';
import { SurfaceMapControls } from './SurfaceMapControls';
import { SurfaceBeaconPin } from './SurfaceBeaconPin';
import { SurfaceHeaderBanner } from '../../ui/surface/SurfaceHeaderBanner';
import { SurfaceTelemetryPanel } from '../../ui/surface/SurfaceTelemetryPanel';
import { SurfaceRadarGizmo } from '../../ui/surface/SurfaceRadarGizmo';
import { SurfaceToastSystem, type SurfaceToast } from '../../ui/surface/SurfaceToastSystem';
import { ATLAS_POIS, latLonToBodyVector } from '../../config/atlasPOIs';
import { BODY_CATALOG } from '../../config/bodyCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import type { BodyId, CelestialTarget } from '../../types/cosmos.types';

const SURFACE_DEVICE_IDS: Record<string, string> = {
    perseverance: 'perseverance_rover',
    curiosity: 'curiosity_rover',
    opportunity: 'spirit_and_opportunity_rover',
    viking_1: 'viking_lander',
    sojourner: 'sojourner_rover',
    insight: 'insight_lander',
    apollo_11: 'apollo_lm_equipment',
    apollo_15_site: 'apollo_15_lrv',
    apollo_17_site: 'apollo_17_lrv',
    apollo_12_surveyor: 'apollo_surface_equipment',
};

const INSPECTION_LOADING_MS = 2100;

function createSurfaceInspectionTarget(
    equipment: SurfaceEquipmentItem,
    bodyId: BodyId,
): CelestialTarget {
    const nearbyPoi = ATLAS_POIS.find((poi) => {
        if (poi.bodyId !== bodyId || !poi.coordinates) return false;
        const latDistance = Math.abs(poi.coordinates.lat - equipment.realCoords.lat);
        const rawLonDistance = Math.abs(poi.coordinates.lon - equipment.realCoords.lon);
        const lonDistance = Math.min(rawLonDistance, 360 - rawLonDistance);
        return latDistance < 1 && lonDistance < 1;
    });
    if (nearbyPoi) return nearbyPoi;

    const body = BODY_CATALOG[bodyId];
    return {
        id: `surface_inspection_${equipment.id}`,
        bodyId,
        name: equipment.name,
        subtitle: 'Surface asset inspection',
        category: 'SURFACE_POI',
        position: latLonToBodyVector(
            equipment.realCoords.lat,
            equipment.realCoords.lon,
            body.radiusKm + 18,
        ),
        radius: 100,
        safeViewDistance: body.radiusKm * 0.8,
        coordinates: {
            lat: equipment.realCoords.lat,
            lon: equipment.realCoords.lon,
            height: 0,
            ...(equipment.elevationM === undefined
                ? {}
                : { elevationKm: equipment.elevationM / 1000 }),
        },
        telemetry: {
            ...body.target.telemetry,
            classification: equipment.status,
            missionSummary: equipment.description,
            keyHighlights: [equipment.mission, equipment.status],
        },
    };
}

export const SurfaceTerrainView: React.FC = () => {
    const viewStage = useCosmosStore((state) => state.viewStage);
    const activeBodyId = useCosmosStore((state) => state.activeBodyId);
    const activeTarget = useCosmosStore((state) => state.activeTarget);
    const returnToOrbit = useCosmosStore((state) => state.returnToOrbit);
    const selectDevice = useCosmosStore((state) => state.selectDevice);
    const selectTarget = useCosmosStore((state) => state.selectTarget);
    const setInspectionMode = useCosmosStore((state) => state.setInspectionMode);
    const setSpectralMode = useCosmosStore((state) => state.setSpectralMode);
    const inspectionTransitionTarget = useCosmosStore((state) => state.inspectionTransitionTarget);
    const setInspectionTransitionTarget = useCosmosStore(
        (state) => state.setInspectionTransitionTarget,
    );
    const audioMuted = useCosmosStore((state) => state.audioMuted);
    const rendererFailure = useCosmosStore((state) => state.rendererFailure);
    const rendererRetryTick = useCosmosStore((state) => state.rendererRetryTick);
    const rendererBasicMode = useCosmosStore((state) => state.rendererBasicMode);
    const reportRendererFailure = useCosmosStore((state) => state.reportRendererFailure);
    const clearRendererFailure = useCosmosStore((state) => state.clearRendererFailure);
    const retryRenderer = useCosmosStore((state) => state.retryRenderer);
    const enableBasicRenderMode = useCosmosStore((state) => state.enableBasicRenderMode);

    const rendererCleanupRef = useRef<(() => void) | null>(null);
    const surfaceWrapperRef = useRef<HTMLDivElement | null>(null);

    const isMoon = activeBodyId === 'moon';
    const isSurfaceStage = viewStage === 'SURFACE_VIEW' || viewStage === 'SURFACE_CESIUM';
    const [isMounted, setIsMounted] = useState(isSurfaceStage);
    const [isExiting, setIsExiting] = useState(false);

    const webglSupport = useMemo(() => {
        void rendererRetryTick;
        return detectWebGLSupport();
    }, [rendererRetryTick]);

    useEffect(() => {
        if (isMounted && !webglSupport.available) {
            reportRendererFailure({
                kind: 'webgl-unavailable',
                surface: 'surface_terrain',
                message:
                    webglSupport.reason ??
                    'The browser or GPU did not provide a WebGL context for the 3D surface scene.',
                detail: 'Return to the overview to view equipment records, coordinates, and source documents.',
                recoverable: true,
            });
        }
    }, [isMounted, webglSupport.available, webglSupport.reason, reportRendererFailure]);

    useEffect(() => {
        const el = surfaceWrapperRef.current;
        if (!el) return;
        const onContextCreationError = (event: Event) => {
            const msg = (event as { statusMessage?: string }).statusMessage;
            reportRendererFailure({
                kind: 'webgl-unavailable',
                surface: 'surface_terrain',
                message: 'Unable to initialize a WebGL context for the 3D surface scene.',
                detail: msg || 'The graphics driver refused to create a WebGL context.',
                recoverable: true,
            });
        };
        el.addEventListener('webglcontextcreationerror', onContextCreationError, true);
        return () => {
            el.removeEventListener('webglcontextcreationerror', onContextCreationError, true);
        };
    }, [isMounted, reportRendererFailure, rendererRetryTick]);

    useEffect(() => {
        return () => {
            rendererCleanupRef.current?.();
            rendererCleanupRef.current = null;
        };
    }, [isMounted, rendererRetryTick, rendererBasicMode]);

    const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));
    const [focusRevision, setFocusRevision] = useState(0);
    const [selectedEquipment, setSelectedEquipment] = useState<SurfaceEquipmentItem | null>(null);
    const [toasts, setToasts] = useState<SurfaceToast[]>([]);
    const inspectionTimerRef = useRef<number | null>(null);

    const equipmentList = useMemo(() => {
        return getSurfaceEquipmentForBody(activeBodyId);
    }, [activeBodyId]);
    const surfacePinList = useMemo(() => {
        if (
            !selectedEquipment ||
            equipmentList.some((equipment) => equipment.id === selectedEquipment.id)
        ) {
            return equipmentList;
        }
        return [...equipmentList, selectedEquipment];
    }, [equipmentList, selectedEquipment]);

    // Handle smooth mounting & crossfade lifecycle
    useEffect(() => {
        if (isSurfaceStage) {
            setIsMounted(true);
            setIsExiting(false);
        } else if (isMounted) {
            setIsExiting(true);
            const timer = setTimeout(() => {
                setIsMounted(false);
                setIsExiting(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [isSurfaceStage]);

    useEffect(() => {
        if (isSurfaceStage) {
            surfaceAudio.startAmbience(activeBodyId, 0.24, 2500);
        }
    }, [isSurfaceStage, activeBodyId]);

    // Initial sync with activeTarget coordinates from orbital globe selection
    useEffect(() => {
        if (activeTarget?.coordinates) {
            const { lat, lon } = activeTarget.coordinates;
            const matched = findSurfaceEquipmentByCoords(lat, lon, activeBodyId);
            if (matched) {
                setSelectedEquipment(matched);
            } else {
                const customItem: SurfaceEquipmentItem = {
                    id: activeTarget.id,
                    name: activeTarget.name,
                    bodyId: activeBodyId,
                    realCoords: { lat, lon },
                    status: 'SURFACE RECON TARGET',
                    mission: activeTarget.telemetry.classification,
                    description: activeTarget.telemetry.missionSummary,
                    elevationM: (activeTarget.coordinates.elevationKm ?? 0) * 1000,
                    coords: latLonToMapCoords(lat, lon),
                };
                setSelectedEquipment(customItem);
            }
        } else if (!selectedEquipment || selectedEquipment.bodyId !== activeBodyId) {
            const defaultEq = equipmentList[0] ?? null;
            setSelectedEquipment(defaultEq);
        }
    }, [activeTarget, activeBodyId, equipmentList]);

    // Sync audio muted state
    useEffect(() => {
        surfaceAudio.updateMuteState(audioMuted);
    }, [audioMuted]);

    useEffect(
        () => () => {
            if (inspectionTimerRef.current !== null) {
                window.clearTimeout(inspectionTimerRef.current);
            }
            setInspectionTransitionTarget(null);
        },
        [setInspectionTransitionTarget],
    );

    const addToast = (type: SurfaceToast['type'], title: string, description?: string) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, type, title, description }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4200);
    };

    const handleSelectEquipment = (equipment: SurfaceEquipmentItem) => {
        setSelectedEquipment(equipment);
        setFocusRevision((revision) => revision + 1);
        addToast(
            'info',
            `TELEMETRY LOCKED: ${equipment.name.toUpperCase()}`,
            `Coordinates: ${equipment.realCoords.lat.toFixed(2)}°N, ${equipment.realCoords.lon.toFixed(2)}°E`,
        );
    };

    const handleInspect = () => {
        if (!selectedEquipment || inspectionTransitionTarget) return;
        setInspectionTransitionTarget(selectedEquipment.name);
        inspectionTimerRef.current = window.setTimeout(() => {
            const deviceId = SURFACE_DEVICE_IDS[selectedEquipment.id];
            const device = DEVICE_CATALOG.find(
                (item) => item.id === deviceId && item.bodyId === activeBodyId,
            );

            if (device) {
                selectDevice(device.id);
            } else {
                selectTarget(createSurfaceInspectionTarget(selectedEquipment, activeBodyId));
                setInspectionMode('MODEL_CLOSEUP');
                setSpectralMode('TERRAIN_MESH_3D');
            }

            inspectionTimerRef.current = null;
            setInspectionTransitionTarget(null);
        }, INSPECTION_LOADING_MS);
    };

    const handleRecenter = () => {
        if (!selectedEquipment?.coords) return;
        setFocusRevision((revision) => revision + 1);
        addToast(
            'info',
            'CAMERA RE-CENTERED',
            `Aligning sensor array to ${selectedEquipment.name}.`,
        );
    };

    const handleReturnToOrbit = () => {
        if (isExiting) return;
        setIsExiting(true);
        surfaceAudio.playCollapse();
        surfaceAudio.stopAmbience(1200);

        // Simultaneously trigger return to orbit so orbital globe begins crossfading in
        returnToOrbit();
    };

    // Calculate current 3D focus coordinate
    const focusCoords = useMemo<[number, number, number] | null>(() => {
        if (!selectedEquipment?.coords) return null;
        return selectedEquipment.coords;
    }, [selectedEquipment]);

    if (!isMounted) return null;

    const showSurfaceFallback =
        !webglSupport.available ||
        (rendererFailure?.surface === 'surface_terrain' &&
            rendererFailure.kind !== 'postprocessing-error');

    const surfaceFailure =
        rendererFailure?.surface === 'surface_terrain'
            ? rendererFailure
            : !webglSupport.available
              ? {
                    kind: 'webgl-unavailable' as const,
                    surface: 'surface_terrain' as const,
                    message:
                        webglSupport.reason ??
                        'The browser or GPU did not provide a WebGL context for the 3D surface scene.',
                    detail: 'Return to the overview to browse records, coordinates, and source documents.',
                    recoverable: true,
                    timestampMs: Date.now(),
                }
              : null;

    const surfaceFallbackElement = surfaceFailure ? (
        <CanvasFallbackPanel
            failure={surfaceFailure}
            surface="surface_terrain"
            onRetry={retryRenderer}
            onEnableBasicMode={enableBasicRenderMode}
            onReturnToOrbit={handleReturnToOrbit}
        />
    ) : null;

    return (
        <div
            ref={surfaceWrapperRef}
            className={`surface-terrain-experience ${isExiting ? 'is-exiting' : 'is-active'} ${isMoon ? 'is-lunar-view' : 'is-martian-view'}`}
            role="region"
            aria-label={isMoon ? '3D Lunar Surface Terrain View' : '3D Martian Surface Terrain View'}
        >
            <div className="surface-vignette-overlay" aria-hidden="true" />

            {/* Top Navigation & Status Bar */}
            <SurfaceHeaderBanner
                bodyId={activeBodyId}
                selectedEquipment={selectedEquipment}
                onReturnToOrbit={handleReturnToOrbit}
            />

            {/* Left Radar Navigation Gizmo */}
            <SurfaceRadarGizmo
                equipmentList={surfacePinList}
                selectedEquipment={selectedEquipment}
                cameraTargetRef={cameraTargetRef}
                onSelectEquipment={handleSelectEquipment}
            />

            {/* Right Telemetry Panel (when target selected) */}
            {selectedEquipment && (
                <SurfaceTelemetryPanel
                    equipment={selectedEquipment}
                    onClose={() => setSelectedEquipment(null)}
                    onInspect={handleInspect}
                    onRecenter={handleRecenter}
                />
            )}

            {/* Toasts Feedback */}
            <SurfaceToastSystem
                toasts={toasts}
                onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
            />

            {/* 3D Scene Canvas with Low FOV=12 for scale & telephoto depth */}
            {showSurfaceFallback ? (
                surfaceFallbackElement
            ) : (
                <CanvasErrorBoundary
                    resetKey={`surface-${rendererRetryTick}-${rendererBasicMode ? 'basic' : 'full'}`}
                    surface="surface_terrain"
                    fallback={surfaceFallbackElement}
                    onCatchError={(error) => {
                        reportRendererFailure({
                            kind: 'render-error',
                            surface: 'surface_terrain',
                            message: 'The 3D surface scene encountered an initialization or rendering error.',
                            detail: error.message,
                            recoverable: true,
                        });
                    }}
                >
                    <Canvas
                        key={`surface-canvas-${rendererRetryTick}-${rendererBasicMode ? 'basic' : 'full'}`}
                        onCreated={({ gl }) => {
                            rendererCleanupRef.current?.();
                            rendererCleanupRef.current = registerRenderer(gl, {
                                surface: 'surface_terrain',
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
                        camera={{
                            fov: 12,
                            position: [0, 800, 1000],
                            near: 0.1,
                            far: 5000,
                        }}
                    >
                        {/* Atmospheric or space background */}
                        <color attach="background" args={[isMoon ? '#020205' : '#c7a47b']} />

                        <Suspense fallback={null}>
                            {/* 3D Surface Ground Mesh (generalized for Mars or Moon) */}
                            <PlanetaryTerrainMesh key={activeBodyId} bodyId={activeBodyId} />

                            {/* Mars atmosphere features: dust particles & fog (skipped on airless Moon) */}
                            {!isMoon && (
                                <>
                                    <MartianDustParticles />
                                    <MartianAtmosphericFog />
                                </>
                            )}

                            {/* Fixed-size Beacon Pins for Equipment & Landmarks */}
                            {surfacePinList.map((eq) => (
                                <SurfaceBeaconPin
                                    key={eq.id}
                                    equipment={eq}
                                    isSelected={selectedEquipment?.id === eq.id}
                                    onClick={() => handleSelectEquipment(eq)}
                                />
                            ))}

                            <Environment preset={isMoon ? 'night' : 'sunset'} environmentIntensity={isMoon ? 0.35 : 0.65} />
                            <directionalLight
                                position={isMoon ? [100, 120, 60] : [100, 80, 50]}
                                intensity={isMoon ? 1.25 : 0.6}
                                color={isMoon ? '#ffffff' : '#ffd4b8'}
                            />
                            <ambientLight
                                intensity={isMoon ? 0.22 : 0.28}
                                color={isMoon ? '#383844' : '#9a6e4d'}
                            />

                        </Suspense>

                        {/* Buttery, sluggish inertia MapControls consistent across both views */}
                        <SurfaceMapControls
                            focusTarget={focusCoords}
                            focusRevision={focusRevision}
                            cameraTargetRef={cameraTargetRef}
                        />
                    </Canvas>
                </CanvasErrorBoundary>
            )}

            <Loader
                dataInterpolation={(p) =>
                    `Streaming ${isMoon ? 'Lunar' : 'Martian'} Surface Terrain... ${p.toFixed(0)}%`
                }
                containerStyles={{ background: '#020205' }}
                innerStyles={{ width: '320px' }}
                barStyles={{ background: isMoon ? '#7dd3fc' : '#f18b62' }}
            />
        </div>
    );
};

export const MarsSurfaceTerrainView = SurfaceTerrainView;
