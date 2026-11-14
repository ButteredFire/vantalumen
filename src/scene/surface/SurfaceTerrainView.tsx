import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Loader } from '@react-three/drei';
import * as THREE from 'three';
import { useCosmosStore } from '../../store/useCosmosStore';
import { surfaceAudio } from '../../core/audio/SurfaceAudioController';
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

export const SurfaceTerrainView: React.FC = () => {
    const viewStage = useCosmosStore((state) => state.viewStage);
    const activeBodyId = useCosmosStore((state) => state.activeBodyId);
    const activeTarget = useCosmosStore((state) => state.activeTarget);
    const returnToOrbit = useCosmosStore((state) => state.returnToOrbit);
    const audioMuted = useCosmosStore((state) => state.audioMuted);

    const isMoon = activeBodyId === 'moon';
    const isSurfaceStage = viewStage === 'SURFACE_VIEW' || viewStage === 'SURFACE_CESIUM';
    const [isMounted, setIsMounted] = useState(isSurfaceStage);
    const [isExiting, setIsExiting] = useState(false);

    const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));
    const [focusRevision, setFocusRevision] = useState(0);
    const [selectedEquipment, setSelectedEquipment] = useState<SurfaceEquipmentItem | null>(null);
    const [toasts, setToasts] = useState<SurfaceToast[]>([]);

    const equipmentList = useMemo(() => {
        return getSurfaceEquipmentForBody(activeBodyId);
    }, [activeBodyId]);

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
        if (!selectedEquipment) return;
        addToast(
            'success',
            'DIAGNOSTICS COMPLETE',
            `${selectedEquipment.name}: Power & thermal margins nominal. Scientific payload telemetry transmitting.`,
        );
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

    return (
        <div
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
                equipmentList={equipmentList}
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
            <Canvas
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
                    {equipmentList.map((eq) => (
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
