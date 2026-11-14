import type { SurfaceEquipmentItem } from '../types/cosmos.types';
import type { BodyId } from '../types/cosmos.types';

/**
 * Converts Latitude (N/S) and Longitude (E) into 3D coordinates on the flat terrain model.
 * Longitude [-180, 180] maps to X [-1000, 1000]
 * Latitude [90, -90] maps to Z [-500, 500]
 */
export function latLonToMapCoords(lat: number, lon: number): [number, number, number] {
    let normalizedLon = ((lon % 360) + 360) % 360;
    if (normalizedLon > 180) {
        normalizedLon -= 360;
    }
    const x = (normalizedLon / 180) * 1000;
    const z = -(lat / 90) * 500;
    return [x, 0, z];
}

export const MARS_SURFACE_CATALOG: SurfaceEquipmentItem[] = [
    {
        id: 'perseverance',
        name: 'Perseverance Rover & Ingenuity',
        realCoords: { lat: 18.447, lon: 77.402 },
        status: 'ACTIVE (Sol 1320+)',
        mission: 'Astrobiology & Sample Return Caching',
        description: 'Actively exploring ancient river delta deposits and ascending the western rim of Jezero Crater. Has cached over 24 rock core samples and deployed the Ingenuity Mars Helicopter.',
        elevationM: -2500,
        coords: latLonToMapCoords(18.447, 77.402),
        pinColor: '#64d2ff',
    },
    {
        id: 'beagle_2',
        name: 'Beagle 2 Lander',
        realCoords: { lat: 12.9, lon: 87.0 },
        status: 'DORMANT (Found 2014)',
        mission: 'Exobiology & Geochemistry',
        description: 'ESA/UK lander located in Isidis Planitia, 11 years after contact was lost during Christmas 2003 descent. High-resolution MRO HiRISE imagery confirmed successful touchdown, but incomplete solar panel unfolding blocked its transmission antenna.',
        elevationM: -3200,
        coords: latLonToMapCoords(12.9, 87.0),
        pinColor: '#f18b62',
    },
    {
        id: 'curiosity',
        name: 'Curiosity Rover (MSL)',
        realCoords: { lat: -5.4, lon: 137.8 },
        status: 'ACTIVE (Sol 4350+)',
        mission: 'Habitability & Paleoclimate Investigation',
        description: 'Climbing the lower foothills of Mount Sharp (Aeolis Mons) in Gale Crater since 2012. Proven ancient Gale Crater once held a freshwater lake system capable of supporting microbial life.',
        elevationM: -4500,
        coords: latLonToMapCoords(-5.4, 137.8),
        pinColor: '#64d2ff',
    },
    {
        id: 'opportunity',
        name: 'Opportunity Rover (MER-B)',
        realCoords: { lat: -1.95, lon: 354.47 },
        status: 'MISSION COMPLETE (2004–2018)',
        mission: 'Hydration Mineralogy & Deep Geological Traverse',
        description: 'Historic rover that operated for nearly 15 years across Meridiani Planum, trekking 45.16 kilometers before the catastrophic 2018 global dust storm covered its solar arrays in Perseverance Valley.',
        elevationM: -1400,
        coords: latLonToMapCoords(-1.95, 354.47),
        pinColor: '#f18b62',
    },
    {
        id: 'viking_1',
        name: 'Viking 1 Lander',
        realCoords: { lat: 22.48, lon: 312.05 },
        status: 'HISTORIC MONUMENT (Touchdown July 20, 1976)',
        mission: 'First Successful Extended Surface Mission',
        description: 'The first spacecraft to successfully land on Mars and operate long-term on the surface (Chryse Planitia), returning iconic initial color photographs and atmospheric pressure profiles.',
        elevationM: -2690,
        coords: latLonToMapCoords(22.48, 312.05),
        pinColor: '#f18b62',
    },
    {
        id: 'olympus_mons_site',
        name: 'Olympus Mons Caldera Rim',
        realCoords: { lat: 18.65, lon: 226.2 },
        status: 'NATURAL GEOLOGICAL WONDER',
        mission: 'Volcanology & High-Altitude Survey',
        description: "Summit caldera complex of the solar system's highest volcano (+21.2 km). The atmosphere here is thin (72 Pa) with panoramic views extending beyond the Tharsis rise.",
        elevationM: 21229,
        coords: latLonToMapCoords(18.65, 226.2),
        pinColor: '#f18b62',
    },
    {
        id: 'valles_marineris_site',
        name: 'Valles Marineris (Melas Chasma)',
        realCoords: { lat: -13.9, lon: 300.8 },
        status: 'TECTONIC SURVEY SITE',
        mission: 'Deep Canyon & Fog Stratigraphy',
        description: 'Floor of the deepest segment of the grand canyon network (-7.1 km below datum). Often experiences early morning water-ice clouds and dense atmospheric pooling.',
        elevationM: -7100,
        coords: latLonToMapCoords(-13.9, 300.8),
        pinColor: '#f18b62',
    },
    {
        id: 'hellas_site',
        name: 'Hellas Planitia (Badwater Floor)',
        realCoords: { lat: -42.4, lon: 70.5 },
        status: 'DEEP BASIN DEPRESSION',
        mission: 'High-Pressure Boundary Survey',
        description: 'Deepest point on Mars (-8.2 km). The ambient atmospheric pressure exceeds 1,155 Pa, creating unique atmospheric thermodynamic stability conditions on the planet.',
        elevationM: -8200,
        coords: latLonToMapCoords(-42.4, 70.5),
        pinColor: '#f18b62',
    },
];

export const MOON_SURFACE_CATALOG: SurfaceEquipmentItem[] = [
    {
        id: 'apollo_11',
        name: 'Apollo 11 — Tranquility Base',
        realCoords: { lat: 0.674, lon: 23.473 },
        status: 'HISTORIC MONUMENT (July 20, 1969)',
        mission: 'First Human Lunar Landing',
        description: 'Site of humanity\'s first crewed Moon landing in Mare Tranquillitatis. The Eagle lunar module descent stage, scientific equipment (ALSEP), and the American flag remain at the site.',
        elevationM: -600,
        coords: latLonToMapCoords(0.674, 23.473),
        pinColor: '#f18b62',
    },
    {
        id: 'apollo_12',
        name: 'Apollo 12 — Ocean of Storms',
        realCoords: { lat: -3.013, lon: -23.422 },
        status: 'HISTORIC MONUMENT (November 19, 1969)',
        mission: 'Precision Landing & ALSEP Deployment',
        description: 'Second crewed lunar landing in Oceanus Procellarum, only 183 m from the Surveyor 3 probe. Retrieved components from Surveyor 3 for analysis and deployed the first complete ALSEP station.',
        elevationM: -1550,
        coords: latLonToMapCoords(-3.013, -23.422),
        pinColor: '#f18b62',
    },
    {
        id: 'apollo_14',
        name: 'Apollo 14 — Fra Mauro Highlands',
        realCoords: { lat: -3.645, lon: -17.472 },
        status: 'HISTORIC MONUMENT (February 5, 1971)',
        mission: 'Fra Mauro Formation Geology',
        description: 'Third crewed landing in the Fra Mauro formation, an ancient impact ejecta field. Astronauts Shepard and Mitchell trekked to the rim of Cone Crater, returning the highest mass of lunar samples.',
        elevationM: -450,
        coords: latLonToMapCoords(-3.645, -17.472),
        pinColor: '#f18b62',
    },
    {
        id: 'apollo_15',
        name: 'Apollo 15 — Hadley-Apennine',
        realCoords: { lat: 26.133, lon: 3.634 },
        status: 'HISTORIC MONUMENT (July 30, 1971)',
        mission: 'First Lunar Roving Vehicle Deployment',
        description: 'First J-mission featuring the Lunar Roving Vehicle. Located at the base of the Apennine mountains next to Hadley Rille — a 1.2 km wide lava tube channel. Spent 18+ hours on the surface.',
        elevationM: 2060,
        coords: latLonToMapCoords(26.133, 3.634),
        pinColor: '#f18b62',
    },
    {
        id: 'apollo_16',
        name: 'Apollo 16 — Descartes Highlands',
        realCoords: { lat: -8.973, lon: 15.498 },
        status: 'HISTORIC MONUMENT (April 21, 1972)',
        mission: 'Highland Volcanic Geology Survey',
        description: 'Only landing in the central highlands. Young and Duke collected 94.7 kg of lunar samples, including the famous "Big Muley" — largest returned Moon rock. ALSEP instruments operated for 5 years.',
        elevationM: 2600,
        coords: latLonToMapCoords(-8.973, 15.498),
        pinColor: '#f18b62',
    },
    {
        id: 'apollo_17',
        name: 'Apollo 17 — Taurus-Littrow Valley',
        realCoords: { lat: 20.187, lon: 30.773 },
        status: 'HISTORIC MONUMENT (December 11, 1972)',
        mission: 'Final Apollo Mission & Geologist on Moon',
        description: 'Last human lunar landing to date. Harrison Schmitt (geologist) and Cernan collected 110 kg of samples from a narrow valley flanked by ancient massifs, including orange volcanic glass beads.',
        elevationM: -2300,
        coords: latLonToMapCoords(20.187, 30.773),
        pinColor: '#f18b62',
    },
    {
        id: 'luna_9',
        name: 'Luna 9 — Oceanus Procellarum',
        realCoords: { lat: 7.133, lon: -64.37 },
        status: 'HISTORIC MONUMENT (February 3, 1966)',
        mission: 'First Soft Landing on the Moon',
        description: 'First spacecraft to achieve a soft landing on the Moon and transmit photographic data from the surface. Proved the lunar soil could support a spacecraft\'s weight.',
        elevationM: -1750,
        coords: latLonToMapCoords(7.133, -64.37),
        pinColor: '#f18b62',
    },
    {
        id: 'chang_e_4',
        name: "Chang'e 4 — Von Kármán Crater",
        realCoords: { lat: -45.456, lon: 177.588 },
        status: 'ACTIVE',
        mission: "First Far-Side Landing & Yutu-2 Rover",
        description: "First spacecraft to soft-land on the far side of the Moon in January 2019. The Yutu-2 rover is still operational, investigating the ancient Von Kármán impact basin inside the South Pole-Aitken Basin.",
        elevationM: -6200,
        coords: latLonToMapCoords(-45.456, 177.588),
        pinColor: '#64d2ff',
    },
];

export function getSurfaceCatalog(bodyId: BodyId): SurfaceEquipmentItem[] {
    return bodyId === 'moon' ? MOON_SURFACE_CATALOG : MARS_SURFACE_CATALOG;
}

export function findSurfaceEquipmentByCoords(
    bodyId: BodyId,
    lat: number,
    lon: number,
): SurfaceEquipmentItem | undefined {
    return getSurfaceCatalog(bodyId).find(
        (eq) => Math.abs(eq.realCoords.lat - lat) < 1.0 && Math.abs(eq.realCoords.lon - lon) < 1.0,
    );
}

export function findSurfaceEquipmentById(
    bodyId: BodyId,
    id: string,
): SurfaceEquipmentItem | undefined {
    return getSurfaceCatalog(bodyId).find((eq) => eq.id === id);
}
