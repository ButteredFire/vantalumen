import * as THREE from 'three';
import type { BodyId, ResolvedQualityTier } from '../../types/cosmos.types';
import {
  BASE_TILE_SEGMENTS,
  LOD1_SEGMENTS,
  LOD2_SEGMENTS,
  TILE_SIZE_M,
  type TerrainTilePayload,
} from './terrainDataPipeline';

export type TerrainLodLevel = 0 | 1 | 2;

export function getLodSegments(lod: TerrainLodLevel): number {
  if (lod === 0) return BASE_TILE_SEGMENTS;
  if (lod === 1) return LOD1_SEGMENTS;
  return LOD2_SEGMENTS;
}

/**
 * Builds a Three.js BufferGeometry in tile-local X/Z `[0..256]` (or centered `-128..+128`)
 * with origin at tile center `(centerX, 0, centerZ)` so floating origin shifts only move mesh.position!
 * Includes optional downward boundary skirts on LOD1/LOD2 to eliminate cracks at LOD seams.
 */
export function buildTerrainTileGeometry(
  payload: TerrainTilePayload,
  lod: TerrainLodLevel,
): THREE.BufferGeometry {
  const segs = getLodSegments(lod);
  const step = Math.max(1, Math.floor(payload.segments / segs));
  const vertsPerSide = segs + 1;
  const gridVertexCount = vertsPerSide * vertsPerSide;
  const addSkirts = lod > 0;
  const skirtVertsCount = addSkirts ? vertsPerSide * 4 * 2 : 0;
  const totalVerts = gridVertexCount + skirtVertsCount;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = new Float32Array(totalVerts * 3);

  const srcGrid = payload.segments + 1;
  const cellM = TILE_SIZE_M / segs;
  const half = TILE_SIZE_M / 2;

  const paletteLow =
    payload.bodyId === 'mars'
      ? new THREE.Color('#6f3723')
      : new THREE.Color('#5a5d64');
  const paletteMid =
    payload.bodyId === 'mars'
      ? new THREE.Color('#a65432')
      : new THREE.Color('#80858f');
  const paletteHigh =
    payload.bodyId === 'mars'
      ? new THREE.Color('#c8764a')
      : new THREE.Color('#9ea4ae');
  const tempColor = new THREE.Color();

  // Populate main grid vertices
  for (let col = 0; col <= segs; col += 1) {
    const srcCol = Math.min(payload.segments, col * step);
    const localX = -half + col * cellM;
    for (let row = 0; row <= segs; row += 1) {
      const srcRow = Math.min(payload.segments, row * step);
      const localZ = -half + row * cellM;
      const idx = col * vertsPerSide + row;
      const h = payload.heights[srcCol * srcGrid + srcRow];

      positions[idx * 3] = localX;
      positions[idx * 3 + 1] = h;
      positions[idx * 3 + 2] = localZ;

      uvs[idx * 2] = col / segs;
      uvs[idx * 2 + 1] = row / segs;

      // Central-difference normal using source grid neighbors for crisp shading across tiles
      const cPrev = Math.max(0, srcCol - step);
      const cNext = Math.min(payload.segments, srcCol + step);
      const rPrev = Math.max(0, srcRow - step);
      const rNext = Math.min(payload.segments, srcRow + step);
      const hL = payload.heights[cPrev * srcGrid + srcRow];
      const hR = payload.heights[cNext * srcGrid + srcRow];
      const hD = payload.heights[srcCol * srcGrid + rPrev];
      const hU = payload.heights[srcCol * srcGrid + rNext];
      const dxSpan = Math.max(0.1, ((cNext - cPrev) / payload.segments) * TILE_SIZE_M);
      const dzSpan = Math.max(0.1, ((rNext - rPrev) / payload.segments) * TILE_SIZE_M);
      const nx = (hL - hR) / dxSpan;
      const ny = 1;
      const nz = (hD - hU) / dzSpan;
      const invLen = 1 / (Math.hypot(nx, ny, nz) || 1);
      normals[idx * 3] = nx * invLen;
      normals[idx * 3 + 1] = ny * invLen;
      normals[idx * 3 + 2] = nz * invLen;

      // Subtle elevation & slope albedo modulation to break tiling repetition
      const slopeFactor = Math.max(0, Math.min(1, (1 - normals[idx * 3 + 1]) * 5.2));
      const relH = Math.max(0, Math.min(1, (h + 30) / 80));
      tempColor.copy(paletteLow).lerp(paletteMid, relH).lerp(paletteHigh, slopeFactor * 0.72);
      colors[idx * 3] = tempColor.r;
      colors[idx * 3 + 1] = tempColor.g;
      colors[idx * 3 + 2] = tempColor.b;
    }
  }

  // Build indices with exact Rapier anti-diagonal `(col+1, row) - (col, row+1)` and +Y CCW winding
  const mainIndexCount = segs * segs * 6;
  const skirtIndexCount = addSkirts ? segs * 4 * 6 : 0;
  const useUint32 = totalVerts > 65535;
  const indices = useUint32
    ? new Uint32Array(mainIndexCount + skirtIndexCount)
    : new Uint16Array(mainIndexCount + skirtIndexCount);

  let ptr = 0;
  for (let col = 0; col < segs; col += 1) {
    for (let row = 0; row < segs; row += 1) {
      const v00 = col * vertsPerSide + row;
      const v10 = (col + 1) * vertsPerSide + row;
      const v01 = col * vertsPerSide + (row + 1);
      const v11 = (col + 1) * vertsPerSide + (row + 1);

      indices[ptr++] = v00;
      indices[ptr++] = v01;
      indices[ptr++] = v10;

      indices[ptr++] = v11;
      indices[ptr++] = v10;
      indices[ptr++] = v01;
    }
  }

  if (addSkirts) {
    const skirtDropM = 4.0;
    let vCursor = gridVertexCount;

    const addEdgeSkirt = (getGridIndex: (k: number) => number, flipWinding: boolean) => {
      const baseV = vCursor;
      for (let k = 0; k <= segs; k += 1) {
        const gIdx = getGridIndex(k);
        const topOut = vCursor++;
        const botOut = vCursor++;

        positions[topOut * 3] = positions[gIdx * 3];
        positions[topOut * 3 + 1] = positions[gIdx * 3 + 1];
        positions[topOut * 3 + 2] = positions[gIdx * 3 + 2];

        positions[botOut * 3] = positions[gIdx * 3];
        positions[botOut * 3 + 1] = positions[gIdx * 3 + 1] - skirtDropM;
        positions[botOut * 3 + 2] = positions[gIdx * 3 + 2];

        for (const v of [topOut, botOut]) {
          normals[v * 3] = normals[gIdx * 3];
          normals[v * 3 + 1] = normals[gIdx * 3 + 1];
          normals[v * 3 + 2] = normals[gIdx * 3 + 2];
          uvs[v * 2] = uvs[gIdx * 2];
          uvs[v * 2 + 1] = uvs[gIdx * 2 + 1];
          colors[v * 3] = colors[gIdx * 3] * 0.85;
          colors[v * 3 + 1] = colors[gIdx * 3 + 1] * 0.85;
          colors[v * 3 + 2] = colors[gIdx * 3 + 2] * 0.85;
        }
      }

      for (let k = 0; k < segs; k += 1) {
        const t0 = baseV + k * 2;
        const b0 = t0 + 1;
        const t1 = t0 + 2;
        const b1 = t0 + 3;
        if (flipWinding) {
          indices[ptr++] = t0;
          indices[ptr++] = t1;
          indices[ptr++] = b0;
          indices[ptr++] = b0;
          indices[ptr++] = t1;
          indices[ptr++] = b1;
        } else {
          indices[ptr++] = t0;
          indices[ptr++] = b0;
          indices[ptr++] = t1;
          indices[ptr++] = b0;
          indices[ptr++] = b1;
          indices[ptr++] = t1;
        }
      }
    };

    // North (row = 0), South (row = segs), West (col = 0), East (col = segs)
    addEdgeSkirt((k) => k * vertsPerSide, false);
    addEdgeSkirt((k) => k * vertsPerSide + segs, true);
    addEdgeSkirt((k) => k, true);
    addEdgeSkirt((k) => segs * vertsPerSide + k, false);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

interface TerrainMaterialSet {
  material: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
  refCount: number;
}

const materialCache = new Map<string, TerrainMaterialSet>();

function createProceduralSurfaceTextures(
  bodyId: BodyId,
  tier: ResolvedQualityTier,
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = tier === 'low' ? 256 : tier === 'medium' ? 512 : 512;
  const repeat = 16;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const nCtx = normCanvas.getContext('2d')!;

  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const nImg = nCtx.createImageData(size, size);
  const heightField = new Float32Array(size * size);

  const seedOffset = bodyId === 'mars' ? 17 : 89;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      const nx = (x / size) * Math.PI * 2;
      const ny = (y / size) * Math.PI * 2;
      // Tileable multi-octave grain & regolith ripples
      const grain =
        Math.sin(nx * 5 + Math.cos(ny * 3 + seedOffset)) * 0.35 +
        Math.sin(ny * 7 - nx * 4 + seedOffset) * 0.25 +
        (((Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.8;
      heightField[idx] = grain;

      const bright = 195 + grain * 26;
      const p4 = idx * 4;
      if (bodyId === 'mars') {
        aImg.data[p4] = Math.max(90, Math.min(255, Math.round(bright * 1.06)));
        aImg.data[p4 + 1] = Math.max(70, Math.min(255, Math.round(bright * 0.9)));
        aImg.data[p4 + 2] = Math.max(55, Math.min(255, Math.round(bright * 0.78)));
      } else {
        const g = Math.max(115, Math.min(255, Math.round(bright)));
        aImg.data[p4] = g;
        aImg.data[p4 + 1] = g;
        aImg.data[p4 + 2] = Math.min(255, g + 3);
      }
      aImg.data[p4 + 3] = 255;

      const roughByte = Math.max(150, Math.min(252, Math.round(220 - grain * 24)));
      rImg.data[p4] = roughByte;
      rImg.data[p4 + 1] = roughByte;
      rImg.data[p4 + 2] = roughByte;
      rImg.data[p4 + 3] = 255;
    }
  }

  for (let y = 0; y < size; y += 1) {
    const yPrev = (y - 1 + size) % size;
    const yNext = (y + 1) % size;
    for (let x = 0; x < size; x += 1) {
      const xPrev = (x - 1 + size) % size;
      const xNext = (x + 1) % size;
      const dx = (heightField[y * size + xNext] - heightField[y * size + xPrev]) * 1.65;
      const dy = (heightField[yNext * size + x] - heightField[yPrev * size + x]) * 1.65;
      const len = Math.hypot(-dx, -dy, 1) || 1;
      const p4 = (y * size + x) * 4;
      nImg.data[p4] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      nImg.data[p4 + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      nImg.data[p4 + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      nImg.data[p4 + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeat, repeat);
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeat, repeat);
  roughnessMap.needsUpdate = true;

  return { map, normalMap, roughnessMap };
}

export function acquireTerrainTileMaterial(
  bodyId: BodyId,
  tier: ResolvedQualityTier,
): THREE.MeshStandardMaterial {
  const key = `${bodyId}:${tier}`;
  const cached = materialCache.get(key);
  if (cached) {
    cached.refCount += 1;
    return cached.material;
  }

  const textures = createProceduralSurfaceTextures(bodyId, tier);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.map,
    normalMap: textures.normalMap,
    normalScale: new THREE.Vector2(bodyId === 'mars' ? 0.68 : 0.78, bodyId === 'mars' ? 0.68 : 0.78),
    roughnessMap: textures.roughnessMap,
    roughness: bodyId === 'mars' ? 0.91 : 0.94,
    metalness: 0.04,
  });

  materialCache.set(key, {
    material,
    textures: [textures.map, textures.normalMap, textures.roughnessMap],
    refCount: 1,
  });
  return material;
}

export function releaseTerrainTileMaterial(bodyId: BodyId, tier: ResolvedQualityTier): void {
  const key = `${bodyId}:${tier}`;
  const entry = materialCache.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.textures.forEach((tex) => tex.dispose());
    entry.material.dispose();
    materialCache.delete(key);
  }
}
