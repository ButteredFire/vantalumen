import test from 'node:test';
import assert from 'node:assert/strict';
import type { WebGLRenderer } from 'three';
import {
  getRendererHealthSnapshot,
  registerRenderer,
  resetRendererDiagnosticsForTests,
} from '../src/core/canvas/rendererDiagnostics';

class FakeCanvas {
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, fn: (event: Event) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: (event: Event) => void) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatch(type: string, event: Event) {
    for (const fn of this.listeners.get(type) ?? []) {
      fn(event);
    }
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

test('registerRenderer captures shader errors, context loss/restore, and cleans up listeners', () => {
  resetRendererDiagnosticsForTests();
  const canvas = new FakeCanvas();
  const failures: Array<{ kind: string; detail?: string }> = [];
  const restored: string[] = [];

  const fakeRenderer = {
    domElement: canvas as unknown as HTMLCanvasElement,
    debug: {
      checkShaderErrors: false,
      onShaderError: null as unknown,
    },
    info: {
      memory: { geometries: 1, textures: 2 },
    },
  } as unknown as WebGLRenderer;

  const dispose = registerRenderer(fakeRenderer, {
    surface: 'orbital',
    onFailure: (record) => failures.push({ kind: record.kind, detail: record.detail }),
    onRestored: (surface) => restored.push(surface),
  });

  assert.equal(fakeRenderer.debug.checkShaderErrors, true);
  assert.equal(typeof fakeRenderer.debug.onShaderError, 'function');
  assert.equal(canvas.listenerCount('webglcontextlost'), 1);
  assert.equal(canvas.listenerCount('webglcontextrestored'), 1);

  // Trigger shader error via gl.debug.onShaderError
  const fakeGl = {
    getProgramInfoLog: () => 'VALIDATE_STATUS false',
    getShaderInfoLog: (shader: unknown) => (shader === 'frag' ? 'ERROR: 0:1: syntax error' : ''),
  } as unknown as WebGLRenderingContext;
  fakeRenderer.debug.onShaderError?.(
    fakeGl,
    {} as WebGLProgram,
    'vert' as unknown as WebGLShader,
    'frag' as unknown as WebGLShader,
  );
  assert.equal(failures.length, 1);
  assert.equal(failures[0].kind, 'shader-error');
  assert.match(failures[0].detail ?? '', /syntax error/);
  assert.equal(getRendererHealthSnapshot().shaderErrorCount, 1);

  // Trigger context lost & restored
  let prevented = false;
  canvas.dispatch('webglcontextlost', {
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as Event);
  assert.equal(prevented, true);
  assert.equal(failures.length, 2);
  assert.equal(failures[1].kind, 'context-lost');
  assert.equal(getRendererHealthSnapshot().contextLost, true);

  canvas.dispatch('webglcontextrestored', {} as Event);
  assert.deepEqual(restored, ['orbital']);
  assert.equal(getRendererHealthSnapshot().contextLost, false);

  dispose();
  assert.equal(canvas.listenerCount('webglcontextlost'), 0);
  assert.equal(canvas.listenerCount('webglcontextrestored'), 0);
  assert.equal(fakeRenderer.debug.onShaderError, null);
});
