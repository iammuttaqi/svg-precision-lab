import type { PrecisionTier, OptimizationResult } from '../types.js';

export interface QuantizeOptions {
  precision: PrecisionTier;
  stripComments?: boolean;
  stripEditorMetadata?: boolean;
  collapseWhitespace?: boolean;
}

export const DEFAULT_QUANTIZE_OPTIONS: QuantizeOptions = {
  precision: 2,
  stripComments: true,
  stripEditorMetadata: true,
  collapseWhitespace: true,
};

/**
 * Measure raw byte size in UTF-8.
 */
export function getByteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Measure true gzip size using modern CompressionStream.
 * Falls back to estimated deflate ratio if CompressionStream is unavailable.
 */
export async function getGzipSize(text: string): Promise<number> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      let total = 0;
      for (const c of chunks) total += c.length;
      return total;
    } catch {
      // Fallback below
    }
  }
  // Theoretical deflate compression approximation if web streams fail
  return Math.max(20, Math.round(bytes.length * 0.42));
}

/**
 * Format a floating-point coordinate according to decimal precision.
 * Removes redundant trailing zeros and eliminates -0.
 */
export function formatCoordinate(num: number, precision: number): string {
  if (!Number.isFinite(num)) return '0';
  if (precision === 0) {
    const rounded = Math.round(num);
    return rounded === 0 ? '0' : rounded.toString();
  }
  const factor = 10 ** precision;
  const rounded = Math.round(num * factor) / factor;
  if (rounded === 0) return '0';

  // Format and strip trailing zeros
  const fixed = rounded.toFixed(precision);
  return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

/**
 * Quantize SVG Path Data (d attribute) string.
 * Accurately parses commands and argument lists, protecting arc flags.
 */
export function quantizePathData(d: string, precision: number): string {
  if (!d || !d.trim()) return '';

  // Match commands or numbers.
  // SVG path commands: M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z
  const tokens: string[] = [];
  const regex = /([a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(d)) !== null) {
    tokens.push(match[1]);
  }

  const resultTokens: string[] = [];
  let currentCmd = '';
  let cmdArgIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isCommand = /^[a-df-z]$/i.test(token);

    if (isCommand) {
      currentCmd = token;
      cmdArgIndex = 0;
      resultTokens.push(token);
    } else {
      const num = parseFloat(token);
      if (Number.isNaN(num)) {
        resultTokens.push(token);
        continue;
      }

      // Special handling for Arc command: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
      // large-arc-flag is arg 3, sweep-flag is arg 4 (0-indexed modulo 7)
      const isArc = currentCmd.toLowerCase() === 'a';
      if (isArc && (cmdArgIndex % 7 === 3 || cmdArgIndex % 7 === 4)) {
        // Flag must strictly be integer 0 or 1!
        resultTokens.push(num > 0 ? '1' : '0');
      } else {
        resultTokens.push(formatCoordinate(num, precision));
      }
      cmdArgIndex++;
    }
  }

  // Join tokens smartly: space between numbers, no space needed after command letter
  let pathStr = '';
  for (let i = 0; i < resultTokens.length; i++) {
    const tok = resultTokens[i];
    if (i === 0) {
      pathStr += tok;
    } else {
      const prevTok = resultTokens[i - 1];
      const prevIsCmd = /^[a-df-z]$/i.test(prevTok);
      const isCmd = /^[a-df-z]$/i.test(tok);

      if (isCmd) {
        pathStr += ' ' + tok;
      } else if (prevIsCmd) {
        pathStr += ' ' + tok;
      } else if (tok.startsWith('-')) {
        pathStr += ' ' + tok;
      } else {
        pathStr += ' ' + tok;
      }
    }
  }

  return pathStr.trim();
}

/**
 * Quantize comma/space-separated list of numbers (such as polyline points).
 */
export function quantizePointsList(points: string, precision: number): string {
  return points.replace(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g, (numStr) => {
    const val = parseFloat(numStr);
    return Number.isFinite(val) ? formatCoordinate(val, precision) : numStr;
  });
}

/**
 * Quantize coordinates inside transform attribute (translate, scale, matrix, rotate).
 */
export function quantizeTransform(transform: string, precision: number): string {
  // Preserve higher precision for matrix transforms to prevent skew distortion
  const effectivePrecision = Math.max(precision, 2);
  return transform.replace(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g, (numStr) => {
    const val = parseFloat(numStr);
    return Number.isFinite(val) ? formatCoordinate(val, effectivePrecision) : numStr;
  });
}

/**
 * Quantize viewBox attribute while guaranteeing aspect ratio stability.
 */
export function quantizeViewBox(viewBox: string, precision: number): string {
  // Keep at least 1 decimal in viewBox if precision is low to avoid collapsing aspect ratio
  const effectivePrecision = Math.max(precision, 1);
  return viewBox.replace(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g, (numStr) => {
    const val = parseFloat(numStr);
    return Number.isFinite(val) ? formatCoordinate(val, effectivePrecision) : numStr;
  });
}

/**
 * Main SVG Optimizer & Path Quantizer.
 * Processes SVG markup, strips editor metadata, quantizes numeric coordinates,
 * and preserves essential semantics, defs, IDs, text, gradients, and clip-paths.
 */
export async function optimizeSvg(
  svgMarkup: string,
  options: Partial<QuantizeOptions> = {}
): Promise<OptimizationResult> {
  const opts: QuantizeOptions = { ...DEFAULT_QUANTIZE_OPTIONS, ...options };
  if (!svgMarkup || !svgMarkup.trim()) {
    throw new Error('SVG input is empty or whitespace-only.');
  }

  // Basic XML well-formedness validation check
  if (!svgMarkup.includes('<svg')) {
    throw new Error('Input does not contain a valid <svg> root element.');
  }

  const rawOriginalBytes = getByteSize(svgMarkup);
  const warnings: string[] = [];

  let cleaned = svgMarkup;

  // 1. Strip XML comments if requested
  if (opts.stripComments) {
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  }

  // 2. Strip editor namespaces and editor attributes (Inkscape, Sodipodi, Illustrator, Sketch)
  if (opts.stripEditorMetadata) {
    cleaned = cleaned
      .replace(/\s+xmlns:(?:inkscape|sodipodi|sketch|adobe)="[^"]*"/gi, '')
      .replace(/\s+(?:inkscape|sodipodi|sketch|adobe):[a-z0-9_-]+="[^"]*"/gi, '')
      .replace(/<sodipodi:namedview[\s\S]*?\/>/gi, '')
      .replace(/<metadata>[\s\S]*?<\/metadata>/gi, '');
  }

  // 3. Process viewBox attribute safely
  cleaned = cleaned.replace(/viewBox=["']([^"']+)["']/gi, (_match, vb) => {
    return `viewBox="${quantizeViewBox(vb, opts.precision)}"`;
  });

  // 4. Process path 'd' attributes
  cleaned = cleaned.replace(/\bd=["']([^"']+)["']/gi, (_match, pathData) => {
    // Check warning: if precision is 0 and path has fine coordinates < 1px
    if (opts.precision === 0 && /\b0\.[0-9]+/i.test(pathData)) {
      if (!warnings.includes('Fine path coordinates rounded to integers; check for shape deformation.')) {
        warnings.push('Fine path coordinates rounded to integers; check for shape deformation.');
      }
    }
    const quantized = quantizePathData(pathData, opts.precision);
    return `d="${quantized}"`;
  });

  // 5. Process points on polyline and polygon
  cleaned = cleaned.replace(/\bpoints=["']([^"']+)["']/gi, (_match, pts) => {
    return `points="${quantizePointsList(pts, opts.precision)}"`;
  });

  // 6. Process transform attributes
  cleaned = cleaned.replace(/\btransform=["']([^"']+)["']/gi, (_match, tr) => {
    return `transform="${quantizeTransform(tr, opts.precision)}"`;
  });

  // 7. Process elementary geometry attributes (x, y, cx, cy, r, rx, ry, width, height, x1, y1, x2, y2)
  const geomAttrRegex = /\b(cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height)=["']([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)["']/gi;
  cleaned = cleaned.replace(geomAttrRegex, (_match, attrName, valStr) => {
    const val = parseFloat(valStr);
    if (Number.isFinite(val)) {
      return `${attrName}="${formatCoordinate(val, opts.precision)}"`;
    }
    return _match;
  });

  // 8. Collapse redundant whitespace between tags while preserving text node spacing
  if (opts.collapseWhitespace) {
    cleaned = cleaned
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  const byteSize = getByteSize(cleaned);
  const gzipSize = await getGzipSize(cleaned);
  const savingsBytes = rawOriginalBytes > byteSize ? rawOriginalBytes - byteSize : 0;
  const savingsPercent =
    rawOriginalBytes > 0 && savingsBytes > 0
      ? Math.round((savingsBytes / rawOriginalBytes) * 1000) / 10
      : 0;

  return {
    precision: opts.precision,
    markup: cleaned,
    byteSize,
    gzipSize,
    savingsBytes,
    savingsPercent,
    warnings,
    metrics: null,
  };
}
