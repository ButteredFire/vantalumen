import { MarsCanvas } from './core/canvas/MarsCanvas';
import { MarsSurfaceTerrainView } from './scene/surface/MarsSurfaceTerrainView';
import { ImmersivePreloader } from './ui/preloader/ImmersivePreloader';
import { TopNavigationBar } from './ui/hud/TopNavigationBar';
import { CelestialQuickSelect } from './ui/hud/CelestialQuickSelect';
import { SubSceneInfoPanel } from './ui/hud/SubSceneInfoPanel';
import { TimeScrubberBar } from './ui/hud/TimeScrubberBar';
import { ControlRoomHudOverlay } from './ui/hud/ControlRoomHudOverlay';
import { InspectionTransitionOverlay } from './ui/surface/InspectionTransitionOverlay';
import {
    validateCatalog,
    validateDeviceControlSpecs,
    validateSimulationProfiles,
} from './config/validateCatalog';
import { BODY_CATALOG } from './config/bodyCatalog';
import { BODY_PHYSICS_CONFIG } from './config/bodyPhysicsConfig';
import { ATLAS_POIS } from './config/atlasPOIs';
import { ORBITAL_ACTORS_CATALOG } from './config/celestialCatalog';
import { DEVICE_CATALOG } from './config/deviceCatalog';
import { DEVICE_CONTROL_SPECS } from './config/deviceControlSpecs';
import { DEVICE_SIMULATION_PROFILES } from './config/deviceSimulationProfiles';
import { useCosmosStore } from './store/useCosmosStore';

validateCatalog(Object.values(BODY_CATALOG), ATLAS_POIS, DEVICE_CATALOG);
validateDeviceControlSpecs(DEVICE_CATALOG, DEVICE_CONTROL_SPECS);
validateSimulationProfiles(
    Object.values(BODY_CATALOG),
    DEVICE_CATALOG,
    ORBITAL_ACTORS_CATALOG,
    BODY_PHYSICS_CONFIG,
    DEVICE_SIMULATION_PROFILES,
);

function App() {
    const viewStage = useCosmosStore((state) => state.viewStage);
    const showOrbitalHud =
        viewStage !== 'PRELOADING' &&
        viewStage !== 'LAUNCHING' &&
        viewStage !== 'BODY_TRANSITION' &&
        viewStage !== 'SURFACE_VIEW' &&
        viewStage !== 'SURFACE_CESIUM';
    const isAlphaJumpStage =
        viewStage === 'PRELOADING' ||
        viewStage === 'LAUNCHING' ||
        viewStage === 'BODY_TRANSITION';

    return (
        <div className={`cosmos-app-root atlas-release ${isAlphaJumpStage ? 'is-alpha-jump' : ''}`}>
            {/* Layer 1: 3D Deep Space & Orbital Globe (Three.js + R3F + 4-Tier LOD) */}
            <MarsCanvas />

            {/* Layer 2: 3D Planetary Surface Terrain Environment (Generalized for Mars & Lunar) */}
            <MarsSurfaceTerrainView />
            <InspectionTransitionOverlay />

            {/* Layer 3: Cockpit Preloader, POV HUD, Control Systems & Navigation Panels */}
            <ImmersivePreloader />
            {showOrbitalHud && (
                <>
                    <ControlRoomHudOverlay />
                    <TopNavigationBar />
                    <CelestialQuickSelect />
                    <SubSceneInfoPanel />
                    <TimeScrubberBar />
                </>
            )}
        </div>
    );
}

export default App;
