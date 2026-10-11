import type {
  PrecisionTier,
  TolerancePreset,
  ViewMode,
  OptimizationResult,
  AppState,
} from './types.js';
import { TOLERANCE_PRESETS } from './types.js';
import { SAMPLE_SVGS } from './corpus/samples.js';
import { analyzeCandidates } from './optimizer/recommender.js';
import {
  createInitialState,
  transitionToLoading,
  transitionToError,
  transitionToSuccess,
  setActiveTier,
  setPreset,
  setViewMode,
  setOnionOpacity,
} from './state.js';

// Application State
let state: AppState = createInitialState();

/**
 * Format raw byte size for human-readable display.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Execute candidate analysis for the current SVG markup and update state.
 */
export async function processSvgInput(
  rawInput: string,
  sourceType: AppState['sourceType'],
  sourceName?: string
): Promise<void> {
  const trimmed = rawInput ? rawInput.trim() : '';

  if (!trimmed) {
    state = transitionToError(state, 'Input is empty or whitespace-only.');
    renderAll();
    return;
  }

  if (!trimmed.includes('<svg')) {
    state = transitionToError(state, 'Input does not contain a valid <svg> root element.');
    renderAll();
    return;
  }

  state = transitionToLoading(state, 'optimizing', sourceType, sourceName, trimmed);
  renderAll();

  try {
    const customConfig =
      state.activePreset === 'custom'
        ? {
            maxDiffPercent: state.customTolerancePct,
            name: `Custom (≤ ${state.customTolerancePct.toFixed(2)}%)`,
          }
        : undefined;

    const analysis = await analyzeCandidates(trimmed, state.activePreset, customConfig);
    state = transitionToSuccess(state, analysis, trimmed, sourceType, sourceName);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    state = transitionToError(state, msg);
  }

  renderAll();
}

/**
 * Render all UI components according to current state.
 */
export function renderAll(): void {
  renderActiveSourceBar();
  renderStatusBanners();
  renderToleranceControls();
  renderRecommendationCard();
  renderComparisonViews();
  renderMetricsCards();
  renderCodeOutput();
  renderActionButtons();
}

function renderActiveSourceBar(): void {
  const bar = document.getElementById('active-source-bar');
  const typeTag = document.getElementById('source-type-tag');
  const nameEl = document.getElementById('active-source-name');
  const sizeEl = document.getElementById('active-source-size');

  // Update sample buttons active state
  const sampleBtns = document.querySelectorAll('.sample-chip');
  sampleBtns.forEach((btn) => {
    const id = btn.getAttribute('data-sample-id');
    const sample = SAMPLE_SVGS.find((s) => s.id === id);
    const isAct =
      state.phase === 'success' &&
      state.sourceType === 'sample' &&
      sample &&
      sample.markup.trim() === state.originalSvg.trim();
    btn.classList.toggle('active', !!isAct);
  });

  if (!bar) return;

  if (state.phase === 'success' && state.sourceType !== 'none') {
    bar.style.display = 'flex';
    if (typeTag) {
      typeTag.textContent =
        state.sourceType === 'sample'
          ? 'Sample Fixture'
          : state.sourceType === 'file'
          ? 'File Upload'
          : 'Pasted SVG';
    }
    if (nameEl) {
      nameEl.textContent = state.sourceName || 'Custom SVG';
    }
    if (sizeEl && state.currentAnalysis) {
      sizeEl.textContent = `${formatBytes(state.currentAnalysis.originalByteSize)} (gzip: ${formatBytes(state.currentAnalysis.originalGzipSize)})`;
    }
  } else {
    bar.style.display = 'none';
  }
}

function renderStatusBanners(): void {
  const errorBanner = document.getElementById('error-banner');
  const errorMsg = document.getElementById('error-message-text');
  const procBanner = document.getElementById('processing-banner');
  const procMsg = document.getElementById('processing-message-text');

  if (errorBanner) {
    if (state.phase === 'error') {
      errorBanner.style.display = 'flex';
      if (errorMsg) errorMsg.textContent = state.errorMessage || 'An error occurred during SVG optimization.';
    } else {
      errorBanner.style.display = 'none';
    }
  }

  if (procBanner) {
    const isLoading = state.phase === 'parsing' || state.phase === 'optimizing' || state.phase === 'comparing';
    if (isLoading) {
      procBanner.style.display = 'flex';
      if (procMsg) {
        procMsg.textContent =
          state.phase === 'comparing'
            ? 'Comparing rasterized pixel differences...'
            : 'Evaluating candidate precision tiers against tolerance budget...';
      }
    } else {
      procBanner.style.display = 'none';
    }
  }
}

function renderToleranceControls(): void {
  // Presets
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    const p = btn.getAttribute('data-preset');
    const isAct = p === state.activePreset;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-checked', isAct ? 'true' : 'false');
  });

  // Custom panel visibility
  const customPanel = document.getElementById('custom-threshold-panel');
  if (customPanel) {
    customPanel.style.display = state.activePreset === 'custom' ? 'flex' : 'none';
  }
  const customLabel = document.getElementById('custom-tolerance-label');
  if (customLabel) {
    customLabel.textContent = `${state.customTolerancePct.toFixed(2)}%`;
  }
  const customBadge = document.getElementById('custom-badge-val');
  if (customBadge && state.activePreset === 'custom') {
    customBadge.textContent = `≤ ${state.customTolerancePct.toFixed(2)}% diff`;
  }

  // Tier override buttons
  const tierBtns = document.querySelectorAll('.tier-btn');
  tierBtns.forEach((btn) => {
    const tier = Number(btn.getAttribute('data-tier')) as PrecisionTier;
    const isAct = state.activeTier === tier && state.phase === 'success';
    btn.classList.toggle('active', isAct);

    if (state.phase === 'success') {
      btn.removeAttribute('disabled');
      const isRec = state.currentAnalysis?.recommendation.recommendedPrecision === tier;
      if (isRec) {
        btn.textContent = `P${tier} (Recommended)`;
      } else {
        const label = tier === 0 ? 'Integers' : `${tier} Dec`;
        btn.textContent = `P${tier} (${label})`;
      }
    } else {
      btn.setAttribute('disabled', 'true');
      const label = tier === 0 ? 'Integers' : `${tier} Dec`;
      btn.textContent = `P${tier} (${label})`;
    }
  });
}

function renderRecommendationCard(): void {
  const recCard = document.getElementById('recommendation-card');
  const statusPill = document.getElementById('rec-status-pill');
  const tierBadge = document.getElementById('rec-tier-badge');
  const savingsPct = document.getElementById('rec-savings-pct');
  const explanation = document.getElementById('rec-explanation');

  if (state.phase === 'success' && state.currentAnalysis) {
    const rec = state.currentAnalysis.recommendation;
    if (statusPill) {
      statusPill.textContent = rec.meetsTolerance ? 'Optimal Choice' : 'Tightest Tolerance';
      statusPill.className = 'rec-pill';
    }
    if (tierBadge) {
      tierBadge.textContent = `Precision ${rec.recommendedPrecision}`;
    }
    if (savingsPct) {
      savingsPct.textContent = rec.toleratedSavingsPercent > 0 ? `-${rec.toleratedSavingsPercent}%` : '0%';
    }
    if (explanation) {
      explanation.textContent = rec.reason;
    }
    if (recCard) {
      recCard.style.borderColor = 'var(--color-sky-500)';
    }
  } else if (state.phase === 'error') {
    if (statusPill) {
      statusPill.textContent = 'Error';
      statusPill.className = 'rec-pill pill-error';
    }
    if (tierBadge) tierBadge.textContent = '—';
    if (savingsPct) savingsPct.textContent = '—';
    if (explanation) {
      explanation.textContent = `Could not optimize input: ${state.errorMessage || 'Invalid SVG'}. Please check your markup and try again.`;
    }
    if (recCard) {
      recCard.style.borderColor = 'var(--color-rose-600)';
    }
  } else {
    // Empty or loading state
    if (statusPill) {
      statusPill.textContent = state.phase === 'optimizing' ? 'Analyzing...' : 'Awaiting Input';
      statusPill.className = 'rec-pill pill-neutral';
    }
    if (tierBadge) tierBadge.textContent = '—';
    if (savingsPct) savingsPct.textContent = '—';
    if (explanation) {
      explanation.textContent =
        state.phase === 'optimizing'
          ? 'Evaluating candidate precision tiers against your visual-error budget...'
          : 'Select a sample fixture above, drop an SVG file, or paste markup to evaluate candidate precision tiers.';
    }
    if (recCard) {
      recCard.style.borderColor = 'var(--color-slate-200)';
    }
  }
}

function renderComparisonViews(): void {
  // Update view mode tabs
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach((tab) => {
    const mode = tab.getAttribute('data-mode') as ViewMode;
    const isAct = mode === state.activeViewMode;
    tab.classList.toggle('active', isAct);
    tab.setAttribute('aria-selected', isAct ? 'true' : 'false');
  });

  const emptyViewport = document.getElementById('empty-viewport');
  const panelSide = document.getElementById('panel-side-by-side');
  const panelOnion = document.getElementById('panel-onion-skin');
  const panelHeatmap = document.getElementById('panel-diff-heatmap');

  const candidate =
    state.phase === 'success' && state.currentAnalysis
      ? state.currentAnalysis.candidates.find((c) => c.precision === state.activeTier) ||
        state.currentAnalysis.candidates[0]!
      : null;

  if (!candidate || state.phase !== 'success') {
    // Show empty viewport, hide comparison panels
    if (emptyViewport) emptyViewport.style.display = 'flex';
    if (panelSide) panelSide.style.display = 'none';
    if (panelOnion) panelOnion.style.display = 'none';
    if (panelHeatmap) panelHeatmap.style.display = 'none';
    return;
  }

  // Active success state: hide empty viewport, show active panel
  if (emptyViewport) emptyViewport.style.display = 'none';
  if (panelSide) panelSide.style.display = state.activeViewMode === 'side-by-side' ? 'grid' : 'none';
  if (panelOnion) panelOnion.style.display = state.activeViewMode === 'onion-skin' ? 'flex' : 'none';
  if (panelHeatmap) panelHeatmap.style.display = state.activeViewMode === 'diff-heatmap' ? 'flex' : 'none';

  // Mode 1: Side by Side
  const origContainer = document.getElementById('orig-svg-container');
  const candContainer = document.getElementById('cand-svg-container');
  const origSizeEl = document.getElementById('frame-orig-size');
  const candSizeEl = document.getElementById('frame-cand-size');
  const candTagEl = document.getElementById('frame-cand-tag');

  if (origContainer) origContainer.innerHTML = state.originalSvg;
  if (candContainer) candContainer.innerHTML = candidate.markup;
  if (origSizeEl && state.currentAnalysis) {
    origSizeEl.textContent = `${formatBytes(state.currentAnalysis.originalByteSize)} (gzip: ${formatBytes(state.currentAnalysis.originalGzipSize)})`;
  }
  if (candSizeEl) {
    candSizeEl.textContent = `${formatBytes(candidate.byteSize)} (gzip: ${formatBytes(candidate.gzipSize)})`;
  }
  if (candTagEl) {
    const savingsLabel = candidate.savingsPercent > 0 ? `${candidate.savingsPercent}% smaller` : 'same size';
    candTagEl.textContent = `P${state.activeTier} Candidate (${savingsLabel})`;
  }

  // Mode 2: Onion Skin
  const onionOrig = document.getElementById('onion-layer-orig');
  const onionCand = document.getElementById('onion-layer-cand');
  const onionSlider = document.getElementById('onion-slider') as HTMLInputElement | null;
  const onionValue = document.getElementById('onion-value');

  if (onionOrig) onionOrig.innerHTML = state.originalSvg;
  if (onionCand) {
    onionCand.innerHTML = candidate.markup;
    onionCand.style.opacity = `${state.onionOpacity / 100}`;
  }
  if (onionSlider) onionSlider.value = state.onionOpacity.toString();
  if (onionValue) onionValue.textContent = `${state.onionOpacity}% Blend`;

  // Mode 3: Diff Heatmap
  const heatmapImg = document.getElementById('heatmap-image') as HTMLImageElement | null;
  const heatmapMeta = document.getElementById('heatmap-meta-text');

  if (heatmapImg && candidate.metrics?.diffDataUrl) {
    heatmapImg.src = candidate.metrics.diffDataUrl;
    heatmapImg.style.display = 'block';
  } else if (heatmapImg) {
    heatmapImg.style.display = 'none';
  }

  if (heatmapMeta && candidate.metrics) {
    heatmapMeta.textContent = `${candidate.metrics.diffPixels.toLocaleString()} altered pixels (${candidate.metrics.visualDiffPercentage}% of 400×400 canvas)`;
  }
}

function renderMetricsCards(): void {
  // File size card
  const rawSizeEl = document.getElementById('metric-raw-size');
  const gzipSizeEl = document.getElementById('metric-gzip-size');
  const bytesSavedEl = document.getElementById('metric-bytes-saved');
  const savingsBadge = document.getElementById('metric-savings-badge');

  // Visual diff card
  const diffPctEl = document.getElementById('metric-diff-pct');
  const diffPixelsEl = document.getElementById('metric-diff-pixels');
  const maxDeltaEl = document.getElementById('metric-max-delta');
  const diffBadge = document.getElementById('metric-diff-badge');

  // Signal quality card
  const maeEl = document.getElementById('metric-mae');
  const psnrEl = document.getElementById('metric-psnr');
  const budgetStatusEl = document.getElementById('metric-budget-status');
  const fidelityBadge = document.getElementById('metric-fidelity-badge');

  const candidate =
    state.phase === 'success' && state.currentAnalysis
      ? state.currentAnalysis.candidates.find((c) => c.precision === state.activeTier) ||
        state.currentAnalysis.candidates[0]!
      : null;

  if (!candidate || state.phase !== 'success' || !state.currentAnalysis) {
    // Reset all to empty/dash values
    if (rawSizeEl) rawSizeEl.textContent = '—';
    if (gzipSizeEl) gzipSizeEl.textContent = '—';
    if (bytesSavedEl) {
      bytesSavedEl.textContent = '—';
      bytesSavedEl.className = 'metric-val';
    }
    if (savingsBadge) savingsBadge.textContent = '—';

    if (diffPctEl) diffPctEl.textContent = '—';
    if (diffPixelsEl) diffPixelsEl.textContent = '—';
    if (maxDeltaEl) maxDeltaEl.textContent = '—';
    if (diffBadge) diffBadge.textContent = '—';

    if (maeEl) maeEl.textContent = '—';
    if (psnrEl) psnrEl.textContent = '—';
    if (budgetStatusEl) {
      budgetStatusEl.textContent = 'Awaiting Input';
      budgetStatusEl.className = 'metric-val';
    }
    if (fidelityBadge) fidelityBadge.textContent = '—';
    return;
  }

  // Active candidate metrics
  if (rawSizeEl) rawSizeEl.textContent = `${formatBytes(state.currentAnalysis.originalByteSize)} → ${formatBytes(candidate.byteSize)}`;
  if (gzipSizeEl) gzipSizeEl.textContent = `${formatBytes(state.currentAnalysis.originalGzipSize)} → ${formatBytes(candidate.gzipSize)}`;
  if (bytesSavedEl) {
    if (candidate.savingsBytes > 0) {
      bytesSavedEl.textContent = `-${formatBytes(candidate.savingsBytes)} raw (${candidate.savingsPercent}%)`;
      bytesSavedEl.className = 'metric-val text-success';
    } else {
      bytesSavedEl.textContent = '0 B (0%)';
      bytesSavedEl.className = 'metric-val';
    }
  }
  if (savingsBadge) savingsBadge.textContent = `${candidate.savingsPercent}% Saved`;

  const diffPct = candidate.metrics?.visualDiffPercentage ?? 0;
  const diffPixels = candidate.metrics?.diffPixels ?? 0;
  const totalPixels = candidate.metrics?.totalPixels ?? 160000;
  const maxDelta = candidate.metrics?.maxColorDelta ?? 0;

  if (diffPctEl) diffPctEl.textContent = `${diffPct.toFixed(2)}%`;
  if (diffPixelsEl) diffPixelsEl.textContent = `${diffPixels.toLocaleString()} / ${totalPixels.toLocaleString()}`;
  if (maxDeltaEl) maxDeltaEl.textContent = `${maxDelta} / 255`;
  if (diffBadge) diffBadge.textContent = `${diffPct.toFixed(2)}% Diff`;

  const mae = candidate.metrics?.meanAbsoluteError ?? 0;
  const psnr = candidate.metrics?.psnr ?? 99.9;
  const maxDiffAllowed =
    state.activePreset === 'custom'
      ? state.customTolerancePct
      : TOLERANCE_PRESETS[state.activePreset].maxDiffPercent;

  const passes = diffPct <= maxDiffAllowed;

  if (maeEl) maeEl.textContent = mae.toFixed(2);
  if (psnrEl) psnrEl.textContent = `${psnr.toFixed(1)} dB`;
  if (fidelityBadge) fidelityBadge.textContent = passes ? 'Passes Budget' : 'Tolerance Exceeded';
  if (budgetStatusEl) {
    budgetStatusEl.textContent = passes ? 'Within Budget' : 'Exceeds Budget';
    budgetStatusEl.className = passes ? 'metric-val text-success' : 'metric-val';
    if (!passes) budgetStatusEl.style.color = 'var(--color-rose-600)';
  }
}

function renderCodeOutput(): void {
  const codeEl = document.getElementById('code-output');
  const statsEl = document.getElementById('code-stats-text');

  const candidate =
    state.phase === 'success' && state.currentAnalysis
      ? state.currentAnalysis.candidates.find((c) => c.precision === state.activeTier) ||
        state.currentAnalysis.candidates[0]!
      : null;

  if (candidate && state.phase === 'success') {
    if (codeEl) codeEl.textContent = candidate.markup;
    if (statsEl) {
      const lines = candidate.markup.split('\n').length;
      statsEl.textContent = `${lines} lines • ${formatBytes(candidate.byteSize)}`;
    }
  } else if (state.phase === 'error') {
    if (codeEl) codeEl.textContent = `<!-- Optimization failed: ${state.errorMessage || 'Invalid SVG'} -->`;
    if (statsEl) statsEl.textContent = '0 lines • 0 B';
  } else {
    if (codeEl) {
      codeEl.textContent =
        '<!-- Awaiting SVG input. Choose a test sample, drop an SVG file, or paste markup above to view optimized output. -->';
    }
    if (statsEl) statsEl.textContent = '0 lines • 0 B';
  }
}

function renderActionButtons(): void {
  const isReady = state.phase === 'success' && state.currentAnalysis !== null;

  const btnCopyHeader = document.getElementById('btn-copy-code-header') as HTMLButtonElement | null;
  const btnDownloadHeader = document.getElementById('btn-download-svg') as HTMLButtonElement | null;
  const btnCopy = document.getElementById('btn-copy-code') as HTMLButtonElement | null;
  const btnDownload = document.getElementById('btn-download-code') as HTMLButtonElement | null;

  [btnCopyHeader, btnDownloadHeader, btnCopy, btnDownload].forEach((btn) => {
    if (btn) {
      if (isReady) {
        btn.removeAttribute('disabled');
      } else {
        btn.setAttribute('disabled', 'true');
      }
    }
  });
}

/**
 * Download SVG markup as a local file.
 */
export function downloadSvg(markup: string, filename: string): void {
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Setup event listeners.
 */
function setupEventListeners(): void {
  // Sample buttons
  const sampleContainer = document.getElementById('sample-buttons-container');
  if (sampleContainer) {
    sampleContainer.innerHTML = '';
    SAMPLE_SVGS.forEach((sample) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sample-chip';
      btn.setAttribute('data-sample-id', sample.id);
      btn.textContent = sample.name;
      btn.title = sample.description;
      btn.addEventListener('click', () => {
        processSvgInput(sample.markup, 'sample', sample.name);
      });
      sampleContainer.appendChild(btn);
    });
  }

  // Clear button
  const btnClear = document.getElementById('btn-clear-input');
  btnClear?.addEventListener('click', () => {
    state = createInitialState();
    renderAll();
  });

  // File dropzone & file picker
  const dropzone = document.getElementById('svg-dropzone');
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  const browseBtn = document.getElementById('btn-browse-file');

  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  dropzone?.addEventListener('click', () => {
    fileInput?.click();
  });

  function handleFile(file?: File): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processSvgInput(text, 'file', file.name);
    };
    reader.onerror = () => {
      state = transitionToError(state, `Failed to read file ${file.name}.`);
      renderAll();
    };
    reader.readAsText(file);
  }

  fileInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    handleFile(target.files?.[0]);
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleFile(e.dataTransfer?.files[0]);
  });

  // Paste raw SVG
  const btnProcessPasted = document.getElementById('btn-process-pasted');
  const textarea = document.getElementById('svg-textarea') as HTMLTextAreaElement | null;
  btnProcessPasted?.addEventListener('click', () => {
    const text = textarea?.value ?? '';
    processSvgInput(text, 'pasted', 'Pasted SVG');
  });

  // Tolerance Preset buttons
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset') as TolerancePreset;
      if (p) {
        state = setPreset(state, p);
        if (state.originalSvg && state.phase === 'success') {
          processSvgInput(state.originalSvg, state.sourceType, state.sourceName);
        } else {
          renderAll();
        }
      }
    });
  });

  // Custom tolerance slider
  const customSlider = document.getElementById('custom-tolerance-slider') as HTMLInputElement | null;
  customSlider?.addEventListener('input', () => {
    const val = parseFloat(customSlider.value);
    state = setPreset(state, 'custom', val);
    if (state.originalSvg && state.phase === 'success') {
      processSvgInput(state.originalSvg, state.sourceType, state.sourceName);
    } else {
      renderAll();
    }
  });

  // Tier override buttons
  const tierBtns = document.querySelectorAll('.tier-btn');
  tierBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.phase === 'success') {
        const tier = Number(btn.getAttribute('data-tier')) as PrecisionTier;
        state = setActiveTier(state, tier);
        renderAll();
      }
    });
  });

  // View mode tabs
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode') as ViewMode;
      if (mode) {
        state = setViewMode(state, mode);
        renderComparisonViews();
      }
    });
  });

  // Onion skin slider
  const onionSlider = document.getElementById('onion-slider') as HTMLInputElement | null;
  onionSlider?.addEventListener('input', () => {
    const op = parseInt(onionSlider.value, 10);
    state = setOnionOpacity(state, op);
    const onionCand = document.getElementById('onion-layer-cand');
    const onionValue = document.getElementById('onion-value');
    if (onionCand) onionCand.style.opacity = `${state.onionOpacity / 100}`;
    if (onionValue) onionValue.textContent = `${state.onionOpacity}% Blend`;
  });

  // Copy Markup
  const btnCopyHeader = document.getElementById('btn-copy-code-header');
  const btnCopy = document.getElementById('btn-copy-code');
  const btnCopyText = document.getElementById('btn-copy-text');

  function handleCopy(): void {
    if (state.phase !== 'success' || !state.currentAnalysis) return;
    const candidate =
      state.currentAnalysis.candidates.find((c) => c.precision === state.activeTier) ||
      state.currentAnalysis.candidates[0]!;

    navigator.clipboard.writeText(candidate.markup);
    if (btnCopyText) {
      btnCopyText.textContent = 'Copied!';
      setTimeout(() => {
        btnCopyText.textContent = 'Copy Markup';
      }, 1500);
    }
  }

  btnCopyHeader?.addEventListener('click', handleCopy);
  btnCopy?.addEventListener('click', handleCopy);

  // Download SVG
  const btnDownloadHeader = document.getElementById('btn-download-svg');
  const btnDownload = document.getElementById('btn-download-code');

  function handleDownload(): void {
    if (state.phase !== 'success' || !state.currentAnalysis) return;
    const candidate =
      state.currentAnalysis.candidates.find((c) => c.precision === state.activeTier) ||
      state.currentAnalysis.candidates[0]!;

    const baseName = state.sourceName?.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'optimized';
    downloadSvg(candidate.markup, `${baseName}-p${state.activeTier}.svg`);
  }

  btnDownloadHeader?.addEventListener('click', handleDownload);
  btnDownload?.addEventListener('click', handleDownload);
}

// Bootstrap on DOM load
if (typeof document !== 'undefined') {
  setupEventListeners();
  // Start in intentional empty state: no fake claims, no automatic optimization until input is loaded
  renderAll();
}
