export type PrecisionTier = 0 | 1 | 2 | 3 | 4;

export type TolerancePreset = 'strict' | 'balanced' | 'compact' | 'custom';

export interface ToleranceConfig {
  preset: TolerancePreset;
  name: string;
  maxDiffPercent: number; // e.g. 0.1% for strict, 0.5% for balanced, 1.5% for compact
  maxMae: number; // Mean absolute subpixel error threshold
  description: string;
  badgeText: string;
}

export const TOLERANCE_PRESETS: Record<TolerancePreset, ToleranceConfig> = {
  strict: {
    preset: 'strict',
    name: 'Strict (Sub-pixel)',
    maxDiffPercent: 0.1,
    maxMae: 0.5,
    description: 'Virtually indistinguishable from original. Best for fine logos, typography, and precision icons.',
    badgeText: '≤ 0.1% diff',
  },
  balanced: {
    preset: 'balanced',
    name: 'Balanced (Production)',
    maxDiffPercent: 0.5,
    maxMae: 2.0,
    description: 'Subtle coordinate rounding imperceptible at standard display scaling. Recommended default.',
    badgeText: '≤ 0.5% diff',
  },
  compact: {
    preset: 'compact',
    name: 'Compact (Aggressive)',
    maxDiffPercent: 1.5,
    maxMae: 5.0,
    description: 'Aggressive quantization for maximum file reduction. Best for decorative backgrounds and large shapes.',
    badgeText: '≤ 1.5% diff',
  },
  custom: {
    preset: 'custom',
    name: 'Custom Tolerance',
    maxDiffPercent: 1.0,
    maxMae: 3.5,
    description: 'User-specified threshold and manual precision override.',
    badgeText: 'Custom',
  },
};

export interface VisualDiffMetrics {
  diffPixels: number;
  totalPixels: number;
  visualDiffPercentage: number;
  meanAbsoluteError: number;
  maxColorDelta: number;
  psnr: number;
  renderedWidth: number;
  renderedHeight: number;
  diffDataUrl?: string;
}

export interface SavingsMetrics {
  rawBytesSaved: number;
  rawReductionPercent: number;
  gzipBytesSaved: number;
  gzipReductionPercent: number;
}

export interface OptimizationResult {
  precision: PrecisionTier;
  markup: string;
  byteSize: number;
  gzipSize: number;
  rawBytesSaved: number;
  rawReductionPercent: number;
  gzipBytesSaved: number;
  gzipReductionPercent: number;
  savingsBytes: number;
  savingsPercent: number;
  warnings: string[];
  metrics: VisualDiffMetrics | null;
}

export interface Recommendation {
  recommendedPrecision: PrecisionTier;
  reason: string;
  meetsTolerance: boolean;
  toleratedSavingsPercent: number;
  rawBytesSaved: number;
  rawReductionPercent: number;
  gzipBytesSaved: number;
  gzipReductionPercent: number;
  tolerancePreset: TolerancePreset;
  toleranceThreshold: number;
}

export interface MultiCandidateAnalysis {
  originalByteSize: number;
  originalGzipSize: number;
  candidates: OptimizationResult[];
  recommendation: Recommendation;
  toleranceConfig: ToleranceConfig;
}

export type ViewMode = 'side-by-side' | 'onion-skin' | 'diff-heatmap';

export interface SvgSample {
  id: string;
  name: string;
  description: string;
  markup: string;
}

export type ProcessingPhase = 'empty' | 'parsing' | 'optimizing' | 'comparing' | 'success' | 'error';
export type SourceType = 'none' | 'sample' | 'file' | 'pasted';

export interface AppState {
  phase: ProcessingPhase;
  sourceType: SourceType;
  sourceName?: string;
  originalSvg: string;
  errorMessage?: string;
  currentAnalysis: MultiCandidateAnalysis | null;
  activeTier: PrecisionTier | null;
  activePreset: TolerancePreset;
  customTolerancePct: number;
  activeViewMode: ViewMode;
  onionOpacity: number;
}
