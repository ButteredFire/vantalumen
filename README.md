# Mars–Moon Orbital Atlas

A shared 3D atlas for Mars and the Moon, built with React, TypeScript, Vite,
React Three Fiber, and Cesium.

- **Mars:** Nine available GLB models associated with Mars or included as off-world references (`sojourner_rover`, `spirit_and_opportunity_rover`, `viking_lander`, `insight_lander`, `ingenuity_helicopter`, `curiosity_rover`, `perseverance_rover`, `mro_orbiter`, and `dawn_spacecraft`, shown in its flyby context), plus three separately scoped reference spacecraft (`near_shoemaker`, `pioneer_10`, `kepler_space_telescope` under `reference_spacecraft`), orbital actors and satellites (`phobos`, `deimos`, `mars_odyssey`, `maven_orbiter`, and `ares_station`, an ISS proxy), and four IAU/USGS features.
- **Moon:** An illustrative globe and surface imagery/textures, two orbiters (`lro_orbiter`, `apollo_csm`), one verified NASA 3D Resources lander GLB (`apollo_lunar_module`, in static inspection mode), three reference features (`mare_tranquillitatis`, `tycho`, `south_pole_aitken`), and six Apollo equipment records from CSV that remain `unavailable` (with illustrative procedural geometry reconstructions).

The globe, thermal/elevation maps, seeded synthesized terrain grid, and procedural reconstructions support educational visualization. They do not replace MOLA, THEMIS, LOLA, or Diviner measurement datasets; the original measured datasets are explicitly listed as not integrated.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```powershell
npm install
npm run dev
```

To enable the **RISE assistant** (`/api/chat`, launched from the 3D button at
`public/assets/mascot/rise_plushie.glb` through
`src/scene/mascot/RiseMascot.tsx`), configure the server-side `GEMINI_API_KEY`
environment variable in `.env.local` locally or in Vercel Environment
Variables. Do not expose it to the client with the `VITE_` prefix. The backend
uses the `@google/genai` Interactions API with the highest Free Tier model
`gemini-3.8-flash`, falling back according to the time budget to
`gemini-3.6-flash` and `gemini-3.5-flash-lite` under load (`store: false`). It
uses the locally indexed project knowledge in `src/config/chatKnowledgeIndex.json`
(`npm run build:chat-index`).

Choose Mars or the Moon in the top navigation, follow the suggested journey
(`Guided journey`) or switch to `Explore freely`, use `?v=1&body=...` for shared
links, and view sources and model status in the right-hand information panel.

## Test and build

```powershell
npm test
npm run typecheck
npm run validate:assets
npm run build
npm run verify:dist
npm run test:browser
```

`validate:assets` inventories all 28 `.glb` files in `public/assets/models/`
(separating 22 catalog/orbital/terrain runtime GLBs from six non-catalog
preload/LOD/legacy GLBs) and one UI mascot `.glb`
(`public/assets/mascot/rise_plushie.glb`), verifying glTF `2.0`, byte counts,
SHA-256, and six terrain-region manifest entries. `verify:dist` compares all
asset files and SHA-256 checksums between `public/` and `dist/` after a build.
`npm run build:chat-index` regenerates the locally sourced knowledge index at
`src/config/chatKnowledgeIndex.json`. `test:browser` runs Playwright/Chrome
with SwiftShader through both Mars and Moon journeys on desktop and narrow
viewports.

Cesium is served from `/cesium/`; GLSL shaders and WASM resources are configured
in Vite. Model assets, textures, audio, and decoders are under `public/assets/`
and `public/decoders/`. Unprocessed source models are under `raw_assets/`.
Data sources and visualization limits are documented in `docs/SOURCES.md`.
