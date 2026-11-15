import React from 'react';
import type * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useCosmosStore } from '../../store/useCosmosStore';
import { getQualityPreset } from '../quality/QualityManager';

export interface PostProcessingRigProps {
  sunLightRef?: React.RefObject<THREE.DirectionalLight | null>;
  enabled?: boolean;
}

class PostProcessingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[Atlas PostProcessing] Falling back to basic rendering mode:', error);
    queueMicrotask(() => {
      useCosmosStore.getState().enableBasicRenderMode();
    });
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const PostProcessingRig: React.FC<PostProcessingRigProps> = ({ enabled = true }) => {
  const resolvedQualityTier = useCosmosStore((state) => state.resolvedQualityTier);
  const rendererBasicMode = useCosmosStore((state) => state.rendererBasicMode);
  const preset = getQualityPreset(resolvedQualityTier);

  if (!enabled || rendererBasicMode || (!preset.enableBloom && !preset.enableSmaa)) {
    return null;
  }

  if (!preset.enableBloom) {
    return (
      <PostProcessingErrorBoundary>
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
          <Vignette
            offset={0.25}
            darkness={0.55}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      </PostProcessingErrorBoundary>
    );
  }

  return (
    <PostProcessingErrorBoundary>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <SMAA />
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        <Vignette
          offset={0.25}
          darkness={0.65}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </PostProcessingErrorBoundary>
  );
};
