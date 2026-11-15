import { ATLAS_POIS } from './atlasPOIs';
import { BODY_CATALOG } from './bodyCatalog';
import { ORBITAL_ACTORS_CATALOG } from './celestialCatalog';
import { DEVICE_CATALOG } from './deviceCatalog';
import type { BodyId, MissionConfig, MissionStopConfig } from '../types/cosmos.types';

export const MISSION_LIST: MissionConfig[] = [
  {
    id: 'jezero-evidence',
    bodyId: 'mars',
    title: 'Jezero Journey: Searching for Traces of an Ancient Lake',
    headlineQuestion:
      'Why was Jezero Crater selected to search for evidence of ancient water on Mars?',
    summary:
      'Follow four stops, from the planetary overview and illustrative terrain to the Perseverance rover and Ingenuity helicopter.',
    defaultStopId: 'observe',
    featuredDeviceIds: ['perseverance_rover', 'ingenuity_helicopter', 'curiosity_rover'],
    featuredPoiIds: ['jezero_crater', 'gale_crater'],
    stops: [
      {
        id: 'observe',
        missionId: 'jezero-evidence',
        stepIndex: 1,
        title: 'View Mars from Orbit',
        shortLabel: '1. Mars Overview',
        questionPrompt:
          'Where are Jezero and other notable features on the planetary globe?',
        summary:
          'View the Red Planet before descending. Orbital paths are temporarily hidden in guided mode so you can focus on the surface and the main story.',
        whatYouSee:
          'An illustrative synthesized Mars globe at center, with markers leading to Jezero Crater.',
        imageStatusNote:
          'Displays a synthesized illustrative globe (not quantitative real-time imagery).',
        bodyId: 'mars',
        targetKind: 'body',
        targetId: 'mars',
        suggestedView: 'overview',
      },
      {
        id: 'jezero',
        missionId: 'jezero-evidence',
        stepIndex: 2,
        title: 'Jezero Terrain Mesh (Illustrative 3D)',
        shortLabel: '2. Jezero Landforms',
        questionPrompt:
          'How do the terrain relief and crater rim appear in the target area?',
        summary:
          'Focus on the Jezero feature center (18.41°N, 77.69°E per IAU/USGS) and open the illustrative 3D terrain mesh in Inspect Model mode.',
        whatYouSee:
          'The illustrative Mars 3D terrain mesh can be rotated and zoomed to inspect the landforms.',
        imageStatusNote:
          'Feature center from the IAU/USGS Gazetteer; the 3D terrain mesh is illustrative.',
        bodyId: 'mars',
        targetKind: 'poi',
        targetId: 'jezero_crater',
        suggestedView: 'inspect',
        recommendedLayerMode: 'TERRAIN_MESH_3D',
      },
      {
        id: 'investigate',
        missionId: 'jezero-evidence',
        stepIndex: 3,
        title: 'Perseverance Rover',
        shortLabel: '3. Perseverance',
        questionPrompt:
          'How do the optical assemblies, chassis, and robotic arm support rock and soil sample collection?',
        summary:
          'View the NASA/JPL Perseverance 3D model in Inspect Model mode, then switch to Explore Viewpoints to see the simulated control-room perspective.',
        whatYouSee:
          'A size-normalized Perseverance 3D model with controls for selecting component groups.',
        imageStatusNote:
          'NASA/JPL GLB model · Control-room operating values are illustrative simulations.',
        bodyId: 'mars',
        targetKind: 'device',
        targetId: 'perseverance_rover',
        suggestedView: 'inspect',
      },
      {
        id: 'compare',
        missionId: 'jezero-evidence',
        stepIndex: 4,
        title: 'Ingenuity Helicopter',
        shortLabel: '4. Ingenuity',
        questionPrompt:
          'How did Ingenuity’s counter-rotating coaxial rotor design enable flight in the thin atmosphere?',
        summary:
          'Compare a lightweight aerial scout with a heavy rover. Slow rotor rotation in the right-hand panel is an illustrative demonstration.',
        whatYouSee:
          'The Ingenuity 3D model includes controls for inspecting components and stepping rotor rotation.',
        imageStatusNote:
          'NASA/JPL GLB model · On-screen rotor motion uses an illustrative speed for visibility.',
        bodyId: 'mars',
        targetKind: 'device',
        targetId: 'ingenuity_helicopter',
        suggestedView: 'inspect',
      },
    ],
  },
  {
    id: 'hadley-geology',
    bodyId: 'moon',
    title: 'Apollo-Era Lunar Geology Survey',
    headlineQuestion:
      'How do impact craters and Apollo rovers help reveal the Moon’s history?',
    summary:
      'Visit four stops, from dark basaltic maria to Tycho crater, the Apollo Lunar Module lander (NASA GLB), and an Apollo LRV 3D reconstruction.',
    defaultStopId: 'observe',
    featuredDeviceIds: ['apollo_lunar_module', 'apollo_lrv', 'apollo_surface_equipment'],
    featuredPoiIds: ['mare_tranquillitatis', 'tycho', 'south_pole_aitken'],
    stops: [
      {
        id: 'observe',
        missionId: 'hadley-geology',
        stepIndex: 1,
        title: 'View the Moon from Orbit',
        shortLabel: '1. Moon Overview',
        questionPrompt:
          'How do the dark basaltic maria differ from the bright, heavily cratered highlands?',
        summary:
          'View the illustrative synthesized Moon globe, showing the distribution of ancient lava basins and highlands.',
        whatYouSee:
          'An illustrative synthesized Moon globe at the center of the view, ready to guide you to Tycho crater.',
        imageStatusNote:
          'Displays a synthesized illustrative globe (LOLA/Diviner measurement maps are not integrated).',
        bodyId: 'moon',
        targetKind: 'body',
        targetId: 'moon',
        suggestedView: 'overview',
      },
      {
        id: 'tycho',
        missionId: 'hadley-geology',
        stepIndex: 2,
        title: 'Tycho Crater Terrain Mesh (Illustrative)',
        shortLabel: '2. Tycho Crater',
        questionPrompt:
          'What evidence of impact is shown by the crater-wall slope and surrounding area?',
        summary:
          'Locate the Tycho feature center (-43.30°, 348.78°E per IAU/USGS) and inspect the illustrative lunar 3D terrain mesh.',
        whatYouSee:
          'An illustrative lunar 3D terrain mesh in Inspect Model mode, which can be rotated to view its relief.',
        imageStatusNote:
          'Feature center from the IAU/USGS Gazetteer; the 3D terrain mesh is for illustrative visualization.',
        bodyId: 'moon',
        targetKind: 'poi',
        targetId: 'tycho',
        suggestedView: 'inspect',
        recommendedLayerMode: 'TERRAIN_MESH_3D',
      },
      {
        id: 'lrv',
        missionId: 'hadley-geology',
        stepIndex: 3,
        title: 'Apollo LRV (3D Reconstruction)',
        shortLabel: '3. Apollo LRV',
        questionPrompt:
          'How did this foldable vehicle extend Apollo astronauts’ geological survey range?',
        summary:
          'View a procedural 3D reconstruction representing Apollo 15–17 LRV vehicles in one-sixth Earth gravity.',
        whatYouSee:
          'An Apollo LRV 3D reconstruction with an option to switch to illustrative Explore Viewpoints mode.',
        imageStatusNote:
          'Illustrative 3D reconstruction (the original Apollo LRV GLB is not integrated).',
        bodyId: 'moon',
        targetKind: 'device',
        targetId: 'apollo_lrv',
        suggestedView: 'inspect',
      },
      {
        id: 'lunar_module',
        missionId: 'hadley-geology',
        stepIndex: 4,
        title: 'Apollo Lunar Module Lander (NASA GLB)',
        shortLabel: '4. Lunar Module Lander',
        questionPrompt:
          'How did the Lunar Module’s two-stage (Descent and Ascent Stage) design support landing on and launching from the Moon?',
        summary:
          'View the official NASA 3D Resources GLB (NASA / Michael D. Carbajal) in Inspect Model mode. It is for viewing only; the model is not rigged and its CAD scale is unverified.',
        whatYouSee:
          'The normalized Apollo Lunar Module 3D model shows the two separate stages, four landing legs, and ascent module.',
        imageStatusNote:
          'NASA Science 3D Resources GLB model · Static inspection only (no rig or real-scale collision).',
        bodyId: 'moon',
        targetKind: 'device',
        targetId: 'apollo_lunar_module',
        suggestedView: 'inspect',
      },
    ],
  },
];

export const MISSIONS_BY_ID: Record<string, MissionConfig> = Object.fromEntries(
  MISSION_LIST.map((mission) => [mission.id, mission]),
);

export function getMissionsForBody(bodyId: BodyId): MissionConfig[] {
  return MISSION_LIST.filter((mission) => mission.bodyId === bodyId);
}

export function getDefaultMissionForBody(bodyId: BodyId): MissionConfig {
  const found = getMissionsForBody(bodyId)[0];
  if (!found) {
    throw new Error(`No default mission configured for body: ${bodyId}`);
  }
  return found;
}

export function getMissionById(missionId: string | null | undefined): MissionConfig | null {
  if (!missionId) return null;
  return MISSIONS_BY_ID[missionId] ?? null;
}

export function getStopById(
  mission: MissionConfig,
  stopId: string | null | undefined,
): MissionStopConfig | null {
  if (!stopId) return null;
  return mission.stops.find((stop) => stop.id === stopId) ?? null;
}

export function validateMissions(missions: MissionConfig[] = MISSION_LIST): void {
  const missionIds = new Set<string>();
  const poiMap = new Map(ATLAS_POIS.map((poi) => [poi.id, poi]));
  const orbitalMap = new Map(ORBITAL_ACTORS_CATALOG.map((actor) => [actor.id, actor]));
  const deviceMap = new Map(DEVICE_CATALOG.map((device) => [device.id, device]));

  for (const mission of missions) {
    if (!/^[a-z][a-z0-9_-]*$/.test(mission.id) || missionIds.has(mission.id)) {
      throw new Error(`Invalid or duplicate mission ID: ${mission.id}`);
    }
    missionIds.add(mission.id);
    if (!BODY_CATALOG[mission.bodyId]) {
      throw new Error(`Mission references unknown body: ${mission.id} -> ${mission.bodyId}`);
    }
    if (mission.stops.length === 0) {
      throw new Error(`Mission must define at least one stop: ${mission.id}`);
    }
    const stopIds = new Set<string>();
    for (const stop of mission.stops) {
      if (!/^[a-z][a-z0-9_-]*$/.test(stop.id) || stopIds.has(stop.id)) {
        throw new Error(`Invalid or duplicate stop ID in ${mission.id}: ${stop.id}`);
      }
      stopIds.add(stop.id);
      if (stop.missionId !== mission.id || stop.bodyId !== mission.bodyId) {
        throw new Error(`Stop body/mission mismatch: ${mission.id}/${stop.id}`);
      }
      if (stop.targetKind === 'body') {
        if (stop.targetId !== mission.bodyId) {
          throw new Error(`Body stop must reference its mission body: ${mission.id}/${stop.id}`);
        }
      } else if (stop.targetKind === 'poi') {
        const poi = poiMap.get(stop.targetId);
        if (!poi || poi.bodyId !== mission.bodyId) {
          throw new Error(`Invalid POI target in stop ${mission.id}/${stop.id}: ${stop.targetId}`);
        }
      } else if (stop.targetKind === 'orbital') {
        const actor = orbitalMap.get(stop.targetId);
        if (!actor || actor.bodyId !== mission.bodyId) {
          throw new Error(`Invalid orbital target in stop ${mission.id}/${stop.id}: ${stop.targetId}`);
        }
      } else if (stop.targetKind === 'device') {
        const device = deviceMap.get(stop.targetId);
        if (!device || (device.bodyId !== mission.bodyId && device.bodyId !== 'reference')) {
          throw new Error(`Invalid device target in stop ${mission.id}/${stop.id}: ${stop.targetId}`);
        }
      }
    }
    if (!stopIds.has(mission.defaultStopId)) {
      throw new Error(`Missing default stop ${mission.defaultStopId} in mission ${mission.id}`);
    }
    for (const devId of mission.featuredDeviceIds) {
      const device = deviceMap.get(devId);
      if (!device || device.bodyId !== mission.bodyId) {
        throw new Error(`Featured device invalid for ${mission.id}: ${devId}`);
      }
    }
    for (const poiId of mission.featuredPoiIds) {
      const poi = poiMap.get(poiId);
      if (!poi || poi.bodyId !== mission.bodyId) {
        throw new Error(`Featured POI invalid for ${mission.id}: ${poiId}`);
      }
    }
  }
}
