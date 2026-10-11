import type {
  AppState,
  MultiCandidateAnalysis,
  PrecisionTier,
  TolerancePreset,
  ViewMode,
  SourceType,
} from './types.js';

/**
 * Creates the initial empty state of the application.
 * In this state, no claims, fake metrics, or recommendations are present.
 */
export function createInitialState(): AppState {
  return {
    phase: 'empty',
    sourceType: 'none',
    originalSvg: '',
    currentAnalysis: null,
    activeTier: null,
    activePreset: 'balanced',
    customTolerancePct: 1.0,
    activeViewMode: 'side-by-side',
    onionOpacity: 50,
  };
}

/**
 * Transition to an in-progress processing phase.
 * Stale analysis results and active tier recommendations are immediately purged.
 */
export function transitionToLoading(
  state: AppState,
  phase: 'parsing' | 'optimizing' | 'comparing',
  sourceType: SourceType,
  sourceName?: string,
  svgContent?: string
): AppState {
  return {
    ...state,
    phase,
    sourceType,
    sourceName,
    originalSvg: svgContent ?? state.originalSvg,
    errorMessage: undefined,
    // Stale results must be cleared immediately when loading new input
    currentAnalysis: null,
    activeTier: null,
  };
}

/**
 * Transition to error state.
 * Stale success metrics are completely cleared.
 */
export function transitionToError(
  state: AppState,
  errorMessage: string
): AppState {
  return {
    ...state,
    phase: 'error',
    errorMessage,
    // Stale results must never be retained on error
    currentAnalysis: null,
    activeTier: null,
  };
}

/**
 * Transition to success state when valid analysis completes.
 */
export function transitionToSuccess(
  state: AppState,
  analysis: MultiCandidateAnalysis,
  svgContent: string,
  sourceType: SourceType,
  sourceName?: string
): AppState {
  return {
    ...state,
    phase: 'success',
    originalSvg: svgContent,
    sourceType,
    sourceName: sourceName ?? state.sourceName,
    errorMessage: undefined,
    currentAnalysis: analysis,
    activeTier: analysis.recommendation.recommendedPrecision,
  };
}

/**
 * Manually override active candidate tier.
 */
export function setActiveTier(
  state: AppState,
  tier: PrecisionTier
): AppState {
  return {
    ...state,
    activeTier: tier,
  };
}

/**
 * Update tolerance preset or custom threshold.
 */
export function setPreset(
  state: AppState,
  preset: TolerancePreset,
  customTolerancePct?: number
): AppState {
  return {
    ...state,
    activePreset: preset,
    customTolerancePct: customTolerancePct ?? state.customTolerancePct,
  };
}

/**
 * Update comparison studio inspection view mode.
 */
export function setViewMode(
  state: AppState,
  mode: ViewMode
): AppState {
  return {
    ...state,
    activeViewMode: mode,
  };
}

/**
 * Update onion skin blending opacity (0-100).
 */
export function setOnionOpacity(
  state: AppState,
  opacity: number
): AppState {
  return {
    ...state,
    onionOpacity: Math.max(0, Math.min(100, opacity)),
  };
}
