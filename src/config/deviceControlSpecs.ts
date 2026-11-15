import type {
  DeviceControlSpec,
  DevicePartGroupId,
} from '../types/cosmos.types';

export const INSIGHT_PANEL_LEFT_NODES = [
  'panel_l_rod',
  'Cube.046',
  'Cube.001',
  'Cube.047',
  'Cube.048',
  'Cube.049',
  'Cube.050',
  'Cube.051',
  'Cube.052',
  'Cube.056',
  'Cube.057',
  'Cube.054',
  'Cube.055',
  'Cube.053',
  'panel_l.033',
  'panel_l.032',
  'panel_l.031',
  'panel_l.021',
  'panel_l.020',
  'Cube.064',
  'Cube.065',
  'Cube.062',
  'Cube.063',
  'Cube.060',
  'Cube.061',
  'Cube.058',
  'Cube.059',
  'panel_l.037',
  'panel_l.036',
  'panel_l.035',
  'panel_l.034',
  'panel_l.019',
  'panel_l.004',
  'panel_l_root',
] as const;

export const INSIGHT_PANEL_RIGHT_NODES = [
  'panel_r_rod',
  'Cube.002',
  'Cube.079',
  'Cube.080',
  'Cube.067',
  'Cube.081',
  'Cube.082',
  'Cube.068',
  'Cube.083',
  'Cube.084',
  'Cube.069',
  'Cube.085',
  'Cube.086',
  'Cube.070',
  'Cube.097',
  'Cube.066',
  'Cube.095',
  'Cube.096',
  'Cube.075',
  'Cube.093',
  'Cube.094',
  'Cube.074',
  'Cube.091',
  'Cube.092',
  'Cube.073',
  'Cube.089',
  'Cube.090',
  'Cube.072',
  'Cube.087',
  'Cube.088',
  'Cube.071',
  'Cube.026',
  'Cube.078',
  'panel_r_root',
] as const;

export const INSIGHT_ARM_NODES = [
  'arm_01',
  'arm_02',
  'arm_03',
  'arm_03.001',
  'IDC',
  'lens_cap_IDC',
  'knob',
  'shovel',
] as const;

export const INSIGHT_GRAPPLE_NODES = [
  'grapple',
  'claw_01',
  'claw_02',
  'claw_03',
  'claw_04',
  'claw_05',
] as const;

export const INSIGHT_ALL_NODES = [
  ...INSIGHT_GRAPPLE_NODES,
  'IDC',
  'knob',
  'lens_cap_IDC',
  'shovel',
  'arm_03',
  'arm_03.001',
  'arm_02',
  'arm_01',
  ...INSIGHT_PANEL_LEFT_NODES,
  ...INSIGHT_PANEL_RIGHT_NODES,
  'InSight_Deployed',
] as const;

export const INGENUITY_ALL_NODES = [
  'bus',
  'cams',
  'leg_01',
  'leg_02',
  'leg_03',
  'leg_04',
  'parts_01',
  'parts_02',
  'rotors_01',
  'rotors_02',
  'solar_panel',
] as const;

export const PERSEVERANCE_MAST_OPTICS_NODES = [
  'head',
  'lens',
  'Mastcam_Z_cams',
  'NavCams',
  'microphones.001',
  'probe',
  'probe.001',
  'base',
  'top',
  'bottom',
  'bottom.001',
  'bottom.002',
  'bottom.003',
  'Up_Look_Camera',
  'Down_Look_Camera',
  'calibration_target',
  'calibration_target_bracket',
] as const;

export const PERSEVERANCE_ARM_TURRET_NODES = [
  'arm.003',
  'arm.002',
  'arm',
  'arm.004',
  'arm.001',
  'arm_cable_etc',
  'turret_obj',
  'turret_obj.002',
  'turret_obj.004',
  'turret_obj.006',
  'turret_parts',
  'corring_drill',
  'cover_02',
  'cover_03',
  'hinge',
  'PIXL_cover_01',
  'PIXL',
  'WATSON',
  'arm_01_joint',
  'arm_01_pivot',
  'arm_01',
  'arm_02_joint',
  'arm_02_pivot',
  'arm_02',
  'arm_02.001',
] as const;

export const PERSEVERANCE_POWER_COMMS_NODES = [
  'rtg',
  'antenna_uhf',
  'antenna_hg',
  'antenna_lg',
  'RIMFAX',
  'Name_Chips',
  'pan_end cover',
] as const;

export const PERSEVERANCE_CHASSIS_MOBILITY_NODES = [
  'Wheels_objs',
  'suspension',
  'Body',
  'Body.002',
  'Body.003',
  'Body_Parts',
  'Body_Parts.001',
  'part_01',
  'box',
  'lab',
  'hazcams_front',
  'hazcams_front_cover',
  'hazcams_rear',
  'hazcams_rear_cover_l',
  'hazcams_rear_cover_r',
  'hazcams_rear_wiring',
  'microphones',
] as const;

export const PERSEVERANCE_ALL_NODES = [
  ...PERSEVERANCE_MAST_OPTICS_NODES,
  ...PERSEVERANCE_ARM_TURRET_NODES,
  ...PERSEVERANCE_POWER_COMMS_NODES,
  ...PERSEVERANCE_CHASSIS_MOBILITY_NODES,
] as const;

export const CURIOSITY_ALL_NODES = ['MSL'] as const;

/**
 * Verified source-backed inspection & limited mechanism specs.
 * `ingenuity_helicopter` (11 nodes), `insight_lander` (83 nodes),
 * `perseverance_rover` (66 nodes), and `curiosity_rover` (1 static MSL node)
 * have GLB hierarchies verified against official NASA/JPL documentation.
 */
export const DEVICE_CONTROL_SPECS: Record<string, DeviceControlSpec> = {
  ingenuity_helicopter: {
    deviceId: 'ingenuity_helicopter',
    modelVersion: '1.0.0 (NASA/JPL-Caltech GLB · fit-longest-side-2)',
    generalDisclaimer:
      'Views and slow-rotation simulation illustrate the structure using a GLB normalized to 2 units; they do not simulate aerodynamics or real flight telemetry.',
    rotorControl: {
      upperNodeName: 'rotors_01',
      lowerNodeName: 'rotors_02',
      localAxis: [1, 0, 0],
      documentedRpm: '~2,400 rpm (design speed per NASA Fact Sheet)',
      documentedDiameter: '1.21 m (four-blade carbon-fiber coaxial rotor)',
      documentedFlightWindow: 'Up to ~90 seconds per flight (NASA Rotor Geometry)',
      demoSpinRadPerSec: Math.PI, // 0.5 rev/s visual rate so counter-rotation stays legible on 60 Hz displays
      demoRevPerSecLabel: '0.5 revolutions/second (for observing counter-rotation only; not the actual 2,400 rpm)',
      stepAnglesDeg: [0, 45, 90, 180],
      disclaimer:
        'The rotors_01 and rotors_02 nodes have opposite-sign local [1, 0, 0] axes (+Y and -Y in world space), so they counter-rotate around the main mast. Blade pitch (collective/cyclic) is not simulated because the GLB does not separate the pitch links.',
    },
    cameraViews: [
      {
        id: 'overview',
        label: 'Three-quarter overview',
        position: [2.4, 1.25, 2.4],
        target: [0, 0, 0],
        summary:
          'Overview of all 11 helicopter nodes: solar_panel, two coaxial rotor levels, the bus body (1.8 kg), and four landing legs.',
        sourceRef: 'NASA Ingenuity Fact Sheet & NASA 3D Resource GLB',
        isIllustrativeView: true,
      },
      {
        id: 'coaxial_mast',
        label: 'Rotor and solar panel assembly',
        position: [1.35, 0.42, 1.35],
        target: [0, 0.24, 0],
        summary:
          'Close-up of the top-mounted solar panel (solar_panel), upper/lower rotors (rotors_01, rotors_02 · 1.21 m span), and two mast assemblies (parts_01, parts_02).',
        sourceRef: 'NASA Ingenuity Rotor Geometry & Fact Sheet',
        isIllustrativeView: true,
      },
      {
        id: 'rte_horizon',
        label: 'RTE color camera (13 MP · forward-facing)',
        position: [0.68, -0.34, 0.22],
        target: [0.06, -0.22, 0],
        summary:
          'Positioned below the bus body (+X, between legs leg_03/leg_04), facing the cams optical assembly to represent the 13 MP color horizon camera.',
        sourceRef: 'NASA Ingenuity Landing Press Kit (RTE 13 MP camera)',
        isIllustrativeView: true,
      },
      {
        id: 'navcam_nadir',
        label: 'Navcam (0.5 MP · downward-facing)',
        position: [0.08, -0.92, 0.38],
        target: [0.03, -0.24, 0],
        summary:
          'View upward from below the ground clearance (~13 cm in reality) toward the cams sensor assembly and underside of the bus containing the 0.5 MP monochrome Navcam and laser altimeter.',
        sourceRef: 'NASA Ingenuity Landing Press Kit & Hover Modeling',
        isIllustrativeView: true,
      },
    ],
    partGroups: [
      {
        id: 'all',
        label: 'All components (11 nodes)',
        nodeNames: [...INGENUITY_ALL_NODES],
        documentedSpec:
          'Mass 1.8 kg on Earth (~0.68 kg on Mars); height 0.49 m; coaxial rotor span 1.21 m.',
        sourceRef: 'NASA Ingenuity Fact Sheet · /assets/provenance/ingenuity.csv',
        limitationNote:
          'Displays all 11 nodes in a static configuration with landing legs deployed; normalized to 2 scene units.',
        isControlVerified: true,
      },
      {
        id: 'rotor_system',
        label: 'Coaxial rotor system (rotors_01/02)',
        nodeNames: ['rotors_01', 'rotors_02', 'parts_01', 'parts_02'],
        documentedSpec:
          'Two counter-rotating, 1.21 m-diameter carbon-fiber rotor levels; design speed ~2,400 rpm (associated with parts_01 and parts_02).',
        sourceRef: 'NASA Ingenuity Fact Sheet & Rotor Geometry',
        limitationNote:
          'Supports 0°/45°/90°/180° step rotation and illustrative counter-rotation for rotors_01 and rotors_02; the swashplate parts (parts_01/02) remain static.',
        isControlVerified: true,
      },
      {
        id: 'solar_power',
        label: 'Solar panel and antenna (solar_panel)',
        nodeNames: ['solar_panel'],
        documentedSpec:
          'Photovoltaic array mounted atop the rotor mast to charge six Li-ion cells, with a communications antenna mast above.',
        sourceRef: 'NASA Ingenuity Rotor Geometry & Fact Sheet',
        limitationNote:
          'Fixed in the GLB model; battery capacity and time-varying Martian solar irradiance are not simulated.',
        isControlVerified: false,
      },
      {
        id: 'fuselage_avionics',
        label: 'Avionics and sensor bus',
        nodeNames: ['bus'],
        documentedSpec:
          'The thermally controlled 13.6 × 19.5 × 16.3 cm body houses the flight computer, IMU, autonomy processor, and underside laser altimeter port.',
        sourceRef: 'NASA Ingenuity Landing Press Kit & Hover Modeling',
        limitationNote:
          'Fixed body (one node combining the silver/carbon shell and base plate); no real-time temperature or IMU telemetry.',
        isControlVerified: false,
      },
      {
        id: 'cameras_optics',
        label: 'RTE and Navcam assembly (cams)',
        nodeNames: ['cams'],
        documentedSpec:
          'Includes a downward-facing navigation camera (0.5 MP monochrome Navcam) and a horizon-facing color camera (13 MP RTE).',
        sourceRef: 'NASA Ingenuity Landing Press Kit',
        limitationNote:
          'The lens assembly is fixed at the lower front edge of the body; no gimbal rotation or live sensor imagery is available.',
        isControlVerified: false,
      },
      {
        id: 'landing_gear',
        label: 'Four carbon landing legs (leg_01–04)',
        nodeNames: ['leg_01', 'leg_02', 'leg_03', 'leg_04'],
        documentedSpec:
          'Four carbon-composite landing legs, with ~13 cm ground clearance when on the surface.',
        sourceRef: 'NASA Ingenuity Landing Press Kit & Hover Modeling',
        limitationNote:
          'Remains in the deployed configuration. No leg-folding animation is provided because the node’s local axis is not a hinge and no sourced folding angle is available.',
        isControlVerified: false,
      },
    ],
    sources: [
      {
        title: 'NASA Provenance CSV · Ingenuity Notes',
        url: '/assets/provenance/ingenuity.csv',
        checked: '2026-11-14',
        version: 'Supplied project provenance (Fact Sheet, Rotor Geometry, Landing Press Kit, Hover Modeling)',
      },
      {
        title: 'NASA 3D Resources · Ingenuity Mars Helicopter',
        url: 'https://science.nasa.gov/3d-resources/ingenuity-mars-helicopter/',
        checked: '2026-11-14',
        version: 'Supplied ZIP original GLB bytes',
      },
    ],
  },
  insight_lander: {
    deviceId: 'insight_lander',
    modelVersion: '1.0.0 (NASA/JPL-Caltech GLB · fit-longest-side-2 · 83 nodes)',
    generalDisclaimer:
      'InSight views and grouping of its 83 nodes are verified against the normalized GLB geometry; the IDA arm remains in its static deployed pose, with no simulation of dynamics or real seismic telemetry.',
    cameraViews: [
      {
        id: 'overview',
        label: 'Lander overview',
        position: [2.5, 1.35, 2.5],
        target: [0, 0, 0],
        summary:
          'Overview of all 83 InSight nodes with both circular Ultraflex solar arrays deployed (~2.15 m diameter each).',
        sourceRef: 'NASA InSight Launch Press Kit & NASA 3D Resource GLB',
        isIllustrativeView: true,
      },
      {
        id: 'arm_grapple',
        label: 'IDA arm and grapple',
        position: [1.15, 0.58, 1.32],
        target: [0.1, 0.05, 0.25],
        summary:
          'Close-up of the Instrument Deployment Arm (arm_01–arm_03), IDC camera, scoop (shovel), and five-finger grapple (claw_01–05).',
        sourceRef: 'NASA InSight Instrument Deployment System Fact Sheet',
        isIllustrativeView: true,
      },
      {
        id: 'solar_wings',
        label: 'Two Ultraflex solar arrays (2.15 m)',
        position: [0.1, 1.9, 1.75],
        target: [0, 0, 0],
        summary:
          'Top-down view of the two fan-shaped solar arrays (panel_l_root / panel_r_root), comprising 68 strut and panel nodes.',
        sourceRef: 'NASA InSight Spacecraft Overview (Lockheed Martin)',
        isIllustrativeView: true,
      },
      {
        id: 'deck_overview',
        label: 'Deck and SEIS/HP³ instruments',
        position: [-1.1, 0.72, 1.15],
        target: [0, -0.05, 0],
        summary:
          'Inspect the InSight_Deployed main body, which carries the thermally controlled electronics bay, UHF/X-band RISE antenna, and geophysics instrument frame.',
        sourceRef: 'NASA InSight Mission Press Kit & GLB Mesh Inspection',
        isIllustrativeView: true,
      },
    ],
    partGroups: [
      {
        id: 'all',
        label: 'Full structure (83 nodes)',
        nodeNames: [...INSIGHT_ALL_NODES],
        documentedSpec:
          'Launch mass ~358 kg (lander only); span ~6.0 m with both Ultraflex arrays deployed on Elysium Planitia.',
        sourceRef: 'NASA InSight Spacecraft Fact Sheet',
        limitationNote:
          'Displays all 83 nodes in their post-landing deployed configuration; normalized with fit-longest-side-2.',
        isControlVerified: true,
      },
      {
        id: 'robotic_arm',
        label: 'IDA arm and IDC camera',
        nodeNames: [...INSIGHT_ARM_NODES],
        documentedSpec:
          'The ~1.8 m robotic arm (4 degrees of freedom) carries the IDC color camera, lens cap (lens_cap_IDC), and soil scoop (shovel).',
        sourceRef: 'NASA JPL InSight Robotic Arm Overview',
        limitationNote:
          'Static in the normalized GLB version; shoulder and elbow pivots are not calibrated for each segment, so no arbitrary joint animation is added.',
        isControlVerified: false,
      },
      {
        id: 'grapple_claw',
        label: 'Five-finger grapple',
        nodeNames: [...INSIGHT_GRAPPLE_NODES],
        documentedSpec:
          'The passive five-finger grapple (grapple, claw_01–claw_05) was used to place the SEIS seismometer and HP³ heat probe on the surface.',
        sourceRef: 'NASA InSight Instrument Deployment System',
        limitationNote:
          'Remains static; the winch cable and tether extension are not separate from the grapple node.',
        isControlVerified: false,
      },
      {
        id: 'solar_wings',
        label: 'Two Ultraflex solar arrays',
        nodeNames: [...INSIGHT_PANEL_LEFT_NODES, ...INSIGHT_PANEL_RIGHT_NODES],
        documentedSpec:
          'Two deployed, 10-sided disk-shaped solar arrays, each ~2.15 m in diameter, with a combined design output of hundreds of watts at midday.',
        sourceRef: 'NASA InSight Launch Press Kit (Solar Arrays)',
        limitationNote:
          'Consists of 68 fan-rib and strut nodes in the fully deployed state; actual dust accumulation over sols is not simulated.',
        isControlVerified: false,
      },
      {
        id: 'lander_deck',
        label: 'Lander deck and main antenna',
        nodeNames: ['InSight_Deployed'],
        documentedSpec:
          'The Phoenix-derived three-legged lander body carries the SEIS seismometer, TWINS weather sensors, and RISE system.',
        sourceRef: 'NASA InSight Spacecraft Design · Lockheed Martin',
        limitationNote:
          'The entire deck, three-legged frame, and antenna are combined into one static InSight_Deployed node in the GLB.',
        isControlVerified: false,
      },
    ],
    sources: [
      {
        title: 'NASA Science · InSight Mars Lander',
        url: 'https://science.nasa.gov/mission/insight/',
        checked: '2026-11-14',
        version: 'Supplied NASA 3D Resource GLB (83 nodes)',
      },
    ],
  },
  perseverance_rover: {
    deviceId: 'perseverance_rover',
    modelVersion: '1.0.0 (NASA/JPL-Caltech 25042_Perseverance.glb · fit-longest-side-2 · 66 nodes)',
    generalDisclaimer:
      'Camera presets and subsystem highlights reflect the verified 66-node official NASA/JPL-Caltech Perseverance GLB hierarchy normalized to 2 scene units. Robotic arm joints, mast pan/tilt, and Control Room scans are static/illustrative.',
    cameraViews: [
      {
        id: 'overview',
        label: '3/4 Rover Overview',
        position: [2.15, 1.15, 2.25],
        target: [0, 0.05, 0],
        summary:
          'Overview of all 66 NASA Perseverance mesh nodes: rocker-bogie chassis, extended 2.1 m sampling arm, Remote Sensing Mast, and aft MMRTG power unit.',
        sourceRef: 'NASA Mars 2020 Launch Press Kit & NASA 3D Resource GLB',
        isIllustrativeView: true,
      },
      {
        id: 'mastcam_supercam',
        label: 'Mastcam-Z & SuperCam Head',
        position: [-1.05, 0.92, 1.15],
        target: [-0.26, 0.52, 0.36],
        summary:
          'Close inspection of the Remote Sensing Mast head carrying dual Mastcam-Z zoom cameras, SuperCam laser optics, NavCams, MEDA wind boom, and microphone.',
        sourceRef: 'NASA Mars 2020 Rover Components & Perseverance GLB',
        isIllustrativeView: true,
      },
      {
        id: 'arm_pixl_turret',
        label: '2.1 m Arm & PIXL/WATSON Turret',
        position: [0.85, 0.35, 1.65],
        target: [0.08, -0.02, 0.68],
        summary:
          'Front close-up of the rotary-percussive coring drill, PIXL X-ray spectrometer, WATSON macro camera, and 5-DOF articulated arm harness.',
        sourceRef: 'NASA Mars 2020 Sampling & Caching System Overview',
        isIllustrativeView: true,
      },
      {
        id: 'aft_rtg_rimfax',
        label: 'Aft MMRTG & RIMFAX Radar',
        position: [-1.45, 0.62, -1.55],
        target: [0, 0.02, -0.62],
        summary:
          'Rear view highlighting the Multi-Mission Radioisotope Thermoelectric Generator (MMRTG), RIMFAX ground-penetrating radar antenna, UHF/X-band dishes, and Send Your Name plaque.',
        sourceRef: 'NASA Mars 2020 Power & Communications Fact Sheet',
        isIllustrativeView: true,
      },
    ],
    partGroups: [
      {
        id: 'all',
        label: 'Complete Rover Assembly (66 nodes)',
        nodeNames: [...PERSEVERANCE_ALL_NODES],
        documentedSpec:
          'Launch mass 1,025 kg (dimensions ~3.0 m × 2.7 m × 2.2 m); car-sized Mars 2020 astrobiology and core-caching flagship rover.',
        sourceRef: 'NASA Mars 2020 Launch Press Kit',
        limitationNote:
          'Displays all 66 named nodes of official NASA 25042_Perseverance.glb in extended sampling configuration, normalized via fit-longest-side-2.',
        isControlVerified: true,
      },
      {
        id: 'optics_mast',
        label: 'Remote Sensing Mast & Cameras (17)',
        nodeNames: [...PERSEVERANCE_MAST_OPTICS_NODES],
        documentedSpec:
          'Includes Mastcam-Z stereo zoom imagers, SuperCam LIBS/Raman head (lens), NavCams, EDL Up/Down Look cameras, MEDA probes, and calibration targets.',
        sourceRef: 'NASA Mars 2020 Science Instruments',
        limitationNote:
          'Isolates optical mast and camera assemblies statically; mast pan/tilt actuators are not animated in close-up inspection mode.',
        isControlVerified: false,
      },
      {
        id: 'robotic_arm',
        label: 'Sampling Arm, Turret & Belly Bay (25)',
        nodeNames: [...PERSEVERANCE_ARM_TURRET_NODES],
        documentedSpec:
          '2.1 m 5-axis robotic arm carrying a ~45 kg turret with rotary-percussive coring drill, PIXL, and WATSON, plus under-chassis sample/helicopter bay hardware.',
        sourceRef: 'NASA Mars 2020 Turret & Sample Caching System',
        limitationNote:
          'Turret and arm nodes remain at nominal deployed pose in close-up mode; illustrative arm reach/scan previews live under Explore viewpoints (Control Room POV).',
        isControlVerified: false,
      },
      {
        id: 'mobility_chassis',
        label: 'Rocker-Bogie Chassis & Hazcams (17)',
        nodeNames: [...PERSEVERANCE_CHASSIS_MOBILITY_NODES],
        documentedSpec:
          'Titanium rocker-bogie suspension with six 52.5 cm strengthened aluminum curved-grouser wheels, avionics body, MOXIE/ACA bay, and front/rear Hazcams.',
        sourceRef: 'NASA Mars 2020 Mobility & Chassis Architecture',
        limitationNote:
          'Wheels and suspension links are rigid mesh nodes; terrain-following suspension compliance and wheel odometry are not simulated.',
        isControlVerified: false,
      },
      {
        id: 'power_thermal',
        label: 'MMRTG, Antennas & RIMFAX (7)',
        nodeNames: [...PERSEVERANCE_POWER_COMMS_NODES],
        documentedSpec:
          'Pu-238 MMRTG (~110 W initial electric), High-Gain/Low-Gain/UHF antennas, rear bumper RIMFAX subsurface radar, and belly shield panel.',
        sourceRef: 'NASA Mars 2020 Power & Telecommunications',
        limitationNote:
          'Static hardware highlight only; no real-time thermal wattage or radar sounder telemetry is attached to this 3D mesh.',
        isControlVerified: false,
      },
    ],
    sources: [
      {
        title: 'NASA 3D Resources · Mars Perseverance Rover 3D Model',
        url: 'https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/',
        checked: '2026-11-14',
        version: '25042_Perseverance.glb (66 nodes)',
      },
      {
        title: 'NASA Mars 2020 Provenance Notes',
        url: '/assets/provenance/mars-rovers.csv',
        checked: '2026-11-14',
        version: 'Landing coordinates & Mars 2020 press kit cross-check',
      },
    ],
  },
  curiosity_rover: {
    deviceId: 'curiosity_rover',
    modelVersion: '1.0.0 (NASA/JPL-Caltech 24584_Curiosity_static.glb · fit-longest-side-2 · 1 MSL node)',
    generalDisclaimer:
      'Rendered from the official NASA/JPL-Caltech static Curiosity GLB (single unified MSL node). Camera views frame external instruments illustratively; individual subsystems cannot be isolated or articulated.',
    cameraViews: [
      {
        id: 'overview',
        label: '3/4 Rover Overview',
        position: [2.2, 1.18, 2.2],
        target: [0, 0.02, 0],
        summary:
          'Full 3/4 view of Curiosity (Mars Science Laboratory) showing the 6-wheel rocker-bogie suspension, robotic arm, camera mast, and aft MMRTG.',
        sourceRef: 'NASA Mars Science Laboratory Launch Press Kit & 24584_Curiosity_static.glb',
        isIllustrativeView: true,
      },
      {
        id: 'chemcam_mast',
        label: 'ChemCam & Mastcam Head',
        position: [-0.95, 0.95, 1.25],
        target: [-0.15, 0.48, 0.35],
        summary:
          'Close view of the Remote Sensing Mast head carrying ChemCam laser-induced breakdown spectrometer, Mastcam stereo cameras, and Navcams.',
        sourceRef: 'NASA MSL ChemCam & Mastcam Instrument Fact Sheet',
        isIllustrativeView: true,
      },
      {
        id: 'mahli_turret',
        label: 'Sampling Arm & MAHLI Turret',
        position: [0.95, 0.32, 1.68],
        target: [0.05, -0.05, 0.65],
        summary:
          'Close inspection of the 2.1 m forward robotic arm holding APXS, MAHLI hand lens imager, CHIMRA scoop/sieve, and rotary-percussive drill.',
        sourceRef: 'NASA MSL Sample Acquisition & Turret Guide',
        isIllustrativeView: true,
      },
      {
        id: 'rtg_aft',
        label: 'Aft MMRTG & High-Gain Dish',
        position: [-1.5, 0.65, -1.6],
        target: [0, 0.05, -0.62],
        summary:
          'Rear deck view showcasing the diagonally canted Pu-238 MMRTG radiator fins, high-gain X-band dish antenna, and UHF whip antenna.',
        sourceRef: 'NASA MSL Power & Communications Overview',
        isIllustrativeView: true,
      },
    ],
    partGroups: [
      {
        id: 'all',
        label: 'Complete Static MSL Mesh (1 node)',
        nodeNames: [...CURIOSITY_ALL_NODES],
        documentedSpec:
          'Launch mass 899 kg (dimensions ~3.0 m × 2.7 m × 2.2 m); nuclear-powered Mars Science Laboratory laboratory rover operating in Gale Crater since 2012.',
        sourceRef: 'NASA MSL Fact Sheet & NASA 3D Resources (24584_Curiosity_static.glb)',
        limitationNote:
          'The official NASA static GLB merges all rover structures into a single node (`MSL`), so individual subsystems cannot be isolated in 3D highlight mode.',
        isControlVerified: true,
      },
    ],
    sources: [
      {
        title: 'NASA 3D Resources · Curiosity Rover 3D Model (MSL)',
        url: 'https://science.nasa.gov/resource/curiosity-rover-3d-model/',
        checked: '2026-11-14',
        version: '24584_Curiosity_static.glb (static unified MSL mesh)',
      },
      {
        title: 'NASA MSL Provenance Notes',
        url: '/assets/provenance/mars-rovers.csv',
        checked: '2026-11-14',
        version: 'Gale Crater landing coordinates & MSL instrument cross-check',
      },
    ],
  },
};

export function getDeviceControlSpec(deviceId: string | null): DeviceControlSpec | null {
  if (!deviceId) return null;
  return DEVICE_CONTROL_SPECS[deviceId] ?? null;
}

export function getPartGroupSpec(
  spec: DeviceControlSpec,
  groupId: DevicePartGroupId,
) {
  return spec.partGroups.find((group) => group.id === groupId) ?? spec.partGroups[0];
}
