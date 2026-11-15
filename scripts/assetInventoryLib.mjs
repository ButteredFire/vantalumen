import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Non-catalog fallback/archive GLBs preserved in `public/assets/models/` so
 * runtime inventory separates user-selectable catalog hardware from internal
 * preload stubs, LOD variants, or legacy backups without untracked orphans.
 */
export const NON_CATALOG_ARCHIVE_GLBS = {
  '/assets/models/spacecraft/perseverance_rover.glb': {
    classification: 'legacy_prototype_stub',
    note: 'Legacy lightweight prototype stub superseded by /assets/models/mars/perseverance_rover.glb.',
  },
  '/assets/models/stations/ares_orbital_station_lod1.glb': {
    classification: 'lod_proxy_variant',
    note: 'Low-detail fallback LOD variant companion to /assets/models/stations/ares_orbital_station.glb.',
  },
};

export const MASCOT_GLB_ASSETS = [
  {
    id: 'rise_plushie',
    role: 'ui_mascot_glb',
    modelPath: '/assets/mascot/rise_plushie.glb',
    expectedBytes: 716904,
    expectedSha256: 'aee69a76157e5b5fea6067dc91d9ae847bcf747686e2b4694db383946ff6d32f',
    sourceRef: 'src/scene/mascot/RiseMascot.tsx',
  },
];

export const TERRAIN_GLB_ASSETS = [
  {
    id: 'mars_terrain',
    bodyId: 'mars',
    role: 'terrain_block_glb',
    modelPath: '/assets/models/mars/mars_terrain.glb',
    sourceRef: 'src/scene/surface/MarsTerrainPatch.tsx',
  },
  {
    id: 'moon_terrain',
    bodyId: 'moon',
    role: 'terrain_block_glb',
    modelPath: '/assets/models/moons/moon_terrain.glb',
    sourceRef: 'src/scene/surface/MarsTerrainPatch.tsx',
  },
];

export const COMPANION_PUBLIC_ASSETS = [
  '/assets/models/moons/moon_color.jpg',
  '/assets/attribution/Mars-Attributions.txt',
  '/assets/provenance/mars-rovers.csv',
  '/assets/provenance/ingenuity.csv',
  '/assets/provenance/apollo-equipment.csv',
  '/assets/terrain/manifest.json',
  '/assets/textures/mars_albedo_baked.webp',
  '/assets/textures/mars_normals.webp',
  '/assets/textures/mars_roughness.webp',
  '/assets/textures/moon_albedo_baked.webp',
  '/assets/textures/moon_normals.webp',
  '/assets/textures/moon_roughness.webp',
  '/decoders/draco/draco_decoder.js',
  '/decoders/draco/draco_decoder.wasm',
  '/decoders/draco/draco_wasm_wrapper.js',
  '/decoders/basis/basis_transcoder.js',
  '/decoders/basis/basis_transcoder.wasm',
];

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFilesRecursive(full)));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

export function extractOrbitalCatalogEntries(celestialSource) {
  const entries = [];
  const blockRegex = /\{\s*id:\s*'([^']+)'[\s\S]*?bodyId:\s*'([^']+)'[\s\S]*?modelPath:\s*'([^']+)'/g;
  let match;
  while ((match = blockRegex.exec(celestialSource)) !== null) {
    entries.push({
      id: match[1],
      bodyId: match[2],
      role: 'orbital_actor',
      modelPath: match[3],
    });
  }
  return entries;
}

export function extractCorePreloadPaths(progressiveLoaderSource) {
  const match = progressiveLoaderSource.match(/CORE_MODEL_PATHS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  const paths = [];
  const itemRegex = /'([^']+\.glb)'/g;
  let item;
  while ((item = itemRegex.exec(match[1])) !== null) {
    paths.push(item[1]);
  }
  return paths;
}

export async function buildExpectedAssetInventory(rootDir = process.cwd()) {
  const manifestPath = path.join(rootDir, 'src', 'config', 'deviceManifest.json');
  const celestialPath = path.join(rootDir, 'src', 'config', 'celestialCatalog.ts');
  const preloadPath = path.join(rootDir, 'src', 'core', 'loaders', 'useProgressiveAsset.ts');
  const terrainManifestPath = path.join(rootDir, 'public', 'assets', 'terrain', 'manifest.json');

  const [manifestRaw, celestialRaw, preloadRaw, terrainManifestRaw] = await Promise.all([
    fs.readFile(manifestPath, 'utf8'),
    fs.readFile(celestialPath, 'utf8'),
    fs.readFile(preloadPath, 'utf8'),
    fs.readFile(terrainManifestPath, 'utf8'),
  ]);

  const deviceManifest = JSON.parse(manifestRaw);
  const orbitalActors = extractOrbitalCatalogEntries(celestialRaw);
  const preloadPaths = extractCorePreloadPaths(preloadRaw);
  const terrainManifest = JSON.parse(terrainManifestRaw);

  const selectableDevices = [];
  const unavailableDevices = [];

  for (const record of deviceManifest) {
    if (record.status !== 'available') {
      if (record.modelPath) {
        throw new Error(`Unavailable device has a model URL: ${record.id}`);
      }
      unavailableDevices.push({
        id: record.id,
        bodyId: record.bodyId,
        catalogScope: record.catalogScope,
        proceduralModel: record.proceduralModel ?? null,
      });
      continue;
    }
    if (!/^\/assets\/models\/(mars|moons)\/[a-z0-9_]+\.glb$/.test(record.modelPath)) {
      throw new Error(`Unapproved selectable device modelPath: ${record.id} -> ${record.modelPath}`);
    }
    selectableDevices.push({
      id: record.id,
      bodyId: record.bodyId,
      catalogScope: record.catalogScope,
      role: 'selectable_device',
      modelPath: record.modelPath,
      expectedBytes: record.bytes,
      expectedSha256: record.sha256,
    });
  }

  const runtimeCatalogMap = new Map();
  const addRuntimeRef = (modelPath, ref) => {
    const existing = runtimeCatalogMap.get(modelPath) ?? {
      modelPath,
      refs: [],
      expectedBytes: undefined,
      expectedSha256: undefined,
    };
    existing.refs.push(ref);
    if (ref.expectedBytes !== undefined && ref.expectedSha256 !== undefined) {
      if (
        existing.expectedSha256 !== undefined &&
        (existing.expectedBytes !== ref.expectedBytes || existing.expectedSha256 !== ref.expectedSha256)
      ) {
        throw new Error(`Conflicting digest expectation for ${modelPath}`);
      }
      existing.expectedBytes = ref.expectedBytes;
      existing.expectedSha256 = ref.expectedSha256;
    }
    runtimeCatalogMap.set(modelPath, existing);
  };

  for (const entry of selectableDevices) addRuntimeRef(entry.modelPath, entry);
  for (const entry of orbitalActors) addRuntimeRef(entry.modelPath, entry);
  for (const entry of TERRAIN_GLB_ASSETS) addRuntimeRef(entry.modelPath, entry);

  const modelsRoot = path.join(rootDir, 'public', 'assets', 'models');
  const allDiskGlbsAbs = (await walkFilesRecursive(modelsRoot)).filter((p) => p.endsWith('.glb'));
  const diskGlbs = allDiskGlbsAbs.map((abs) => ({
    absPath: abs,
    webPath: '/' + path.relative(path.join(rootDir, 'public'), abs).replace(/\\/g, '/'),
  }));

  const preloadSet = new Set(preloadPaths);
  const nonCatalogGlbs = [];
  const untrackedDiskGlbs = [];

  for (const file of diskGlbs) {
    if (runtimeCatalogMap.has(file.webPath)) continue;
    if (preloadSet.has(file.webPath)) {
      nonCatalogGlbs.push({
        modelPath: file.webPath,
        classification: 'preload_warmup_stub',
        note: 'Preloaded by CORE_MODEL_PATHS in useProgressiveAsset.ts; not a selectable UI catalog device.',
      });
    } else if (NON_CATALOG_ARCHIVE_GLBS[file.webPath]) {
      nonCatalogGlbs.push({
        modelPath: file.webPath,
        ...NON_CATALOG_ARCHIVE_GLBS[file.webPath],
      });
    } else {
      untrackedDiskGlbs.push(file.webPath);
    }
  }

  const runtimeCatalogEntries = [];
  let totalRuntimeBytes = 0;
  for (const entry of [...runtimeCatalogMap.values()].sort((a, b) => a.modelPath.localeCompare(b.modelPath))) {
    const publicAbs = path.join(rootDir, 'public', entry.modelPath.replace(/^\//, ''));
    if (!(await fileExists(publicAbs))) {
      throw new Error(`Missing runtime catalog GLB on disk: ${entry.modelPath}`);
    }
    const buf = await fs.readFile(publicAbs);
    const actualSha256 = sha256Hex(buf);
    if (entry.expectedBytes !== undefined && buf.length !== entry.expectedBytes) {
      throw new Error(`Manifest byte size mismatch for ${entry.modelPath}: expected ${entry.expectedBytes}, got ${buf.length}`);
    }
    if (entry.expectedSha256 !== undefined && actualSha256 !== entry.expectedSha256) {
      throw new Error(`Manifest SHA-256 mismatch for ${entry.modelPath}`);
    }
    totalRuntimeBytes += buf.length;
    runtimeCatalogEntries.push({
      modelPath: entry.modelPath,
      bytes: buf.length,
      sha256: actualSha256,
      refs: entry.refs.map((r) => ({ id: r.id, role: r.role, bodyId: r.bodyId })),
    });
  }

  let totalNonCatalogBytes = 0;
  const nonCatalogEntries = [];
  for (const item of nonCatalogGlbs.sort((a, b) => a.modelPath.localeCompare(b.modelPath))) {
    const publicAbs = path.join(rootDir, 'public', item.modelPath.replace(/^\//, ''));
    const buf = await fs.readFile(publicAbs);
    totalNonCatalogBytes += buf.length;
    nonCatalogEntries.push({
      ...item,
      bytes: buf.length,
      sha256: sha256Hex(buf),
    });
  }

  const companionFiles = [];
  for (const webPath of COMPANION_PUBLIC_ASSETS) {
    const publicAbs = path.join(rootDir, 'public', webPath.replace(/^\//, ''));
    if (!(await fileExists(publicAbs))) {
      throw new Error(`Missing required companion public asset: ${webPath}`);
    }
    const buf = await fs.readFile(publicAbs);
    companionFiles.push({
      webPath,
      bytes: buf.length,
      sha256: sha256Hex(buf),
    });
  }

  const mascotGlbs = [];
  const expectedMascotPaths = new Set(MASCOT_GLB_ASSETS.map((item) => item.modelPath));
  const mascotDir = path.join(rootDir, 'public', 'assets', 'mascot');
  const mascotDiskAbs = (await walkFilesRecursive(mascotDir)).filter((p) => p.endsWith('.glb'));
  for (const abs of mascotDiskAbs) {
    const webPath = '/' + path.relative(path.join(rootDir, 'public'), abs).replace(/\\/g, '/');
    if (!expectedMascotPaths.has(webPath)) {
      untrackedDiskGlbs.push(webPath);
    }
  }
  for (const asset of MASCOT_GLB_ASSETS) {
    const publicAbs = path.join(rootDir, 'public', asset.modelPath.replace(/^\//, ''));
    if (!(await fileExists(publicAbs))) {
      throw new Error(`Missing mascot GLB on disk: ${asset.modelPath}`);
    }
    const buf = await fs.readFile(publicAbs);
    const actualSha256 = sha256Hex(buf);
    if (buf.length !== asset.expectedBytes) {
      throw new Error(`Mascot byte size mismatch for ${asset.modelPath}: expected ${asset.expectedBytes}, got ${buf.length}`);
    }
    if (actualSha256 !== asset.expectedSha256) {
      throw new Error(`Mascot SHA-256 mismatch for ${asset.modelPath}`);
    }
    mascotGlbs.push({
      modelPath: asset.modelPath,
      bytes: buf.length,
      sha256: actualSha256,
      refs: [{ id: asset.id, role: asset.role, bodyId: 'ui' }],
    });
  }

  return {
    selectableDevices,
    unavailableDevices,
    orbitalActors,
    terrainGlbs: TERRAIN_GLB_ASSETS,
    runtimeCatalogEntries,
    nonCatalogEntries,
    mascotGlbs,
    untrackedDiskGlbs,
    diskGlbCount: diskGlbs.length,
    totalRuntimeBytes,
    totalNonCatalogBytes,
    totalAllGlbBytes: totalRuntimeBytes + totalNonCatalogBytes,
    terrainManifest,
    companionFiles,
  };
}
