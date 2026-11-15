import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_LIST,
  getDefaultMissionForBody,
  validateMissions,
} from '../src/config/missions';
import { parseUrlState, serializeUrlState } from '../src/config/urlStateAdapter';
import {
  selectEffectiveOrbitsVisible,
  useCosmosStore,
} from '../src/store/useCosmosStore';

test('mission catalog passes structural and cross-body validation', () => {
  assert.doesNotThrow(() => validateMissions(MISSION_LIST));
  assert.equal(getDefaultMissionForBody('mars').id, 'jezero-evidence');
  assert.equal(getDefaultMissionForBody('moon').id, 'hadley-geology');
});

test('URL state adapter parses valid deep links and rejects unknown or cross-body mismatched params', () => {
  const empty = parseUrlState('');
  assert.equal(empty.hasExplicitParams, false);
  assert.equal(empty.bodyId, 'mars');
  assert.equal(empty.mode, 'guided');
  assert.equal(empty.missionId, 'jezero-evidence');
  assert.equal(empty.stopId, 'observe');
  assert.equal(empty.view, 'overview');
  assert.equal(empty.notice, null);

  const observeLink = parseUrlState('?v=1&body=mars&mission=jezero-evidence&stop=observe');
  assert.equal(observeLink.hasExplicitParams, true);
  assert.equal(observeLink.bodyId, 'mars');
  assert.equal(observeLink.mode, 'guided');
  assert.equal(observeLink.missionId, 'jezero-evidence');
  assert.equal(observeLink.stopId, 'observe');
  assert.equal(observeLink.view, 'overview');
  assert.equal(observeLink.targetId, null);
  assert.equal(observeLink.notice, null);

  const deviceStopLink = parseUrlState('?v=1&body=mars&mission=jezero-evidence&stop=investigate');
  assert.equal(deviceStopLink.mode, 'guided');
  assert.equal(deviceStopLink.targetKind, 'device');
  assert.equal(deviceStopLink.targetId, 'perseverance_rover');
  assert.equal(deviceStopLink.view, 'inspect');
  assert.equal(deviceStopLink.notice, null);

  const freeTargetLink = parseUrlState('?v=1&body=moon&mode=free&target=apollo_lrv&view=viewpoints');
  assert.equal(freeTargetLink.bodyId, 'moon');
  assert.equal(freeTargetLink.mode, 'free');
  assert.equal(freeTargetLink.targetKind, 'device');
  assert.equal(freeTargetLink.targetId, 'apollo_lrv');
  assert.equal(freeTargetLink.view, 'viewpoints');
  assert.equal(freeTargetLink.notice, null);

  // Unknown body falls back to Mars overview with clear user notice
  const badBody = parseUrlState('?v=1&body=jupiter&mission=jezero-evidence');
  assert.equal(badBody.bodyId, 'mars');
  assert.equal(badBody.view, 'overview');
  assert.equal(badBody.targetId, null);
  assert.ok(badBody.notice && badBody.notice.length > 0);

  // Unsupported version falls back cleanly with notice
  const badVersion = parseUrlState('?v=99&body=mars');
  assert.equal(badVersion.bodyId, 'mars');
  assert.equal(badVersion.view, 'overview');
  assert.ok(badVersion.notice && badVersion.notice.length > 0);

  // Cross-body mission mismatch falls back to valid overview on target body with notice
  const crossMission = parseUrlState('?v=1&body=mars&mission=hadley-geology');
  assert.equal(crossMission.bodyId, 'mars');
  assert.equal(crossMission.missionId, 'jezero-evidence');
  assert.equal(crossMission.stopId, 'observe');
  assert.equal(crossMission.view, 'overview');
  assert.ok(crossMission.notice && crossMission.notice.length > 0);

  // Cross-body target mismatch falls back to valid overview on target body with notice
  const crossTarget = parseUrlState('?v=1&body=mars&target=apollo_lrv');
  assert.equal(crossTarget.bodyId, 'mars');
  assert.equal(crossTarget.targetId, null);
  assert.equal(crossTarget.view, 'overview');
  assert.ok(crossTarget.notice && crossTarget.notice.length > 0);

  // Unknown stop falls back cleanly with notice
  const badStop = parseUrlState('?v=1&body=mars&mission=jezero-evidence&stop=nonexistent');
  assert.equal(badStop.bodyId, 'mars');
  assert.equal(badStop.stopId, 'observe');
  assert.equal(badStop.view, 'overview');
  assert.ok(badStop.notice && badStop.notice.length > 0);

  // Viewpoints on bare overview falls back with notice
  const orphanViewpoints = parseUrlState('?v=1&body=moon&view=viewpoints');
  assert.equal(orphanViewpoints.bodyId, 'moon');
  assert.equal(orphanViewpoints.view, 'overview');
  assert.ok(orphanViewpoints.notice && orphanViewpoints.notice.length > 0);

  // Serialization symmetry for guided overview stop
  const search = serializeUrlState({
    bodyId: 'mars',
    mode: 'guided',
    missionId: 'jezero-evidence',
    stopId: 'observe',
    activeTarget: null,
    activeDeviceId: null,
    spectralMode: 'VISUAL_RGB',
    viewStage: 'ORBITAL_OVERVIEW',
    inspectionMode: 'MODEL_CLOSEUP',
  });
  assert.equal(search, '?v=1&body=mars&mission=jezero-evidence&stop=observe');
});

test('guided mode hides orbits by default while preserving free-mode showOrbits preference', () => {
  const store = useCosmosStore;
  store.getState().setExplorationMode('free');
  if (!store.getState().showOrbits) {
    store.getState().toggleOrbits();
  }
  store.getState().selectBody('mars');

  // Switch into guided mode: effective orbits hidden by default, free preference stays true
  store.getState().setExplorationMode('guided');
  assert.equal(selectEffectiveOrbitsVisible(store.getState()), false);
  assert.equal(store.getState().showOrbits, true);

  // Switch into free mode: saved free preference (true) returns
  store.getState().setExplorationMode('free');
  assert.equal(selectEffectiveOrbitsVisible(store.getState()), true);

  // User turns off orbits in free mode
  store.getState().toggleOrbits();
  assert.equal(store.getState().showOrbits, false);
  assert.equal(selectEffectiveOrbitsVisible(store.getState()), false);

  // Temporarily turn on orbits inside guided mode, then return to free mode -> free preference stays false!
  store.getState().setExplorationMode('guided');
  assert.equal(selectEffectiveOrbitsVisible(store.getState()), false);
  store.getState().toggleOrbits();
  assert.equal(selectEffectiveOrbitsVisible(store.getState()), true);
  assert.equal(store.getState().showOrbits, false);

  store.getState().setExplorationMode('free');
  assert.equal(selectEffectiveOrbitsVisible(store.getState()), false);
  assert.equal(store.getState().showOrbits, false);

  // Restore clean free preference & guided default for downstream tests
  store.getState().toggleOrbits();
  store.getState().setExplorationMode('guided');
});

test('selectMissionStop & applyUrlState synchronize body, stop target, and fallback notices', () => {
  const store = useCosmosStore;
  store.getState().selectMissionStop('jezero-evidence', 'jezero');
  assert.equal(store.getState().activeBodyId, 'mars');
  assert.equal(store.getState().explorationMode, 'guided');
  assert.equal(store.getState().activeStopId, 'jezero');
  assert.equal(store.getState().activeTarget?.id, 'jezero_crater');
  assert.equal(store.getState().spectralMode, 'TERRAIN_MESH_3D');
  assert.equal(store.getState().viewStage, 'SUB_SCENE');

  store.getState().selectMissionStop('hadley-geology', 'lrv');
  assert.equal(store.getState().activeBodyId, 'moon');
  assert.equal(store.getState().activeMissionId, 'hadley-geology');
  assert.equal(store.getState().activeStopId, 'lrv');
  assert.equal(store.getState().activeDeviceId, 'apollo_lrv');
  assert.equal(store.getState().inspectionMode, 'MODEL_CLOSEUP');

  const invalidParsed = parseUrlState('?v=1&body=mars&target=apollo_lrv');
  store.getState().applyUrlState(invalidParsed, { skipPreloader: true });
  assert.equal(store.getState().activeBodyId, 'mars');
  assert.equal(store.getState().activeDeviceId, null);
  assert.equal(store.getState().viewStage, 'ORBITAL_OVERVIEW');
  assert.ok(store.getState().urlNotice);

  store.getState().dismissUrlNotice();
  assert.equal(store.getState().urlNotice, null);
});
