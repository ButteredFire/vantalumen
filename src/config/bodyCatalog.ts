import { Vector3 } from 'three';
import type { BodyConfig, BodyId, ScientificTelemetry } from '../types/cosmos.types';

export const UNKNOWN_TELEMETRY: ScientificTelemetry = {
  classification: 'No data available',
  meanTemperatureC: 'No data available',
  atmosphericPressurePa: 'No data available',
  surfaceGravityMs2: 'No data available',
  orbitalVelocityKms: 'No data available',
  geologicalAge: 'No data available',
  missionSummary: '',
  keyHighlights: [],
};

const marsSource = {
  title: 'NASA NSSDCA Mars Fact Sheet',
  url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  checked: '2026-11-14',
  version: '2025-05-19',
};

const moonSource = {
  title: 'NASA NSSDCA Moon Fact Sheet',
  url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
  checked: '2026-11-14',
  version: 'Last updated 2024-01-11',
};

export const BODY_CATALOG: Record<BodyId, BodyConfig> = {
  mars: {
    id: 'mars',
    name: 'Mars',
    radiusKm: 3389.5,
    rotationSeconds: 24.6229 * 3600,
    color: '#bc623d',
    textureStyle: 'illustrative-mars',
    source: marsSource,
    credit: 'NASA NSSDCA (planetary data) · Atlas procedural/baked visual globe',
    missionRelationship: 'planetary_body',
    missionRelationshipLabel: 'Primary celestial body · Mars',
    target: {
      id: 'mars',
      bodyId: 'mars',
      name: 'Mars',
      subtitle: 'Illustrative globe (no measured imagery or elevation data integrated)',
      category: 'PLANET',
      position: new Vector3(),
      radius: 3389.5,
      safeViewDistance: 10500,
      source: marsSource,
      credit: 'NASA NSSDCA · Atlas illustrative globe',
      missionRelationship: 'planetary_body',
      missionRelationshipLabel: 'Primary celestial body · Mars',
      representation: 'illustrative_layer',
      evidenceKind: 'illustrative',
      telemetry: {
        ...UNKNOWN_TELEMETRY,
        classification: 'Terrestrial planet',
        surfaceGravityMs2: '3.73 m/s² (mean · NSSDCA)',
        missionSummary:
          'Mean radius 3,389.5 km. The globe uses a prebuilt illustrative texture; it is not calibrated imagery or an original MOLA/THEMIS elevation raster.',
        keyHighlights: [
          'One scene unit = 1 km.',
          'Color, elevation, and temperature filters are illustrative layers.',
        ],
      },
    },
    layers: [
      {
        id: 'globe',
        mode: 'VISUAL_RGB',
        label: 'Illustrative surface color',
        tag: 'Illustrative · 3D texture',
        status: 'illustrative',
        representation: 'illustrative_layer',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Prebuilt colored surface for visual exploration; not calibrated orbital imagery.',
      },
      {
        id: 'elevation_filter',
        mode: 'MOLA_ELEVATION',
        label: 'Elevation color filter (illustrative)',
        tag: 'Simulated color filter · MOLA not integrated',
        status: 'illustrative',
        representation: 'illustrative_layer',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Synthesized color scale based on simulated elevation; original MOLA laser altimetry data is not integrated.',
      },
      {
        id: 'thermal_filter',
        mode: 'THERMAL_IR',
        label: 'Thermal color filter (illustrative)',
        tag: 'Simulated color filter · THEMIS not integrated',
        status: 'illustrative',
        representation: 'illustrative_layer',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Synthesized day/night thermal color filter; THEMIS infrared radiance data is not integrated.',
      },
      {
        id: 'terrain_mesh_3d',
        mode: 'TERRAIN_MESH_3D',
        label: 'Synthesized 3D terrain mesh',
        tag: 'Illustrative terrain',
        status: 'illustrative',
        representation: 'procedural_reconstruction',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Prebuilt 3D terrain mesh for close-up viewing; not a measured terrain map.',
      },
    ],
    unavailableDatasets: [
      {
        id: 'mars_measured_imagery',
        label: 'Calibrated orbital imagery (Viking / CTX / HiRISE)',
        instrumentReference: 'NASA PDS / MRO HiRISE',
        detail: 'Calibrated quantitative imagery is not integrated.',
      },
      {
        id: 'mars_mola_dem',
        label: 'Measured elevation data (MOLA DEM)',
        instrumentReference: 'MGS MOLA',
        detail: 'The original MOLA raster is not integrated; the 3D driving surface uses a reference baseline with synthesized detail.',
      },
      {
        id: 'mars_themis_ir',
        label: 'Infrared thermal data (THEMIS IR)',
        instrumentReference: 'Mars Odyssey THEMIS',
        detail: 'A quantitative surface-temperature layer is not integrated.',
      },
    ],
  },
  moon: {
    id: 'moon',
    name: 'Moon',
    radiusKm: 1737.4,
    rotationSeconds: 2360592, // 655.720 sidereal hours
    color: '#9b9a94',
    textureStyle: 'illustrative-moon',
    source: moonSource,
    credit: 'NASA NSSDCA (lunar data) · Atlas illustrative lunar surface map',
    missionRelationship: 'planetary_body',
    missionRelationshipLabel: 'Primary celestial body · Moon',
    target: {
      id: 'moon',
      bodyId: 'moon',
      name: 'Moon',
      subtitle: 'Illustrative globe (no LOLA/Diviner measurements integrated)',
      category: 'MOON',
      position: new Vector3(),
      radius: 1737.4,
      safeViewDistance: 5400,
      source: moonSource,
      credit: 'NASA NSSDCA · Atlas illustrative globe',
      missionRelationship: 'planetary_body',
      missionRelationshipLabel: 'Primary celestial body · Moon',
      representation: 'illustrative_layer',
      evidenceKind: 'illustrative',
      telemetry: {
        ...UNKNOWN_TELEMETRY,
        classification: 'Earth’s natural satellite',
        meanTemperatureC: '95–390 K at the equator (day/night); no single mean value',
        atmosphericPressurePa: '≈3×10⁻¹⁰ Pa (night; 3×10⁻¹⁵ bar)',
        surfaceGravityMs2: '1.62 m/s² (mean · NSSDCA)',
        orbitalVelocityKms: '1.022 km/s (orbit around Earth)',
        missionSummary:
          'Mean radius 1,737.4 km; rotation period 655.72 hours. The globe uses illustrative imagery; original LOLA elevation or Diviner thermal rasters are not integrated.',
        keyHighlights: [
          'One scene unit = 1 km.',
          'The Apollo Lunar Module lander uses an official NASA 3D Resources GLB (static inspection); the LRV and other surface equipment still use illustrative reconstructions / documentary records.',
          'Elevation and thermal filters are synthesized visual layers, not LOLA/Diviner measurements.',
        ],
      },
    },
    layers: [
      {
        id: 'globe',
        mode: 'VISUAL_RGB',
        label: 'Illustrative surface color',
        tag: 'Illustrative · 3D texture',
        status: 'illustrative',
        representation: 'illustrative_layer',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Illustrative surface imagery for the Moon globe; not a substitute for scientific measurement maps.',
      },
      {
        id: 'elevation_filter',
        mode: 'MOLA_ELEVATION',
        label: 'Elevation color filter (illustrative)',
        tag: 'Simulated color filter · LOLA not integrated',
        status: 'illustrative',
        representation: 'illustrative_layer',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Synthesized elevation colors for illustration; original LOLA laser altimetry data is not integrated.',
      },
      {
        id: 'thermal_filter',
        mode: 'THERMAL_IR',
        label: 'Thermal color filter (illustrative)',
        tag: 'Simulated color filter · Diviner not integrated',
        status: 'illustrative',
        representation: 'illustrative_layer',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Simulated thermal colors illustrate the Moon’s temperature range; original Diviner radiometer data is not integrated.',
      },
      {
        id: 'terrain_mesh_3d',
        mode: 'TERRAIN_MESH_3D',
        label: 'Synthesized 3D terrain mesh',
        tag: 'Illustrative terrain',
        status: 'illustrative',
        representation: 'procedural_reconstruction',
        evidenceKind: 'illustrative',
        datasetStatus: 'illustrative_active',
        detail:
          'Prebuilt 3D terrain mesh for close-up viewing; not a measured LOLA raster.',
      },
    ],
    unavailableDatasets: [
      {
        id: 'moon_lroc_imagery',
        label: 'Original LROC WAC/NAC mapping imagery',
        instrumentReference: 'NASA LRO LROC',
        detail: 'Calibrated high-resolution imagery is not integrated.',
      },
      {
        id: 'moon_lola_dem',
        label: 'LOLA DEM laser altimetry data',
        instrumentReference: 'NASA LRO LOLA',
        detail: 'A quantitative LOLA raster is not integrated.',
      },
      {
        id: 'moon_diviner_ir',
        label: 'Diviner infrared thermal data',
        instrumentReference: 'NASA LRO Diviner',
        detail: 'An orbital thermal measurement map is not integrated.',
      },
    ],
  },
};
