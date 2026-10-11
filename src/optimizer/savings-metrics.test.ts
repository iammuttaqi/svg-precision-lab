import { describe, it, expect } from 'vitest';
import { calculateSavingsMetrics, optimizeSvg, getByteSize, getGzipSize } from './quantizer.js';
import { analyzeCandidates } from './recommender.js';
import { SAMPLE_SVGS } from '../corpus/samples.js';

describe('M14.1.2: SVG Savings Metric Semantics & Arithmetic Integrity', () => {
  describe('calculateSavingsMetrics unit tests', () => {
    it('computes positive savings for smaller optimized outputs', () => {
      const originalRaw = 1000;
      const optimizedRaw = 778;
      const originalGzip = 500;
      const optimizedGzip = 400;

      const res = calculateSavingsMetrics(originalRaw, optimizedRaw, originalGzip, optimizedGzip);

      expect(res.rawBytesSaved).toBe(222);
      expect(res.rawReductionPercent).toBeCloseTo(22.2, 5);
      expect(res.gzipBytesSaved).toBe(100);
      expect(res.gzipReductionPercent).toBeCloseTo(20.0, 5);

      // Verify underlying arithmetic is unrounded float while display formatting produces expected strings
      expect(res.rawReductionPercent.toFixed(1)).toBe('22.2');
      expect(res.gzipReductionPercent.toFixed(1)).toBe('20.0');
    });

    it('computes zero savings for equal-sized outputs without negative signs or NaN', () => {
      const originalRaw = 500;
      const optimizedRaw = 500;
      const originalGzip = 250;
      const optimizedGzip = 250;

      const res = calculateSavingsMetrics(originalRaw, optimizedRaw, originalGzip, optimizedGzip);

      expect(res.rawBytesSaved).toBe(0);
      expect(res.rawReductionPercent).toBe(0);
      expect(res.gzipBytesSaved).toBe(0);
      expect(res.gzipReductionPercent).toBe(0);
      expect(Number.isFinite(res.rawReductionPercent)).toBe(true);
      expect(Number.isFinite(res.gzipReductionPercent)).toBe(true);
    });

    it('computes negative savings / explicit increase when optimized output is larger', () => {
      const originalRaw = 500;
      const optimizedRaw = 600; // 100 bytes larger
      const originalGzip = 250;
      const optimizedGzip = 320; // 70 bytes larger

      const res = calculateSavingsMetrics(originalRaw, optimizedRaw, originalGzip, optimizedGzip);

      expect(res.rawBytesSaved).toBe(-100);
      expect(res.rawReductionPercent).toBeCloseTo(-20.0, 5);
      expect(res.gzipBytesSaved).toBe(-70);
      expect(res.gzipReductionPercent).toBeCloseTo(-28.0, 5);

      // Verify absolute increase values can be extracted cleanly
      expect(Math.abs(res.rawBytesSaved)).toBe(100);
      expect(Math.abs(res.rawReductionPercent).toFixed(1)).toBe('20.0');
      expect(Math.abs(res.gzipBytesSaved)).toBe(70);
      expect(Math.abs(res.gzipReductionPercent).toFixed(1)).toBe('28.0');
    });

    it('guards all percentage calculations against division by zero when original size is 0', () => {
      const originalRaw = 0;
      const optimizedRaw = 0;
      const originalGzip = 0;
      const optimizedGzip = 0;

      const res = calculateSavingsMetrics(originalRaw, optimizedRaw, originalGzip, optimizedGzip);

      expect(res.rawBytesSaved).toBe(0);
      expect(res.rawReductionPercent).toBe(0);
      expect(res.gzipBytesSaved).toBe(0);
      expect(res.gzipReductionPercent).toBe(0);
      expect(Number.isNaN(res.rawReductionPercent)).toBe(false);
      expect(Number.isNaN(res.gzipReductionPercent)).toBe(false);
      expect(Number.isFinite(res.rawReductionPercent)).toBe(true);
      expect(Number.isFinite(res.gzipReductionPercent)).toBe(true);
    });

    it('guards against division by zero when original size is 0 but optimized size is positive', () => {
      const originalRaw = 0;
      const optimizedRaw = 150;
      const originalGzip = 0;
      const optimizedGzip = 80;

      const res = calculateSavingsMetrics(originalRaw, optimizedRaw, originalGzip, optimizedGzip);

      expect(res.rawBytesSaved).toBe(-150);
      expect(res.rawReductionPercent).toBe(0); // guarded, not -Infinity or NaN
      expect(res.gzipBytesSaved).toBe(-80);
      expect(res.gzipReductionPercent).toBe(0); // guarded, not -Infinity or NaN
    });
  });

  describe('Integration with real SVG optimization & candidate analysis', () => {
    it('derives raw and gzip statistics from their respective representations', async () => {
      const fixture = SAMPLE_SVGS[0]!;
      const originalRaw = getByteSize(fixture.markup);
      const originalGzip = await getGzipSize(fixture.markup);

      const analysis = await analyzeCandidates(fixture.markup, 'balanced');

      expect(analysis.originalByteSize).toBe(originalRaw);
      expect(analysis.originalGzipSize).toBe(originalGzip);

      for (const cand of analysis.candidates) {
        // Raw metrics
        expect(cand.rawBytesSaved).toBe(originalRaw - cand.byteSize);
        const expectedRawPct = ((originalRaw - cand.byteSize) / originalRaw) * 100;
        expect(cand.rawReductionPercent).toBeCloseTo(expectedRawPct, 5);

        // Gzip metrics
        expect(cand.gzipBytesSaved).toBe(originalGzip - cand.gzipSize);
        const expectedGzipPct = ((originalGzip - cand.gzipSize) / originalGzip) * 100;
        expect(cand.gzipReductionPercent).toBeCloseTo(expectedGzipPct, 5);

        // Verify raw and gzip are independently calculated
        expect(cand.rawBytesSaved).toBeGreaterThan(0);
        expect(cand.gzipBytesSaved).toBeGreaterThan(0);

        // Arithmetic identity: cand.byteSize + cand.rawBytesSaved === originalRaw
        expect(cand.byteSize + cand.rawBytesSaved).toBe(originalRaw);
        expect(cand.gzipSize + cand.gzipBytesSaved).toBe(originalGzip);
      }
    });

    it('handles already-minimal SVG with equal or non-shrinking size', async () => {
      const minimalSvg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';
      const originalRaw = getByteSize(minimalSvg);
      const originalGzip = await getGzipSize(minimalSvg);

      const res = await optimizeSvg(minimalSvg, { precision: 2 }, originalGzip);

      expect(res.rawBytesSaved).toBe(originalRaw - res.byteSize);
      expect(Number.isFinite(res.rawReductionPercent)).toBe(true);
      expect(Number.isFinite(res.gzipReductionPercent)).toBe(true);
    });

    it('formats recommendation reason string with positive reduction values and bytes saved', async () => {
      const fixture = SAMPLE_SVGS[0]!;
      const analysis = await analyzeCandidates(fixture.markup, 'balanced');
      const rec = analysis.recommendation;

      expect(rec.rawBytesSaved).toBeGreaterThan(0);
      expect(rec.rawReductionPercent).toBeGreaterThan(0);
      expect(rec.reason).toContain(`${rec.rawReductionPercent.toFixed(1)}% reduction`);
      expect(rec.reason).toContain(`${rec.rawBytesSaved} B saved`);
      expect(rec.reason).not.toContain('-%');
    });
  });
});
