import React from 'react';
import { surfaceAudio } from '../../core/audio/SurfaceAudioController';
import type { SurfaceEquipmentItem } from '../../types/cosmos.types';
import type { BodyId } from '../../types/cosmos.types';

interface SurfaceHeaderBannerProps {
    bodyId: BodyId;
    selectedEquipment: SurfaceEquipmentItem | null;
    onReturnToOrbit: () => void;
}

const BODY_LABELS: Record<BodyId, { title: string; site: string }> = {
    mars: { title: 'MARTIAN SURFACE ATLAS', site: 'MARS SURFACE' },
    moon: { title: 'LUNAR SURFACE ATLAS', site: 'MOON SURFACE' },
};

export const SurfaceHeaderBanner: React.FC<SurfaceHeaderBannerProps> = ({
    bodyId,
    selectedEquipment,
    onReturnToOrbit,
}) => {
    const handleReturn = () => {
        surfaceAudio.playCollapse();
        onReturnToOrbit();
    };

    const labels = BODY_LABELS[bodyId] ?? BODY_LABELS.mars;

    return (
        <header className="surface-header-bar glass-panel" aria-label="Surface Mission Header">
            <div className="surface-brand-group">
                <img
                    src="/vantalumen.png"
                    alt="Project VantaLumen"
                    className="surface-brand-avatar"
                    onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                    }}
                />
                <div className="surface-brand-info">
                    <span className="telemetry-tag">PROJECT VANTALUMEN • {labels.title}</span>
                    <h1 className="surface-site-heading">
                        {selectedEquipment ? selectedEquipment.name.toUpperCase() : labels.site}
                    </h1>
                </div>
            </div>

            <div className="surface-environmental-telemetry">
                {bodyId === 'mars' && (
                    <>
                        <div className="surface-telemetry-item">
                            <span className="telemetry-label">ATMOSPHERE</span>
                            <strong className="telemetry-val">95.3% CO₂ • 740 Pa</strong>
                        </div>
                        <div className="surface-telemetry-item">
                            <span className="telemetry-label">SURFACE TEMP</span>
                            <strong className="telemetry-val">-60 °C (avg)</strong>
                        </div>
                    </>
                )}
                {bodyId === 'moon' && (
                    <>
                        <div className="surface-telemetry-item">
                            <span className="telemetry-label">ATMOSPHERE</span>
                            <strong className="telemetry-val">≈3×10⁻¹⁰ Pa (exosphere)</strong>
                        </div>
                        <div className="surface-telemetry-item">
                            <span className="telemetry-label">SURFACE TEMP</span>
                            <strong className="telemetry-val">95–390 K (day/night)</strong>
                        </div>
                    </>
                )}
                <div className="surface-telemetry-item">
                    <span className="telemetry-label">TARGET ACQUISITION</span>
                    <strong className={`telemetry-val ${selectedEquipment ? 'is-locked' : 'is-standby'}`}>
                        {selectedEquipment ? selectedEquipment.name.toUpperCase() : 'AWAITING SELECTION...'}
                    </strong>
                </div>
            </div>

            <div className="surface-actions-group">
                <button
                    type="button"
                    onClick={handleReturn}
                    className="hud-action-btn return-orbit-btn"
                    onMouseEnter={() => surfaceAudio.playHover()}
                >
                    <span className="btn-icon">↑</span>
                    <span>Return to Orbit</span>
                </button>
            </div>
        </header>
    );
};
