import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, type Group } from 'three';
import { ATLAS_POIS, latLonToBodyVector } from '../../config/atlasPOIs';
import { MARS_AXIAL_TILT_RAD, MOON_AXIAL_TILT_RAD } from '../../config/celestialCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { useCosmosStore } from '../../store/useCosmosStore';
import type { BodyConfig, DeviceRecord } from '../../types/cosmos.types';
import { PhobosOrbit } from '../moons/PhobosOrbit';
import { DeimosOrbit } from '../moons/DeimosOrbit';
import { MarsAtmosphereMesh } from './MarsAtmosphereMesh';
import { MarsLODMesh } from './MarsLODMesh';
import { POIMarker3D } from './POIMarker3D';
import { AssetCalloutBox } from '../../ui/hud/AssetCalloutBox';

interface SurfaceDevicePinNodeProps {
    device: DeviceRecord;
    localPos: Vector3;
    beaconRadius: number;
    planetCenter: Vector3;
}

const SurfaceDevicePinNode: React.FC<SurfaceDevicePinNodeProps> = ({
    device,
    localPos,
    beaconRadius,
    planetCenter,
}) => {
    const groupRef = useRef<Group>(null);
    const worldPos = useRef(new Vector3());
    const normal = useRef(new Vector3());
    const toCamera = useRef(new Vector3());
    const [isVisible, setIsVisible] = useState(true);

    const activeDeviceId = useCosmosStore((state) => state.activeDeviceId);
    const viewStage = useCosmosStore((state) => state.viewStage);
    const controlsLocked = useCosmosStore((state) => state.controlsLocked);
    const selectDevice = useCosmosStore((state) => state.selectDevice);

    const isSelected = activeDeviceId === device.id;
    const dotColor = device.status === 'available' ? '#38bdf8' : '#f59e0b';

    useFrame(({ camera }) => {
        if (!groupRef.current) return;
        groupRef.current.getWorldPosition(worldPos.current);
        normal.current.copy(worldPos.current).sub(planetCenter).normalize();
        toCamera.current.copy(camera.position).sub(worldPos.current).normalize();

        const dot = normal.current.dot(toCamera.current);
        const shouldShow = dot > 0.05;
        if (shouldShow !== isVisible) {
            setIsVisible(shouldShow);
        }
    });

    const hideForCloseInspection = isSelected && (viewStage === 'SUB_SCENE' || viewStage === 'SURFACE_VIEW');
    const showCallout = isVisible && !controlsLocked && !hideForCloseInspection;

    return (
        <group ref={groupRef} position={localPos}>
            {/* Colored dot on the planetary surface */}
            <mesh
                onClick={(event) => {
                    event.stopPropagation();
                    if (!controlsLocked) selectDevice(device.id);
                }}
                onPointerOver={() => {
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'default';
                }}
            >
                <octahedronGeometry args={[isSelected ? beaconRadius * 1.45 : beaconRadius, 0]} />
                <meshStandardMaterial
                    color={dotColor}
                    emissive={dotColor}
                    emissiveIntensity={isSelected ? 1.8 : 0.85}
                />
            </mesh>

            {/* Tooltip pin pointing to the equipment, retaining the exact dot color */}
            <Html
                zIndexRange={[15, 0]}
                style={{
                    opacity: showCallout ? 1 : 0,
                    pointerEvents: showCallout ? 'auto' : 'none',
                    transition: 'opacity 0.25s ease-out',
                }}
            >
                <AssetCalloutBox
                    title={device.name}
                    meta={device.kind ? device.kind.toUpperCase() : 'EQUIPMENT'}
                    category="SURFACE_POI"
                    variant={1}
                    accentColor={dotColor}
                    isSelected={isSelected}
                    isVisible={showCallout}
                    onClick={() => {
                        if (!controlsLocked) selectDevice(device.id);
                    }}
                />
            </Html>
        </group>
    );
};

export function MarsPlanetGroup({ body }: { body: BodyConfig }) {
    const spinGroupRef = useRef<Group>(null);
    const planetCenter = useMemo(() => new Vector3(0, 0, 0), []);
    const showPOIs = useCosmosStore((state) => state.showPOIs);
    const showOrbits = useCosmosStore((state) => state.showOrbits);
    const viewStage = useCosmosStore((state) => state.viewStage);
    const showSurfaceMarkers =
        showPOIs && viewStage !== 'PRELOADING' && viewStage !== 'LAUNCHING';

    const tiltRad = body.id === 'mars' ? MARS_AXIAL_TILT_RAD : MOON_AXIAL_TILT_RAD;
    const pois = useMemo(
        () => ATLAS_POIS.filter((poi) => poi.bodyId === body.id),
        [body.id],
    );
    const surfaceDevices = useMemo(
        () =>
            DEVICE_CATALOG.filter(
                (device) => device.bodyId === body.id && Boolean(device.coordinates),
            ).map((device) => ({
                device,
                localPos: latLonToBodyVector(
                    device.coordinates!.lat,
                    device.coordinates!.lon,
                    body.radiusKm + 14,
                ),
            })),
        [body.id, body.radiusKm],
    );

    useFrame(() => {
        if (!spinGroupRef.current) return;
        spinGroupRef.current.rotation.y =
            (useCosmosStore.getState().simulationTime / body.rotationSeconds) * Math.PI * 2;
    });

    return (
        <group rotation={[0, 0, tiltRad]}>
            <group ref={spinGroupRef}>
                <MarsLODMesh body={body} />
                {showSurfaceMarkers &&
                    pois.map((poi) => (
                        <POIMarker3D key={poi.id} target={poi} planetCenter={planetCenter} />
                    ))}
                {showSurfaceMarkers &&
                    surfaceDevices.map(({ device, localPos }) => {
                        const beaconRadius = Math.max(18, body.radiusKm * 0.008);
                        return (
                            <SurfaceDevicePinNode
                                key={device.id}
                                device={device}
                                localPos={localPos}
                                beaconRadius={beaconRadius}
                                planetCenter={planetCenter}
                            />
                        );
                    })}
            </group>

            {body.id === 'mars' && <MarsAtmosphereMesh />}
            {body.id === 'mars' && showOrbits && (
                <>
                    <PhobosOrbit />
                    <DeimosOrbit />
                </>
            )}
        </group>
    );
}
