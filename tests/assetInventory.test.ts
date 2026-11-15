import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DEVICE_CATALOG } from '../src/config/deviceCatalog';
import { ORBITAL_ACTORS_CATALOG } from '../src/config/celestialCatalog';
// @ts-expect-error ESM script helper tested directly under tsx
import { buildExpectedAssetInventory } from '../scripts/assetInventoryLib.mjs';

test('asset inventory covers every catalog/orbital/terrain GLB and separates non-catalog disk files', async () => {
  const inventory = await buildExpectedAssetInventory(path.resolve(process.cwd()));

  assert.equal(inventory.untrackedDiskGlbs.length, 0);

  const availableDevices = DEVICE_CATALOG.filter((d) => d.status === 'available');
  assert.equal(inventory.selectableDevices.length, availableDevices.length);
  assert.equal(inventory.unavailableDevices.length, DEVICE_CATALOG.length - availableDevices.length);
  assert.equal(inventory.orbitalActors.length, ORBITAL_ACTORS_CATALOG.length);

  for (const actor of ORBITAL_ACTORS_CATALOG) {
    assert.ok(
      inventory.orbitalActors.some((entry: { id: string; modelPath: string }) =>
        entry.id === actor.id && entry.modelPath === actor.modelPath,
      ),
      `Missing orbital actor in asset inventory: ${actor.id}`,
    );
  }

  const runtimePaths = new Set(inventory.runtimeCatalogEntries.map((e: { modelPath: string }) => e.modelPath));
  assert.ok(runtimePaths.has('/assets/models/moons/apollo_lunar_module.glb'));
  assert.ok(runtimePaths.has('/assets/models/mars/mars_terrain.glb'));
  assert.ok(runtimePaths.has('/assets/models/moons/moon_terrain.glb'));

  const nonCatalogPaths = new Set(inventory.nonCatalogEntries.map((e: { modelPath: string }) => e.modelPath));
  for (const stubPath of [
    '/assets/models/moons/phobos_draco.glb',
    '/assets/models/moons/deimos_draco.glb',
    '/assets/models/spacecraft/mars_reconnaissance_orbiter.glb',
    '/assets/models/stations/ares_orbital_station_lod0.glb',
    '/assets/models/spacecraft/perseverance_rover.glb',
    '/assets/models/stations/ares_orbital_station_lod1.glb',
  ]) {
    assert.ok(nonCatalogPaths.has(stubPath), `Expected documented non-catalog GLB: ${stubPath}`);
    assert.equal(runtimePaths.has(stubPath), false);
  }

  assert.equal(inventory.mascotGlbs.length, 1);
  assert.equal(inventory.mascotGlbs[0].modelPath, '/assets/mascot/rise_plushie.glb');
  assert.equal(inventory.mascotGlbs[0].bytes, 716904);
  assert.equal(
    inventory.mascotGlbs[0].sha256,
    'aee69a76157e5b5fea6067dc91d9ae847bcf747686e2b4694db383946ff6d32f',
  );
});
