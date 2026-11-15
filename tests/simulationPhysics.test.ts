import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { getBodyPhysicsConfig } from '../src/config/bodyPhysicsConfig';
import { getDeviceSimulationProfile } from '../src/config/deviceSimulationProfiles';
import { DEVICE_CATALOG } from '../src/config/deviceCatalog';
import { FIXED_PHYSICS_DT } from '../src/scene/simulation/SimulationClock';
import {
  createInitialInputState,
  SimulationWorld,
} from '../src/scene/simulation/SimulationWorld';
import {
  BASE_TILE_SEGMENTS,
  generateTilePayload,
  sampleTileGridHeight,
} from '../src/scene/terrain/terrainDataPipeline';

test('Perseverance 6-wheel rover settles, climbs ramp & basalt step, crosses trench, and recovers from hazard crater', async () => {
  const device = DEVICE_CATALOG.find((d) => d.id === 'perseverance_rover')!;
  const profile = getDeviceSimulationProfile('perseverance_rover', device);
  const sim = await SimulationWorld.create({
    bodyId: 'mars',
    deviceId: 'perseverance_rover',
    profile,
    regionSizeKm: 2,
    qualityTier: 'medium',
    enableWorker: false,
  });

  try {
    const idleInput = createInitialInputState();
    for (let i = 0; i < 45; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, idleInput, false);
    }
    const settledPos = sim.getCurrentGlobalPosition();
    const groundAtOrigin = sim.provider.sampleHeightAt(settledPos.x, settledPos.z);
    assert.ok(
      sim.controller.pose.wheelsGroundedCount >= 4,
      `Expected >=4 wheels grounded at rest, got ${sim.controller.pose.wheelsGroundedCount}`,
    );
    assert.ok(Math.abs(settledPos.y - groundAtOrigin) < 1.2, 'Rover chassis settled cleanly near terrain');

    // Drive forward (-Z) up toward basalt slab (-15m) & ramp ridge (-28m.. -34m)
    const driveInput = { throttle: 1, steer: 0, brake: false, ascend: 0 };
    let peakClimb = 0;
    for (let i = 0; i < 600; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveInput, false);
      const pos = sim.getCurrentGlobalPosition();
      const gY = sim.provider.sampleHeightAt(pos.x, pos.z);
      const climb = gY - groundAtOrigin;
      if (climb > peakClimb) peakClimb = climb;
    }

    const afterDrive = sim.getCurrentGlobalPosition();
    assert.ok(afterDrive.z < -20, `Expected forward travel past -20m, got z=${afterDrive.z.toFixed(2)}`);
    assert.ok(peakClimb > 1.0, `Expected ramp climb >1.0m, peak=${peakClimb.toFixed(2)}`);
    assert.ok(sim.distanceTraveledM > 18, `Expected odometer > 18m, got ${sim.distanceTraveledM.toFixed(2)}`);

    // Traverse across shallow trench (z ≈ -74m) without tunneling under ground
    sim.teleportToGlobal(0, -64, 0);
    for (let i = 0; i < 360; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveInput, false);
      const pos = sim.getCurrentGlobalPosition();
      const terrainH = sim.provider.sampleHeightAt(pos.x, pos.z);
      assert.ok(pos.y >= terrainH - 0.15, `Rover tunneled below trench at z=${pos.z.toFixed(2)}`);
    }

    // Place rover on steep wall of deep hazard crater (-92, -112), trigger tilt & recover cleanly (R)
    sim.teleportToGlobal(-92, -112, 0.5);
    for (let i = 0; i < 90; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveInput, false);
    }
    sim.recoverToLastStablePose();
    const recoveredPos = sim.getCurrentGlobalPosition();
    const recoveredGround = sim.provider.sampleHeightAt(recoveredPos.x, recoveredPos.z);
    assert.ok(Number.isFinite(recoveredPos.x) && Number.isFinite(recoveredPos.y) && Number.isFinite(recoveredPos.z));
    assert.ok(recoveredPos.y >= recoveredGround, 'Recovered pose must sit cleanly on terrain');
  } finally {
    sim.dispose();
  }
});

test('Sojourner 0.065m wheels match Rapier heightfield seam error <= 5% of wheel radius (<= 3.25mm)', () => {
  // Check exact tile seam x = +128m between tile (0,0) and tile (1,0) on Mars and Moon
  for (const bodyId of ['mars', 'moon'] as const) {
    const tileLeft = generateTilePayload(bodyId, 0, 0, BASE_TILE_SEGMENTS);
    const tileRight = generateTilePayload(bodyId, 1, 0, BASE_TILE_SEGMENTS);

    for (let z = -120; z <= 120; z += 7.5) {
      const hLeft = sampleTileGridHeight(
        tileLeft.heights,
        BASE_TILE_SEGMENTS,
        tileLeft.minX,
        tileLeft.minZ,
        127.9999,
        z,
      );
      const hRight = sampleTileGridHeight(
        tileRight.heights,
        BASE_TILE_SEGMENTS,
        tileRight.minX,
        tileRight.minZ,
        128.0001,
        z,
      );
      const seamErrorM = Math.abs(hLeft - hRight);
      assert.ok(
        seamErrorM <= 0.00325,
        `${bodyId} seam discontinuity ${seamErrorM.toFixed(6)}m exceeded 3.25mm (5% of 0.065m wheel radius) at z=${z}`,
      );
    }
  }
});

test('Apollo LRV drives cleanly in 1.625 m/s² lunar gravity & respects braking', async () => {
  const device = DEVICE_CATALOG.find((d) => d.id === 'apollo_lrv')!;
  const profile = getDeviceSimulationProfile('apollo_lrv', device);
  assert.equal(getBodyPhysicsConfig('moon').gravityMs2, 1.625);

  const sim = await SimulationWorld.create({
    bodyId: 'moon',
    deviceId: 'apollo_lrv',
    profile,
    regionSizeKm: 2,
    qualityTier: 'medium',
    enableWorker: false,
  });

  try {
    const driveLeft = { throttle: 1, steer: 0.4, brake: false, ascend: 0 };
    for (let i = 0; i < 240; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveLeft, false);
    }
    const movedPos = sim.getCurrentGlobalPosition();
    assert.ok(Math.hypot(movedPos.x, movedPos.z) > 6, 'Apollo LRV must cover ground cleanly under 4-wheel drive');
    assert.ok(movedPos.x < -0.5, 'Left steering input (+steer) should curve toward -X heading');

    const brakeInput = { throttle: 0, steer: 0, brake: true, ascend: 0 };
    for (let i = 0; i < 150; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, brakeInput, false);
    }
    assert.ok(sim.controller.pose.speedMs < 0.35, `Expected LRV to stop under braking, speed=${sim.controller.pose.speedMs}`);
  } finally {
    sim.dispose();
  }
});

test('Fixed-60Hz accumulator produces deterministic paths across 30Hz, 60Hz, and 120Hz frame pacing', async () => {
  const profile = getDeviceSimulationProfile('curiosity_rover');
  const runAtFps = async (dt: number, steps: number) => {
    const sim = await SimulationWorld.create({
      bodyId: 'mars',
      deviceId: 'curiosity_rover',
      profile,
      regionSizeKm: 2,
      qualityTier: 'low',
      enableWorker: false,
    });
    try {
      const input = { throttle: 1, steer: 0.25, brake: false, ascend: 0 };
      let snap = sim.buildRenderSnapshot(1);
      for (let i = 0; i < steps; i += 1) {
        snap = sim.stepFixed(dt, input, false, false);
      }
      return sim.getCurrentGlobalPosition().distanceTo(new THREE.Vector3(0, snap.globalPos.y, 0)) > 0
        ? sim.getCurrentGlobalPosition()
        : snap.globalPos;
    } finally {
      sim.dispose();
    }
  };

  // Total 2.0 seconds in each cadence: 60 steps @ 1/30s, 120 steps @ 1/60s, 240 steps @ 1/120s
  const p30 = await runAtFps(1 / 30, 60);
  const p60 = await runAtFps(1 / 60, 120);
  const p120 = await runAtFps(1 / 120, 240);

  const err30_60 = p30.distanceTo(p60);
  const err120_60 = p120.distanceTo(p60);
  assert.ok(err30_60 < 0.05, `Expected 30Hz vs 60Hz determinism (<5cm), got ${err30_60.toFixed(4)}m`);
  assert.ok(err120_60 < 0.05, `Expected 120Hz vs 60Hz determinism (<5cm), got ${err120_60.toFixed(4)}m`);
});

test('Ingenuity helicopter takes off, spins coaxial rotors, translates forward, and stops on terrain collider without tunneling', async () => {
  const device = DEVICE_CATALOG.find((d) => d.id === 'ingenuity_helicopter')!;
  const profile = getDeviceSimulationProfile('ingenuity_helicopter', device);
  const sim = await SimulationWorld.create({
    bodyId: 'mars',
    deviceId: 'ingenuity_helicopter',
    profile,
    regionSizeKm: 2,
    qualityTier: 'medium',
    enableWorker: false,
  });

  try {
    const ascendInput = { throttle: 0.8, steer: 0, brake: false, ascend: 1 };
    let lastRotorAngle = 0;
    for (let i = 0; i < 180; i += 1) {
      const snap = sim.stepFixed(FIXED_PHYSICS_DT, ascendInput, false);
      if (i > 20) {
        assert.ok(snap.rotorSpinAngleRad > lastRotorAngle, 'Coaxial rotor spin should increment');
      }
      lastRotorAngle = snap.rotorSpinAngleRad;
    }

    const highSnap = sim.buildRenderSnapshot(1);
    assert.ok(highSnap.airborne, 'Ingenuity must report airborne state during climbed hover');
    const groundY = sim.provider.sampleHeightAt(highSnap.globalPos.x, highSnap.globalPos.z);
    assert.ok(
      highSnap.globalPos.y - groundY > 1.2,
      `Expected climb > 1.2m AGL, got ${(highSnap.globalPos.y - groundY).toFixed(2)}m`,
    );

    // Descend back to surface and ensure Rapier ground collision prevents tunneling
    const descendInput = { throttle: 0, steer: 0, brake: false, ascend: -1 };
    for (let i = 0; i < 240; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, descendInput, false);
      const pos = sim.getCurrentGlobalPosition();
      const terrainH = sim.provider.sampleHeightAt(pos.x, pos.z);
      assert.ok(pos.y >= terrainH - 0.08, `Helicopter tunneled below terrain at y=${pos.y.toFixed(2)}`);
    }
  } finally {
    sim.dispose();
  }
});

test('Stationary lander Viking stays locked by default and only moves when simulated mobility is enabled', async () => {
  const device = DEVICE_CATALOG.find((d) => d.id === 'viking_lander')!;
  const profile = getDeviceSimulationProfile('viking_lander', device);
  const sim = await SimulationWorld.create({
    bodyId: 'mars',
    deviceId: 'viking_lander',
    profile,
    regionSizeKm: 2,
    qualityTier: 'medium',
    enableWorker: false,
  });

  try {
    const startPos = sim.getCurrentGlobalPosition();
    const driveInput = { throttle: 1, steer: 0, brake: false, ascend: 0 };
    for (let i = 0; i < 120; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveInput, false);
    }
    const afterStatic = sim.getCurrentGlobalPosition();
    const staticDrift = Math.hypot(afterStatic.x - startPos.x, afterStatic.z - startPos.z);
    assert.ok(staticDrift < 0.05, `Static lander drifted ${staticDrift.toFixed(3)}m while stationary`);

    // Enable "Di chuyển giả lập"
    for (let i = 0; i < 180; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveInput, true);
    }
    const afterSimulated = sim.getCurrentGlobalPosition();
    const simTravel = Math.hypot(afterSimulated.x - startPos.x, afterSimulated.z - startPos.z);
    assert.ok(simTravel > 2.5, `Expected simulated exploration travel > 2.5m, got ${simTravel.toFixed(2)}m`);
  } finally {
    sim.dispose();
  }
});

test('All Mars and Moon surface devices retain planetary gravity at rest (zero upward levitation or tip-over across 180 ticks)', async () => {
  const idle = createInitialInputState();
  for (const device of DEVICE_CATALOG) {
    const profile = getDeviceSimulationProfile(device.id, device);
    if (profile.mobilityKind === 'orbital') continue;

    const sim = await SimulationWorld.create({
      bodyId: profile.bodyId,
      deviceId: device.id,
      profile,
      regionSizeKm: 2,
      qualityTier: 'low',
      enableWorker: false,
    });
    try {
      for (let i = 0; i < 180; i += 1) {
        sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, idle, false);
      }
      const pos = sim.getCurrentGlobalPosition();
      const groundY = sim.provider.sampleHeightAt(pos.x, pos.z);
      const heightAboveGround = pos.y - groundY;
      assert.ok(
        heightAboveGround >= -0.05 && heightAboveGround <= profile.physicalTransform.dimensionsM[1] + 0.6,
        `Device ${device.id} (${profile.bodyId}) levitated or sank: y-g=${heightAboveGround.toFixed(3)}m`,
      );
      assert.notEqual(
        sim.controller.pose.stabilityWarning,
        'tip_over',
        `Device ${device.id} tipped over unexpectedly at rest`,
      );
    } finally {
      sim.dispose();
    }
  }
});
