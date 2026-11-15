import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT_DIR, 'public', 'assets', 'terrain', 'manifest.json');

const TILE_SIZE_M = 256;
const BASE_GRID_RESOLUTION = 97;
const ELEVATION_QUANTIZATION_M = 0.005;

const BODY_SEED = {
  mars: 409_731,
  moon: 823_157,
};

const REGION_METADATA = {
  mars: {
    regionName: 'Ares Vallis — Vùng hạ cánh Pathfinder',
    source: 'MOLA baseline parameters + deterministic seeded synthetic micro-relief',
    license: 'Public domain NASA/MOLA reference + MIT procedural relief',
    elevationRangeM: { min: -28.4, max: 32.8 },
  },
  moon: {
    regionName: 'Hadley–Apennine — Apollo 15',
    source: 'LOLA baseline parameters + deterministic seeded synthetic rille & craters',
    license: 'Public domain NASA/LOLA reference + MIT procedural relief',
    elevationRangeM: { min: -34.2, max: 38.6 },
  },
};

function computeDeterministicChecksum(bodyId, regionSizeKm, seed) {
  const payload = JSON.stringify({
    bodyId,
    regionSizeKm,
    tileSizeM: TILE_SIZE_M,
    baseGridResolution: BASE_GRID_RESOLUTION,
    quantizationStepM: ELEVATION_QUANTIZATION_M,
    seed,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function generateManifest() {
  const entries = [];
  for (const bodyId of ['mars', 'moon']) {
    const meta = REGION_METADATA[bodyId];
    const seed = BODY_SEED[bodyId];
    for (const regionSizeKm of [2, 16, 64]) {
      const half = (regionSizeKm * 1000) / 2;
      entries.push({
        bodyId,
        regionName: meta.regionName,
        regionSizeKm,
        tileSizeM: TILE_SIZE_M,
        baseGridResolution: BASE_GRID_RESOLUTION,
        boundsMeters: {
          minX: -half,
          maxX: half,
          minZ: -half,
          maxZ: half,
        },
        elevationRangeM: meta.elevationRangeM,
        quantizationStepM: ELEVATION_QUANTIZATION_M,
        maxQuantizationErrorM: ELEVATION_QUANTIZATION_M / 2,
        source: meta.source,
        license: meta.license,
        isBaselinePlusSyntheticRelief: true,
        seed,
        sha256: computeDeterministicChecksum(bodyId, regionSizeKm, seed),
      });
    }
  }

  const document = {
    schemaVersion: 1,
    generatedAt: '2026-11-15T00:00:00Z',
    note: 'Regional terrain streaming manifest combining NASA MOLA/LOLA reference coordinates with deterministic seeded micro-relief.',
    regions: entries,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(document, null, 2) + '\n', 'utf8');
  console.log(`Generated terrain manifest with ${entries.length} region profiles at ${OUT_PATH}`);
}

generateManifest().catch((err) => {
  console.error('Failed to generate terrain manifest:', err);
  process.exitCode = 1;
});
