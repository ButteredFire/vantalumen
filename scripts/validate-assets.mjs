import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { buildExpectedAssetInventory } from './assetInventoryLib.mjs';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1')), '..');
const jsonFlag = process.argv.includes('--json');

const inventory = await buildExpectedAssetInventory(ROOT_DIR);
if (inventory.untrackedDiskGlbs.length > 0) {
  throw new Error(
    `Untracked GLB files found under public/assets/models/: ${inventory.untrackedDiskGlbs.join(', ')}`,
  );
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

async function validateGlbFile(entry) {
  const idList = entry.refs.map((r) => r.id).join('+');
  const absPath = path.join(ROOT_DIR, 'public', entry.modelPath.replace(/^\//, ''));
  const bytes = await fs.readFile(absPath);

  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`Invalid GLB header/length: ${idList} (${entry.modelPath})`);
  }
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  if ((json.scenes?.length ?? 0) !== 1) {
    throw new Error(`Review multi-scene resource ownership: ${idList} (${entry.modelPath})`);
  }
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((item) => item.uri)) {
    throw new Error(`Unexpected external resource URI inside GLB: ${idList} (${entry.modelPath})`);
  }

  const doc = await io.read(absPath);
  let vertices = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) throw new Error(`Missing vertex positions: ${idList}`);
      const array = position.getArray();
      if (!array?.every(Number.isFinite)) throw new Error(`Non-finite geometry: ${idList}`);
      vertices += position.getCount();
    }
  }
  if (!vertices) throw new Error(`Empty model: ${idList}`);

  if (!jsonFlag) {
    const manifestBacked = entry.refs.some(
      (r) => r.role === 'selectable_device' || r.role === 'ui_mascot_glb',
    );
    console.log(
      `${idList}: valid GLB (${entry.modelPath}), ${vertices} vertices, ${doc.getRoot().listTextures().length} textures, ${bytes.length} bytes${manifestBacked ? ', SHA-256 verified' : ''}`,
    );
  }
}

for (const entry of inventory.runtimeCatalogEntries) {
  await validateGlbFile(entry);
}

for (const entry of inventory.mascotGlbs) {
  await validateGlbFile(entry);
}

const terrainManifest = inventory.terrainManifest;
if (!Array.isArray(terrainManifest.regions) || terrainManifest.regions.length !== 6) {
  throw new Error('Invalid terrain manifest: expected 6 region entries (Mars & Moon x 2/16/64 km)');
}
for (const entry of terrainManifest.regions) {
  if (
    typeof entry.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(entry.sha256) ||
    entry.isBaselinePlusSyntheticRelief !== true ||
    entry.maxQuantizationErrorM > 0.005
  ) {
    throw new Error(`Invalid terrain region manifest entry: ${entry.bodyId}:${entry.regionSizeKm}`);
  }
}

if (jsonFlag) {
  console.log(
    JSON.stringify(
      {
        selectableDevicesCount: inventory.selectableDevices.length,
        unavailableDevicesCount: inventory.unavailableDevices.length,
        orbitalActorsCount: inventory.orbitalActors.length,
        terrainGlbsCount: inventory.terrainGlbs.length,
        uniqueRuntimeGlbsCount: inventory.runtimeCatalogEntries.length,
        nonCatalogGlbsCount: inventory.nonCatalogEntries.length,
        mascotGlbsCount: inventory.mascotGlbs.length,
        totalDiskGlbCount: inventory.diskGlbCount,
        totalRuntimeBytes: inventory.totalRuntimeBytes,
        totalNonCatalogBytes: inventory.totalNonCatalogBytes,
        totalAllGlbBytes: inventory.totalAllGlbBytes,
        terrainRegionsCount: terrainManifest.regions.length,
        runtimeCatalogEntries: inventory.runtimeCatalogEntries,
        nonCatalogEntries: inventory.nonCatalogEntries,
        mascotGlbs: inventory.mascotGlbs,
        unavailableDevices: inventory.unavailableDevices,
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    `Validated ${inventory.runtimeCatalogEntries.length} unique runtime catalog GLBs (${inventory.selectableDevices.length} selectable devices, ${inventory.orbitalActors.length} orbital actors, ${inventory.terrainGlbs.length} terrain meshes), ${inventory.mascotGlbs.length} UI mascot GLB, ${inventory.nonCatalogEntries.length} documented non-catalog GLBs (${inventory.diskGlbCount} total GLBs on disk, ${inventory.unavailableDevices.length} unavailable procedural/CSV records), and ${terrainManifest.regions.length} terrain region manifests.`,
  );
}
