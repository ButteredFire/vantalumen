import React from 'react';
import { BODY_CATALOG } from '../../config/bodyCatalog';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { classifyDeviceStatus, classifyTargetStatus } from '../../config/statusVocabulary';
import { useCosmosStore } from '../../store/useCosmosStore';
import type { RendererFailureState } from '../../types/cosmos.types';

interface CanvasErrorBoundaryProps {
  resetKey: string | number;
  surface: 'orbital' | 'surface_terrain';
  onCatchError: (error: Error) => void;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

export class CanvasErrorBoundary extends React.Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: CanvasErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Atlas ${this.props.surface} Canvas Error]`, error, info.componentStack);
    this.props.onCatchError(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const FAILURE_TITLES: Record<RendererFailureState['kind'], string> = {
  'webgl-unavailable': 'WebGL is unavailable in the current browser / GPU',
  'context-lost': 'WebGL context lost',
  'shader-error': '3D shader compilation or linking failed',
  'postprocessing-error': 'Graphics post-processing failed — switched to basic mode',
  'render-error': '3D scene rendering failed',
};

interface CanvasFallbackPanelProps {
  failure: RendererFailureState;
  surface: 'orbital' | 'surface_terrain';
  compact?: boolean;
  onRetry: () => void;
  onEnableBasicMode?: () => void;
  onDismissTextMode?: () => void;
  onReturnToOrbit?: () => void;
}

export const CanvasFallbackPanel: React.FC<CanvasFallbackPanelProps> = ({
  failure,
  surface,
  compact = false,
  onRetry,
  onEnableBasicMode,
  onDismissTextMode,
  onReturnToOrbit,
}) => {
  const activeBodyId = useCosmosStore((s) => s.activeBodyId);
  const activeTarget = useCosmosStore((s) => s.activeTarget);
  const activeDeviceId = useCosmosStore((s) => s.activeDeviceId);
  const rendererBasicMode = useCosmosStore((s) => s.rendererBasicMode);
  const assetLoad = useCosmosStore((s) => s.assetLoad);

  const body = BODY_CATALOG[activeBodyId];
  const device = activeDeviceId
    ? DEVICE_CATALOG.find((item) => item.id === activeDeviceId) ?? null
    : null;
  const target = activeTarget ?? body.target;
  const statusInfo = device
    ? classifyDeviceStatus(device, assetLoad)
    : classifyTargetStatus(target);

  const title = FAILURE_TITLES[failure.kind];
  const summaryText = device ? device.summary : target.telemetry.missionSummary;
  const creditText = device ? device.credit : target.credit ?? body.credit;
  const source = device ? device.source : target.source ?? body.source;
  const coords = device?.coordinates ?? target.coordinates;

  if (compact) {
    return (
      <div
        className="renderer-status-banner glass-panel"
        role="status"
        aria-live="polite"
        data-testid="renderer-status-banner"
      >
        <div className="renderer-status-copy">
          <strong>Text &amp; records mode (3D temporarily disabled)</strong>
          <span>{title}</span>
        </div>
        <div className="renderer-fallback-actions">
          <button
            type="button"
            className="pov-chip-btn"
            data-testid="renderer-retry-btn"
            onClick={onRetry}
          >
            Try enabling 3D again
          </button>
          {!rendererBasicMode && failure.kind !== 'webgl-unavailable' && onEnableBasicMode && (
            <button
              type="button"
              className="pov-chip-btn"
              data-testid="renderer-basic-mode-btn"
              onClick={onEnableBasicMode}
            >
              Basic 3D mode
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`renderer-fallback-panel glass-panel ${
        surface === 'surface_terrain' ? 'is-surface-fallback' : ''
      }`}
      role="alert"
      data-testid="renderer-fallback-panel"
    >
      <div className="renderer-fallback-eyebrow">
        SAFE MODE · {surface === 'surface_terrain' ? '3D SURFACE' : 'ORBITAL OVERVIEW'}
      </div>
      <h2 className="renderer-fallback-title">{title}</h2>
      <p className="renderer-fallback-message">{failure.message}</p>
      {failure.detail && <p className="renderer-fallback-detail">{failure.detail}</p>}

      <div className="renderer-fallback-dossier" data-testid="renderer-fallback-context">
        <div className="renderer-fallback-context-head">
          <strong>{device ? device.name : target.name}</strong>
          <span className="status-badge status-badge-relationship">
            {statusInfo.missionRelationshipLabel}
          </span>
          <span className="status-badge status-badge-representation">
            {statusInfo.representationLabel}
          </span>
        </div>
        <p>{summaryText}</p>
        {coords && (
          <p className="coordinates-strip">
            Reference coordinates: {coords.lat.toFixed(2)}° · {coords.lon.toFixed(2)}°E
          </p>
        )}
        <p className="source-note">
          <strong>Credit:</strong> {creditText} ·{' '}
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.title} ({source.version})
          </a>
        </p>
      </div>

      <div className="renderer-fallback-actions">
        {failure.recoverable && (
          <button
            type="button"
            className="hud-action-btn primary-btn"
            data-testid="renderer-retry-btn"
            onClick={onRetry}
          >
            Try initializing 3D again
          </button>
        )}
        {!rendererBasicMode && failure.kind !== 'webgl-unavailable' && onEnableBasicMode && (
          <button
            type="button"
            className="hud-action-btn"
            data-testid="renderer-basic-mode-btn"
            onClick={onEnableBasicMode}
          >
            Basic 3D mode
          </button>
        )}
        {onReturnToOrbit && (
          <button
            type="button"
            className="hud-action-btn secondary-btn"
            data-testid="renderer-return-orbit-btn"
            onClick={onReturnToOrbit}
          >
            Return to overview
          </button>
        )}
        {onDismissTextMode && (
          <button
            type="button"
            className="hud-action-btn secondary-btn"
            data-testid="renderer-text-mode-btn"
            onClick={onDismissTextMode}
          >
            Collapse notice · Continue viewing records &amp; sources
          </button>
        )}
      </div>
    </section>
  );
};
