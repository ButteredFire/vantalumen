import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { surfaceAudio } from '../../core/audio/SurfaceAudioController';

interface SurfaceMapControlsProps {
    focusTarget: [number, number, number] | null;
    focusRevision: number;
    cameraTargetRef?: React.MutableRefObject<THREE.Vector3>;
}

export const SurfaceMapControls: React.FC<SurfaceMapControlsProps> = ({
    focusTarget,
    focusRevision,
    cameraTargetRef,
}) => {
    const controlsRef = useRef<MapControlsImpl>(null!);
    const focusDestination = useRef(new THREE.Vector3());
    const isFocusing = useRef(false);
    const lastFocusTarget = useRef<[number, number, number] | null>(null);
    const lastFocusRevision = useRef<number | null>(null);
    const lastNavigationSoundAt = useRef(0);
    const offset = useRef(new THREE.Vector3());
    
    // Define limits for camera movement
    // The divisions are arbitrary on purpose
    const limitX = 1000 / 1.5;
    const limitZ = 500 / 2.0;

    useEffect(() => {
        if (!focusTarget) {
            return;
        }

        const sameTarget = lastFocusTarget.current?.every(
            (value, index) => value === focusTarget[index],
        );
        if (sameTarget && lastFocusRevision.current === focusRevision) return;

        lastFocusTarget.current = [...focusTarget];
        lastFocusRevision.current = focusRevision;
        focusDestination.current.set(...focusTarget);
        isFocusing.current = true;
    }, [focusRevision, focusTarget]);

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        const handleNavigationStart = () => {
            isFocusing.current = false;
            const now = performance.now();
            if (now - lastNavigationSoundAt.current >= 180) {
                lastNavigationSoundAt.current = now;
                surfaceAudio.playHover();
            }
        };

        controls.addEventListener('start', handleNavigationStart);
        return () => controls.removeEventListener('start', handleNavigationStart);
    }, []);

    useFrame((state, delta) => {
        if (!controlsRef.current) return;
        const controls = controlsRef.current;
        const camera = state.camera;
        const target = controls.target;

        if (isFocusing.current) {
            offset.current.copy(focusDestination.current).sub(target);
            offset.current.multiplyScalar(1 - Math.exp(-4 * delta));
            target.add(offset.current);
            camera.position.add(offset.current);

            if (target.distanceToSquared(focusDestination.current) < 0.25) {
                offset.current.copy(focusDestination.current).sub(target);
                target.copy(focusDestination.current);
                camera.position.add(offset.current);
                isFocusing.current = false;
            }
        }

        if (cameraTargetRef) {
            cameraTargetRef.current.copy(target);
        }

        const clampedX = THREE.MathUtils.clamp(target.x, -limitX, limitX);
        const clampedZ = THREE.MathUtils.clamp(target.z, -limitZ, limitZ);
        if (target.x !== clampedX || target.z !== clampedZ) {
            const diffX = clampedX - target.x;
            const diffZ = clampedZ - target.z;
            target.x = clampedX;
            target.z = clampedZ;
            camera.position.x += diffX;
            camera.position.z += diffZ;
        }
    });

    return (
        <MapControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.015}
            enableRotate={false}
            enablePan
            minDistance={80}
            maxDistance={1500}
            zoomSpeed={0.22}
            panSpeed={0.34}
        />
    );
};
