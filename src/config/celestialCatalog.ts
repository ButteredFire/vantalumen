import * as THREE from 'three';
import { BODY_CATALOG } from './bodyCatalog';
import type { BodyId, CelestialTarget, OrbitalElements, SourceReference } from '../types/cosmos.types';

export const MARS_MEAN_RADIUS_KM = 3389.5;
export const MARS_EQUATORIAL_RADIUS_KM = 3396.19;
export const MARS_POLAR_RADIUS_KM = 3376.2;
export const MARS_AXIAL_TILT_DEG = 25.19;
export const MARS_AXIAL_TILT_RAD = THREE.MathUtils.degToRad(MARS_AXIAL_TILT_DEG);
export const MARS_SIDEREAL_ROTATION_SECONDS = 88642.44;

export const MOON_MEAN_RADIUS_KM = 1737.4;
export const MOON_AXIAL_TILT_DEG = 6.68;
export const MOON_AXIAL_TILT_RAD = THREE.MathUtils.degToRad(MOON_AXIAL_TILT_DEG);

const _orbitalEuler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Computes the 3D orbital position around the active body center (1 scene unit = 1 km)
 * given Keplerian orbital elements and accumulated simulation time (in seconds).
 * Zero heap allocations per frame when outVector is provided.
 */
export function computeOrbitalPosition(
  elements: OrbitalElements,
  simulationTimeSeconds: number,
  outVector = new THREE.Vector3(),
): THREE.Vector3 {
  const periodSeconds = elements.orbitalPeriodHours * 3600;
  const meanMotion = (Math.PI * 2) / periodSeconds;
  const m0 = THREE.MathUtils.degToRad(elements.meanAnomalyAtEpochDeg);
  const M = m0 + meanMotion * simulationTimeSeconds;

  const e = elements.eccentricity;
  const E = M + e * Math.sin(M) + 0.5 * e * e * Math.sin(2 * M);

  const a = elements.semiMajorAxisKm;
  const xOrbital = a * (Math.cos(E) - e);
  const zOrbital = a * Math.sqrt(Math.max(0.01, 1 - e * e)) * Math.sin(E);

  const inc = THREE.MathUtils.degToRad(elements.inclinationDeg);
  const asc = THREE.MathUtils.degToRad(elements.ascendingNodeDeg);
  const arg = THREE.MathUtils.degToRad(elements.argumentOfPeriapsisDeg);

  outVector.set(xOrbital, 0, zOrbital);
  _orbitalEuler.set(inc, asc, arg, 'YXZ');
  outVector.applyEuler(_orbitalEuler);
  return outVector;
}

export const CELESTIAL_BODIES_CATALOG: CelestialTarget[] = Object.values(BODY_CATALOG).map(
  (body) => body.target,
);

function nasaSource(title: string, url: string, version: string): SourceReference {
  return {
    title,
    url,
    checked: '2026-11-14',
    version,
  };
}

/**
 * Natural moons & artificial orbital actors around Mars and the Moon.
 * Orbital visualization radii near low orbits are given minimum display clearance
 * while retaining documented NASA semi-major axes and altitudes inside telemetry text.
 */
export const ORBITAL_ACTORS_CATALOG: CelestialTarget[] = [
  {
    id: 'phobos',
    bodyId: 'mars',
    name: 'Phobos (Mars I)',
    subtitle: 'Largest and closest natural satellite of Mars',
    category: 'MOON',
    credit: 'NASA/JPL-Caltech (NASA 3D Resources 24878_Phobos_1_1000.glb)',
    missionRelationship: 'natural_moon',
    missionRelationshipLabel: 'Natural satellite · Mars orbit',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(13200, 220, 0),
    radius: 70, // Halved visual scale on orbit for clean separation (documented mean radius ~11.27 km)
    safeViewDistance: 240,
    modelPath: '/assets/models/moons/phobos.glb',
    orbitalElements: {
      semiMajorAxisKm: 13200, // Expanded display clearance outside orbiter shells (documented mean semi-major axis 9,376 km)
      eccentricity: 0.0151,
      inclinationDeg: 1.093,
      ascendingNodeDeg: 48.0,
      argumentOfPeriapsisDeg: 150.0,
      meanAnomalyAtEpochDeg: 15.0,
      orbitalPeriodHours: 7.6538,
    },
    source: nasaSource(
      'NASA Science · Phobos Facts & NASA 3D Resources GLB',
      'https://science.nasa.gov/resource/phobos-3d-model/',
      'NASA 3D Resources 24878_Phobos_1_1000.glb & documented Keplerian parameters; orbital track/size scaled for legibility',
    ),
    telemetry: {
      classification: 'Irregular natural satellite (carbon-rich C/D type)',
      meanTemperatureC: '-40 °C (day) to -112 °C (night)',
      atmosphericPressurePa: '0 Pa (vacuum)',
      surfaceGravityMs2: '0.0057 m/s² (~580 µg)',
      orbitalVelocityKms: '2.138 km/s',
      geologicalAge: '~4.3 billion years',
      missionSummary:
        'Orbits Mars at a true semi-major axis of 9,376 km (~5,980 km above the surface), faster than Mars rotates (orbital period 7.65 hours). Notable for the ~9 km-wide Stickney crater.',
      keyHighlights: [
        'Actual dimensions: ~27 × 22 × 18 km · True semi-major axis 9,376 km (the displayed 3D orbit is expanded to separate it from the orbiter fleet)',
        'Orbital period: 7 hours 39 minutes · Equatorial inclination: 1.093°',
        'Its close orbit subjects Phobos to tidal forces that gradually draw it toward Mars',
      ],
    },
  },
  {
    id: 'deimos',
    bodyId: 'mars',
    name: 'Deimos (Mars II)',
    subtitle: 'Outer natural satellite of Mars',
    category: 'MOON',
    credit: 'NASA/JPL-Caltech (NASA 3D Resources 24879_Deimos_1_1000.glb)',
    missionRelationship: 'natural_moon',
    missionRelationshipLabel: 'Natural satellite · Outer Mars orbit',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(-26000, 420, 0),
    radius: 55, // Halved visual scale on orbit for clean separation (documented mean radius ~6.2 km)
    safeViewDistance: 200,
    modelPath: '/assets/models/moons/deimos.glb',
    orbitalElements: {
      semiMajorAxisKm: 26000, // Expanded outer ring (documented 23,463.2 km)
      eccentricity: 0.00033,
      inclinationDeg: 1.788,
      ascendingNodeDeg: 316.0,
      argumentOfPeriapsisDeg: 290.0,
      meanAnomalyAtEpochDeg: 195.0,
      orbitalPeriodHours: 30.312,
    },
    source: nasaSource(
      'NASA Science · Deimos Facts & NASA 3D Resources GLB',
      'https://science.nasa.gov/resource/deimos-3d-model/',
      'NASA 3D Resources 24879_Deimos_1_1000.glb & documented Keplerian parameters; orbital track/size scaled for legibility',
    ),
    telemetry: {
      classification: 'Outer natural satellite (carbon-rich chondrite)',
      meanTemperatureC: '-40 °C (estimated mean)',
      atmosphericPressurePa: '0 Pa (vacuum)',
      surfaceGravityMs2: '0.003 m/s² (~300 µg)',
      orbitalVelocityKms: '1.351 km/s',
      geologicalAge: '~4.3 billion years',
      missionSummary:
        'The outer orbit has a 23,463.2 km semi-major axis and very low eccentricity (0.00033). Its surface is smoother than Phobos, with thick regolith around the large Swift and Voltaire craters.',
      keyHighlights: [
        'True semi-major axis: 23,463.2 km · Orbital period: 30.31 hours',
        'Actual dimensions: ~15 × 12 × 10 km (display size and radius are adjusted to avoid overlap)',
        'Nearly circular orbit around Mars’s equatorial plane',
      ],
    },
  },
  {
    id: 'mro_orbiter',
    bodyId: 'mars',
    name: 'Mars Reconnaissance Orbiter (MRO)',
    subtitle: 'HiRISE / CRISM remote-sensing orbiter · Active polar orbit',
    category: 'SPACECRAFT',
    credit: 'NASA/JPL-Caltech (official NASA 3D Resources 24884_MRO.glb)',
    missionRelationship: 'active_orbiter',
    missionRelationshipLabel: 'Active Mars orbiter (since 2006)',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(0, 6200, 0),
    radius: 42,
    safeViewDistance: 180,
    modelPath: '/assets/models/mars/mro_orbiter.glb',
    orbitalElements: {
      semiMajorAxisKm: 6200, // Expanded ~2,810 km visual clearance above surface (actual 255x320 km)
      eccentricity: 0.002,
      inclinationDeg: 92.6,
      ascendingNodeDeg: 24.0,
      argumentOfPeriapsisDeg: 90.0,
      meanAnomalyAtEpochDeg: 65.0,
      orbitalPeriodHours: 1.87,
    },
    source: nasaSource(
      'NASA Science · Mars Reconnaissance Orbiter (MRO)',
      'https://science.nasa.gov/resource/mars-reconnaissance-orbiter-3d-model/',
      'NASA 3D Resources 24884_MRO.glb & mission orbital parameters',
    ),
    telemetry: {
      classification: 'Remote-sensing orbiter and communications relay',
      meanTemperatureC: 'Active thermal control',
      atmosphericPressurePa: 'Low Mars polar orbit (~255 × 320 km)',
      surfaceGravityMs2: 'Free-fall orbit',
      orbitalVelocityKms: '~3.42 km/s',
      geologicalAge: 'Launched Aug 12, 2005 · Entered orbit Mar 10, 2006',
      missionSummary:
        'Equipped with the HiRISE telescope and CRISM spectrometer to map minerals and rover landing sites, and serve as the primary UHF relay.',
      keyHighlights: [
        'Actual orbit: 255 × 320 km, inclined 92.6° (the displayed 3D orbit is expanded for visibility)',
        'NASA 3D Resources GLB model (24884_MRO.glb) is shown in orbit and in Inspect Model mode',
        'Explore Viewpoints includes a downward-facing HiRISE remote-sensing view',
      ],
    },
  },
  {
    id: 'mars_odyssey',
    bodyId: 'mars',
    name: '2001 Mars Odyssey',
    subtitle: 'THEMIS infrared spectrometer orbiter · Active polar orbit',
    category: 'SPACECRAFT',
    credit: 'NASA/JPL-Caltech (NASA 3D Resources 24885_Odyssey.glb)',
    missionRelationship: 'active_orbiter',
    missionRelationshipLabel: 'Active Mars orbiter (since 2001)',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(-7000, 420, 0),
    radius: 42,
    safeViewDistance: 180,
    modelPath: '/assets/models/mars/mars_odyssey.glb',
    orbitalElements: {
      semiMajorAxisKm: 7000, // Expanded clearance above Mars (actual ~400 km altitude Sun-synchronous)
      eccentricity: 0.003,
      inclinationDeg: 93.1,
      ascendingNodeDeg: 112.0,
      argumentOfPeriapsisDeg: 180.0,
      meanAnomalyAtEpochDeg: 210.0,
      orbitalPeriodHours: 1.97,
    },
    source: nasaSource(
      'NASA Science · 2001 Mars Odyssey',
      'https://science.nasa.gov/resource/mars-odyssey-3d-model/',
      'NASA 3D Resources 24885_Odyssey.glb & Sun-synchronous polar profile',
    ),
    telemetry: {
      classification: 'Infrared thermal and hydrogen mapping orbiter',
      meanTemperatureC: 'Spacecraft thermal control',
      atmosphericPressurePa: 'Low orbit (~400 km above the surface)',
      surfaceGravityMs2: 'Free-fall orbit',
      orbitalVelocityKms: '~3.38 km/s',
      geologicalAge: 'Launched Apr 7, 2001 · Entered orbit Oct 24, 2001',
      missionSummary:
        'The longest-operating orbiter around Mars, carrying the THEMIS thermal imager and a gamma-ray spectrometer that detected signs of near-polar water ice.',
      keyHighlights: [
        'Sun-synchronous orbit inclined ~93.1°, with a period of nearly 2 hours',
        'NASA 3D Resources GLB model (24885_Odyssey.glb) is shown in orbit and in Inspect Model mode',
        'Explore Viewpoints supports thermal-sensor and global-grid views',
      ],
    },
  },
  {
    id: 'maven_orbiter',
    bodyId: 'mars',
    name: 'MAVEN Orbiter',
    subtitle: 'Upper-atmosphere and escape research · Active elliptical orbit',
    category: 'SPACECRAFT',
    credit: 'NASA/GSFC & JPL (NASA 3D Resources 24882_Maven.glb)',
    missionRelationship: 'active_orbiter',
    missionRelationshipLabel: 'Active Mars orbiter (since 2014)',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(0, 4600, 7400),
    radius: 45,
    safeViewDistance: 190,
    modelPath: '/assets/models/mars/maven_orbiter.glb',
    orbitalElements: {
      semiMajorAxisKm: 8800,
      eccentricity: 0.31, // Illustrative elliptical display geometry inspired by MAVEN's elliptical science orbit
      inclinationDeg: 75.0,
      ascendingNodeDeg: 205.0,
      argumentOfPeriapsisDeg: 35.0,
      meanAnomalyAtEpochDeg: 310.0,
      orbitalPeriodHours: 3.6,
    },
    source: nasaSource(
      'NASA Science · MAVEN',
      'https://science.nasa.gov/resource/maven-3d-model/',
      'NASA 3D Resources 24882_Maven.glb & elliptical upper-atmosphere survey orbit',
    ),
    telemetry: {
      classification: 'Ionosphere and solar-wind research orbiter',
      meanTemperatureC: 'Ionospheric environment',
      atmosphericPressurePa: 'Elliptical orbit ~150 × 4,500 km (reduced after 2019)',
      surfaceGravityMs2: 'Free-fall orbit',
      orbitalVelocityKms: 'Varies along the Keplerian ellipse',
      geologicalAge: 'Launched Nov 18, 2013 · Entered orbit Sep 21, 2014',
      missionSummary:
        'Studies how the solar wind strips Mars’s atmosphere into space and also relays communications for surface rovers.',
      keyHighlights: [
        'Elliptical orbit inclined ~75° (the displayed 3D orbit is expanded to separate it from Mars)',
        'NASA 3D Resources GLB model (24882_Maven.glb) is shown in orbit and in Inspect Model mode',
        'Explore Viewpoints includes an upper-atmosphere orbital view',
      ],
    },
  },
  {
    id: 'dawn_flyby',
    bodyId: 'mars',
    name: 'Dawn · 2009 Flyby Context',
    subtitle: 'Feb 17, 2009 gravity-assist flyby (not surface-deployed / not in a current orbit)',
    category: 'SPACECRAFT',
    credit: 'NASA/JPL-Caltech (official NASA 3D Resources dawn_spacecraft.glb)',
    missionRelationship: 'flyby_encounter',
    missionRelationshipLabel: 'Feb 17, 2009 flyby context · Departed Mars for Vesta and Ceres',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(9800, -2200, 5200),
    radius: 48,
    safeViewDistance: 200,
    modelPath: '/assets/models/mars/dawn_spacecraft.glb',
    orbitalElements: {
      semiMajorAxisKm: 11800,
      eccentricity: 0.14,
      inclinationDeg: 42.0,
      ascendingNodeDeg: 292.0,
      argumentOfPeriapsisDeg: 115.0,
      meanAnomalyAtEpochDeg: 120.0,
      orbitalPeriodHours: 5.4,
    },
    source: nasaSource(
      'NASA Science · Dawn Mission & Mars Gravity Assist (Feb 2009)',
      'https://science.nasa.gov/mission/dawn/',
      'Historical 2009 Mars gravity assist flyby reference & NASA 3D GLB',
    ),
    telemetry: {
      classification: 'Ion-propulsion spacecraft (illustrative path across Mars orbit)',
      meanTemperatureC: 'Interplanetary space',
      atmosphericPressurePa: 'Flyby at a minimum altitude of ~549 km (Feb 17, 2009)',
      surfaceGravityMs2: 'Historical flyby (illustrative loop around Mars)',
      orbitalVelocityKms: 'Accelerated by Mars’s gravitational field',
      geologicalAge: 'Mars flyby: Feb 17, 2009',
      missionSummary:
        'Dawn performed only one gravity-assist Mars flyby (Feb 17, 2009, at an altitude of ~549 km), redirecting its trajectory toward asteroids Vesta and Ceres. It is not in a current Mars orbit and did not land on the surface.',
      keyHighlights: [
        'Historical context: flew past Mars only on Feb 17, 2009 (~549 km); it does not actually orbit Mars continuously',
        'The NASA GLB model (dawn_spacecraft.glb) is shown along an illustrative path for the 2009 flyby',
        'Linked to the Dawn reference record; not listed as Mars surface equipment',
      ],
    },
  },
  {
    id: 'ares_station',
    bodyId: 'mars',
    name: 'Ares Orbital Station (Concept · ISS Proxy)',
    subtitle: 'Hypothetical Mars orbital relay station (not a historically launched spacecraft)',
    category: 'SPACECRAFT',
    credit: 'Mars Orbital Atlas concept · Structural proxy based on the ISS (see dossier for GLB details)',
    missionRelationship: 'conceptual_proxy',
    missionRelationshipLabel: 'Illustrative concept · ISS structural proxy',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(6200, 1800, -7800),
    radius: 38,
    safeViewDistance: 170,
    modelPath: '/assets/models/stations/ares_orbital_station.glb',
    orbitalElements: {
      semiMajorAxisKm: 10200,
      eccentricity: 0.001,
      inclinationDeg: 28.5,
      ascendingNodeDeg: 140.0,
      argumentOfPeriapsisDeg: 45.0,
      meanAnomalyAtEpochDeg: 55.0,
      orbitalPeriodHours: 3.12,
    },
    source: nasaSource(
      'Mars Orbital Atlas · Illustrative Gateway (NASA ISS Structural Proxy GLB)',
      'https://science.nasa.gov/resource/international-space-station-3d-model/',
      'Conceptual Mars orbital gateway rendering official NASA 3D Resources ISS GLB; non-historic mission',
    ),
    telemetry: {
      classification: 'Illustrative concept module (not a historically launched spacecraft)',
      meanTemperatureC: '+21 °C (simulated pressurized cabin)',
      atmosphericPressurePa: 'Medium orbit ~6,810 km above the surface (illustrative)',
      surfaceGravityMs2: 'Orbital microgravity (illustrative)',
      orbitalVelocityKms: '~2,89 km/s',
      geologicalAge: 'Orbital infrastructure concept in the atlas',
      missionSummary:
        'The conceptual orbital station serves as a Mars overview point and elevated control-room (Cupola POV) for the exploration fleet; it uses NASA’s ISS modular truss model as a structural reference.',
      keyHighlights: [
        'Explicitly identified as an illustrative concept using the official International Space Station (ISS) GLB as a structural reference, not a real Mars mission',
        'The displayed medium orbit (~10,200 km) provides a broad view, separated from the Martian atmosphere',
        'Supports Inspect Model and Explore Viewpoints (illustrative Cupola view)',
      ],
    },
  },
  {
    id: 'lro_orbiter',
    bodyId: 'moon',
    name: 'Lunar Reconnaissance Orbiter (LRO)',
    subtitle: 'LROC and LOLA mapping orbiter · Active lunar polar orbit',
    category: 'SPACECRAFT',
    credit: 'NASA/GSFC (NASA 3D Resources Lunar Reconnaissance Orbiter GLB)',
    missionRelationship: 'active_orbiter',
    missionRelationshipLabel: 'Active lunar orbiter (since 2009)',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(0, 2650, 0),
    radius: 38,
    safeViewDistance: 165,
    modelPath: '/assets/models/moons/lro_orbiter.glb',
    orbitalElements: {
      semiMajorAxisKm: 2650, // Expanded display clearance above 1737.4 km radius (actual ~50-200 km altitude)
      eccentricity: 0.004,
      inclinationDeg: 89.2,
      ascendingNodeDeg: 35.0,
      argumentOfPeriapsisDeg: 90.0,
      meanAnomalyAtEpochDeg: 35.0,
      orbitalPeriodHours: 1.88,
    },
    source: nasaSource(
      'NASA Science · Lunar Reconnaissance Orbiter (LRO)',
      'https://science.nasa.gov/resource/lunar-reconnaissance-orbiter-3d-model/',
      'NASA 3D Resources LRO GLB & polar mapping orbital parameters',
    ),
    telemetry: {
      classification: 'LOLA elevation-mapping and LROC imaging orbiter',
      meanTemperatureC: 'Active thermal control',
      atmosphericPressurePa: 'Lunar polar orbit (~50–200 km above the surface)',
      surfaceGravityMs2: 'Free-fall orbit',
      orbitalVelocityKms: '~1,68 km/s',
      geologicalAge: 'Launched Jun 18, 2009 · Entered orbit Jun 23, 2009',
      missionSummary:
        'Maps lunar terrain using the LOLA laser altimeter and high-resolution LROC cameras, observing permanently shadowed polar regions and Apollo landing sites.',
      keyHighlights: [
        'Near-polar orbit (~90°) passes over the lunar south pole every ~113 minutes',
        'NASA 3D Resources GLB model (Lunar Reconnaissance Orbiter) is shown directly in lunar polar orbit',
        'Supports Inspect Model or Explore Viewpoints (LROC nadir view)',
      ],
    },
  },
  {
    id: 'apollo_csm',
    bodyId: 'moon',
    name: 'Apollo Command/Service Module (CSM · ASTP Reference)',
    subtitle: 'Lunar-orbit command module (1968–1972) · Apollo-Soyuz GLB reference',
    category: 'SPACECRAFT',
    credit: 'NASA NTRS & NASA 3D Resources (Apollo-Soyuz Block II CSM GLB reference)',
    missionRelationship: 'historical_orbiter',
    missionRelationshipLabel: 'Historical orbiter (1968–1972 · Apollo-Soyuz reference model)',
    representation: 'source_model',
    evidenceKind: 'illustrative',
    position: new THREE.Vector3(-3050, 140, 0),
    radius: 39,
    safeViewDistance: 170,
    modelPath: '/assets/models/moons/apollo_csm.glb',
    orbitalElements: {
      semiMajorAxisKm: 3050, // Expanded display clearance above 1737.4 km radius (actual ~110 km altitude)
      eccentricity: 0.002,
      inclinationDeg: 18.0,
      ascendingNodeDeg: 155.0,
      argumentOfPeriapsisDeg: 25.0,
      meanAnomalyAtEpochDeg: 145.0,
      orbitalPeriodHours: 2.0,
    },
    source: nasaSource(
      'NASA NTRS & 3D Resources · Apollo Block II CSM / ASTP GLB',
      'https://science.nasa.gov/resource/apollo-soyuz-3d-model/',
      'Historic Apollo lunar orbit ~60 nmi circular benchmark + official NASA Apollo-Soyuz orbital CSM GLB reference',
    ),
    telemetry: {
      classification: 'Historical command spacecraft (Apollo CSM GLB reference)',
      meanTemperatureC: 'Pressurized crew cabin',
      atmosphericPressurePa: 'Near-lunar orbit ~110 km (60 nautical miles)',
      surfaceGravityMs2: 'Free-fall orbit',
      orbitalVelocityKms: '~1,63 km/s',
      geologicalAge: 'Apollo Program (1968–1972)',
      missionSummary:
        'Remained in lunar orbit while the LM descended to the surface; performed orbital rendezvous and docking after the LRV survey was complete.',
      keyHighlights: [
        'Orbital period ~2 hours around the Moon at a nominal altitude of ~110 km',
        'Official NASA GLB model (Apollo Soyuz.glb, Block II CSM orbital assembly) is displayed; Apollo surface equipment remains separate and has no GLBs',
        'Open Inspect Model to rotate the CSM 3D model or Explore Viewpoints',
      ],
    },
  },
];

export const LINKED_ORBITAL_DEVICE_IDS: Record<string, string> = {
  mro_orbiter: 'mro_orbiter',
  dawn_flyby: 'dawn_spacecraft',
};

export function getOrbitalActorsForBody(bodyId: BodyId): CelestialTarget[] {
  return ORBITAL_ACTORS_CATALOG.filter((actor) => actor.bodyId === bodyId);
}
