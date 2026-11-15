import assert from 'node:assert/strict';
import test from 'node:test';
import { getDeviceSimulationProfile } from '../src/config/deviceSimulationProfiles';
import { FIXED_PHYSICS_DT } from '../src/scene/simulation/SimulationClock';
import {
  createInitialInputState,
  SimulationWorld,
} from '../src/scene/simulation/SimulationWorld';
import {
  computeSphericalDropM,
  sampleGlobalTerrainElevationM,
  sampleReliefElevationM,
} from '../src/scene/terrain/terrainDataPipeline';

test('64x64 km Mars traverse >10 km triggers >=3 floating-origin 1 km rebases and preserves local precision & curvature', async () => {
  const profile = getDeviceSimulationProfile('perseverance_rover');
  const sim = await SimulationWorld.create({
    bodyId: 'mars',
    deviceId: 'perseverance_rover',
    profile,
    regionSizeKm: 64,
    qualityTier: 'medium',
    enableWorker: false,
  });

  try {
    const driveInput = { throttle: 1, steer: 0, brake: false, ascend: 0 };
    // Simulate continuous multi-chunk traversal stepping ahead across 10.6 km in 900m jumps + live physics ticks
    // Wait: let's also verify natural origin rebase by stepping just under 1 km -> crossing 1.05 km naturally via Rapier!
    let prevDist = 0;
    for (let hop = 0; hop <= 11; hop += 1) {
      const targetX = hop * 960;
      const targetZ = -hop * 320;
      // Place just behind 1km boundary transition on first hop or advance steadily across chunks
      if (hop > 0) {
        sim.teleportToGlobal(targetX - 18, targetZ, -0.32);
      }
      // Drive across chunk edge / 1 km threshold natively via fixed 60 Hz ticks
      for (let tick = 0; tick < 180; tick += 1) {
        sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, driveInput, false);
        const snap = sim.buildRenderSnapshot(1);
        assert.ok(
          Math.hypot(snap.localPos.x, snap.localPos.z) < 1050,
          `Local pos grew too large without rebase: (${snap.localPos.x.toFixed(1)}, ${snap.localPos.z.toFixed(1)})`,
        );
      }
      prevDist = Math.hypot(
        sim.getCurrentGlobalPosition().x,
        sim.getCurrentGlobalPosition().z,
      );
    }

    assert.ok(prevDist > 10_000, `Expected >10 km global travel distance, got ${prevDist.toFixed(1)} m`);

    // Drive continuously from 0 to >3.2 km? We already test incremental natural 1km rebases directly:
    // Verify genuine originShiftCount accumulates across continuous stepping:
    sim.teleportToGlobal(0, 0, 0);
    const startRebases = sim.originShiftCount;
    for (const stepZ of [-1020, -2040, -3060, -4080]) {
      // Shift body manually near threshold to force SimulationWorld's 1000m runtime rebase check naturally!
      const deltaNeededZ = stepZ - sim.originOffset.z;
      sim.controller.teleport(
        sim.controller.pose.localPos.clone().set(0, sim.controller.pose.localPos.y, deltaNeededZ),
        0,
      );
      sim.chunkManager.primeImmediateNeighborhood(0, stepZ);
      sim.colliderManager.syncActiveTiles(0, stepZ, 0, sim.chunkManager.getLoadedTilesMap(), 1);
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, createInitialInputState(), false);
    }
    assert.ok(
      sim.originShiftCount - startRebases >= 3,
      `Expected >=3 automatic 1 km floating origin shifts, observed ${sim.originShiftCount - startRebases}`,
    );

    // Verify planetary curvature formula accuracy at d = 10 km on Mars (R = 3,389,500 m)
    const drop10Km = computeSphericalDropM(10_000, 0, 3_389_500);
    const relief = sampleReliefElevationM('mars', 10_000, 0);
    const total = sampleGlobalTerrainElevationM('mars', 10_000, 0, true);
    assert.ok(Math.abs(drop10Km - 14.75) < 0.05, `Expected ~14.75m Mars drop at 10km, got ${drop10Km}`);
    assert.ok(Math.abs((relief - drop10Km) - total) < 1e-4);
  } finally {
    sim.dispose();
  }
});

test('Checkpoint save & distant 64 km restore initializes origin, chunks, and telemetry cleanly', async () => {
  const profile = getDeviceSimulationProfile('apollo_lrv');
  const worldA = await SimulationWorld.create({
    bodyId: 'moon',
    deviceId: 'apollo_lrv',
    profile,
    regionSizeKm: 64,
    qualityTier: 'medium',
    enableWorker: false,
  });

  let checkpoint;
  try {
    worldA.teleportToGlobal(-4320, -6180, 1.1);
    for (let i = 0; i < 60; i += 1) {
      worldA.stepSinglePhysicsTick(FIXED_PHYSICS_DT, { throttle: 1, steer: 0, brake: false, ascend: 0 }, false);
    }
    checkpoint = worldA.buildCheckpoint(64);
  } finally {
    worldA.dispose();
  }

  assert.ok(checkpoint.globalPos[0] < -4000);
  assert.ok(checkpoint.odometerM > 0.5);

  const worldB = await SimulationWorld.create({
    bodyId: 'moon',
    deviceId: 'apollo_lrv',
    profile,
    regionSizeKm: 64,
    qualityTier: 'medium',
    checkpoint,
    enableWorker: false,
  });

  try {
    const posB = worldB.getCurrentGlobalPosition();
    const groundB = worldB.provider.sampleExactGridHeightAt(posB.x, posB.z);
    assert.ok(Math.abs(posB.x - checkpoint.globalPos[0]) < 0.5);
    assert.ok(Math.abs(posB.z - checkpoint.globalPos[2]) < 0.5);
    assert.ok(posB.y >= groundB, 'Restored checkpoint must spawn cleanly above ground');
    assert.equal(worldB.distanceTraveledM, checkpoint.odometerM);
    assert.ok(Math.abs(worldB.originOffset.x) >= 4000, 'Origin snapped cleanly to distant km block');
  } finally {
    worldB.dispose();
  }
});

test('Region size clamp enforces 2x2 km boundaries and streaming collider hold safety brake protects uncached terrain', async () => {
  const profile = getDeviceSimulationProfile('spirit_and_opportunity_rover');
  const sim = await SimulationWorld.create({
    bodyId: 'mars',
    deviceId: 'spirit_and_opportunity_rover',
    profile,
    regionSizeKm: 2,
    qualityTier: 'low',
    enableWorker: false,
  });

  try {
    sim.teleportToGlobal(998, 998, 0);
    for (let i = 0; i < 120; i += 1) {
      sim.stepSinglePhysicsTick(FIXED_PHYSICS_DT, { throttle: 1, steer: 0, brake: false, ascend: 0 }, false);
    }
    const pos = sim.getCurrentGlobalPosition();
    assert.ok(Math.abs(pos.x) <= 1000 && Math.abs(pos.z) <= 1000, '2x2 km region must clamp rover cleanly within +/-1000m');
    const tel = sim.buildTelemetrySnapshot('first_person', false, true, false);
    assert.ok(tel.activeChunkCount >= 9, 'Active streamed chunk ring must populate around rover');
  } finally {
    sim.dispose();
  }
});
