import { useEffect, useState } from 'react';
import { useCosmosStore } from '../../store/useCosmosStore';

const REVEAL_DURATION_MS = 850;

export function InspectionTransitionOverlay() {
    const activeTarget = useCosmosStore((state) => state.inspectionTransitionTarget);
    const [displayedTarget, setDisplayedTarget] = useState(activeTarget);
    const [isRevealing, setIsRevealing] = useState(false);

    useEffect(() => {
        if (activeTarget) {
            setDisplayedTarget(activeTarget);
            setIsRevealing(false);
            return;
        }

        if (!displayedTarget) return;

        setIsRevealing(true);
        const timer = window.setTimeout(() => {
            setDisplayedTarget(null);
            setIsRevealing(false);
        }, REVEAL_DURATION_MS);

        return () => window.clearTimeout(timer);
    }, [activeTarget, displayedTarget]);

    if (!displayedTarget) return null;

    return (
        <div
            className={`inspection-transition-overlay${isRevealing ? ' is-revealing' : ''}`}
            role="status"
            aria-live="assertive"
            aria-label={`Inspecting ${displayedTarget}`}
        >
            <div className="inspection-transition-grid" aria-hidden="true" />
            <div className="inspection-transition-content">
                <span className="inspection-transition-kicker">SURFACE ASSET ANALYSIS</span>
                <strong className="inspection-glitch-title" data-text={displayedTarget}>
                    {displayedTarget}
                </strong>
                <span className="inspection-transition-status">ESTABLISHING HOLOGRAPHIC LINK</span>
                <div className="inspection-scan-bars" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                </div>
                <span className="inspection-transition-coordinates" aria-hidden="true">
                    SYNCING TELEMETRY // DECRYPTING MODEL DATA
                </span>
            </div>
        </div>
    );
}
