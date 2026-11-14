import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
    loadBakedMarsWebPTextures,
    loadBakedMoonWebPTextures,
    type BakedMarsWebPSet,
} from '../../core/loaders/useProgressiveAsset';
import type { BodyId } from '../../types/cosmos.types';

export const MARS_TERRAIN_PATH = '/assets/models/mars/mars_terrain.glb';
export const MOON_TERRAIN_PATH = '/assets/models/moons/moon_terrain.glb';

interface PlanetaryTerrainMeshProps {
    bodyId: BodyId;
}

export const PlanetaryTerrainMesh: React.FC<PlanetaryTerrainMeshProps> = ({ bodyId }) => {
    const glbPath = bodyId === 'moon' ? MOON_TERRAIN_PATH : MARS_TERRAIN_PATH;
    const { scene } = useGLTF(glbPath);
    const textureSet = useRef<{ bodyId: BodyId; textures: BakedMarsWebPSet } | null>(null);
    const [textureRevision, setTextureRevision] = useState(0);

    useEffect(() => {
        let isActive = true;
        textureSet.current = null;
        const loadTextures =
            bodyId === 'moon' ? loadBakedMoonWebPTextures : loadBakedMarsWebPTextures;

        void loadTextures({ flipY: false }).then(
            (textures) => {
                if (!isActive) {
                    textures.albedo.dispose();
                    textures.normal.dispose();
                    textures.roughness.dispose();
                    return;
                }
                textureSet.current = { bodyId, textures };
                setTextureRevision((revision) => revision + 1);
            },
            (error: unknown) => {
                if (isActive) {
                    console.error(`Failed to load ${bodyId} terrain textures.`, error);
                }
            },
        );

        return () => {
            isActive = false;
            const loaded = textureSet.current;
            if (loaded?.bodyId === bodyId) {
                loaded.textures.albedo.dispose();
                loaded.textures.normal.dispose();
                loaded.textures.roughness.dispose();
                textureSet.current = null;
            }
        };
    }, [bodyId]);

    const terrainScene = useMemo(() => {
        const clone = scene.clone(true);
        const textures =
            textureSet.current?.bodyId === bodyId ? textureSet.current.textures : null;

        clone.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const applyTextures = (material: THREE.Material) => {
                const clonedMaterial = material.clone();
                if (clonedMaterial instanceof THREE.MeshStandardMaterial) {
                    clonedMaterial.color.set(bodyId === 'moon' ? '#d0d0d0' : '#ffffff');
                    clonedMaterial.map = textures?.albedo ?? null;
                    clonedMaterial.roughnessMap = textures?.roughness ?? null;
                    clonedMaterial.roughness = bodyId === 'moon' ? 0.92 : 0.9;
                    clonedMaterial.needsUpdate = true;
                }
                return clonedMaterial;
            };

            object.material = Array.isArray(object.material)
                ? object.material.map(applyTextures)
                : applyTextures(object.material);
        });

        return clone;
    }, [bodyId, scene, textureRevision]);

    useEffect(
        () => () => {
            terrainScene.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];
                materials.forEach((material) => material.dispose());
            });
        },
        [terrainScene],
    );

    return <primitive object={terrainScene} position={[0, 0, 0]} />;
};
