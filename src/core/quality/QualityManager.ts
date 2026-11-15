import type * as THREE from 'three';
import type {
  QualityRuntimeStats,
  QualityTier,
  ResolvedQualityTier,
} from '../../types/cosmos.types';

export interface QualityPresetConfig {
  maxDpr: number;
  minDpr: number;
  enableShadows: boolean;
  shadowMapSize: number;
  enableBloom: boolean;
  enableSmaa: boolean;
  maxSurfaceTextureSize: number;
}

const PRESETS: Record<ResolvedQualityTier, QualityPresetConfig> = {
  low: {
    maxDpr: 1.0,
    minDpr: 0.75,
    enableShadows: false,
    shadowMapSize: 512,
    enableBloom: false,
    enableSmaa: false,
    maxSurfaceTextureSize: 1024,
  },
  medium: {
    maxDpr: 1.25,
    minDpr: 0.9,
    enableShadows: true,
    shadowMapSize: 1024,
    enableBloom: false,
    enableSmaa: true,
    maxSurfaceTextureSize: 2048,
  },
  high: {
    maxDpr: 1.5,
    minDpr: 1.0,
    enableShadows: true,
    shadowMapSize: 2048,
    enableBloom: true,
    enableSmaa: true,
    maxSurfaceTextureSize: 8192,
  },
};

export function getQualityPreset(tier: ResolvedQualityTier): QualityPresetConfig {
  return PRESETS[tier];
}

export function detectHardwareDefaultTier(): ResolvedQualityTier {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'medium';
}

export function resolveInitialTier(
  requested: QualityTier,
  reducedMotion = false,
): ResolvedQualityTier {
  if (requested !== 'auto') return requested;
  if (reducedMotion) return 'medium';
  return detectHardwareDefaultTier();
}

export function clampDevicePixelRatio(tier: ResolvedQualityTier): number {
  const nativeDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const preset = PRESETS[tier];
  return Math.max(preset.minDpr, Math.min(preset.maxDpr, nativeDpr));
}

export function estimateRendererGpuBytes(gl: THREE.WebGLRenderer): number {
  const mem = gl.info.memory;
  // Estimate ~128 KB avg per live geometry + ~1.5 MB avg per texture (conservative heuristic)
  return mem.geometries * 131_072 + mem.textures * 1_572_864;
}

/**
 * Monitors frame pacing (p50/p95 ms) and steps Auto quality tiers with cooldown hysteresis
 * so low-end devices drop cleanly to medium/low without tier ping-ponging.
 */
export class FramePacingMonitor {
  private readonly samples: number[] = [];
  private currentTier: ResolvedQualityTier;
  private elapsedSinceSwitchSec = 0;

  constructor(initialTier: ResolvedQualityTier) {
    this.currentTier = initialTier;
  }

  public getTier(): ResolvedQualityTier {
    return this.currentTier;
  }

  public setTierExplicit(tier: ResolvedQualityTier): void {
    this.currentTier = tier;
    this.elapsedSinceSwitchSec = 0;
  }

  public recordFrame(
    deltaSec: number,
    requestedTier: QualityTier,
  ): { switchedTo: ResolvedQualityTier | null; p50Ms: number; p95Ms: number } {
    const ms = Math.max(1, Math.min(200, deltaSec * 1000));
    this.samples.push(ms);
    if (this.samples.length > 60) {
      this.samples.shift();
    }
    this.elapsedSinceSwitchSec += deltaSec;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const p50Ms = sorted[Math.floor(sorted.length * 0.5)] ?? ms;
    const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? ms;

    if (requestedTier !== 'auto') {
      if (this.currentTier !== requestedTier) {
        this.currentTier = requestedTier;
        this.elapsedSinceSwitchSec = 0;
        return { switchedTo: requestedTier, p50Ms, p95Ms };
      }
      return { switchedTo: null, p50Ms, p95Ms };
    }

    if (this.samples.length >= 30) {
      if (p95Ms > 30.5 && this.elapsedSinceSwitchSec >= 2.5) {
        const next: ResolvedQualityTier | null =
          this.currentTier === 'high'
            ? 'medium'
            : this.currentTier === 'medium'
              ? 'low'
              : null;
        if (next) {
          this.currentTier = next;
          this.elapsedSinceSwitchSec = 0;
          return { switchedTo: next, p50Ms, p95Ms };
        }
      } else if (p95Ms < 14.5 && this.elapsedSinceSwitchSec >= 7.0) {
        const next: ResolvedQualityTier | null =
          this.currentTier === 'low'
            ? 'medium'
            : this.currentTier === 'medium'
              ? 'high'
              : null;
        if (next) {
          this.currentTier = next;
          this.elapsedSinceSwitchSec = 0;
          return { switchedTo: next, p50Ms, p95Ms };
        }
      }
    }

    return { switchedTo: null, p50Ms, p95Ms };
  }

  public buildRuntimeStats(gl: THREE.WebGLRenderer): QualityRuntimeStats {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p50FrameMs = Number((sorted[Math.floor(sorted.length * 0.5)] ?? 16.6).toFixed(1));
    const p95FrameMs = Number(
      (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 16.6).toFixed(1),
    );
    const perfMem = (
      typeof performance !== 'undefined'
        ? (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
        : undefined
    );

    return {
      p50FrameMs,
      p95FrameMs,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      estimatedGpuBytes: estimateRendererGpuBytes(gl),
      jsHeapBytes: perfMem?.usedJSHeapSize ?? null,
      activeDpr: Number(gl.getPixelRatio().toFixed(2)),
      resolvedTier: this.currentTier,
    };
  }
}
