import type { WebGLRenderer } from 'three';
import type { RendererFailureKind } from '../../types/cosmos.types';

export interface RendererDiagnosticRecord {
  kind: RendererFailureKind;
  surface: 'orbital' | 'surface_terrain';
  message: string;
  detail?: string;
  timestampMs: number;
}

export interface WebGLSupportResult {
  available: boolean;
  reason?: string;
}

interface DiagnosticsCallbacks {
  surface: 'orbital' | 'surface_terrain';
  onFailure?: (record: RendererDiagnosticRecord) => void;
  onRestored?: (surface: 'orbital' | 'surface_terrain') => void;
}

let renderer: WebGLRenderer | undefined;
let activeSurface: 'orbital' | 'surface_terrain' = 'orbital';
let contextLostFlag = false;
let shaderErrorCount = 0;
let lastFailureRecord: RendererDiagnosticRecord | null = null;

function buildShaderDiagnosticDetail(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): string {
  try {
    const programLog = gl.getProgramInfoLog(program)?.trim() ?? '';
    const vertLog = gl.getShaderInfoLog(vertexShader)?.trim() ?? '';
    const fragLog = gl.getShaderInfoLog(fragmentShader)?.trim() ?? '';
    const parts = [
      programLog ? `Program: ${programLog}` : '',
      vertLog ? `Vertex: ${vertLog}` : '',
      fragLog ? `Fragment: ${fragLog}` : '',
    ].filter(Boolean);
    return parts.join(' | ') || 'GLSL compile/link status false';
  } catch {
    return 'Unable to inspect WebGL shader info log';
  }
}

export function detectWebGLSupport(): WebGLSupportResult {
  if (typeof document === 'undefined') {
    return { available: true };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      return {
        available: false,
        reason: 'The browser or GPU did not provide a WebGL context for the 3D scene.',
      };
    }
    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message
          : 'Unable to initialize a WebGL context on this device.',
    };
  }
}

export function registerRenderer(
  value: WebGLRenderer,
  callbacks?: DiagnosticsCallbacks,
): () => void {
  const surface = callbacks?.surface ?? 'orbital';
  activeSurface = surface;
  contextLostFlag = false;
  if (import.meta.env?.DEV) {
    renderer = value;
  }

  value.debug.checkShaderErrors = true;
  value.debug.onShaderError = (gl, program, glVertexShader, glFragmentShader) => {
    shaderErrorCount += 1;
    const detail = buildShaderDiagnosticDetail(gl, program, glVertexShader, glFragmentShader);
    console.error(`[Atlas WebGL Shader Error] ${detail}`);
    const record: RendererDiagnosticRecord = {
      kind: 'shader-error',
      surface,
      message: 'A 3D shader failed to compile or link on the GPU.',
      detail,
      timestampMs: Date.now(),
    };
    lastFailureRecord = record;
    callbacks?.onFailure?.(record);
  };

  const canvas = value.domElement;
  const handleContextLost = (event: Event) => {
    if (typeof (event as WebGLContextEvent).preventDefault === 'function') {
      event.preventDefault();
    }
    contextLostFlag = true;
    const record: RendererDiagnosticRecord = {
      kind: 'context-lost',
      surface,
      message: 'The WebGL graphics context was lost (webglcontextlost).',
      detail: 'GPU resources were temporarily reclaimed; try initializing again or continue in text mode.',
      timestampMs: Date.now(),
    };
    lastFailureRecord = record;
    callbacks?.onFailure?.(record);
  };

  const handleContextRestored = () => {
    contextLostFlag = false;
    lastFailureRecord = null;
    callbacks?.onRestored?.(surface);
  };

  canvas.addEventListener('webglcontextlost', handleContextLost, false);
  canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

  return () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost, false);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
    if (value.debug) {
      value.debug.onShaderError = null;
    }
    if (renderer === value) {
      renderer = undefined;
    }
  };
}

export function rendererMemory() {
  return renderer ? { ...renderer.info.memory } : undefined;
}

export function getRendererHealthSnapshot() {
  return {
    activeSurface,
    contextLost: contextLostFlag,
    shaderErrorCount,
    lastFailure: lastFailureRecord,
  };
}

export function resetRendererDiagnosticsForTests() {
  contextLostFlag = false;
  shaderErrorCount = 0;
  lastFailureRecord = null;
}
