import React from 'react';
import { surfaceAudio } from '../../core/audio/SurfaceAudioController';
import type { BodyId, SurfaceEquipmentItem } from '../../types/cosmos.types';

interface SurfaceHeaderBannerProps {
    bodyId: BodyId;
    selectedEquipment: SurfaceEquipmentItem | null;
    onReturnToOrbit: () => void;
}

export const SurfaceHeaderBanner: React.FC<SurfaceHeaderBannerProps> = ({
    bodyId,
    selectedEquipment,
    onReturnToOrbit,
}) => {
    const isMoon = bodyId === 'moon';

    const handleReturn = () => {
        surfaceAudio.playCollapse();
        onReturnToOrbit();
    };

    return (
        <header className="surface-header-bar glass-panel" aria-label="Planetary Surface Mission Header">
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
                    <span className="telemetry-tag">
                        {isMoon
                            ? 'PROJECT VANTALUMEN • LUNAR SURFACE ATLAS'
                            : 'PROJECT VANTALUMEN • MARTIAN SURFACE ATLAS'}
                    </span>
                    <h1 className="surface-site-heading">
                        {isMoon
                            ? 'MARE TRANQUILLITATIS & LUNAR BASIN'
                            : 'ISIDIS PLANITIA & EXPEDITION BASIN'}
                    </h1>
                </div>
            </div>

            <div className="surface-environmental-telemetry">
                <div className="surface-telemetry-item">
                    <span className="telemetry-label">ATMOSPHERE</span>
                    <strong className="telemetry-val">
                        {isMoon ? '≈3×10⁻¹⁰ Pa • ULTRA-HIGH VACUUM' : '95.3% CO₂ • 740 Pa'}
                    </strong>
                </div>
                <div className="surface-telemetry-item">
                    <span className="telemetry-label">SURFACE TEMP</span>
                    <strong className="telemetry-val">
                        {isMoon ? '-130 °C to +120 °C' : '-60 °C (-76 °F)'}
                    </strong>
                </div>
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
