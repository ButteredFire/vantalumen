import type { BodyId, SurfaceEquipmentItem } from '../types/cosmos.types';

/**
 * Converts Planetary Latitude (N/S) and Longitude (E) into 3D coordinates on the flat terrain model.
 * Matches standard projection math:
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

export const MARS_SURFACE_EQUIPMENT_CATALOG: SurfaceEquipmentItem[] = [
    {
        id: 'perseverance',
        name: 'Perseverance Rover & Ingenuity',
        bodyId: 'mars',
        realCoords: { lat: 18.447, lon: 77.402 },
        status: 'ACTIVE (Sol 1320+)',
        mission: 'Astrobiology & Sample Return Caching',
        description: 'Actively exploring ancient river delta deposits and ascending the western rim of Jezero Crater. Has cached over 24 rock core samples and deployed the Ingenuity Mars Helicopter.',
        elevationM: -2500,
        coords: latLonToMapCoords(18.447, 77.402),
    },
    {
        id: 'beagle_2',
        name: 'Beagle 2 Lander',
        bodyId: 'mars',
        realCoords: { lat: 12.9, lon: 87.0 },
        status: 'DORMANT (Found 2014)',
        mission: 'Exobiology & Geochemistry',
        description: 'ESA/UK lander located in Isidis Planitia, 11 years after contact was lost during Christmas 2003 descent. High-resolution MRO HiRISE imagery confirmed successful touchdown, but incomplete solar panel unfolding blocked its transmission antenna.',
        elevationM: -3200,
        coords: latLonToMapCoords(12.9, 87.0),
    },
    {
        id: 'curiosity',
        name: 'Curiosity Rover (MSL)',
        bodyId: 'mars',
        realCoords: { lat: -5.4, lon: 137.8 },
        status: 'ACTIVE (Sol 4350+)',
        mission: 'Habitability & Paleoclimate Investigation',
        description: 'Climbing the lower foothills of Mount Sharp (Aeolis Mons) in Gale Crater since 2012. Proven ancient Gale Crater once held a freshwater lake system capable of supporting microbial life.',
        elevationM: -4500,
        coords: latLonToMapCoords(-5.4, 137.8),
    },
    {
        id: 'opportunity',
        name: 'Opportunity Rover (MER-B)',
        bodyId: 'mars',
        realCoords: { lat: -1.95, lon: 354.47 },
        status: 'MISSION COMPLETE (2004–2018)',
        mission: 'Hydration Mineralogy & Deep Geological Traverse',
        description: 'Historic rover that operated for nearly 15 years across Meridiani Planum, trekking 45.16 kilometers before the catastrophic 2018 global dust storm covered its solar arrays in Perseverance Valley.',
        elevationM: -1400,
        coords: latLonToMapCoords(-1.95, 354.47),
    },
    {
        id: 'viking_1',
        name: 'Viking 1 Lander',
        bodyId: 'mars',
        realCoords: { lat: 22.48, lon: 312.05 },
        status: 'HISTORIC MONUMENT (Touchdown July 20, 1976)',
        mission: 'First Successful Extended Surface Mission',
        description: 'The first spacecraft to successfully land on Mars and operate long-term on the surface (Chryse Planitia), returning iconic initial color photographs and atmospheric pressure profiles.',
        elevationM: -2690,
        coords: latLonToMapCoords(22.48, 312.05),
    },
    {
        id: 'sojourner',
        name: 'Sojourner Rover (Mars Pathfinder)',
        bodyId: 'mars',
        realCoords: { lat: 19.13, lon: 326.78 },
        status: 'HISTORIC MONUMENT (Touchdown 1997)',
        mission: 'First Wheeled Mars Micro-Rover',
        description: 'First robotic rover on Mars, deployed by Pathfinder lander at Ares Vallis. Operated for 83 sols and analyzed chemical composition of rocks like Barnacle Bill and Yogi.',
        elevationM: -3680,
        coords: latLonToMapCoords(19.13, 326.78),
    },
    {
        id: 'insight',
        name: 'InSight Lander',
        bodyId: 'mars',
        realCoords: { lat: 4.502, lon: 135.623 },
        status: 'MISSION COMPLETE (2018–2022)',
        mission: 'Seismology & Internal Structure',
        description: 'Geophysics lander stationed at Elysium Planitia. Detected over 1,300 marsquakes using the SEIS seismometer and mapped Mars crust, mantle, and molten liquid iron-nickel core.',
        elevationM: -2613,
        coords: latLonToMapCoords(4.502, 135.623),
    },
    {
        id: 'olympus_mons_site',
        name: 'Olympus Mons Caldera Rim',
        bodyId: 'mars',
        realCoords: { lat: 18.65, lon: 226.2 },
        status: 'NATURAL GEOLOGICAL WONDER',
        mission: 'Volcanology & High-Altitude Survey',
        description: 'Summit caldera complex of the solar system\'s highest volcano (+21.2 km). The atmosphere here is thin (72 Pa) with panoramic views extending beyond the Tharsis rise.',
        elevationM: 21229,
        coords: latLonToMapCoords(18.65, 226.2),
    },
    {
        id: 'valles_marineris_site',
        name: 'Valles Marineris (Melas Chasma)',
        bodyId: 'mars',
        realCoords: { lat: -13.9, lon: 300.8 },
        status: 'TECTONIC SURVEY SITE',
        mission: 'Deep Canyon & Fog Stratigraphy',
        description: 'Floor of the deepest segment of the grand canyon network (-7.1 km below datum). Often experiences early morning water-ice clouds and dense atmospheric pooling.',
        elevationM: -7100,
        coords: latLonToMapCoords(-13.9, 300.8),
    },
    {
        id: 'hellas_site',
        name: 'Hellas Planitia (Badwater Floor)',
        bodyId: 'mars',
        realCoords: { lat: -42.4, lon: 70.5 },
        status: 'DEEP BASIN DEPRESSION',
        mission: 'High-Pressure Boundary Survey',
        description: 'Deepest point on Mars (-8.2 km). The ambient atmospheric pressure exceeds 1,155 Pa, creating unique atmospheric thermodynamic stability conditions on the planet.',
        elevationM: -8200,
        coords: latLonToMapCoords(-42.4, 70.5),
    },
];

export const MOON_SURFACE_EQUIPMENT_CATALOG: SurfaceEquipmentItem[] = [
    {
        id: 'apollo_11',
        name: 'Apollo 11 Tranquility Base',
        bodyId: 'moon',
        realCoords: { lat: 0.6741, lon: 23.473 },
        status: 'HISTORIC MONUMENT (July 20, 1969)',
        mission: 'First Crewed Lunar Landing',
        description: 'Lunar Module "Eagle" descent stage and Early Apollo Scientific Experiments Package (EASEP) at Mare Tranquillitatis. Humanity\'s first footsteps on another celestial body.',
        elevationM: -2500,
        coords: latLonToMapCoords(0.6741, 23.473),
    },
    {
        id: 'apollo_15_site',
        name: 'Apollo 15 & Lunar Roving Vehicle 1',
        bodyId: 'moon',
        realCoords: { lat: 26.1322, lon: 3.6339 },
        status: 'HISTORIC MONUMENT (1971)',
        mission: 'Hadley-Apennine Exploration & First LRV',
        description: 'First J-class extended mission featuring the Lunar Roving Vehicle (LRV). Explored Hadley Rille and sampled anorthosite sample 15415 ("Genesis Rock") in the Apennine Mountains.',
        elevationM: -1800,
        coords: latLonToMapCoords(26.1322, 3.6339),
    },
    {
        id: 'apollo_17_site',
        name: 'Apollo 17 & Lunar Roving Vehicle 3',
        bodyId: 'moon',
        realCoords: { lat: 20.1908, lon: 30.7717 },
        status: 'HISTORIC MONUMENT (December 1972)',
        mission: 'Taurus-Littrow Geological Survey',
        description: 'Final Apollo lunar surface mission. Geologist-astronaut Harrison Schmitt discovered orange volcanic glass beads at Shorty Crater while traversing 35.7 km across the valley.',
        elevationM: -2100,
        coords: latLonToMapCoords(20.1908, 30.7717),
    },
    {
        id: 'apollo_12_surveyor',
        name: 'Apollo 12 & Surveyor 3 Site',
        bodyId: 'moon',
        realCoords: { lat: -3.012, lon: 336.582 },
        status: 'HISTORIC MONUMENT (November 1969)',
        mission: 'Precision Landing & Hardware Retrieval',
        description: 'Precision landing within walking distance of the robotic Surveyor 3 lander in Oceanus Procellarum. Retrieved components for analysis of 2.5 years of lunar environmental exposure.',
        elevationM: -1400,
        coords: latLonToMapCoords(-3.012, 336.582),
    },
    {
        id: 'mare_tranquillitatis_basin',
        name: 'Mare Tranquillitatis Central Basin',
        bodyId: 'moon',
        realCoords: { lat: 8.35, lon: 30.83 },
        status: 'BASALTIC MARE PLAIN',
        mission: 'Lunar Basalt & Titanium Mapping',
        description: 'Ancient flood basalt plain rich in ilmenite and titanium dioxide, formed during the Upper Imbrian epoch (~3.8 to 3.2 billion years ago).',
        elevationM: -2100,
        coords: latLonToMapCoords(8.35, 30.83),
    },
    {
        id: 'tycho_crater_site',
        name: 'Tycho Crater Rim & Peak',
        bodyId: 'moon',
        realCoords: { lat: -43.30, lon: 348.78 },
        status: 'IMPACT CRATER COMPLEX',
        mission: 'Young Copernican Crater Survey',
        description: 'Prominent 85-km impact crater with a 1,600-meter central peak and extensive bright ray system stretching across thousands of kilometers of the lunar nearside.',
        elevationM: 4800,
        coords: latLonToMapCoords(-43.30, 348.78),
    },
    {
        id: 'south_pole_aitken_site',
        name: 'South Pole–Aitken Basin Center',
        bodyId: 'moon',
        realCoords: { lat: -53.0, lon: 191.0 },
        status: 'DEEP BASIN DEPRESSION',
        mission: 'Deep Crust & Mantle Excavation Site',
        description: 'Largest and oldest recognized impact basin on the Moon (2,500 km across, up to 8.2 km deep), exposing ancient lower crustal and upper mantle materials.',
        elevationM: -8200,
        coords: latLonToMapCoords(-53.0, 191.0),
    },
];

export const SURFACE_EQUIPMENT_CATALOG = MARS_SURFACE_EQUIPMENT_CATALOG;

export function getSurfaceEquipmentForBody(bodyId: BodyId): SurfaceEquipmentItem[] {
    return bodyId === 'moon' ? MOON_SURFACE_EQUIPMENT_CATALOG : MARS_SURFACE_EQUIPMENT_CATALOG;
}

export function findSurfaceEquipmentByCoords(
    lat: number,
    lon: number,
    bodyId: BodyId = 'mars',
): SurfaceEquipmentItem | undefined {
    const list = getSurfaceEquipmentForBody(bodyId);
    return list.find((item) => {
        const dLat = Math.abs(item.realCoords.lat - lat);
        const dLon = Math.abs(item.realCoords.lon - lon);
        return dLat < 1.0 && (dLon < 1.0 || Math.abs(dLon - 360) < 1.0);
    });
}
