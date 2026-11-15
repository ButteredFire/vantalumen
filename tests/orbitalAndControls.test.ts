import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CELESTIAL_BODIES_CATALOG,
  computeOrbitalPosition,
  ORBITAL_ACTORS_CATALOG,
} from '../src/config/celestialCatalog';
import { DEVICE_CATALOG } from '../src/config/deviceCatalog';
import { getDeviceSimulationProfile } from '../src/config/deviceSimulationProfiles';
import {
  clampFrameDelta,
  computeKeplerPeriodHours,
  computeOrbitalApsidesKm,
  computeOrbitalTimeStep,
  FIXED_PHYSICS_DT,
  MAX_RENDER_DT,
} from '../src/scene/simulation/SimulationClock';
import { surfaceInputBridge } from '../src/scene/simulation/surfaceInputBridge';
import { useCosmosStore } from '../src/store/useCosmosStore';

test('Kepler orbital period and apsides formulas close orbital loops cleanly', () => {
  // Verify Phobos Keplerian theoretical period around Mars (~9376 km real semi-major axis -> ~7.65h)
  const phobosPeriodRealH = computeKeplerPeriodHours(9376, 'mars');
  assert.ok(
    Math.abs(phobosPeriodRealH - 7.65) < 0.1,
    `Expected Phobos theoretical period ~7.65h, got ${phobosPeriodRealH.toFixed(3)}h`,
  );

  for (const actor of ORBITAL_ACTORS_CATALOG) {
    if (!actor.orbitalElements) continue;
    const elems = actor.orbitalElements;
    const { periapsisKm, apoapsisKm } = computeOrbitalApsidesKm(elems);
    assert.ok(periapsisKm <= elems.semiMajorAxisKm && elems.semiMajorAxisKm <= apoapsisKm);

    const p0 = computeOrbitalPosition(elems, 0);
    const pPeriod = computeOrbitalPosition(elems, elems.orbitalPeriodHours * 3600);
    const loopErr = p0.distanceTo(pPeriod);
    assert.ok(
      loopErr < 1e-4,
      `Orbital trajectory ${actor.id} failed to close period loop: err=${loopErr}`,
    );
  }
});

test('SimulationClock decouples orbital timeScale and pause/tab-hidden from 60Hz surface physics dt', () => {
  assert.equal(FIXED_PHYSICS_DT, 1 / 60);
  assert.equal(computeOrbitalTimeStep(0.016, 5000, true, false), 0, 'Paused orbital clock must halt');
  assert.equal(computeOrbitalTimeStep(0.016, 5000, false, true), 0, 'Hidden tab must clamp dt to 0');
  assert.equal(clampFrameDelta(2.0, true), 0);
  assert.equal(clampFrameDelta(2.0, false), MAX_RENDER_DT);

  const warpped = computeOrbitalTimeStep(0.02, 1000, false, false);
  assert.ok(Math.abs(warpped - 20) < 1e-6);
});

test('surfaceInputBridge releases all held keys & joystick axes safely on lifecycle release', () => {
  surfaceInputBridge.releaseAll();
  surfaceInputBridge.setKeyDown('KeyW');
  surfaceInputBridge.setKeyDown('KeyA');
  surfaceInputBridge.setKeyDown('Space');
  surfaceInputBridge.setVirtualJoystick(0.5, -0.3);
  assert.equal(surfaceInputBridge.isActive(), true);

  const heliSample = surfaceInputBridge.sample(true);
  assert.equal(heliSample.ascend, 1, 'Space should command vertical climb in helicopter mode');
  assert.equal(heliSample.brake, false);

  const roverSample = surfaceInputBridge.sample(false);
  assert.equal(roverSample.brake, true, 'Space should command brake in rover mode');
  assert.equal(roverSample.throttle, 1);

  surfaceInputBridge.releaseAll();
  assert.equal(surfaceInputBridge.isActive(), false);
  const released = surfaceInputBridge.sample(false);
  assert.deepEqual(released, { throttle: 0, steer: 0, brake: false, ascend: 0 });
});

test('All 18 catalog devices and orbital actors resolve complete simulation profiles & store body switch resets cleanly', () => {
  for (const record of DEVICE_CATALOG) {
    const profile = getDeviceSimulationProfile(record.id, record);
    assert.ok(profile.id, `Missing profile for device ${record.id}`);
    assert.ok(profile.physicalTransform.targetLongestSideM > 0);
    assert.ok(profile.wheelRig.chassisMassKg > 0);
  }
  for (const actor of [...CELESTIAL_BODIES_CATALOG, ...ORBITAL_ACTORS_CATALOG]) {
    if (actor.category === 'SPACECRAFT' || actor.category === 'MOON') {
      const profile = getDeviceSimulationProfile(actor.id);
      assert.equal(profile.mobilityKind, 'orbital', `Expected orbital profile for ${actor.id}`);
    }
  }

  const store = useCosmosStore.getState();
  store.selectBody('mars');
  store.selectDevice('perseverance_rover');
  store.setInspectionMode('CONTROL_ROOM_POV');
  assert.equal(useCosmosStore.getState().activeDeviceId, 'perseverance_rover');

  // Switching body synchronously resets active device, POV, pointer lock, and boundary warnings
  store.selectBody('moon');
  const afterMoon = useCosmosStore.getState();
  assert.equal(afterMoon.activeBodyId, 'moon');
  assert.equal(afterMoon.activeDeviceId, null);
  assert.equal(afterMoon.inspectionMode, 'MODEL_CLOSEUP');
  assert.equal(afterMoon.pointerLocked, false);
  assert.equal(afterMoon.regionBoundaryMessage, null);
  store.selectBody('mars');
});
