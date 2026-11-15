# Project Vantalumen - Keeping Space Exploration Stories Alive

## Summary

Since the 1960s, NASA has sent many spacecraft and robots to explore the Moon
and Mars. Some are now silent, left behind after completing their missions, but
their stories are far from over. For the "Abandoned but not Forgotten"
challenge, our team created VantaLumen, an interactive educational website that
helps people rediscover these space explorers and the stories behind them.

VantaLumen combines 3D maps of Mars and the Moon, interactive spacecraft
inspections, first-person mission-control-inspired views, and educational
storytelling. It uses NASA open data, including NSSDCA, alongside clearly
identified illustrative visualizations. We believe every spacecraft has a story
worth telling. The machines may be silent, but their stories can still inspire
us.

## Technologies used

- **Application:** React 19, TypeScript 5.9, and Vite 7.
- **3D scenes:** Three.js, React Three Fiber, and Drei for interactive 3D
  scenes, model loading, camera controls, and effects.
- **Planetary/geospatial visualization:** Cesium for globe and geospatial
  views; custom GLSL shaders and Three.js terrain rendering for other views.
- **State and animation:** Zustand for shared application state and GSAP for
  camera and interface transitions.
- **Visual and audio effects:** `@react-three/postprocessing` / `postprocessing`
  and Howler.js.
- **Chat assistant:** A server-side API uses Groq's `groq-sdk` with the
  `openai/gpt-oss-20b` model. Its answers are grounded in a locally indexed set
  of project documents and catalog data; `GROQ_API_KEY` is kept server-side.
- **3D asset formats:** glTF/GLB assets, including Draco-compressed models,
  textures, and separate terrain meshes.

## 3D models and assets currently available

The following is the website's current interactive model inventory. Model
presence does not mean that the real spacecraft is currently at the displayed
location: some orbit paths, positions, scales, reconstructions, and views are
illustrative. See [SOURCES.md](./SOURCES.md) and each model's in-app source
information for provenance and limitations.

### Mars surface and mission spacecraft

- Sojourner rover
- Spirit and Opportunity rovers
- Viking landers
- InSight lander
- Ingenuity helicopter
- Curiosity rover
- Perseverance rover
- Mars Reconnaissance Orbiter (MRO)
- Dawn spacecraft (shown in the context of its 2009 Mars flyby)

Additional spacecraft models available as off-world/reference objects:

- NEAR Shoemaker
- Pioneer 10
- Kepler Space Telescope

### Mars orbit

- Phobos and Deimos, Mars's natural moons
- 2001 Mars Odyssey orbiter
- MAVEN orbiter
- Mars Reconnaissance Orbiter (MRO)
- Dawn spacecraft, shown along an illustrative flyby path rather than as a
  spacecraft in a current Mars orbit
- Ares Orbital Station concept, using an International Space Station (ISS)
  model as a structural proxy; it is not a real or historically launched Mars
  station

### Moon and lunar missions

- Lunar Reconnaissance Orbiter (LRO)
- Apollo Command/Service Module (CSM), represented by an Apollo-era reference
  model
- Apollo Lunar Module, available for static inspection
- Six Apollo surface-equipment records: Lunar Roving Vehicle, its deployment
  mechanism and chassis, Apollo 15 LRV, Apollo 17 LRV, Apollo surface
  equipment, and Lunar Module MESA equipment. These records do not have
  dedicated GLB models and use illustrative procedural reconstructions where
  shown.

### Terrain and interface models

- Mars terrain mesh: `public/assets/models/mars/mars_terrain.glb`
- Lunar terrain mesh: `public/assets/models/moons/moon_terrain.glb`
- RISE assistant mascot: `public/assets/mascot/rise_plushie.glb`

The terrain meshes and generated terrain, globe maps, and procedural
reconstructions are visualization assets, not a claim that the site contains
the complete original MOLA, THEMIS, LOLA, or Diviner measurement datasets.

## What does the website do, and how does it work?

Vantalumen is an interactive educational website that tells the stories of space equipment left behind on the Moon and Mars.

Our project focuses on real NASA missions, including the Opportunity rover on Mars and the Apollo lunar missions. We want people to learn what happened to these machines, why they were important, and what they can still teach us today.

On our website, users can explore 3D maps of the Moon and Mars and find the locations of different spacecraft. They can also view 3D models of space equipment from different angles. We provide two ways to explore: a normal 3D view and a first-person view inspired by a mission control room.

Another feature shows how space equipment might change over 50 years because of the harsh conditions on the Moon and Mars. We use SVG animations that move as users scroll down the page. This is an educational simulation, not an exact prediction.

We also use information from NASA's official databases, including NSSDCA, to make our stories more accurate and useful.

## What benefits and intended impacts does it have?

We created Vantalumen because we believe that space history should be interesting and easy to understand, especially for young people.

For children, we made a comic series about Oppy, a friendly character based on NASA's Opportunity rover. Through Oppy's adventures, children can learn about real events on Mars, such as finding layers of rocks, getting stuck in soft sand, and solving problems during a mission.

We hope these stories will help children become more curious about science and encourage them to ask questions, think creatively, and learn from mistakes.

For older students and adults, our website offers a different way to learn about NASA missions. Instead of only reading articles or looking at photos, they can explore 3D models, learn how the equipment worked, and understand why these missions mattered.

We also want people to think about what happens to space equipment after a mission ends. Even when a rover stops working, it remains part of the history of space exploration.

Through this project, we hope more people will become interested in space science and understand why protecting our space history is important.

## Creativity and Considerations

The main idea behind Vantalumen is to tell the stories of machines that can no longer work but still have something important to share.

When we first learned about old rovers and equipment left on the Moon and Mars, we wondered what stories they could tell if they had a voice. This question became the starting point of our project.

We wanted to create something different from a normal information website. That is why we combined 3D exploration, interactive animations, NASA data, and comics in one place.

One of our favorite parts is Oppy's comic series. We use a friendly rover character and simple stories to explain real problems that NASA engineers faced. We believe children can learn difficult science topics more easily when they enjoy the story.

At the same time, we know scientific accuracy matters. We use NASA information for real mission events and make it clear when something is a simulation or an imagined situation.

Our biggest challenge is balancing science, technology, and storytelling. We want the website to be fun, but we also want visitors to learn something real.

For us, Vantalumen is a way to remember the work of past space missions and share their stories with the next generation.

Vantalumen — The mission ends, but the story continues.

## Miscellaneous

### Sources used
The website's equipment and model data is based on the following sources:
- NASA Space Science Data Coordinated Archive (NSSDCA) (https://nssdc.gsfc.nasa.gov/)
- NASA Open Data Portal (https://data.nasa.gov/)
- NASA Scientific Visualization Studio (https://svs.gsfc.nasa.gov/)
- NASA Mars Exploration Program (https://science.nasa.gov/planetary-science/programs/mars-exploration/)
- Astrogeology Science Center (https://www.usgs.gov/)