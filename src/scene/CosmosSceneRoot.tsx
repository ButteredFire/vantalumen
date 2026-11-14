import type React from 'react';
import type * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { BODY_CATALOG } from '../config/bodyCatalog';
import { DEVICE_CATALOG } from '../config/deviceCatalog';
import { useCosmosStore } from '../store/useCosmosStore';
import { DeepSpaceStarfield } from './environment/DeepSpaceStarfield';
import { SunLightSource } from './environment/SunLightSource';
import { MarsPlanetGroup } from './mars/MarsPlanetGroup';
import { PlanetaryOrbitContext } from './mars/PlanetaryOrbitContext';
import { ControlRoomFirstPersonScene } from './spacecraft/ControlRoomFirstPersonScene';
import { DeviceModel } from './spacecraft/DeviceModel';
import { OrbitalFleet } from './spacecraft/OrbitalFleet';
import { OrbitalGlbModel } from './common/OrbitalGlbModel';
import { ProceduralDeviceModel } from './spacecraft/ProceduralDeviceModel';
import { OpeningShipScene } from './opening/OpeningShipScene';
import { MarsTerrainPatch } from './surface/MarsTerrainPatch';

function DeviceInspectionLighting() {
  return (
    <>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#e8f4ff', '#30384a', 1.1]} />
      <directionalLight position={[4, 7, 5]} intensity={2.8} color="#fff3df" />
      <directionalLight position={[-5, 3, -4]} intensity={1.5} color="#b4ddff" />
      <Environment preset="studio" environmentIntensity={0.65} />
    </>
  );
}

export function CosmosSceneRoot({
  sunLightRef,
}: {
  sunLightRef: React.RefObject<THREE.DirectionalLight | null>;
}) {
  const bodyId = useCosmosStore((state) => state.activeBodyId);
  const deviceId = useCosmosStore((state) => state.activeDeviceId);
  const activeTarget = useCosmosStore((state) => state.activeTarget);
  const inspectionMode = useCosmosStore((state) => state.inspectionMode);
  const orbitalCloseup = useCosmosStore((state) => state.orbitalCloseup);
  const spectralMode = useCosmosStore((state) => state.spectralMode);

  const device = DEVICE_CATALOG.find((item) => item.id === deviceId);
  const hasPovSelection = Boolean(device) || Boolean(activeTarget);
  const isControlRoomPov = inspectionMode === 'CONTROL_ROOM_POV' && hasPovSelection;
  const isAvailableDevice = device?.status === 'available';
  const isProceduralDevice =
    device?.status === 'unavailable' && Boolean(device.proceduralModel);
  const isTerrainShowcase =
    spectralMode === 'TERRAIN_MESH_3D' &&
    !device &&
    (!activeTarget || activeTarget.category === 'SURFACE_POI');
  const isOrbitalCloseup =
    !device &&
    Boolean(activeTarget?.modelPath) &&
    orbitalCloseup &&
    inspectionMode === 'MODEL_CLOSEUP';

  if (isControlRoomPov) {
    return <ControlRoomFirstPersonScene />;
  }

  if (isAvailableDevice && device) {
    return (
      <group>
        <DeviceInspectionLighting />
        <DeviceModel key={device.id} device={device} />
      </group>
    );
  }

  if (isProceduralDevice && device) {
    return (
      <group>
        <DeviceInspectionLighting />
        <ProceduralDeviceModel
          key={device.id}
          kind={device.proceduralModel ?? 'mars_rover_rtg'}
          deviceId={device.id}
          name={device.name}
        />
      </group>
    );
  }

  if (isTerrainShowcase) {
    return (
      <group>
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 14, 8]} intensity={2.1} color="#fff2e2" />
        <directionalLight position={[-8, 4, -8]} intensity={0.55} color="#7dd3fc" />
        <DeepSpaceStarfield />
        <MarsTerrainPatch
          key={`${bodyId}-${activeTarget?.id ?? 'surface'}`}
          bodyId={bodyId}
          locationKey={activeTarget?.id ?? bodyId}
          footprintWidth={14}
          heightScale={1.0}
          spectralMode="TERRAIN_MESH_3D"
        />
      </group>
    );
  }

  if (isOrbitalCloseup && activeTarget?.modelPath) {
    return (
      <group>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.85} />
        <directionalLight position={[-3, 1, -2]} intensity={0.8} />
        <OrbitalGlbModel
          key={activeTarget.id}
          targetId={activeTarget.id}
          modelPath={activeTarget.modelPath}
          visualRadius={1}
          spinAxisYRate={0.14}
          reportToStore
        />
      </group>
    );
  }

  return (
    <group>
      <SunLightSource sunLightRef={sunLightRef} />
      <DeepSpaceStarfield />
      <OpeningShipScene />
      <PlanetaryOrbitContext body={BODY_CATALOG[bodyId]} />
      <MarsPlanetGroup key={bodyId} body={BODY_CATALOG[bodyId]} />
      <OrbitalFleet />
    </group>
  );
}
