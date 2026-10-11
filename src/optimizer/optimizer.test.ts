import { describe, it, expect } from 'vitest';
import {
  formatCoordinate,
  quantizePathData,
  quantizeViewBox,
  quantizeTransform,
  optimizeSvg,
  getByteSize,
} from './quantizer.js';
import { comparePixelBuffers } from './comparator.js';
import { analyzeCandidates } from './recommender.js';
import { SAMPLE_SVGS } from '../corpus/samples.js';

describe('SVG Path Quantizer', () => {
  it('formats coordinates and eliminates redundant trailing zeros', () => {
    expect(formatCoordinate(12.5, 2)).toBe('12.5');
    expect(formatCoordinate(12.5004, 2)).toBe('12.5');
    expect(formatCoordinate(200.0, 2)).toBe('200');
    expect(formatCoordinate(0.0001, 2)).toBe('0');
    expect(formatCoordinate(-0.0001, 2)).toBe('0');
  });

  it('preserves binary 0/1 flags for SVG Arc commands', () => {
    // Arc format: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    // large-arc-flag is 1, sweep-flag is 0
    const rawArc = 'M 10.125 10.125 A 25.555 25.555 0 1 0 50.888 50.888';
    const quantized = quantizePathData(rawArc, 1);
    
    // In quantized output:
    // A 25.6 25.6 0 1 0 50.9 50.9
    expect(quantized).toContain('A 25.6 25.6 0 1 0 50.9 50.9');
  });

  it('quantizes cubic and quadratic Bezier curves accurately', () => {
    const rawCurve = 'M 10.123 20.456 C 30.789 40.123 50.456 60.789 70.123 80.456';
    const q2 = quantizePathData(rawCurve, 2);
    expect(q2).toBe('M 10.12 20.46 C 30.79 40.12 50.46 60.79 70.12 80.46');

    const q0 = quantizePathData(rawCurve, 0);
    expect(q0).toBe('M 10 20 C 31 40 50 61 70 80');
  });

  it('protects viewBox aspect ratio with minimum decimal precision', () => {
    const vb = '0 0 1920.456 1080.789';
    const q0 = quantizeViewBox(vb, 0);
    // Should preserve at least 1 decimal
    expect(q0).toBe('0 0 1920.5 1080.8');
  });

  it('protects affine transform matrix values with minimum 2 decimal precision', () => {
    const matrix = 'matrix(0.707106, 0.707106, -0.707106, 0.707106, 10.5, 20.5)';
    const q0 = quantizeTransform(matrix, 0);
    // Should retain at least 2 decimals to prevent severe skew deformation
    expect(q0).toContain('0.71');
  });

  it('strips editor metadata while preserving semantics, defs, IDs, gradients, and text', async () => {
    const sample = SAMPLE_SVGS.find((s) => s.id === 'typography-badge')!;
    const result = await optimizeSvg(sample.markup, { precision: 1 });

    expect(result.markup).toContain('<svg');
    expect(result.markup).toContain('<title id="svgTitle">Precision Engineering Certified</title>');
    expect(result.markup).toContain('<desc id="svgDesc">');
    expect(result.markup).toContain('role="img"');
    expect(result.markup).toContain('PROJECT FOUNDRY');
    expect(result.markup).toContain('CERTIFIED SVG');
    expect(result.byteSize).toBeLessThan(getByteSize(sample.markup));
    expect(result.savingsPercent).toBeGreaterThan(0);
  });

  it('quantizes polyline and polygon points accurately', async () => {
    const rawSvg = '<svg viewBox="0 0 100 100"><polygon points="10.123,20.456 30.789,40.123" /></svg>';
    const result = await optimizeSvg(rawSvg, { precision: 1 });
    expect(result.markup).toContain('points="10.1,20.5 30.8,40.1"');
  });

  it('safely optimizes all built-in sample SVGs across all precision tiers', async () => {
    for (const sample of SAMPLE_SVGS) {
      for (const precision of [3, 2, 1, 0] as const) {
        const res = await optimizeSvg(sample.markup, { precision });
        expect(res.markup).toContain('<svg');
        expect(res.markup).toContain('</svg>');
        expect(res.byteSize).toBeGreaterThan(0);
        expect(res.gzipSize).toBeGreaterThan(0);
      }
    }
  });

  it('throws descriptive error on malformed or empty SVG input', async () => {
    await expect(optimizeSvg('')).rejects.toThrow('SVG input is empty or whitespace-only.');
    await expect(optimizeSvg('<div>Not an SVG</div>')).rejects.toThrow(
      'Input does not contain a valid <svg> root element.'
    );
  });
});

describe('Deterministic Visual Diff Comparator', () => {
  it('reports zero diff for identical pixel buffers', () => {
    const width = 10;
    const height = 10;
    const len = width * height * 4;
    const bufA = new Uint8ClampedArray(len).fill(128);
    const bufB = new Uint8ClampedArray(len).fill(128);

    const { metrics } = comparePixelBuffers(bufA, bufB, width, height, 5);
    expect(metrics.diffPixels).toBe(0);
    expect(metrics.visualDiffPercentage).toBe(0);
    expect(metrics.meanAbsoluteError).toBe(0);
    expect(metrics.maxColorDelta).toBe(0);
    expect(metrics.psnr).toBe(99.9);
  });

  it('detects altered pixels, computes MAE, PSNR, and generates heatmap buffer', () => {
    const width = 10;
    const height = 10;
    const totalPixels = width * height;
    const len = totalPixels * 4;
    const bufA = new Uint8ClampedArray(len).fill(100);
    const bufB = new Uint8ClampedArray(bufA);

    // Alter 10 pixels (10% of total) by delta 50 (exceeding threshold 8)
    for (let i = 0; i < 10 * 4; i += 4) {
      bufB[i] = 150; // R
    }

    const { metrics, diffRgba } = comparePixelBuffers(bufA, bufB, width, height, 8);
    expect(metrics.diffPixels).toBe(10);
    expect(metrics.visualDiffPercentage).toBe(10);
    expect(metrics.meanAbsoluteError).toBeGreaterThan(0);
    expect(metrics.maxColorDelta).toBe(50);
    expect(metrics.psnr).toBeLessThan(99.9);

    // Heatmap buffer for altered pixel should have high red channel
    expect(diffRgba[0]).toBeGreaterThan(150);
    expect(diffRgba[3]).toBe(230); // Alpha
  });
});

describe('Multi-Candidate Recommender', () => {
  it('generates multi-tier candidates and outputs an explainable recommendation', async () => {
    const sample = SAMPLE_SVGS[0]!;
    const analysis = await analyzeCandidates(sample.markup, 'balanced');

    expect(analysis.candidates).toHaveLength(4); // Tiers 3, 2, 1, 0
    expect(analysis.recommendation).toBeDefined();
    expect(analysis.recommendation.recommendedPrecision).toBeGreaterThanOrEqual(0);
    expect(analysis.recommendation.recommendedPrecision).toBeLessThanOrEqual(3);
    expect(analysis.recommendation.reason).toBeTruthy();
    expect(analysis.originalByteSize).toBeGreaterThan(0);
  });
});
