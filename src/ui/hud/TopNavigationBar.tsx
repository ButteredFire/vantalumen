import { BODY_CATALOG } from '../../config/bodyCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import {
  classifyDeviceStatus,
  classifyTargetStatus,
  getVisitorNavDescription,
} from '../../config/statusVocabulary';
import { useCosmosStore } from '../../store/useCosmosStore';
import { spatialAudio } from '../../core/audio/SpatialAudioEngine';

export function TopNavigationBar() {
  const bodyId = useCosmosStore((state) => state.activeBodyId);
  const deviceId = useCosmosStore((state) => state.activeDeviceId);
  const activeTarget = useCosmosStore((state) => state.activeTarget);
  const assetLoad = useCosmosStore((state) => state.assetLoad);
  const selectBody = useCosmosStore((state) => state.selectBody);
  const muted = useCosmosStore((state) => state.audioMuted);
  const toggleAudio = useCosmosStore((state) => state.toggleAudio);
  const device = DEVICE_CATALOG.find((item) => item.id === deviceId);
  const statusSummary = device
    ? classifyDeviceStatus(device, assetLoad)
    : classifyTargetStatus(activeTarget ?? BODY_CATALOG[bodyId].target);
  const subtitle = `${statusSummary.missionRelationshipLabel} · ${getVisitorNavDescription(statusSummary.representation)}`;
  return <header className="hud-top-bar glass-panel">
    <div className="hud-brand-block"><div className="hud-brand-dot" /><div>
      <div className="hud-brand-eyebrow">3D ATLAS · SPACE EXPLORATION</div>
      <h1 className="hud-brand-title">{BODY_CATALOG[bodyId].name}</h1>
      <small>{subtitle}</small>
    </div></div>
    <nav aria-label="Select a celestial body" className="body-selector">
      {Object.values(BODY_CATALOG).map((body) => <button key={body.id}
        aria-pressed={body.id === bodyId} className={'hud-action-btn ' + (body.id === bodyId ? 'is-active' : '')}
        onClick={() => selectBody(body.id, { animate: true })}>{body.name}</button>)}
    </nav>
    <button className="audio-toggle-btn" onClick={() => {
      spatialAudio.setMuted(!muted); spatialAudio.initAndStart(); toggleAudio();
    }}>{muted ? 'Turn sound on' : 'Turn sound off'}</button>
  </header>;
}
