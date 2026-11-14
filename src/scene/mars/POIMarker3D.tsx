import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import { useCosmosStore } from '../../store/useCosmosStore';
import type { CelestialTarget } from '../../types/cosmos.types';
import { AssetCalloutBox, type CalloutVariant } from '../../ui/hud/AssetCalloutBox';

interface POIMarker3DProps {
    target: CelestialTarget;
    planetCenter: Vector3;
    variant?: CalloutVariant;
}

export function POIMarker3D({ target, planetCenter, variant = 1 }: POIMarker3DProps) {
    const ref = useRef<Group>(null);
    const world = useRef(new Vector3());
    const normal = useRef(new Vector3());
    const toCamera = useRef(new Vector3());
    const [isVisible, setIsVisible] = useState(true);

    const selected = useCosmosStore((state) => state.activeTarget?.id === target.id);
    const viewStage = useCosmosStore((state) => state.viewStage);
    const controlsLocked = useCosmosStore((state) => state.controlsLocked);
    const selectTarget = useCosmosStore((state) => state.selectTarget);

    useFrame(({ camera }) => {
        if (!ref.current) return;
        ref.current.getWorldPosition(world.current);
        useCosmosStore.getState().updateDynamicPosition(target.id, world.current);
        normal.current.copy(world.current).sub(planetCenter).normalize();
        toCamera.current.copy(camera.position).sub(world.current).normalize();

        const dot = normal.current.dot(toCamera.current);
        const shouldShow = dot > 0.05;
        if (shouldShow !== isVisible) {
            setIsVisible(shouldShow);
        }
    });

    const dotColor = selected ? '#9affbd' : '#ffdc8f';
    const hideForCloseInspection = selected && (viewStage === 'SUB_SCENE' || viewStage === 'SURFACE_VIEW');
    const showCallout = isVisible && !controlsLocked && !hideForCloseInspection;
    const elevationLabel = target.coordinates?.elevationKm !== undefined
        ? `MOLA ${target.coordinates.elevationKm > 0 ? `+${target.coordinates.elevationKm}` : target.coordinates.elevationKm} KM`
        : 'NATURAL LANDMARK';

    return (
        <group ref={ref} position={target.position}>
            {/* Colored dot on the surface */}
            <mesh
                onClick={(event) => {
                    event.stopPropagation();
                    if (!controlsLocked) selectTarget(target);
                }}
                onPointerOver={() => {
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'default';
                }}
            >
                <sphereGeometry args={[22, 12, 12]} />
                <meshBasicMaterial color={dotColor} />
            </mesh>

            {/* Tooltip pin retaining the color of the dot */}
            <Html
                zIndexRange={[15, 0]}
                style={{
                    opacity: showCallout ? 1 : 0,
                    pointerEvents: showCallout ? 'auto' : 'none',
                    transition: 'opacity 0.25s ease-out',
                }}
            >
                <AssetCalloutBox
                    title={target.name}
                    meta={elevationLabel}
                    category={target.category}
                    variant={variant}
                    accentColor={dotColor}
                    isSelected={selected}
                    isVisible={showCallout}
                    onClick={() => {
                        if (!controlsLocked) selectTarget(target);
                    }}
                />
            </Html>
        </group>
    );
}
