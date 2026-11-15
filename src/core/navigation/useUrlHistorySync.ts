import { useEffect, useRef } from 'react';
import { parseUrlState, serializeUrlState } from '../../config/urlStateAdapter';
import { useCosmosStore } from '../../store/useCosmosStore';

const SETTLED_STAGES = new Set([
  'ORBITAL_OVERVIEW',
  'SUB_SCENE',
  'SURFACE_VIEW',
  'SURFACE_CESIUM',
]);

function getUrlSearchFromStore(): string {
  const s = useCosmosStore.getState();
  return serializeUrlState({
    bodyId: s.activeBodyId,
    mode: s.explorationMode,
    missionId: s.activeMissionId,
    stopId: s.activeStopId,
    activeTarget: s.activeTarget,
    activeDeviceId: s.activeDeviceId,
    spectralMode: s.spectralMode,
    viewStage: s.viewStage,
    inspectionMode: s.inspectionMode,
  });
}

function getNavSignature(): string {
  const s = useCosmosStore.getState();
  return [
    s.viewStage,
    s.activeBodyId,
    s.explorationMode,
    s.activeMissionId,
    s.activeStopId,
    s.activeTarget?.id ?? '',
    s.activeDeviceId ?? '',
    s.spectralMode,
    s.inspectionMode,
  ].join('|');
}

export function useUrlHistorySync(): void {
  const isApplyingExternalUrlRef = useRef(false);
  const lastCommittedSearchRef = useRef('');
  const wasPrelaunchRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialParsed = parseUrlState(window.location.search);
    if (initialParsed.hasExplicitParams) {
      isApplyingExternalUrlRef.current = true;
      useCosmosStore.getState().applyUrlState(initialParsed, { skipPreloader: true });
      const canonicalSearch = getUrlSearchFromStore();
      if (canonicalSearch !== window.location.search) {
        window.history.replaceState(null, '', `${window.location.pathname}${canonicalSearch}`);
      }
      lastCommittedSearchRef.current = canonicalSearch;
      wasPrelaunchRef.current = false;
      isApplyingExternalUrlRef.current = false;
    } else {
      lastCommittedSearchRef.current = window.location.search;
      const stage = useCosmosStore.getState().viewStage;
      wasPrelaunchRef.current = stage === 'PRELOADING' || stage === 'LAUNCHING';
    }

    let previousSignature = getNavSignature();

    const unsubscribe = useCosmosStore.subscribe(() => {
      const state = useCosmosStore.getState();
      if (state.viewStage === 'PRELOADING' || state.viewStage === 'LAUNCHING') {
        wasPrelaunchRef.current = true;
        return;
      }

      const nextSignature = getNavSignature();
      if (nextSignature === previousSignature) {
        return;
      }
      previousSignature = nextSignature;

      if (isApplyingExternalUrlRef.current || !SETTLED_STAGES.has(state.viewStage)) {
        return;
      }

      const nextSearch = getUrlSearchFromStore();
      const targetUrl = `${window.location.pathname}${nextSearch}`;

      if (wasPrelaunchRef.current) {
        wasPrelaunchRef.current = false;
        lastCommittedSearchRef.current = nextSearch;
        if (window.location.search !== nextSearch) {
          window.history.replaceState(null, '', targetUrl);
        }
        return;
      }

      if (nextSearch !== lastCommittedSearchRef.current && nextSearch !== window.location.search) {
        lastCommittedSearchRef.current = nextSearch;
        window.history.pushState(null, '', targetUrl);
      }
    });

    const handlePopState = () => {
      const parsed = parseUrlState(window.location.search);
      isApplyingExternalUrlRef.current = true;
      wasPrelaunchRef.current = false;
      useCosmosStore.getState().applyUrlState(parsed, { skipPreloader: true });
      previousSignature = getNavSignature();
      lastCommittedSearchRef.current = window.location.search;
      isApplyingExternalUrlRef.current = false;
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}
