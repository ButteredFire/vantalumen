## Implementation plan: destination animation and 3D terrain UI/UX

I read `the supplied ZIP`, including its project specification, destination catalogs, surface scene, camera, and asset-loading code. I did not modify the archive or repository.

### What the ZIP contains today

- The specification calls for story-led discovery, equipment inspection, first-person exploration, and environmental degradation simulations.
- Mars has **five natural-landmark POIs** and **eight surface entries** when rover/lander sites are included. Those lists should become one destination catalog so the globe, terrain, and panels use the same locations.
- Surface terrain is currently a **single ~46.7 MB GLB**. `MarsTerrainMesh` preloads the whole file; despite the “streaming” label, it is not destination-by-destination terrain streaming.
- Selecting a surface POI enters the surface scene directly. The surface view has a separate canvas and an 800 ms crossfade; the orbital spline camera does not currently perform a continuous landing transition for that path.
- The surface header is fixed to Isidis Planitia, and the panel includes generic or simulated telemetry. Those values must not appear as factual, destination-specific or live telemetry.
- The archive has Mars surface terrain, but **no Moon surface destination catalog or terrain**. Moon surface destinations need sourced location data and terrain before they can use this workflow.

## 1. Make destinations the source of truth

Consolidate `poiLandmarks.ts` and `surfaceEquipment.ts` into a shared destination record. Each record should include:

- Body, ID, name, category, latitude/longitude, elevation and coordinate convention.
- Mission/site relationships, narrative, source links, checked date, and confidence.
- Terrain asset or fallback, its bounds/coordinate alignment, and available detail levels.
- Whether imagery, elevation, route lines, and equipment are measured, illustrative, or unavailable.
- A destination-specific camera framing and short animation profile.

The Mars destinations to cover in the first release:

| Destination | Experience emphasis |
|---|---|
| **Jezero Crater — Perseverance and Ingenuity** | Approach the delta and landing area; distinguish rover and helicopter history and status. |
| **Isidis Planitia — Beagle 2** | Show the landing/search context and the limits of location precision. |
| **Gale Crater — Curiosity** | Introduce the crater, then focus on Mount Sharp and its documented layers. |
| **Meridiani Planum — Opportunity** | Emphasize the historic traverse only if a sourced route is available; otherwise show a site marker. |
| **Chryse Planitia — Viking 1** | Present the historic landing site and mission story. |
| **Olympus Mons** | Show the scale through a sourced elevation profile; label any vertical exaggeration. |
| **Valles Marineris** | Follow a selected canyon segment rather than implying the entire canyon is one local terrain tile. |
| **Hellas Planitia** | Descend into the basin and explain elevation-derived context without implying real-time measurements. |

Treat the three added lander/rover locations as first-class destinations, not as pins that happen to appear in the surface view.

## 2. Orchestrate loading and animation as one flow

Introduce explicit stages such as **selecting → preparing assets → arriving → exploring → returning**.

When a visitor selects a destination:

1. Focus its marker on the globe and show its name, coordinates, and data-status badge.
2. Begin preparing that destination’s terrain and content, with honest progress and a low-detail preview when available.
3. Animate the camera toward the site, or use a short crossfade if keeping separate canvases.
4. Reveal the local terrain, marker, and destination panel only when the scene is ready.
5. Restore input and provide a clear return-to-orbit action.

Use one transition coordinator to own camera/scene changes; cancel stale transitions and asset requests when the visitor chooses another destination. Add **skip**, **cancel**, loading-error, and retry paths. Respect reduced-motion preferences with a simple fade instead of a fast camera move.

## 3. Build a destination-aware terrain pipeline

Before adding more visual detail, verify the existing terrain GLB’s scale, bounds, orientation, and geographic alignment. The current latitude/longitude-to-map transform assumes fixed map dimensions; confirm those assumptions against the mesh.

For an MVP:

- Prepare a coarse Mars terrain preview and regional terrain assets for the eight destinations.
- Load only the selected region, then replace it with higher detail as that data becomes ready.
- Use the existing Draco/KTX2 tooling where compatible, and report real asset progress rather than simulated percentages.
- Keep a visible fallback for unavailable or failed terrain.
- Use sourced elevation and imagery where available. If a surface is procedural or illustrative, label it accordingly.

A later Moon phase can reuse this pipeline, but it needs Moon-specific destinations, coordinate transforms, source data, and terrain assets first.

## 4. Redesign the surface controls around exploration

- Make the destination name, body, coordinates, and evidence status dynamic; remove the fixed Isidis header.
- Use a compact destination list or search plus a clearly labeled map/compass. The current radar’s X/Z readout and 650 km range need a verified geographic interpretation before being presented as map coordinates.
- Organize the detail panel into **Overview**, **Mission**, **Terrain**, and **Sources**. On mobile, make it a collapsible bottom sheet.
- Replace “Run Diagnostics” with an explicitly labeled educational simulation, or remove it. Do not display invented system names, communications links, or “nominal” telemetry as factual.
- Make pins, selection, terrain layers, and panel actions available by keyboard and touch, not only mouse interaction.
## 5. Add environmental simulations as a separate, honest mode

Once terrain and destination selection are reliable, add the degradation concept from the specification as an opt-in scenario:

- Provide a timeline or scrubber for dust accumulation, solar exposure, or other supported factors.
- Clearly label the output as **illustrative simulation**, show its assumptions, and keep source-backed mission facts separate.
- Keep the baseline scene recoverable with a reset action; do not overwrite shared model materials or present the simulation as historical telemetry.

## Recommended implementation order

1. **Destination data and evidence:** unify the catalogs; add provenance, status, and coordinate validation.
2. **Transition and loading states:** make selection, preparation, arrival, errors, and return predictable.
3. **Terrain alignment and regional assets:** verify the current GLB, then add progressive regional detail.
4. **Surface UI:** dynamic site information, accessible navigation, and responsive panels.
5. **Simulation and polish:** add the optional degradation timeline, reduced-motion behavior, and performance tuning.

### Acceptance checks

For every destination, verify that its globe marker and local terrain position agree; coordinate wrapping and elevation are handled consistently; loading failures remain recoverable; and the panel identifies measured, illustrative, or unavailable content. Test keyboard/touch use, reduced motion, and narrow screens. Profile loading and frame rate on target devices before setting final performance budgets.