import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildExpectedAssetInventory, fileExists, sha256Hex } from './assetInventoryLib.mjs';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1')), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

if (!existsSync(DIST_DIR)) {
  throw new Error(`Build output directory missing: ${DIST_DIR}. Run "npm run build" first.`);
}

const inventory = await buildExpectedAssetInventory(ROOT_DIR);
if (inventory.untrackedDiskGlbs.length > 0) {
  throw new Error(`Untracked disk GLBs present: ${inventory.untrackedDiskGlbs.join(', ')}`);
}

let verifiedCount = 0;
let verifiedBytes = 0;

async function compareSourceAndDist(webPath, expectedBytes, expectedSha256, label) {
  const distAbs = path.join(DIST_DIR, webPath.replace(/^\//, ''));
  if (!(await fileExists(distAbs))) {
    throw new Error(`Missing ${label} in dist/: ${webPath}`);
  }
  const distBuf = await fs.readFile(distAbs);
  const distSha = sha256Hex(distBuf);
  if (distBuf.length !== expectedBytes) {
    throw new Error(`Size mismatch in dist/ for ${webPath}: expected ${expectedBytes} B, got ${distBuf.length} B`);
  }
  if (distSha !== expectedSha256) {
    throw new Error(`SHA-256 mismatch in dist/ for ${webPath}: expected ${expectedSha256}, got ${distSha}`);
  }
  verifiedCount += 1;
  verifiedBytes += distBuf.length;
}

for (const entry of inventory.runtimeCatalogEntries) {
  await compareSourceAndDist(entry.modelPath, entry.bytes, entry.sha256, 'runtime catalog GLB');
}

for (const entry of inventory.mascotGlbs) {
  await compareSourceAndDist(entry.modelPath, entry.bytes, entry.sha256, 'UI mascot GLB');
}

for (const entry of inventory.nonCatalogEntries) {
  await compareSourceAndDist(entry.modelPath, entry.bytes, entry.sha256, 'non-catalog GLB');
}

for (const file of inventory.companionFiles) {
  await compareSourceAndDist(file.webPath, file.bytes, file.sha256, 'companion public asset');
}

const indexHtmlPath = path.join(DIST_DIR, 'index.html');
if (!(await fileExists(indexHtmlPath))) {
  throw new Error('Missing dist/index.html');
}

console.log(
  `Verified dist/ build output: ${verifiedCount} asset files (${inventory.runtimeCatalogEntries.length} runtime GLBs + ${inventory.mascotGlbs.length} mascot GLB + ${inventory.nonCatalogEntries.length} non-catalog GLBs + ${inventory.companionFiles.length} companion files), ${verifiedBytes.toLocaleString('en-US')} bytes, 100% SHA-256 source->dist match.`,
);
