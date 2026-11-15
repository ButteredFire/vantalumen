import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCosmosStore } from '../../store/useCosmosStore';
import warpTunnelFrag from '../../shaders/warp/warpTunnel.frag.glsl?raw';

const warpTunnelVert = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

export const DeepSpaceStarfield: React.FC<{
  visible?: boolean;
  showTransitionStreaks?: boolean;
}> = ({ visible = true, showTransitionStreaks = false }) => {
  const starsRef = useRef<THREE.Points>(null!);
  const warpMaterialRef = useRef<THREE.ShaderMaterial>(null!);
  const warpFactorRef = useRef(0);
  const viewStage = useCosmosStore((state) => state.viewStage);
  const bodyTransition = useCosmosStore((state) => state.bodyTransition);

  const { positions, colors } = useMemo(() => {
    const count = 7500;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Phân bố sao trên vỏ cầu bán kính 350.000 - 650.000 km
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 360000 + Math.random() * 280000;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Phân loại phổ màu sao (O/B xanh trắng, G vàng, K/M cam đỏ)
      const temp = Math.random();
      if (temp > 0.82) {
        col[i * 3] = 0.72;
        col[i * 3 + 1] = 0.85;
        col[i * 3 + 2] = 1.0;
      } else if (temp > 0.35) {
        col[i * 3] = 0.98;
        col[i * 3 + 1] = 0.96;
        col[i * 3 + 2] = 0.92;
      } else {
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 0.76;
        col[i * 3 + 2] = 0.58;
      }
    }

    return { positions: pos, colors: col };
  }, []);

  const warpUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWarpFactor: { value: 0 },
      uAccentColor: { value: new THREE.Color('#ff7b47') },
    }),
    [],
  );
  useFrame(({ clock }, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = clock.getElapsedTime() * 0.003;
    }

    const targetWarp =
      viewStage === 'LAUNCHING'
        ? 1.35
        : viewStage === 'BODY_TRANSITION'
          ? bodyTransition?.phase === 'arriving'
            ? 0
            : 2
          : viewStage === 'WARPING'
            ? 1.0
            : viewStage === 'PRELOADING'
              ? 0.28
              : 0.0;
    const warpEase = viewStage === 'BODY_TRANSITION' && bodyTransition?.phase === 'arriving'
      ? 1.5
      : 4.5;
    warpFactorRef.current = THREE.MathUtils.lerp(
      warpFactorRef.current,
      targetWarp,
      Math.min(1, delta * warpEase),
    );

    if (warpMaterialRef.current) {
      warpMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      warpMaterialRef.current.uniforms.uWarpFactor.value = warpFactorRef.current;
    }
  });

  return (
    <>
      <group visible={visible}>
        <points ref={starsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[positions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[colors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={580}
            vertexColors
            transparent
            opacity={0.92}
            sizeAttenuation
            depthWrite={false}
          />
        </points>

        <mesh>
          <sphereGeometry args={[320000, 32, 32]} />
          <shaderMaterial
            ref={warpMaterialRef}
            vertexShader={warpTunnelVert}
            fragmentShader={warpTunnelFrag}
            uniforms={warpUniforms}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      {showTransitionStreaks && viewStage === 'BODY_TRANSITION' && (
        <WarpLightStreaks warpFactorRef={warpFactorRef} />
      )}
    </>
  );
};

interface WarpStreakData {
  x: number;
  y: number;
  z: number;
  speedFactor: number;
  baseLength: number;
  color: THREE.Color;
}

function WarpLightStreaks({
  warpFactorRef,
}: {
  warpFactorRef: React.RefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const streaksRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const streaks = useMemo<WarpStreakData[]>(() => {
    const items: WarpStreakData[] = [];
    for (let i = 0; i < 260; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 11 + Math.random() * 78;
      const tone = Math.random();
      const color =
        tone > 0.65
          ? new THREE.Color('#78d8ff')
          : tone > 0.25
            ? new THREE.Color('#e8f1ff')
            : new THREE.Color('#ffad75');

      items.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.72,
        z: -260 + Math.random() * 290,
        speedFactor: 0.7 + Math.random() * 0.9,
        baseLength: 2.8 + Math.random() * 5.2,
        color,
      });
    }
    return items;
  }, []);

  useEffect(() => {
    if (!streaksRef.current) return;
    streaks.forEach((streak, index) => {
      streaksRef.current.setColorAt(index, streak.color);
    });
    if (streaksRef.current.instanceColor) {
      streaksRef.current.instanceColor.needsUpdate = true;
    }
  }, [streaks]);

  useFrame(({ camera }, delta) => {
    const warp = warpFactorRef.current;
    if (!groupRef.current || !streaksRef.current || !materialRef.current) return;

    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
    materialRef.current.opacity = 0.86 * Math.min(1, warp / 1.5);

    const speed = (48 + warp * 320) * Math.min(delta, 0.05);
    const stretchMultiplier = 1 + warp * 5.5;
    for (let i = 0; i < streaks.length; i++) {
      const streak = streaks[i];
      streak.z += speed * streak.speedFactor;
      if (streak.z > 28) {
        streak.z = -260 - Math.random() * 40;
      }

      dummy.position.set(streak.x, streak.y, streak.z);
      dummy.scale.set(1, 1, streak.baseLength * stretchMultiplier);
      dummy.updateMatrix();
      streaksRef.current.setMatrixAt(i, dummy.matrix);
    }
    streaksRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef} frustumCulled={false}>
      <instancedMesh
        ref={streaksRef}
        args={[undefined, undefined, streaks.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.14, 0.14, 1]} />
        <meshBasicMaterial
          ref={materialRef}
          toneMapped={false}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
