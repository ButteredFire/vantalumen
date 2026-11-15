import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BODY_CATALOG } from '../src/config/bodyCatalog';
import { ATLAS_POIS, latLonToBodyVector } from '../src/config/atlasPOIs';
import { DEVICE_CATALOG } from '../src/config/deviceCatalog';
import { DEVICE_DOSSIERS } from '../src/config/deviceDossiers';
import { ORBITAL_ACTORS_CATALOG, computeOrbitalPosition } from '../src/config/celestialCatalog';
import {
  classifyDeviceStatus,
  classifyLayerStatus,
  isDeviceSurfaceDeployable,
} from '../src/config/statusVocabulary';
import { validateCatalog, validateOrbitalActors } from '../src/config/validateCatalog';
import { useCosmosStore } from '../src/store/useCosmosStore';
import { buildSafeWarpSpline } from '../src/core/camera/warpPaths';
import { Vector3 } from 'three';

test('catalog IDs, sources, units, transforms and availability are valid', () => {
  validateCatalog(Object.values(BODY_CATALOG), ATLAS_POIS, DEVICE_CATALOG);
  validateOrbitalActors(Object.values(BODY_CATALOG), ORBITAL_ACTORS_CATALOG);
  const available = DEVICE_CATALOG.filter((device) => device.status === 'available');
  assert.equal(available.length, 13);
  for (const id of [
    'pioneer_10',
    'kepler_space_telescope',
    'dawn_spacecraft',
    'near_shoemaker',
    'mro_orbiter',
    'curiosity_rover',
    'perseverance_rover',
    'apollo_lunar_module',
  ]) {
    const dev = DEVICE_CATALOG.find((device) => device.id === id);
    assert.equal(dev?.status, 'available');
    assert.ok(dev?.modelPath?.endsWith('.glb'));
    assert.equal(dev?.proceduralModel, undefined);
  }
  const apolloLrv = DEVICE_CATALOG.find((device) => device.id === 'apollo_lrv');
  assert.equal(apolloLrv?.status, 'unavailable');
  assert.equal(apolloLrv?.modelPath, undefined);
  assert.equal(apolloLrv?.proceduralModel, 'apollo_lrv');

  const inlineAttributedIds = new Set([
    'mro_orbiter',
    'curiosity_rover',
    'perseverance_rover',
    'apollo_lunar_module',
  ]);
  for (const device of available) {
    if (inlineAttributedIds.has(device.id)) {
      assert.equal(device.attributionPath, undefined);
    } else {
      assert.equal(device.attributionPath, '/assets/attribution/Mars-Attributions.txt');
    }
  }
  for (const device of DEVICE_CATALOG.filter((item) => item.status === 'unavailable')) {
    assert.equal(device.attributionPath, undefined);
  }
});

test('English instrument-layer tags disclose when measured datasets are not integrated', () => {
  const marsBody = BODY_CATALOG.mars;
  const validMarsBody = {
    ...marsBody,
    layers: marsBody.layers.map((layer) =>
      layer.id === 'thermal_filter'
        ? { ...layer, tag: 'THEMIS thermal filter · Not integrated' }
        : layer,
    ),
  };
  validateCatalog(
    [validMarsBody, BODY_CATALOG.moon],
    ATLAS_POIS,
    DEVICE_CATALOG,
  );

  const misleadingMarsBody = {
    ...marsBody,
    layers: marsBody.layers.map((layer) =>
      layer.id === 'thermal_filter'
        ? { ...layer, tag: 'THEMIS thermal filter' }
        : layer,
    ),
  };
  assert.throws(
    () => validateCatalog([misleadingMarsBody, BODY_CATALOG.moon], ATLAS_POIS, DEVICE_CATALOG),
    /Layer tag implies unintegrated instrument data/,
  );
});

test('orbital actors catalog covers Mars moons/orbiters and Moon orbiters with valid Kepler elements and GLB paths', () => {
  const marsOrbiters = ORBITAL_ACTORS_CATALOG.filter((actor) => actor.bodyId === 'mars');
  const moonOrbiters = ORBITAL_ACTORS_CATALOG.filter((actor) => actor.bodyId === 'moon');
  assert.deepEqual(
    marsOrbiters.map((actor) => actor.id),
    ['phobos', 'deimos', 'mro_orbiter', 'mars_odyssey', 'maven_orbiter', 'dawn_flyby', 'ares_station'],
  );
  assert.deepEqual(moonOrbiters.map((actor) => actor.id), ['lro_orbiter', 'apollo_csm']);
  for (const actor of ORBITAL_ACTORS_CATALOG) {
    assert.ok(actor.orbitalElements);
    assert.ok(actor.modelPath?.endsWith('.glb'), `Expected orbital actor ${actor.id} to reference a GLB model`);
    const pos = computeOrbitalPosition(actor.orbitalElements, 3600);
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z));
    assert.ok(pos.length() > BODY_CATALOG[actor.bodyId!].radiusKm * 1.05);
  }
});

test('orbitalCloseup store flag resets across POV switch, target switch, body switch, and returnToOrbit', () => {
  const store = useCosmosStore;
  const odyssey = ORBITAL_ACTORS_CATALOG.find((actor) => actor.id === 'mars_odyssey')!;
  store.getState().selectBody('mars');
  store.getState().selectTarget(odyssey);
  assert.equal(store.getState().orbitalCloseup, false);

  store.getState().setOrbitalCloseup(true);
  store.getState().setInspectionMode('MODEL_CLOSEUP');
  assert.equal(store.getState().orbitalCloseup, true);

  store.getState().setInspectionMode('CONTROL_ROOM_POV');
  assert.equal(store.getState().orbitalCloseup, false);

  store.getState().setOrbitalCloseup(true);
  store.getState().returnToOrbit();
  assert.equal(store.getState().orbitalCloseup, false);
});

test('Moon body, POIs and Apollo records are source-backed and unloadable', () => {
  const moon = BODY_CATALOG.moon;
  assert.equal(moon.radiusKm, 1737.4);
  assert.equal(moon.rotationSeconds, 2360592);
  assert.match(moon.source.url, /moonfact/);
  const moonPois = ATLAS_POIS.filter((poi) => poi.bodyId === 'moon');
  assert.deepEqual(moonPois.map((poi) => poi.id), ['mare_tranquillitatis', 'tycho', 'south_pole_aitken']);
  const mare = moonPois[0];
  assert.equal(mare.coordinates?.lat, 8.35);
  assert.equal(mare.coordinates?.lon, 30.83);
  assert.equal(mare.source?.url, 'https://planetarynames.wr.usgs.gov/Feature/3691');
  const tycho = moonPois[1];
  assert.equal(tycho.coordinates?.lat, -43.30);
  assert.equal(tycho.coordinates?.lon, 348.78);
  assert.equal(tycho.source?.url, 'https://planetarynames.wr.usgs.gov/Feature/6163');
  const spa = moonPois[2];
  assert.equal(spa.coordinates?.lat, -53);
  assert.equal(spa.coordinates?.lon, 191);
  assert.match(spa.source?.url ?? '', /the-moons-largest-basin/);
  const moonDevices = DEVICE_CATALOG.filter((device) => device.bodyId === 'moon');
  assert.equal(moonDevices.length, 7);
  const unavailableMoonCsvDevices = moonDevices.filter((device) => device.id !== 'apollo_lunar_module');
  assert.equal(unavailableMoonCsvDevices.length, 6);
  for (const device of unavailableMoonCsvDevices) {
    assert.equal(device.status, 'unavailable');
    assert.equal(device.modelPath, undefined);
    assert.equal(device.bytes, undefined);
    assert.equal(device.sha256, undefined);
    assert.equal(device.attributionPath, undefined);
    assert.match(device.source.url, /apollo-equipment\.csv/);
  }
  const apolloLm = moonDevices.find((device) => device.id === 'apollo_lunar_module');
  assert.equal(apolloLm?.status, 'available');
  assert.equal(apolloLm?.modelPath, '/assets/models/moons/apollo_lunar_module.glb');
  assert.equal(apolloLm?.bytes, 716840);
  assert.equal(
    apolloLm?.sha256,
    '379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e',
  );
  assert.equal(apolloLm?.source.url, 'https://science.nasa.gov/3d-resources/apollo-lunar-module/');
  assert.equal(apolloLm?.capabilities?.supportsRealMobility, false);
  assert.equal(apolloLm?.capabilities?.supportsSimulatedSurfaceDrive, false);
  assert.ok(DEVICE_DOSSIERS.apollo_lunar_module);
});

test('invalid catalog fixtures fail instead of exposing nonexistent models', () => {
  assert.throws(() => validateCatalog(Object.values(BODY_CATALOG), ATLAS_POIS, [...DEVICE_CATALOG, DEVICE_CATALOG[0]]), /duplicate/);
  assert.throws(() => validateCatalog(Object.values(BODY_CATALOG), ATLAS_POIS, [{ ...DEVICE_CATALOG[0], status: 'unavailable' }]), /unavailable/);
  assert.throws(() => validateCatalog(Object.values(BODY_CATALOG), [{ ...ATLAS_POIS[0], coordinates: { lat: 91, lon: 0, height: 0 } }], DEVICE_CATALOG), /POI/);
  const moonDevice = DEVICE_CATALOG.find(
    (device) => device.bodyId === 'moon' && device.status === 'unavailable',
  )!;
  assert.throws(() => validateCatalog(Object.values(BODY_CATALOG), ATLAS_POIS, [{ ...moonDevice, modelPath: '/assets/models/moon/none.glb' }]), /unavailable/);
  assert.throws(() => validateCatalog([{ ...BODY_CATALOG.moon, target: { ...BODY_CATALOG.moon.target, bodyId: 'mars' } }], ATLAS_POIS, DEVICE_CATALOG), /target/);
});

test('geographic conversion has correct axes, hemispheres and radius', () => {
  assert.ok(latLonToBodyVector(0, 0, 10).distanceTo(new Vector3(10, 0, 0)) < 1e-10);
  assert.ok(latLonToBodyVector(0, 90, 10).distanceTo(new Vector3(0, 0, -10)) < 1e-10);
  assert.ok(latLonToBodyVector(90, 137, 10).distanceTo(new Vector3(0, 10, 0)) < 1e-10);
  assert.ok(latLonToBodyVector(-30, 300, 10).y < 0);
  assert.ok(Math.abs(latLonToBodyVector(-30, 300, 10).length() - 10) < 1e-10);
});

test('globe flights do not cross either body, including antipodal targets', () => {
  for (const body of Object.values(BODY_CATALOG)) {
    for (const poi of ATLAS_POIS.filter((item) => item.bodyId === body.id)) {
      const start = poi.position.clone().normalize().multiplyScalar(-body.radiusKm * 1.1);
      const { curve, endPosition } = buildSafeWarpSpline(start, poi, body.radiusKm);
      for (const point of curve.getPoints(200)) assert.ok(point.length() > body.radiusKm);
      assert.ok(curve.getPoint(1).distanceTo(endPosition) < 1e-6);
    }
  }
});

test('Mars → Moon → Mars switching resets body-scoped state and isolates stale loads', () => {
  const store = useCosmosStore;
  store.getState().selectBody('mars');
  store.getState().selectDevice('viking_lander');
  assert.equal(store.getState().activeDeviceId, 'viking_lander');
  store.getState().selectBody('moon');
  assert.equal(store.getState().activeBodyId, 'moon');
  assert.equal(store.getState().activeDeviceId, null);
  assert.equal(store.getState().activeTarget, null);
  assert.equal(store.getState().assetLoad.status, 'idle');
  assert.equal(store.getState().viewStage, 'ORBITAL_OVERVIEW');
  store.getState().selectTarget(ATLAS_POIS.find((poi) => poi.id === 'tycho')!);
  assert.equal(store.getState().activeTarget?.id, 'tycho');
  assert.equal(store.getState().viewStage, 'WARPING');
  store.getState().selectDevice('apollo_lrv');
  assert.equal(store.getState().activeDeviceId, 'apollo_lrv');
  assert.equal(store.getState().assetLoad.status, 'idle');
  assert.equal(store.getState().viewStage, 'ORBITAL_OVERVIEW');
  store.getState().setAssetLoad('viking_lander', { status: 'ready' });
  assert.equal(store.getState().assetLoad.status, 'idle');
  store.getState().selectBody('mars');
  assert.equal(store.getState().activeBodyId, 'mars');
  assert.equal(store.getState().activeDeviceId, null);
  assert.equal(store.getState().assetLoad.status, 'idle');
  assert.equal(store.getState().viewStage, 'ORBITAL_OVERVIEW');
  store.getState().selectDevice('viking_lander');
  assert.equal(store.getState().assetLoad.status, 'loading');
  store.getState().returnToOrbit();
  assert.equal(store.getState().assetLoad.status, 'idle');
});

test('selection, unavailable assets, stale load reports and unavailable layers', () => {
  const store = useCosmosStore;
  store.getState().selectBody('mars');
  store.getState().selectDevice('viking_lander');
  assert.equal(store.getState().assetLoad.status, 'loading');
  store.getState().selectDevice('perseverance_rover');
  assert.equal(store.getState().viewStage, 'SUB_SCENE');
  store.getState().setAssetLoad('viking_lander', { status: 'ready' });
  assert.equal(store.getState().assetLoad.status, 'loading');

  store.getState().selectBody('moon');
  store.getState().selectDevice('apollo_lrv');
  assert.equal(store.getState().viewStage, 'ORBITAL_OVERVIEW');
  store.getState().setAssetLoad('viking_lander', { status: 'ready' });
  assert.equal(store.getState().assetLoad.status, 'idle');

  store.getState().selectBody('mars');
  store.getState().setSpectralMode('MOLA_ELEVATION');
  assert.equal(store.getState().spectralMode, 'MOLA_ELEVATION');
  store.getState().setSpectralMode('TERRAIN_MESH_3D');
  assert.equal(store.getState().spectralMode, 'TERRAIN_MESH_3D');
  assert.equal(store.getState().viewStage, 'SUB_SCENE');

  // Moon now supports baked 8K surface, LOLA/Diviner spectral previews, and 3D terrain mesh
  store.getState().selectBody('moon');
  store.getState().setSpectralMode('MOLA_ELEVATION');
  assert.equal(store.getState().spectralMode, 'MOLA_ELEVATION');
  store.getState().setSpectralMode('TERRAIN_MESH_3D');
  assert.equal(store.getState().spectralMode, 'TERRAIN_MESH_3D');
  assert.equal(store.getState().viewStage, 'SUB_SCENE');

  store.getState().selectBody('mars');
  store.getState().selectTarget(ATLAS_POIS[0]);
  store.getState().enterSurfaceLanding();
  assert.notEqual(store.getState().viewStage, 'SURFACE_CESIUM');
  store.getState().returnToOrbit();
  assert.equal(store.getState().activeDeviceId, null);
  assert.equal(store.getState().assetLoad.status, 'idle');
});

test('P0.3/P0.4 mission relationships, non-Mars exclusions, status vocabulary & raw shader wiring', () => {
  // Pioneer 10, Kepler, NEAR excluded from Mars catalog and placed in reference scope
  const marsSurfaceDevices = DEVICE_CATALOG.filter(
    (d) => d.bodyId === 'mars' && d.catalogScope === 'body_surface',
  );
  for (const excludedId of ['pioneer_10', 'kepler_space_telescope', 'near_shoemaker', 'dawn_spacecraft']) {
    assert.equal(
      marsSurfaceDevices.some((d) => d.id === excludedId),
      false,
      `${excludedId} must not appear in Mars body_surface catalog`,
    );
  }
  for (const refId of ['pioneer_10', 'kepler_space_telescope', 'near_shoemaker']) {
    const dev = DEVICE_CATALOG.find((d) => d.id === refId);
    assert.equal(dev?.bodyId, 'reference');
    assert.equal(dev?.catalogScope, 'reference_spacecraft');
    assert.equal(isDeviceSurfaceDeployable(dev), false);
  }

  // Dawn is encounter context only; Ares Station is conceptual proxy
  const dawnDevice = DEVICE_CATALOG.find((d) => d.id === 'dawn_spacecraft');
  assert.equal(dawnDevice?.catalogScope, 'encounter_context');
  assert.equal(dawnDevice?.missionRelationship, 'flyby_encounter');
  assert.equal(dawnDevice?.coordinates, undefined);
  const dawnOrbital = ORBITAL_ACTORS_CATALOG.find((a) => a.id === 'dawn_flyby');
  assert.equal(dawnOrbital?.missionRelationship, 'flyby_encounter');
  const aresOrbital = ORBITAL_ACTORS_CATALOG.find((a) => a.id === 'ares_station');
  assert.equal(aresOrbital?.missionRelationship, 'conceptual_proxy');

  // Sojourner disclosure credits CC BY 4.0 creator instead of NASA CAD geometry
  const sojournerDossier = DEVICE_DOSSIERS.sojourner_rover;
  assert.doesNotMatch(sojournerDossier.modelDisclaimer, /CAD.*NASA|NASA.*hình học CAD/i);
  assert.match(sojournerDossier.modelDisclaimer, /Dan|danthemodeler|CC BY 4\.0/i);

  // Unified status vocabulary separation
  const perseverance = DEVICE_CATALOG.find((d) => d.id === 'perseverance_rover')!;
  assert.equal(classifyDeviceStatus(perseverance, { status: 'loading', progress: 40 }).representation, 'source_model');
  assert.equal(classifyDeviceStatus(perseverance, { status: 'error', message: '404' }).representation, 'record_only');
  const apolloLrv = DEVICE_CATALOG.find((d) => d.id === 'apollo_lrv')!;
  const apolloStatus = classifyDeviceStatus(apolloLrv, { status: 'idle' });
  assert.equal(apolloStatus.representation, 'procedural_reconstruction');
  assert.equal(apolloStatus.representationShortTag, 'Illustrative reconstruction');

  // Body layers use honest status vocabulary without implying integrated MOLA/THEMIS/LOLA/Diviner datasets
  for (const body of Object.values(BODY_CATALOG)) {
    assert.ok(body.unavailableDatasets.length >= 2);
    for (const layer of body.layers) {
      const layerStatus = classifyLayerStatus(layer);
      assert.equal(
        layerStatus.representationShortTag,
        layer.id === 'terrain_mesh_3d' ? 'Illustrative reconstruction' : 'Illustrative layer',
      );
      assert.doesNotMatch(layer.tag, /^(MOLA|THEMIS|LOLA|Diviner)$/i);
    }
  }

  // Raw shader imports configured without vite-plugin-glsl vs assetsInclude conflict
  const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
  assert.doesNotMatch(viteConfig, /vite-plugin-glsl/);
  assert.doesNotMatch(viteConfig, /\*\*\/\*\.glsl/);
  const starfield = fs.readFileSync(
    path.resolve(process.cwd(), 'src/scene/environment/DeepSpaceStarfield.tsx'),
    'utf8',
  );
  assert.match(starfield, /warpTunnel\.frag\.glsl\?raw/);
  const atmosphere = fs.readFileSync(
    path.resolve(process.cwd(), 'src/scene/mars/MarsAtmosphereMesh.tsx'),
    'utf8',
  );
  assert.match(atmosphere, /marsAtmosphere\.vert\.glsl\?raw/);
  assert.match(atmosphere, /marsAtmosphere\.frag\.glsl\?raw/);
});

test('P1 primary navigation replaces Option 1/2 and hides technical GLB/WebP/8K badges', () => {
  const primaryNavFiles = [
    'src/ui/hud/MissionEntry.tsx',
    'src/ui/hud/JourneyPanel.tsx',
    'src/ui/hud/CelestialQuickSelect.tsx',
    'src/ui/hud/TopNavigationBar.tsx',
  ];
  for (const relPath of primaryNavFiles) {
    const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
    assert.doesNotMatch(content, /Option\s*[12]/i, `Found Option 1/2 in ${relPath}`);
    assert.doesNotMatch(content, /\b(GLB|WebP|8K)\b/, `Found technical format badge in ${relPath}`);
  }

  for (const relPath of ['src/ui/hud/SubSceneInfoPanel.tsx', 'src/ui/hud/ViewModeFloatingBar.tsx']) {
    const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
    assert.doesNotMatch(content, /Option\s*[12]/i, `Found Option 1/2 in ${relPath}`);
  }

  const subSceneContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/ui/hud/SubSceneInfoPanel.tsx'),
    'utf8',
  );
  assert.match(subSceneContent, /Inspect model/);
  assert.match(subSceneContent, /Explore viewpoints/);
});
