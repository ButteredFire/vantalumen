import { useEffect, useMemo, useState } from 'react';
import { Detailed } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { BodyConfig } from '../../types/cosmos.types';
import {
  generateProceduralMarsTextures,
  loadBakedMarsWebPTextures,
  type BakedMarsWebPSet,
  type BodyPlanetaryTextures,
} from '../../core/loaders/useProgressiveAsset';
import { useCosmosStore } from '../../store/useCosmosStore';

const MOON_COLOR_TEXTURE_PATH = '/assets/models/moons/moon_color.jpg';

export function MarsLODMesh({ body }: { body: BodyConfig }) {
  return body.id === 'moon' ? <MoonLODMesh body={body} /> : <MarsTextureLODMesh body={body} />;
}

function MoonLODMesh({ body }: { body: BodyConfig }) {
  const colorMap = useLoader(THREE.TextureLoader, MOON_COLOR_TEXTURE_PATH);

  useMemo(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.ClampToEdgeWrapping;
    colorMap.anisotropy = 8;
    colorMap.needsUpdate = true;
  }, [colorMap]);

  useEffect(() => {
    useCosmosStore.getState().beginBodyTransitionArrival(body.id);
  }, [body.id]);

  return (
    <Detailed distances={[0, body.radiusKm * 5, body.radiusKm * 18]}>
      {[96, 48, 24].map((segments) => (
        <mesh key={segments}>
          <sphereGeometry args={[body.radiusKm, segments, segments]} />
          <meshStandardMaterial
            color="#ffffff"
            map={colorMap}
            roughness={0.92}
            metalness={0.04}
          />
        </mesh>
      ))}
    </Detailed>
  );
}

function MarsTextureLODMesh({ body }: { body: BodyConfig }) {
  const spectralMode = useCosmosStore((state) => state.spectralMode);
  const [textures, setTextures] = useState<BodyPlanetaryTextures | null>(null);
  const normalScale = useMemo(() => new THREE.Vector2(1.55, 1.55), []);

  useEffect(() => {
    if (body.textureStyle === 'plain') {
      setTextures(null);
      useCosmosStore.getState().beginBodyTransitionArrival(body.id);
      return;
    }

    const controller = new AbortController();
    const owned = generateProceduralMarsTextures();
    let baked: BakedMarsWebPSet | null = null;

    setTextures(owned);

    if (body.textureStyle === 'illustrative-mars') {
      void loadBakedMarsWebPTextures({ flipY: true, signal: controller.signal })
        .then((webpSet) => {
          if (controller.signal.aborted) {
            webpSet.albedo.dispose();
            webpSet.normal.dispose();
            webpSet.roughness.dispose();
            return;
          }
          baked = webpSet;
          owned.albedo.dispose();
          owned.normal.dispose();
          owned.roughness.dispose();
          setTextures({
            albedo: webpSet.albedo,
            normal: webpSet.normal,
            roughness: webpSet.roughness,
            thermalPreview: owned.thermalPreview,
            elevationPreview: owned.elevationPreview,
          });
          useCosmosStore.getState().reportAssetTaskProgress(
            'mars_surface_maps',
            100,
            'Mars surface map & spectral layers loaded',
          );
          useCosmosStore.getState().beginBodyTransitionArrival(body.id);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.warn(`Failed to load ${body.name} surface maps; retaining illustrative textures.`, error);
          useCosmosStore.getState().reportAssetTaskProgress(
            'mars_surface_maps',
            100,
            'Using fallback illustrative texture; unable to load the Mars surface map',
          );
          useCosmosStore.getState().beginBodyTransitionArrival(body.id);
        });
    }

    return () => {
      controller.abort();
      if (baked) {
        baked.albedo.dispose();
        baked.normal.dispose();
        baked.roughness.dispose();
        owned.thermalPreview.dispose();
        owned.elevationPreview.dispose();
      } else {
        Object.values(owned).forEach((texture) => texture.dispose());
      }
    };
  }, [body.name, body.textureStyle]);

  const activeMap = useMemo(() => {
    if (!textures) return null;
    if (spectralMode === 'MOLA_ELEVATION') return textures.elevationPreview;
    if (spectralMode === 'THERMAL_IR') return textures.thermalPreview;
    return textures.albedo;
  }, [spectralMode, textures]);

  const isFalseColor = spectralMode === 'MOLA_ELEVATION' || spectralMode === 'THERMAL_IR';
  const materialKey = `${body.id}-${body.textureStyle}-${spectralMode}-${activeMap?.uuid ?? 'plain'}`;

  return (
    <Detailed distances={[0, body.radiusKm * 5, body.radiusKm * 18]}>
      {[96, 48, 24].map((segments) => (
        <mesh key={segments}>
          <sphereGeometry args={[body.radiusKm, segments, segments]} />
          <meshStandardMaterial
            key={materialKey}
            color={textures ? '#ffffff' : body.color}
            map={activeMap}
            normalMap={textures?.normal ?? null}
            normalScale={normalScale}
            roughnessMap={textures?.roughness ?? null}
            roughness={0.88}
            metalness={0.04}
            emissive={isFalseColor ? '#ffffff' : '#000000'}
            emissiveMap={isFalseColor ? activeMap : null}
            emissiveIntensity={isFalseColor ? 0.22 : 0}
          />
        </mesh>
      ))}
    </Detailed>
  );
}
