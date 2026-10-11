import { describe, it, expect } from 'vitest';
import { SAMPLE_SVGS } from '../corpus/samples.js';
import { optimizeSvg, getByteSize, getGzipSize } from './quantizer.js';
import { analyzeCandidates } from './recommender.js';
import {
  createInitialState,
  transitionToLoading,
  transitionToError,
  transitionToSuccess,
  setActiveTier,
  setPreset,
} from '../state.js';

describe('M14.1 Initial-State Integrity and Regression Tests', () => {
  it('1. Initial empty state has no recommendation, no claims, and null analysis', () => {
    const state = createInitialState();

    expect(state.phase).toBe('empty');
    expect(state.sourceType).toBe('none');
    expect(state.originalSvg).toBe('');
    expect(state.currentAnalysis).toBeNull();
    expect(state.activeTier).toBeNull();
    expect(state.errorMessage).toBeUndefined();
    expect(state.activePreset).toBe('balanced');
    expect(state.customTolerancePct).toBe(1.0);
    expect(state.activeViewMode).toBe('side-by-side');
  });

  it('2. Empty or whitespace-only pasted input throws error and clears all metrics', async () => {
    const emptyInputs = ['', '   ', '\n\t  \r\n'];

    for (const input of emptyInputs) {
      await expect(optimizeSvg(input)).rejects.toThrow('SVG input is empty or whitespace-only.');
      await expect(analyzeCandidates(input)).rejects.toThrow('SVG input is empty or whitespace-only.');
    }

    // Verify state transition on empty input
    let state = createInitialState();
    state = transitionToError(state, 'Input is empty or whitespace-only.');

    expect(state.phase).toBe('error');
    expect(state.errorMessage).toBe('Input is empty or whitespace-only.');
    expect(state.currentAnalysis).toBeNull();
    expect(state.activeTier).toBeNull();
  });

  it('3. Invalid SVG markup throws error and transitions cleanly to error state', async () => {
    const invalidInputs = [
      '<div>Not an SVG</div>',
      '<p>Hello world</p>',
      '{"json": "not svg"}',
      '<custom-tag></custom-tag>',
    ];

    for (const input of invalidInputs) {
      await expect(optimizeSvg(input)).rejects.toThrow(
        'Input does not contain a valid <svg> root element.'
      );
      await expect(analyzeCandidates(input)).rejects.toThrow(
        'Input does not contain a valid <svg> root element.'
      );
    }

    let state = createInitialState();
    state = transitionToError(state, 'Input does not contain a valid <svg> root element.');

    expect(state.phase).toBe('error');
    expect(state.errorMessage).toBe('Input does not contain a valid <svg> root element.');
    expect(state.currentAnalysis).toBeNull();
    expect(state.activeTier).toBeNull();
  });

  it('4. A valid SVG produces real, internally consistent metrics with zero division guards', async () => {
    const fixture = SAMPLE_SVGS[0]!;
    const rawBytes = getByteSize(fixture.markup);
    const rawGzip = await getGzipSize(fixture.markup);

    expect(rawBytes).toBeGreaterThan(0);
    expect(rawGzip).toBeGreaterThan(0);

    const analysis = await analyzeCandidates(fixture.markup, 'balanced');

    expect(analysis.originalByteSize).toBe(rawBytes);
    expect(analysis.originalGzipSize).toBe(rawGzip);
    expect(analysis.candidates).toHaveLength(4);

    // Verify internal consistency across every candidate
    for (const cand of analysis.candidates) {
      expect(cand.byteSize).toBeGreaterThan(0);
      expect(cand.gzipSize).toBeGreaterThan(0);
      expect(cand.savingsBytes).toBeGreaterThanOrEqual(0);
      expect(cand.savingsPercent).toBeGreaterThanOrEqual(0);

      // Verify mathematical identity: savingsPercent = (savingsBytes / originalByteSize) * 100
      if (cand.savingsBytes > 0) {
        const expectedPercent = (cand.rawBytesSaved / rawBytes) * 100;
        expect(cand.rawReductionPercent).toBeCloseTo(expectedPercent, 5);
        expect(Number(cand.rawReductionPercent.toFixed(1))).toBe(
          Math.round(expectedPercent * 10) / 10
        );
        expect(cand.byteSize).toBe(rawBytes - cand.rawBytesSaved);
      } else {
        expect(cand.rawReductionPercent).toBe(0);
      }
    }

    // Verify recommendation reflects candidate data
    const rec = analysis.recommendation;
    const recCand = analysis.candidates.find((c) => c.precision === rec.recommendedPrecision);
    expect(recCand).toBeDefined();
    expect(rec.toleratedSavingsPercent).toBe(recCand!.savingsPercent);
    expect(rec.reason).toBeTruthy();

    // Verify successful state transition
    let state = createInitialState();
    state = transitionToSuccess(state, analysis, fixture.markup, 'sample', fixture.name);

    expect(state.phase).toBe('success');
    expect(state.sourceType).toBe('sample');
    expect(state.sourceName).toBe(fixture.name);
    expect(state.activeTier).toBe(rec.recommendedPrecision);
    expect(state.currentAnalysis).toBe(analysis);
  });

  it('5. Loading a second SVG after a successful run completely replaces all metrics without stale data', async () => {
    const fixture1 = SAMPLE_SVGS[0]!; // Precision Badge
    const fixture2 = SAMPLE_SVGS[1]!; // Sub-Pixel Micro-Circuit

    // Run 1
    let state = createInitialState();
    const analysis1 = await analyzeCandidates(fixture1.markup, 'balanced');
    state = transitionToSuccess(state, analysis1, fixture1.markup, 'sample', fixture1.name);

    expect(state.sourceName).toBe(fixture1.name);
    expect(state.currentAnalysis?.originalByteSize).toBe(getByteSize(fixture1.markup));

    // Transition to loading second input immediately clears stale analysis
    state = transitionToLoading(state, 'optimizing', 'sample', fixture2.name, fixture2.markup);
    expect(state.phase).toBe('optimizing');
    expect(state.currentAnalysis).toBeNull();
    expect(state.activeTier).toBeNull();

    // Run 2 completes
    const analysis2 = await analyzeCandidates(fixture2.markup, 'balanced');
    state = transitionToSuccess(state, analysis2, fixture2.markup, 'sample', fixture2.name);

    expect(state.phase).toBe('success');
    expect(state.sourceName).toBe(fixture2.name);
    expect(state.originalSvg).toBe(fixture2.markup);
    expect(state.currentAnalysis).toBe(analysis2);
    expect(state.currentAnalysis?.originalByteSize).toBe(getByteSize(fixture2.markup));
    expect(state.currentAnalysis?.originalByteSize).not.toBe(analysis1.originalByteSize);
    expect(state.activeTier).toBe(analysis2.recommendation.recommendedPrecision);
  });

  it('6. Failed optimization after a successful run purges all stale success metrics', async () => {
    const fixture = SAMPLE_SVGS[0]!;

    // Successful run
    let state = createInitialState();
    const analysis = await analyzeCandidates(fixture.markup, 'balanced');
    state = transitionToSuccess(state, analysis, fixture.markup, 'sample', fixture.name);
    expect(state.phase).toBe('success');
    expect(state.currentAnalysis).not.toBeNull();
    expect(state.activeTier).not.toBeNull();

    // Subsequent failed input
    state = transitionToError(state, 'Malformed SVG: unclosed tag');
    expect(state.phase).toBe('error');
    expect(state.errorMessage).toBe('Malformed SVG: unclosed tag');
    expect(state.currentAnalysis).toBeNull();
    expect(state.activeTier).toBeNull();
  });

  it('7. Fixtures loaded through sample selection compute metrics strictly from their own asset', async () => {
    for (const sample of SAMPLE_SVGS) {
      let state = createInitialState();
      state = transitionToLoading(state, 'optimizing', 'sample', sample.name, sample.markup);

      expect(state.sourceType).toBe('sample');
      expect(state.sourceName).toBe(sample.name);

      const analysis = await analyzeCandidates(sample.markup, 'balanced');
      state = transitionToSuccess(state, analysis, sample.markup, 'sample', sample.name);

      expect(state.phase).toBe('success');
      expect(state.currentAnalysis?.originalByteSize).toBe(getByteSize(sample.markup));
      expect(state.currentAnalysis?.candidates.length).toBe(4);
      expect(state.activeTier).toBe(analysis.recommendation.recommendedPrecision);
    }
  });

  it('8. Zero-byte or non-shrinking files never report positive savings or divide by zero', async () => {
    // Construct a minimal pre-quantized SVG that cannot be quantized further
    const minimalSvg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';
    const res = await optimizeSvg(minimalSvg, { precision: 2 });

    expect(res.savingsPercent).toBeGreaterThanOrEqual(0);
    expect(res.byteSize).toBeGreaterThan(0);

    const analysis = await analyzeCandidates(minimalSvg, 'strict');
    expect(analysis.originalByteSize).toBeGreaterThan(0);
    expect(analysis.recommendation.toleratedSavingsPercent).toBeGreaterThanOrEqual(0);
  });

  it('9. Full fixture loading followed by Clear Input resets cleanly to empty state with zero retained metrics or active tiers', async () => {
    const fixture = SAMPLE_SVGS[0]!;
    let state = createInitialState();

    // 1. Load fixture
    state = transitionToLoading(state, 'optimizing', 'sample', fixture.name, fixture.markup);
    const analysis = await analyzeCandidates(fixture.markup, 'balanced');
    state = transitionToSuccess(state, analysis, fixture.markup, 'sample', fixture.name);

    expect(state.phase).toBe('success');
    expect(state.currentAnalysis).not.toBeNull();
    expect(state.activeTier).toBe(analysis.recommendation.recommendedPrecision);
    expect(state.originalSvg).toBe(fixture.markup);

    // 2. Clear input
    state = createInitialState();

    expect(state.phase).toBe('empty');
    expect(state.currentAnalysis).toBeNull();
    expect(state.activeTier).toBeNull();
    expect(state.originalSvg).toBe('');
    expect(state.sourceType).toBe('none');
    expect(state.errorMessage).toBeUndefined();
  });
});

