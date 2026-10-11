import type {
  PrecisionTier,
  TolerancePreset,
  ToleranceConfig,
  OptimizationResult,
  Recommendation,
  MultiCandidateAnalysis,
} from '../types.js';
import { TOLERANCE_PRESETS } from '../types.js';
import { optimizeSvg, getByteSize, getGzipSize } from './quantizer.js';
import { compareSvgs } from './comparator.js';

export { type MultiCandidateAnalysis };

/**
 * Generate candidate tiers (P3, P2, P1, P0) and recommend the smallest file
 * that strictly satisfies the user's visual error tolerance budget.
 */
export async function analyzeCandidates(
  svgMarkup: string,
  preset: TolerancePreset = 'balanced',
  customConfig?: Partial<ToleranceConfig>
): Promise<MultiCandidateAnalysis> {
  if (!svgMarkup || !svgMarkup.trim()) {
    throw new Error('SVG input is empty or whitespace-only.');
  }

  if (!svgMarkup.includes('<svg')) {
    throw new Error('Input does not contain a valid <svg> root element.');
  }

  const baseConfig = TOLERANCE_PRESETS[preset] || TOLERANCE_PRESETS.balanced;
  const toleranceConfig: ToleranceConfig = {
    ...baseConfig,
    ...customConfig,
  };

  const originalByteSize = getByteSize(svgMarkup);
  const originalGzipSize = await getGzipSize(svgMarkup);

  const candidateTiers: PrecisionTier[] = [3, 2, 1, 0];
  const candidates: OptimizationResult[] = [];

  for (const precision of candidateTiers) {
    const result = await optimizeSvg(svgMarkup, { precision });
    // Run visual diff comparison if browser canvas is available
    try {
      result.metrics = await compareSvgs(svgMarkup, result.markup);
    } catch {
      // If canvas rendering is unavailable, leave metrics as null or zero diff
      result.metrics = null;
    }
    candidates.push(result);
  }

  // Evaluate candidates against tolerance budget.
  // We want the smallest file (maximum savings) that satisfies the budget.
  // Candidates are sorted descending by savingsPercent (which corresponds to lower precision).
  const sortedBySavings = [...candidates].sort((a, b) => b.savingsPercent - a.savingsPercent);

  let selected: OptimizationResult | null = null;
  let reason = '';
  let meetsTolerance = false;

  for (const cand of sortedBySavings) {
    const diffPct = cand.metrics?.visualDiffPercentage ?? 0;
    const mae = cand.metrics?.meanAbsoluteError ?? 0;

    const passesPercent = diffPct <= toleranceConfig.maxDiffPercent;
    const passesMae = mae <= toleranceConfig.maxMae;

    if (passesPercent && passesMae) {
      selected = cand;
      meetsTolerance = true;
      const savingsText =
        cand.savingsPercent > 0
          ? `yielding ${cand.savingsPercent}% size reduction`
          : 'no further size reduction on this asset';
      reason = `Precision ${cand.precision} satisfies the ${toleranceConfig.name} budget (measured diff: ${diffPct}%, MAE: ${mae}) while ${savingsText}.`;
      break;
    }
  }

  // Fallback if none meet the budget (e.g. extremely strict tolerance or high distortion)
  if (!selected) {
    // Select the candidate with the lowest diff
    const lowestDiffCand = [...candidates].sort(
      (a, b) =>
        (a.metrics?.visualDiffPercentage ?? 999) - (b.metrics?.visualDiffPercentage ?? 999)
    )[0]!;

    selected = lowestDiffCand;
    meetsTolerance = false;
    reason = `No candidate met the strict ${toleranceConfig.maxDiffPercent}% threshold. Precision ${selected.precision} is recommended as the closest fit with ${selected.metrics?.visualDiffPercentage ?? 0}% measured difference.`;
  }

  const recommendation: Recommendation = {
    recommendedPrecision: selected.precision,
    reason,
    meetsTolerance,
    toleratedSavingsPercent: selected.savingsPercent,
    tolerancePreset: preset,
    toleranceThreshold: toleranceConfig.maxDiffPercent,
  };

  return {
    originalByteSize,
    originalGzipSize,
    candidates,
    recommendation,
    toleranceConfig,
  };
}
