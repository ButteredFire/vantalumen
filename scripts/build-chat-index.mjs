import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ATLAS_POIS } from '../src/config/atlasPOIs';
import { BODY_CATALOG } from '../src/config/bodyCatalog';
import { ORBITAL_ACTORS_CATALOG } from '../src/config/celestialCatalog';
import { DEVICE_CATALOG } from '../src/config/deviceCatalog';
import { DEVICE_CONTROL_SPECS } from '../src/config/deviceControlSpecs';
import { DEVICE_DOSSIERS } from '../src/config/deviceDossiers';
import { DEVICE_SIMULATION_PROFILES } from '../src/config/deviceSimulationProfiles';
import { MISSION_LIST } from '../src/config/missions';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'src', 'config', 'chatKnowledgeIndex.json');

const DOC_SOURCES = [
  { relPath: 'README.md', sourceKind: 'documentation', language: 'en', evidenceType: 'mixed' },
  {
    relPath: 'docs/VANTALUMEN_INTRODUCTION.md',
    sourceKind: 'documentation',
    language: 'en',
    evidenceType: 'mixed',
  },
  { relPath: 'docs/SOURCES.md', sourceKind: 'provenance', language: 'mixed', evidenceType: 'source_verified' },
  {
    relPath: 'docs/EXPERIENCE_IMPLEMENTATION_PLAN.md',
    sourceKind: 'documentation',
    language: 'en',
    evidenceType: 'mixed',
  },
];

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function splitLongText(text, maxChars = 1350) {
  const cleaned = text.trim();
  if (cleaned.length <= maxChars) return [cleaned];
  const paragraphs = cleaned.split(/\n{2,}/);
  const parts = [];
  let buf = '';
  for (const para of paragraphs) {
    if (buf && buf.length + para.length + 2 > maxChars) {
      parts.push(buf.trim());
      buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;>]+$/, '')))];
}

function splitMarkdownSections(relPath, markdown, meta) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let currentHeading = path.basename(relPath);
  let currentLines = [];

  for (const line of lines) {
    const hMatch = line.match(/^##\s+(.+)$/);
    if (hMatch) {
      if (currentLines.join('\n').trim()) {
        sections.push({ heading: currentHeading, body: currentLines.join('\n').trim() });
      }
      currentHeading = hMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.join('\n').trim()) {
    sections.push({ heading: currentHeading, body: currentLines.join('\n').trim() });
  }

  const chunks = [];
  const docSlug = slugify(relPath);
  sections.forEach((sec, secIdx) => {
    const pieces = splitLongText(sec.body);
    pieces.forEach((piece, partIdx) => {
      const urls = extractUrls(piece);
      chunks.push({
        id: `doc_${docSlug}_${secIdx + 1}_${partIdx + 1}_${slugify(sec.heading)}`,
        title: `${path.basename(relPath)} — ${sec.heading}${pieces.length > 1 ? ` (${partIdx + 1}/${pieces.length})` : ''}`,
        sourcePath: `${relPath}#${sec.heading}`,
        section: sec.heading,
        sourceKind: meta.sourceKind,
        language: meta.language,
        evidenceType: meta.evidenceType,
        sourceUrls: urls,
        text: piece,
      });
    });
  });
  return chunks;
}

const chunks = [];
const sourceHashes = [];

for (const docSpec of DOC_SOURCES) {
  const abs = path.join(ROOT_DIR, docSpec.relPath);
  const raw = await fs.readFile(abs, 'utf8');
  sourceHashes.push(`${docSpec.relPath}:${createHash('sha256').update(raw).digest('hex')}`);
  chunks.push(...splitMarkdownSections(docSpec.relPath, raw, docSpec));
}

// Body configs & illustrative/unavailable dataset policies
for (const body of Object.values(BODY_CATALOG)) {
  const unavailableSummary = body.unavailableDatasets
    .map((d) => `${d.label} (${d.statusLabel}): ${d.detail}`)
    .join('; ');
  const layerSummary = body.layers.map((l) => `${l.label} [${l.tag}] — ${l.detail}`).join('; ');
  const text = [
    `Body ID: ${body.id} · ${body.name} (${body.englishName})`,
    `Radius: ${body.radiusKm} km · Rotation period: ${body.rotationSeconds} s (${(body.rotationSeconds / 3600).toFixed(2)} h)`,
    `Summary: ${body.summary}`,
    `Credit: ${body.credit} · Source: ${body.source.title} (${body.source.url}, checked ${body.source.checked})`,
    `Classification: ${body.target.telemetry.classification}`,
    `Surface gravity: ${body.target.telemetry.surfaceGravityMs2} · Temp: ${body.target.telemetry.meanTemperatureC} · Pressure: ${body.target.telemetry.atmosphericPressurePa}`,
    `Highlights: ${body.target.telemetry.keyHighlights.join(' | ')}`,
    `Visual layers: ${layerSummary}`,
    `Unintegrated measured datasets (unavailable): ${unavailableSummary}`,
  ].join('\n');

  chunks.push({
    id: `body_${body.id}`,
    title: `${body.name} (${body.englishName})`,
    sourcePath: `src/config/bodyCatalog.ts#${body.id}`,
    section: `BODY_CATALOG.${body.id}`,
    sourceKind: 'catalog',
    language: 'mixed',
    evidenceType: 'mixed',
    sourceUrls: [body.source.url],
    text,
  });
}

// Surface POIs
for (const poi of ATLAS_POIS) {
  const coords = poi.coordinates
    ? `${poi.coordinates.lat.toFixed(4)}° lat, ${poi.coordinates.lon.toFixed(4)}°E`
    : 'N/A';
  const urls = poi.source?.url ? [poi.source.url] : [];
  const text = [
    `POI: ${poi.name} (id: ${poi.id}, body: ${poi.bodyId})`,
    `Subtitle: ${poi.subtitle}`,
    `Coordinates: ${coords} (approximate reference center; no measured elevation attached)`,
    `Relationship: ${poi.missionRelationshipLabel ?? poi.missionRelationship ?? 'surface_feature'}`,
    `Credit: ${poi.credit ?? 'IAU/USGS'} · Source: ${poi.source?.title ?? ''} (${poi.source?.url ?? ''})`,
    `Summary: ${poi.telemetry.missionSummary}`,
    `Highlights: ${poi.telemetry.keyHighlights.join(' | ')}`,
  ].join('\n');

  chunks.push({
    id: `poi_${poi.id}`,
    title: `${poi.name} (${poi.bodyId})`,
    sourcePath: `src/config/atlasPOIs.ts#${poi.id}`,
    section: `ATLAS_POIS.${poi.id}`,
    sourceKind: 'catalog',
    language: 'mixed',
    evidenceType: 'source_verified',
    sourceUrls: urls,
    text,
  });
}

// Devices (Manifest + Dossier + Simulation profile + Control spec)
for (const device of DEVICE_CATALOG) {
  const dossier = DEVICE_DOSSIERS[device.id];
  const sim = DEVICE_SIMULATION_PROFILES[device.id];
  const control = DEVICE_CONTROL_SPECS[device.id];

  const lines = [
    `Device ID: ${device.id} · ${device.name} (${device.kind})`,
    `Body: ${device.bodyId} · Catalog Scope: ${device.catalogScope ?? 'body_surface'} · Status: ${device.status}`,
    `Relationship: ${device.missionRelationshipLabel ?? device.missionRelationship ?? 'surface_deployed'}`,
    `Summary: ${device.summary}`,
    `Source: ${device.source.title} (${device.source.url}, checked ${device.source.checked}, version ${device.source.version})`,
    `Credit: ${device.credit} · License: ${device.license.label}${device.license.url ? ` (${device.license.url})` : ''}`,
    `Units/Transform: ${device.units} · physicalScaleVerified=${String(device.transform.physicalScaleVerified)}`,
  ];

  if (device.modelPath) {
    lines.push(
      `Verified GLB Model: ${device.modelPath} · bytes=${device.bytes} · sha256=${device.sha256}`,
    );
  } else {
    lines.push(
      `Procedural / No-GLB status: unavailable GLB, proceduralModel=${device.proceduralModel ?? 'none'} (illustrative reconstruction only)`,
    );
  }
  if (device.coordinates) {
    lines.push(`Reference coordinates: lat ${device.coordinates.lat}, lon ${device.coordinates.lon}`);
  }
  if (dossier) {
    lines.push(`Agency/Program: ${dossier.agencyAndProgram} · Era: ${dossier.era}`);
    lines.push(`Biography: ${dossier.biography}`);
    lines.push(
      `Technical Specs: ${dossier.technicalSpecs.map((s) => `${s.label}: ${s.value}`).join('; ')}`,
    );
    lines.push(
      `Measured Mission Data: ${dossier.measuredData.map((s) => `${s.label}: ${s.value}`).join('; ')}`,
    );
    lines.push(`Scientific Contributions: ${dossier.contributions.join(' | ')}`);
    lines.push(`Model Disclaimer: ${dossier.modelDisclaimer}`);
  }
  if (sim) {
    lines.push(
      `Simulation Profile: mobilityKind=${sim.mobilityKind}, maxSpeedMs=${sim.maxSpeedMs}, supportsRealMobility=${sim.capabilities.supportsRealMobility}, supportsSimulatedSurfaceDrive=${sim.capabilities.supportsSimulatedSurfaceDrive}, supportsFlight=${sim.capabilities.supportsFlight}, targetLongestSideM=${sim.physicalTransform.targetLongestSideM}, physicalScaleVerified=${sim.physicalTransform.physicalScaleVerified}`,
    );
    lines.push(`Simulation Note: ${sim.documentedSpeedNote} · ${sim.provenanceLabel}`);
  }
  if (control) {
    lines.push(
      `Interactive Control Spec: ${control.partGroups.map((g) => `${g.label} [${g.nodeNames.length} nodes]: ${g.documentedSpec}`).join(' | ')}`,
    );
    lines.push(
      `Camera Presets: ${control.cameraViews.map((v) => `${v.label} (illustrative=${v.isIllustrativeView})`).join(', ')}`,
    );
  }

  const urls = [device.source.url, device.license.url].filter(Boolean);
  chunks.push({
    id: `device_${device.id}`,
    title: `${device.name} (${device.bodyId})`,
    sourcePath: `src/config/deviceManifest.json#${device.id}`,
    section: device.id,
    sourceKind: 'dossier',
    language: 'mixed',
    evidenceType: device.status === 'available' ? 'mixed' : 'illustrative_or_simulated',
    sourceUrls: [...new Set(urls)],
    text: lines.join('\n'),
  });
}

// Orbital Actors
for (const actor of ORBITAL_ACTORS_CATALOG) {
  const dossier = DEVICE_DOSSIERS[actor.id];
  const sim = DEVICE_SIMULATION_PROFILES[actor.id];
  const lines = [
    `Orbital Actor ID: ${actor.id} · ${actor.name} (${actor.subtitle})`,
    `Body: ${actor.bodyId} · Category: ${actor.category} · Relationship: ${actor.missionRelationshipLabel ?? actor.missionRelationship}`,
    `GLB Model: ${actor.modelPath ?? 'none'} · Credit: ${actor.credit ?? ''}`,
    `Source: ${actor.source?.title ?? ''} (${actor.source?.url ?? ''})`,
    `Summary: ${actor.telemetry.missionSummary}`,
    `Highlights: ${actor.telemetry.keyHighlights.join(' | ')}`,
  ];
  if (actor.orbitalElements) {
    lines.push(
      `Display Kepler Elements: a=${actor.orbitalElements.semiMajorAxisKm} km, e=${actor.orbitalElements.eccentricity}, i=${actor.orbitalElements.inclinationDeg} deg, period=${actor.orbitalElements.orbitalPeriodHours} h`,
    );
  }
  if (dossier) {
    lines.push(`Dossier Disclaimer: ${dossier.modelDisclaimer}`);
  }
  if (sim) {
    lines.push(`Simulation Note: ${sim.provenanceLabel}`);
  }

  chunks.push({
    id: `orbital_${actor.id}`,
    title: `${actor.name} (${actor.bodyId})`,
    sourcePath: `src/config/celestialCatalog.ts#${actor.id}`,
    section: actor.id,
    sourceKind: 'catalog',
    language: 'mixed',
    evidenceType: actor.missionRelationship === 'conceptual_proxy' ? 'illustrative_or_simulated' : 'mixed',
    sourceUrls: actor.source?.url ? [actor.source.url] : [],
    text: lines.join('\n'),
  });
}

// Missions & stops
for (const mission of MISSION_LIST) {
  const stopLines = mission.stops.map(
    (s) =>
      `Stop ${s.stepIndex} (${s.id}): ${s.title} — ${s.questionPrompt} | What you see: ${s.whatYouSee} | Status note: ${s.imageStatusNote}`,
  );
  chunks.push({
    id: `mission_${mission.id}`,
    title: `${mission.title} (${mission.bodyId})`,
    sourcePath: `src/config/missions.ts#${mission.id}`,
    section: mission.id,
    sourceKind: 'mission',
    language: 'en',
    evidenceType: 'mixed',
    sourceUrls: [],
    text: [
      `Mission ID: ${mission.id} · Body: ${mission.bodyId} · Title: ${mission.title}`,
      `Headline question: ${mission.headlineQuestion}`,
      `Summary: ${mission.summary}`,
      `Featured devices: ${mission.featuredDeviceIds.join(', ')} · Featured POIs: ${mission.featuredPoiIds.join(', ')}`,
      ...stopLines,
    ].join('\n'),
  });
}

// App usage, simulation controls, and URL deep-link guide
chunks.push({
  id: 'guide_navigation_and_controls',
  title: 'VantaLumen guide: views and simulation shortcuts',
  sourcePath: 'src/config/urlStateAdapter.ts#navigation-guide',
  section: 'Application Controls & Modes',
  sourceKind: 'simulation',
  language: 'en',
  evidenceType: 'illustrative_or_simulated',
  sourceUrls: [],
  text: [
    'VantaLumen supports two exploration modes: "Guided journey" (the default, following Jezero/Hadley mission stops and temporarily hiding reference orbital paths) and "Explore freely" (showing the full catalog of equipment, features, orbits, and visual layers).',
    'Two detailed view modes are available: "Inspect model" (MODEL_CLOSEUP — rotate a model normalized to a 2-unit longest side) and "Explore viewpoints" (CONTROL_ROOM_POV — control-room or field perspective on 3D terrain or in orbit).',
    'Explore Viewpoints shortcuts: use WASD or the arrow keys to drive a rover or fly the Ingenuity helicopter (Q/Space to increase throttle or ascend, E/Shift to descend with the helicopter), C to switch between First Person (Mastcam/Eye) and Chase views, and R to restore the equipment pose.',
    'Terrain simulation offers three area sizes (2×2 km, 16×16 km, 64×64 km) and four graphics quality levels (Auto, Low, Medium, High). Terrain and surface textures are illustrative simulations generated from mathematical seeds and reference coordinates for Ares Vallis and Hadley–Apennine; they are not measured HiRISE/LROC DEM maps.',
    'Shareable URLs use the format ?v=1&body=mars|moon&mission=...&stop=... or &mode=free&target=...&view=overview|inspect|viewpoints. The system cross-checks body/mission/target to prevent mismatches.',
  ].join('\n'),
});

// Track config source hashes for deterministic versioning
for (const rel of [
  'src/config/deviceManifest.json',
  'src/config/bodyCatalog.ts',
  'src/config/celestialCatalog.ts',
  'src/config/missions.ts',
]) {
  const raw = await fs.readFile(path.join(ROOT_DIR, rel), 'utf8');
  sourceHashes.push(`${rel}:${createHash('sha256').update(raw).digest('hex')}`);
}

const contentHash = createHash('sha256').update(sourceHashes.join('\n')).digest('hex');

const indexPayload = {
  version: '1.0.0',
  contentHash,
  chunkCount: chunks.length,
  chunks,
};

await fs.writeFile(OUTPUT_PATH, JSON.stringify(indexPayload, null, 2) + '\n', 'utf8');
console.log(
  `Built chatKnowledgeIndex.json: ${chunks.length} chunks, contentHash=${contentHash.slice(0, 12)}...`,
);
