# Sources and asset provenance

Reviewed 2026-11-14 (Asia/Bangkok). This is a scoped educational catalog, not a complete inventory of NASA exploration. No NASA endorsement is implied.

## Supplied material

- `DeCuong_Atlas_SaoHoa_MatTrang.pdf`, v1.0 dated 2026-11-13: shared Atlas architecture and first-release scope (pp. 2–7); optional optimization/operation appendices (pp. 8–12).
- `Thitb-Tiliunndng-Nidungclichothitkgcnhn (1).csv`: Mars rover references, preserved at `/assets/provenance/mars-rovers.csv`.
- `Thitb-Tiliunndng-Nidungclichothitkgcnhn.csv`: Ingenuity references, preserved at `/assets/provenance/ingenuity.csv`.
- `Thitb-Tiliunndng-Nidungclichothitkgcnhn (2).csv`: Apollo equipment references. No lunar GLBs supplied.
- `Mars-20261114T010556Z-1-001.zip`: five Mars surface GLBs imported without modifying their bytes. Original attribution preserved at `/assets/attribution/Mars-Attributions.txt`, including credit for excluded spacecraft.

## Mars facts and coordinates

- [NASA NSSDCA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), last updated 2025-05-19: volumetric mean radius 3389.5 km, sidereal rotation 24.6229 hours, mean gravity 3.73 m/s². Rotation is an illustrative elapsed-time animation, not a mission clock or ephemeris.
- [Jezero, feature 14300](https://planetarynames.wr.usgs.gov/Feature/14300): 18.41°, 77.69°E.
- [Gale, feature 2071](https://planetarynames.wr.usgs.gov/Feature/2071): -5.44°, 137.70°E.
- [Olympus Mons, feature 4453](https://planetarynames.wr.usgs.gov/Feature/4453): 18.40°, 226.00°E.
- [Valles Marineris, feature 6288](https://planetarynames.wr.usgs.gov/Feature/6288): -13.74°, 300.80°E.

POIs use the default planetocentric, east-positive coordinate table on each IAU/USGS feature page as reviewed. Alternate control networks/search tables can show different center coordinates; these are approximate feature centers, not landing coordinates. No elevation measurement is attached. The 18 km marker offset is solely a display offset. Scene axes: +Y north, +X longitude 0°, -Z longitude 90°E.

## Moon facts and coordinates

- [NASA NSSDCA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html), last updated 2024-01-11: mean radius 1737.4 km, sidereal rotation 655.720 hours, mean surface gravity 1.62 m/s², mean orbital velocity 1.022 km/s, diurnal equatorial temperature range 95–390 K, surface pressure 3×10⁻¹⁵ bar. The globe's rotation is an illustrative elapsed-time animation, not a mission clock or ephemeris.
- [Mare Tranquillitatis, feature 3691](https://planetarynames.wr.usgs.gov/Feature/3691): center 8.35°, 30.83°E; diameter 875.75 km.
- [Tycho, feature 6163](https://planetarynames.wr.usgs.gov/Feature/6163): center -43.30°, -11.22° (stored as 348.78°E); diameter 85.29 km.
- [NASA Science · The Moon's Largest Basin](https://science.nasa.gov/resource/the-moons-largest-basin/): the published orthographic view is centered 53°S, 191°E. The South Pole–Aitken basin boundary is not defined by the IAU Gazetteer, so this marker is a view center, not an IAU feature center and not a landing coordinate.

The two IAU feature pages give planetographic, east-positive coordinates in the -180°–180° range. The Moon is treated as near-spherical for display, so the catalog stores these centers as east-positive 0°–360° without a planetocentric conversion. These are approximate feature centers; no elevation measurement is attached.

## Apollo equipment records

`Thitb-Tiliunndng-Nidungclichothitkgcnhn (2).csv` is preserved byte-for-byte at `/assets/provenance/apollo-equipment.csv` with SHA-256 `792d700306da6348e989c5a1d6737f058be2b03e8fda255b7e0871095b6ce59a` (verified against the supplied file). The six Moon records in `src/config/deviceManifest.json` summarize the CSV rows for LRV systems/operations, the LRV deployment mechanism and chassis, the Apollo 15 and Apollo 17 LRVs, Apollo surface equipment (MET, EVA, sampling and navigation), and the Lunar Module MESA/attached equipment.

All six records are `unavailable`: no model path, bytes, SHA-256, license URL or attribution file is claimed. They preserve supplied notes as educational records only; their summaries are not a substitute for the cited NASA/Lunar and Planetary Institute documents.

## Model credits and terms

| Supplied model | Preserved credit | Terms / evidence |
| --- | --- | --- |
| Sojourner | Dan / danthemodeler; Ngee Ann Polytechnic (ZIP credit) | [Sketchfab source](https://sketchfab.com/3d-models/mars-sojourner-rover-model-8b3810e7cd804bd6b0009520c67984c6), [model API](https://api.sketchfab.com/v3/models/8b3810e7cd804bd6b0009520c67984c6), embedded `asset.extras.license`: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). API checked 2026-11-14: CC Attribution, author danthemodeler. |
| Spirit / Opportunity | NASA/JPL-Caltech | [Source page](https://science.nasa.gov/resource/spirit-and-opportunity-rover-3d-model/) and NASA media guidelines. One shared model represents the pair, not two different supplied GLBs. |
| Viking | NASA/Michael D. Carbajal (source page); NASA/JPL-Caltech (ZIP) | [Source page](https://science.nasa.gov/3d-resources/viking-lander/) and NASA media guidelines. |
| InSight | NASA/JPL-Caltech | [Source page](https://science.nasa.gov/resource/insight-lander-3d-model/) and NASA media guidelines. |
| Ingenuity | NASA/Brian E. Kumanchik (source page); NASA/JPL-Caltech (ZIP) | [Source page](https://science.nasa.gov/3d-resources/ingenuity-mars-helicopter/) and NASA media guidelines. |

[NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) include educational/informational 3D media use and require attribution; third-party material has separate terms. Preserve model credits and do not imply endorsement. Sojourner is separately licensed, not a NASA-authored model.

All models use a centered preview with longest dimension normalized to 2 scene units. Original file transforms/geometry/textures remain unchanged. The glTF meter convention does not verify real-world dimensions. Physical scale, mission-specific configuration, rigging, and mechanical operation are unverified. Unless explicitly controlled via the Ingenuity inspection MVP below, the renderer uses static poses.

## Ingenuity mechanism & camera reference basis (MVP)

Preserved project provenance at `/assets/provenance/ingenuity.csv` cites NASA technical sources (NASA Ingenuity Fact Sheet, NASA Rotor Geometry, NASA Landing Press Kit, and NASA Hover Modeling). The Ingenuity control specification (`src/config/deviceControlSpecs.ts`) distinguishes documented mission parameters from illustrative GLB inspection features:

- **Documented NASA facts**: `1.8 kg` Earth mass (`~0.68 kg` Mars weight), `0.49 m` fuselage/mast height, coaxial counter-rotating `1.21 m` carbon-fiber rotors operating at `~2,400 rpm` for up to `~90 s` flights, `13.6 × 19.5 × 16.3 cm` avionics enclosure housing 6 Li-ion cells recharged via the top solar array, `RTE 13 MP` color horizon-facing camera, `Navcam 0.5 MP` grayscale nadir navigation camera + laser altimeter, and `~13 cm` underside ground clearance across 4 carbon composite landing legs.
- **GLB-verified structure**: `ingenuity_helicopter.glb` contains 11 named nodes (`bus`, `cams`, `leg_01`–`leg_04`, `parts_01`, `parts_02`, `rotors_01`, `rotors_02`, `solar_panel`). Node transforms verify `rotors_01` and `rotors_02` align their local `[1, 0, 0]` axes along opposite world vertical directions (`+Y` and `-Y`).
- **Illustrative / omitted scope**: All four camera presets (`overview`, `coaxial_mast`, `rte_horizon`, `navcam_nadir`) and the `0.5 rev/s` slow counter-rotation demo mode operate purely in normalized 2-unit GLB scene coordinates for structural visibility and are explicitly labeled illustrative (`isIllustrativeView: true`), not calibrated CAD frames or aerodynamic hover physics. Collective/cyclic blade pitch, landing-leg folding, battery charge, IMU state, and thermal telemetry are omitted because the GLB lacks separate hinge/pitch pivots and no measured flight telemetry dataset is integrated.

## Initial scope notes (superseded where noted below)

In the initial catalog pass, no measured surface image, thermal layer, elevation raster, or terrain tileset was configured for either body, and only the five supplied Mars ZIP GLBs were active. Globe textures and lighting remain illustrative; no MOLA, THEMIS, LOLA, or Diviner instrument datasets are integrated in runtime layers. Historical notes below track additions made on 2026-11-14 and audited on 2026-11-15.

## Extended Mars/Moon Dossiers, Official NASA Surface Rovers & Orbital GLBs (2026-11-14)

- **12 verified manifest GLBs (`src/config/deviceManifest.json`) & 8K baked Mars/Moon terrain**:
  - `scripts/import-mars-assets.py` registers the 5 supplied surface assets (`sojourner_rover` under CC BY 4.0 by Dan / danthemodeler · Ngee Ann Polytechnic — not NASA CAD geometry; plus NASA/JPL-Caltech `spirit_and_opportunity_rover`, `viking_lander`, `insight_lander`, `ingenuity_helicopter`), 4 NASA spacecraft/flyby GLBs (`dawn_spacecraft` strictly scoped as February 2009 Mars flyby encounter context, plus `near_shoemaker`, `pioneer_10`, and `kepler_space_telescope` strictly isolated under `bodyId: "reference"` / `catalogScope: "reference_spacecraft"` outside Mars/Moon catalogs), `mro_orbiter` (`24884_MRO.glb`, `624,660` B, SHA-256 `69ee5dcdddfdbbd5ef7e144757926d6a89729b2ff265477659e82abeaacee621`), `curiosity_rover` (`24584_Curiosity_static.glb`, `11,860,016` B), and `perseverance_rover` (`25042_Perseverance.glb`, `11,687,880` B).
  - Surface terrain mesh & textures: `mars_terrain.glb` and downsampled baked Mars WebP maps (`mars_albedo_baked.webp`, `mars_normals.webp`, `mars_roughness.webp`) resized cleanly to WebGL power-of-two textures on load.
- **Official NASA Orbital GLBs (`src/scene/common/OrbitalGlbModel.tsx` + `src/config/celestialCatalog.ts`)**:
  - **Mars Orbit & Moons** (textures/meshes optimized via `@gltf-transform` WebP + mesh simplification to preserve silhouette and material fidelity at low GPU/CPU overhead; orbital shells expanded for non-overlapping visual legibility and orbital scales halved): `phobos` (`24878_Phobos_1_1000.glb`, `778,100` B, `a=13,200` km display orbit, `r=70`), `deimos` (`24879_Deimos_1_1000.glb`, `752,840` B, `a=26,000` km display orbit, `r=55`), `mro_orbiter` (`24884_MRO.glb`, `624,660` B, `a=6,200` km, `r=42`), `mars_odyssey` (`24885_Odyssey.glb`, `577,148` B, `a=7,000` km, `r=42`), `maven_orbiter` (`24882_Maven.glb`, `1,351,112` B, `a=8,800` km, `r=45`), `dawn_flyby` (`dawn_spacecraft.glb`, `927,020` B, `a=11,800` km, `r=48`), and `ares_station` (conceptual gateway rendering official NASA ISS GLB `International Space Station (ISS) (B).glb`, `198,728` B, `a=10,200` km, `r=38`, explicitly disclosed as a structural proxy for a non-historic gateway concept).
  - **Moon Orbit**: `lro_orbiter` (`Lunar Reconnaissance Orbiter (B).glb`, `128,472` B, `a=2,650` km display orbit, `r=38`) and `apollo_csm` (`Apollo Soyuz.glb`, `656,696` B, `a=3,050` km display orbit, `r=39`, explicitly disclosed as a Block II CSM + docking module structural reference).
  - All 6 Moon surface Apollo entries in `deviceManifest.json` remain strictly `status: "unavailable"` with zero `.glb` assets (`public/assets/provenance/apollo-equipment.csv`).
- **InSight 83-node & Perseverance 66-node control specs**: `src/config/deviceControlSpecs.ts` maps verified GLB nodes for `ingenuity_helicopter` (11 nodes), `insight_lander` (83 nodes), `perseverance_rover` (66 nodes), and `curiosity_rover` (`['MSL']`) with NASA Press Kit camera views and static node-group highlights.
- **Documented mission dossiers (`src/config/deviceDossiers.ts`)**: Compiled from NASA NSSDCA Fact Sheets, Pathfinder / MER / Viking / InSight / MSL Curiosity / Mars 2020 Perseverance / MRO / Odyssey / MAVEN / Dawn / LRO / Apollo 14–17 Press Kits and NASA NTRS Apollo LRV Handbooks (`public/assets/provenance/mars-rovers.csv`, `ingenuity.csv`, `apollo-equipment.csv`). Every dossier separates historical measured mission telemetry and scientific contributions from illustrative 3D views and conceptual/proxy GLB disclosures.


## Surface Physics Simulation, Terrain Streaming & Scale Provenance (M0–M5, 2026-11-15)

- **Shared `TerrainProvider` & Deterministically Seeded Micro-Relief (`src/scene/terrain/terrainDataPipeline.ts`, `public/assets/terrain/manifest.json`)**:
  - Regional coordinates reference published landing areas: **Mars Ares Vallis** (`19.13°N, 326.78°E`, Mars Pathfinder baseline, gravity `3.72076 m/s²`, radius `3,389.5 km`) and **Moon Hadley–Apennine** (`26.1322°N, 3.6339°E`, Apollo 15 baseline, gravity `1.625 m/s²`, radius `1,737.4 km`).
  - Selectable exploration windows (`2×2 km`, `16×16 km`, `64×64 km`) stream `256×256 m` base tiles (`96×96` quads, `2.67 m` grid spacing, downsampled to LOD1 `32` & LOD2 `16` with downward skirts) plus spherical curvature drop (`computeSphericalDropM`) and dynamic `1 km` floating-origin rebasing.
  - **Honest disclosure (`isBaselinePlusSyntheticRelief: true`)**: Fine topographic undulations, craters, Hadley-style sinuous rille, basalt step slabs, and boulder fields are generated via deterministic seeded procedural math (`BODY_SEED`), **not** high-resolution raw HiRISE/LROC DTM rasters.
- **Physical Vehicle Dimensions, Wheel Rigging & Stationary Modes (`src/config/deviceSimulationProfiles.ts`, `src/config/deviceManifest.json`)**:
  - Inspect model (`MODEL_CLOSEUP`, formerly Option 1) preserves normalized `fit-longest-side-2` studio framing without modifying source `.glb` bytes or `sha256` digests.
  - Explore viewpoints (`CONTROL_ROOM_POV`, formerly Option 2) scales loaded GLBs and pedestal-free procedural hardware using `simulationTransform` & `physicalTransform` metadata (`physicalScaleVerified: false` clearly disclosed in UI and catalog metadata where exact mission sub-assemblies or procedural Apollo reconstructions stand in for calibrated CAD).
  - Real motorized driving is enabled for rovers (`sojourner_rover`, `spirit_and_opportunity_rover`, `curiosity_rover`, `perseverance_rover` via non-destructive GLB wheel mesh partitioning; and procedural `apollo_lrv`, `apollo_lrv_deploy`, plus simulation-mode rovers under NASA equipment references). Static landers (`viking_lander`, `insight_lander`, `apollo_surface_pack`, `apollo_lm_mesa`) remain fixed by default and explicitly badge **`"Simulated mobility"`** when temporary educational roving is toggled on.
  - Coaxial helicopter flight (`ingenuity_helicopter`) enforces body-relative takeoff, hover drag, coaxial `rotors_01`/`rotors_02` animation, and solid Rapier terrain collision.
- **Decoupled Kepler Orbital Clock & Quality Tiering**:
  - `SimulationClock` (`computeOrbitalTimeStep`) drives orbital actors and planet spin smoothly in both `ORBITAL_OVERVIEW` and orbital `CONTROL_ROOM_POV` cupola view (`1×..5000×` time-warp & pause), completely isolated from the fixed-60 Hz (`FIXED_PHYSICS_DT = 1/60`) surface Rapier simulation step.
  - Adaptive quality tiers (`Auto / Low / Medium / High`) respect `prefers-reduced-motion`, clamp DPR (`0.75–1.5`), control shadow map resolution & Bloom/SMAA passes, and scale WebP surface map rasterization dynamically up to `8192 px` on `High` without altering asset provenance.

## Shader Loading, WebGL Containment & Status Vocabulary Audit (2026-11-15)

- **Single Raw-Text Shader Path (`?raw`)**: `vite.config.ts` excludes `.glsl` from `assetsInclude` and `vite-plugin-glsl`; all custom GLSL modules (`warpTunnel.frag.glsl`, `marsAtmosphere.vert.glsl`, `marsAtmosphere.frag.glsl`) import raw GLSL source strings via `?raw` without asset URL corruption in `dev` or `build`/`preview`.
- **WebGL & Postprocessing Containment (`src/core/canvas/rendererDiagnostics.ts`, `CanvasErrorBoundary.tsx`, `PostProcessingRig.tsx`)**: Pre-flight WebGL capability probing, `gl.debug.onShaderError` logging, `webglcontextlost`/`webglcontextrestored`/`webglcontextcreationerror` handling, React error boundaries around both R3F `<Canvas>` roots and `<EffectComposer>`, basic 3D fallback mode (bypassing postprocessing and shadows), and preloader/HUD text-first survival preserving body navigation, dossiers, and source links.
- **Catalog Relationship & Unified Status Vocabulary (`src/config/statusVocabulary.ts`, `bodyCatalog.ts`)**:
  - `RepresentationKind` (`source_model` | `procedural_reconstruction` | `record_only` | `illustrative_layer`), `EvidenceKind` (`measured` | `reported` | `derived` | `illustrative` | `unknown`), and `RuntimeLoadStatus` (`idle` | `loading` | `ready` | `error`) are strictly separated and enforced across `TopNavigationBar`, `CelestialQuickSelect`, `SubSceneInfoPanel`, and `CanvasFallbackPanel`.
  - Planet layer options load directly from `BODY_CATALOG[bodyId].layers` with non-instrument tags (`MOLA`, `THEMIS`, `LOLA`, `Diviner` listed exclusively under `unavailableDatasets`).
  - `pioneer_10`, `kepler_space_telescope`, and `near_shoemaker` are excluded from `mars` surface/body catalogs and isolated under `bodyId: "reference"` + `catalogScope: "reference_spacecraft"`; `dawn_spacecraft`/`dawn_flyby` is scoped strictly as Feb 2009 flyby encounter context; `ares_station` is badged as a conceptual ISS proxy.

## Guided Missions, Visitor-Facing Labels & URL State Navigation (P1, 2026-11-15)

- **Curated First-Minute Missions (`src/config/missions.ts`, `MissionEntry`, `JourneyPanel`)**:
  - Introduces default guided missions for Mars (`jezero-evidence`: 4 stops across globe overview, Jezero 3D terrain block, Perseverance, and Ingenuity) and Moon (`hadley-geology`: 3 stops across globe overview, Tycho 3D terrain block, and Apollo LRV reconstruction).
  - Full device catalogs, spectral layers, and orbital reference lines (`selectEffectiveOrbitsVisible`) remain tucked behind the explicit **"Explore freely"** switch in guided mode while preserving the user's saved free-mode `showOrbits` preference across switches.
- **Visitor-Facing Naming & Scoped Provenance**:
  - Replaces `"Option 1 / Option 2"` primary labels with **"Inspect model"** and **"Explore viewpoints"**, and moves technical format badges (`GLB`, `WebP`, `8K`) out of primary navigation into the right-hand contextual evidence/dossier panel.
- **Versioned URL & Browser History State (`src/config/urlStateAdapter.ts`, `src/core/navigation/useUrlHistorySync.ts`)**:
  - Supports shareable `?v=1&body=...&mission=...&stop=...` / `target=...` / `view=...` links with strict catalog & cross-body validation, falling back safely to a valid body overview with a dismissible notice banner (`urlNotice`) on unknown or mismatched parameters.
  - Only settled discrete navigation changes push browser history entries (`pushState`) and restore on Back/Forward (`popstate`); camera movement, simulation time ticks, floating-origin offsets, and live telemetry never mutate browser history.

## Moon GLB Addition, Asset Inventory & Mascot Pre-Check (2026-11-15)

- **Apollo Lunar Module (`apollo_lunar_module`, Section 11)**:
  - **Source**: [NASA Science 3D Resources — Apollo Lunar Module](https://science.nasa.gov/3d-resources/apollo-lunar-module/) (direct asset `Apollo Lunar Module.glb`, published `2025-03-20`, modified `2025-06-09`, checked `2026-11-15`).
  - **Credit & Terms**: `NASA / Michael D. Carbajal` under [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) (educational/informational attribution without NASA logo or endorsement implied).
  - **Preserved Source & Runtime Artifact**: `raw_assets/nasa-3d/Apollo Lunar Module.glb` and runtime copy `/assets/models/moons/apollo_lunar_module.glb` (`716,840` bytes, identical unmodified source & runtime SHA-256 `379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e`). Uses glTF `2.0` (`glTF-Transform v4.5.1`) with `KHR_draco_mesh_compression`, `EXT_texture_webp` (6 embedded textures: `BOOSTER3`, `TEXTUREA`, `TEXTURE_`), `KHR_materials_specular`, `64,787` vertices, `97,588` triangles, upright bounds `~6.43 × 5.01 × 6.43` units.
  - **Limitations**: Represents general two-stage Apollo Lunar Module structure rather than a mission-specific flight scan; no calibrated CAD rig or verified physical dimensions (`physicalScaleVerified: false`), configured strictly as view-only static hardware (`supportsRealMobility: false`, `supportsSimulatedSurfaceDrive: false`). Does **not** replace the six `apollo-equipment.csv` procedural/unavailable records (`apollo_lrv`, `apollo_lrv_deployment`, `apollo_15_lrv`, `apollo_17_lrv`, `apollo_surface_equipment`, `apollo_lm_equipment`).
- **Complete Asset Inventory & `dist/` Checksum Pipeline (Section 13)**:
  - `scripts/assetInventoryLib.mjs`, `scripts/validate-assets.mjs`, and `scripts/verify-dist-assets.mjs` (`npm run verify:dist`) distinguish **22 unique runtime catalog GLBs** (covering `13` selectable `deviceManifest.json` GLBs, `9` orbital actor GLBs in `celestialCatalog.ts` sharing `mro_orbiter.glb` and `dawn_spacecraft.glb`, plus `mars_terrain.glb` and `moon_terrain.glb`), **6 documented non-catalog GLBs** (`4` preload warmup stubs referenced by `CORE_MODEL_PATHS` in `useProgressiveAsset.ts`: `phobos_draco.glb`, `deimos_draco.glb`, `spacecraft/mars_reconnaissance_orbiter.glb`, `stations/ares_orbital_station_lod0.glb`; plus `2` legacy/LOD variants: `spacecraft/perseverance_rover.glb`, `stations/ares_orbital_station_lod1.glb`), and **6 unavailable Apollo CSV records**. Every build verifies byte counts and `SHA-256` hashes from `public/` to `dist/`.
- **RISE Plushie Mascot Audit & Section 12 C0–C3 Status (2026-11-15)**:
  - Audited and integrated owner-supplied external file `D:\rise_plushie.glb` into `public/assets/mascot/rise_plushie.glb` (`716,904` bytes, SHA-256 `aee69a76157e5b5fea6067dc91d9ae847bcf747686e2b4694db383946ff6d32f`, generator `Khronos glTF Blender I/O v3.6.27`, 1 node `empty_2`, 1 mesh `Mesh_0`, 35 opaque materials, 0 textures, 0 animations, `21,516` vertices, `29,177` triangles, uncentered local bounds `[-50.80, -48.00, -50.79]` to `[76.11, 54.46, 50.79]`) for the Section 12 C3 3D RISE chat launcher (`src/scene/mascot/RiseMascot.tsx`). Contains **no embedded author, copyright, or license metadata** (`asset.extras` absent); this model is inspired by NASA Artemis II's "Rise" zero-gravity indicator mascot and implies no NASA endorsement or agency insignia use—confirm third-party creator attribution and commercial redistribution terms before public commercial release.
  - **Server-Side Grounded Q&A (`/api/chat`, `api/chat.ts`, `src/chat/chatContract.ts`, `src/chat/knowledgeRetriever.ts`)**: Uses the official `groq-sdk` chat completions API with model **`openai/gpt-oss-20b`** and reads `GROQ_API_KEY` strictly server-side. Enforces same-origin checks, bounded JSON validation (`<= 16 KB` body, `<= 800` chars message), per-instance sliding-window rate limiting (`429`), XML delimiter prompt isolation, a bounded request timeout, and deterministic BM25 project knowledge gating (`src/config/chatKnowledgeIndex.json`) so out-of-scope or real-time queries return an honest boundary reply without hallucinating sources.
  - **Accessible Floating Chat Widget (`src/ui/chat/ProjectChatWidget.tsx`)**: Mounted globally across orbital, closeup, POV, and surface views with a neutral geometric launcher (`data-mascot-slot="neutral-placeholder"`), pointer-capture drag vs click separation, Arrow-key movement, `Escape` focus return, `Enter`/`Shift+Enter` IME-safe composition handling, `prefers-reduced-motion` support, and visible source/evidence-type citation chips. Keep `GROQ_API_KEY` in server environment variables only; never expose it with a `VITE_` prefix or commit it to source control.
