import { MarsCanvas } from './core/canvas/MarsCanvas';
import { useUrlHistorySync } from './core/navigation/useUrlHistorySync';
import { MarsSurfaceTerrainView } from './scene/surface/MarsSurfaceTerrainView';
import { ImmersivePreloader } from './ui/preloader/ImmersivePreloader';
import { TopNavigationBar } from './ui/hud/TopNavigationBar';
import { MissionEntry } from './ui/hud/MissionEntry';
import { JourneyPanel } from './ui/hud/JourneyPanel';
import { CelestialQuickSelect } from './ui/hud/CelestialQuickSelect';
import { SubSceneInfoPanel } from './ui/hud/SubSceneInfoPanel';
import { TimeScrubberBar } from './ui/hud/TimeScrubberBar';
import { ControlRoomHudOverlay } from './ui/hud/ControlRoomHudOverlay';
import { ProjectChatWidget } from './ui/chat/ProjectChatWidget';
import { InspectionTransitionOverlay } from './ui/surface/InspectionTransitionOverlay';
import {
    validateCatalog,
    validateDeviceControlSpecs,
    validateOrbitalActors,
    validateSimulationProfiles,
} from './config/validateCatalog';
import { BODY_CATALOG } from './config/bodyCatalog';
import { BODY_PHYSICS_CONFIG } from './config/bodyPhysicsConfig';
import { ATLAS_POIS } from './config/atlasPOIs';
import { ORBITAL_ACTORS_CATALOG } from './config/celestialCatalog';
import { DEVICE_CATALOG } from './config/deviceCatalog';
import { DEVICE_CONTROL_SPECS } from './config/deviceControlSpecs';
import { DEVICE_SIMULATION_PROFILES } from './config/deviceSimulationProfiles';
import { validateMissions } from './config/missions';
import { useCosmosStore } from './store/useCosmosStore';

validateCatalog(Object.values(BODY_CATALOG), ATLAS_POIS, DEVICE_CATALOG);
validateOrbitalActors(Object.values(BODY_CATALOG), ORBITAL_ACTORS_CATALOG);
validateDeviceControlSpecs(DEVICE_CATALOG, DEVICE_CONTROL_SPECS);
validateSimulationProfiles(
    Object.values(BODY_CATALOG),
    DEVICE_CATALOG,
    ORBITAL_ACTORS_CATALOG,
    BODY_PHYSICS_CONFIG,
    DEVICE_SIMULATION_PROFILES,
);
validateMissions();

function App() {
    useUrlHistorySync();

    const viewStage = useCosmosStore((state) => state.viewStage);
    const urlNotice = useCosmosStore((state) => state.urlNotice);
    const dismissUrlNotice = useCosmosStore((state) => state.dismissUrlNotice);
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
            {urlNotice && (
                <div
                    className="url-validation-notice"
                    data-testid="url-validation-notice"
                    role="status"
                    aria-live="polite"
                >
                    <span>{urlNotice}</span>
                    <button
                        type="button"
                        className="url-validation-dismiss"
                        data-testid="dismiss-url-notice-btn"
                        onClick={dismissUrlNotice}
                    >
                        Close
                    </button>
                </div>
            )}

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
                    <aside
                        className="hud-left-dock glass-panel"
                        data-testid="left-task-panel"
                        aria-label="Journey and exploration catalog"
                    >
                        <MissionEntry />
                        <JourneyPanel />
                        <CelestialQuickSelect />
                    </aside>
                    <SubSceneInfoPanel />
                    <TimeScrubberBar />
                </>
            )}
            <ProjectChatWidget />
        </div>
    );
}

export default App;
