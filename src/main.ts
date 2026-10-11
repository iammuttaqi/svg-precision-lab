import type {
  PrecisionTier,
  TolerancePreset,
  ViewMode,
  OptimizationResult,
} from './types.js';
import { TOLERANCE_PRESETS } from './types.js';
import { SAMPLE_SVGS } from './corpus/samples.js';
import { analyzeCandidates, type MultiCandidateAnalysis } from './optimizer/recommender.js';

// Application State
let originalSvgMarkup = SAMPLE_SVGS[0]!.markup;
let activePreset: TolerancePreset = 'balanced';
let customTolerancePct = 1.0;
let currentAnalysis: MultiCandidateAnalysis | null = null;
let activeTier: PrecisionTier = 2;
let activeViewMode: ViewMode = 'side-by-side';
let onionOpacity = 50;

/**
 * Format raw byte size for human-readable display.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Perform analysis across all precision tiers and update state.
 */
async function runAnalysis(): Promise<void> {
  const customConfig =
    activePreset === 'custom'
      ? {
          maxDiffPercent: customTolerancePct,
          name: `Custom (≤ ${customTolerancePct.toFixed(2)}%)`,
        }
      : undefined;

  currentAnalysis = await analyzeCandidates(originalSvgMarkup, activePreset, customConfig);
  activeTier = currentAnalysis.recommendation.recommendedPrecision;
  renderAll();
}

/**
 * Update active tier directly (when user clicks an override button).
 */
function setActiveTier(tier: PrecisionTier): void {
  activeTier = tier;
  renderAll();
}

/**
 * Render all UI components based on current state.
 */
function renderAll(): void {
  if (!currentAnalysis) return;

  const candidate =
    currentAnalysis.candidates.find((c) => c.precision === activeTier) ||
    currentAnalysis.candidates[0]!;

  renderHeaderAndStatus(candidate);
  renderToleranceControls();
  renderRecommendationCard(candidate);
  renderComparisonViews(candidate);
  renderMetricsCards(candidate);
  renderCodeOutput(candidate);
}

function renderHeaderAndStatus(_candidate: OptimizationResult): void {
  // Update sample buttons active state
  const sampleBtns = document.querySelectorAll('.sample-chip');
  sampleBtns.forEach((btn) => {
    const id = btn.getAttribute('data-sample-id');
    const sample = SAMPLE_SVGS.find((s) => s.id === id);
    if (sample && sample.markup.trim() === originalSvgMarkup.trim()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderToleranceControls(): void {
  // Presets
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    const p = btn.getAttribute('data-preset');
    const isAct = p === activePreset;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-checked', isAct ? 'true' : 'false');
  });

  // Custom panel visibility
  const customPanel = document.getElementById('custom-threshold-panel');
  if (customPanel) {
    customPanel.style.display = activePreset === 'custom' ? 'flex' : 'none';
  }
  const customLabel = document.getElementById('custom-tolerance-label');
  if (customLabel) {
    customLabel.textContent = `${customTolerancePct.toFixed(2)}%`;
  }
  const customBadge = document.getElementById('custom-badge-val');
  if (customBadge && activePreset === 'custom') {
    customBadge.textContent = `≤ ${customTolerancePct.toFixed(2)}% diff`;
  }

  // Tier override buttons
  const tierBtns = document.querySelectorAll('.tier-btn');
  tierBtns.forEach((btn) => {
    const tier = Number(btn.getAttribute('data-tier')) as PrecisionTier;
    const isAct = tier === activeTier;
    btn.classList.toggle('active', isAct);

    // Annotate if this tier is the recommended one
    const isRec = currentAnalysis?.recommendation.recommendedPrecision === tier;
    if (isRec) {
      btn.textContent = `P${tier} (Recommended)`;
    } else {
      const label = tier === 0 ? 'Integers' : `${tier} Dec`;
      btn.textContent = `P${tier} (${label})`;
    }
  });
}

function renderRecommendationCard(candidate: OptimizationResult): void {
  if (!currentAnalysis) return;
  const rec = currentAnalysis.recommendation;

  const recCard = document.getElementById('recommendation-card');
  const statusPill = document.getElementById('rec-status-pill');
  const tierBadge = document.getElementById('rec-tier-badge');
  const savingsPct = document.getElementById('rec-savings-pct');
  const explanation = document.getElementById('rec-explanation');

  if (statusPill) {
    statusPill.textContent = rec.meetsTolerance ? 'Optimal Choice' : 'Tightest Tolerance';
  }
  if (tierBadge) {
    tierBadge.textContent = `Precision ${rec.recommendedPrecision}`;
  }
  if (savingsPct) {
    savingsPct.textContent = `-${rec.toleratedSavingsPercent}%`;
  }
  if (explanation) {
    explanation.textContent = rec.reason;
  }

  if (recCard) {
    if (rec.recommendedPrecision === activeTier) {
      recCard.style.borderColor = 'var(--color-sky-500)';
    } else {
      recCard.style.borderColor = 'var(--color-slate-300)';
    }
  }
}

function renderComparisonViews(candidate: OptimizationResult): void {
  // Update view mode tabs
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach((tab) => {
    const mode = tab.getAttribute('data-mode') as ViewMode;
    const isAct = mode === activeViewMode;
    tab.classList.toggle('active', isAct);
    tab.setAttribute('aria-selected', isAct ? 'true' : 'false');
  });

  const panelSide = document.getElementById('panel-side-by-side');
  const panelOnion = document.getElementById('panel-onion-skin');
  const panelHeatmap = document.getElementById('panel-diff-heatmap');

  if (panelSide) panelSide.style.display = activeViewMode === 'side-by-side' ? 'grid' : 'none';
  if (panelOnion) panelOnion.style.display = activeViewMode === 'onion-skin' ? 'flex' : 'none';
  if (panelHeatmap) panelHeatmap.style.display = activeViewMode === 'diff-heatmap' ? 'flex' : 'none';

  // Mode 1: Side by Side
  const origContainer = document.getElementById('orig-svg-container');
  const candContainer = document.getElementById('cand-svg-container');
  const origSizeEl = document.getElementById('frame-orig-size');
  const candSizeEl = document.getElementById('frame-cand-size');
  const candTagEl = document.getElementById('frame-cand-tag');

  if (origContainer) origContainer.innerHTML = originalSvgMarkup;
  if (candContainer) candContainer.innerHTML = candidate.markup;
  if (origSizeEl && currentAnalysis) origSizeEl.textContent = `${formatBytes(currentAnalysis.originalByteSize)} (gzip: ${formatBytes(currentAnalysis.originalGzipSize)})`;
  if (candSizeEl) candSizeEl.textContent = `${formatBytes(candidate.byteSize)} (gzip: ${formatBytes(candidate.gzipSize)})`;
  if (candTagEl) candTagEl.textContent = `P${activeTier} Candidate (${candidate.savingsPercent}% smaller)`;

  // Mode 2: Onion Skin
  const onionOrig = document.getElementById('onion-layer-orig');
  const onionCand = document.getElementById('onion-layer-cand');
  const onionSlider = document.getElementById('onion-slider') as HTMLInputElement | null;
  const onionValue = document.getElementById('onion-value');

  if (onionOrig) onionOrig.innerHTML = originalSvgMarkup;
  if (onionCand) {
    onionCand.innerHTML = candidate.markup;
    onionCand.style.opacity = `${onionOpacity / 100}`;
  }
  if (onionSlider) onionSlider.value = onionOpacity.toString();
  if (onionValue) onionValue.textContent = `${onionOpacity}% Blend`;

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

function renderMetricsCards(candidate: OptimizationResult): void {
  if (!currentAnalysis) return;

  // File size card
  const rawSizeEl = document.getElementById('metric-raw-size');
  const gzipSizeEl = document.getElementById('metric-gzip-size');
  const bytesSavedEl = document.getElementById('metric-bytes-saved');
  const savingsBadge = document.getElementById('metric-savings-badge');

  if (rawSizeEl) rawSizeEl.textContent = `${formatBytes(currentAnalysis.originalByteSize)} → ${formatBytes(candidate.byteSize)}`;
  if (gzipSizeEl) gzipSizeEl.textContent = `${formatBytes(currentAnalysis.originalGzipSize)} → ${formatBytes(candidate.gzipSize)}`;
  if (bytesSavedEl) bytesSavedEl.textContent = `-${formatBytes(candidate.savingsBytes)} raw (${candidate.savingsPercent}%)`;
  if (savingsBadge) savingsBadge.textContent = `${candidate.savingsPercent}% Saved`;

  // Visual diff card
  const diffPctEl = document.getElementById('metric-diff-pct');
  const diffPixelsEl = document.getElementById('metric-diff-pixels');
  const maxDeltaEl = document.getElementById('metric-max-delta');
  const diffBadge = document.getElementById('metric-diff-badge');

  const diffPct = candidate.metrics?.visualDiffPercentage ?? 0;
  const diffPixels = candidate.metrics?.diffPixels ?? 0;
  const totalPixels = candidate.metrics?.totalPixels ?? 160000;
  const maxDelta = candidate.metrics?.maxColorDelta ?? 0;

  if (diffPctEl) diffPctEl.textContent = `${diffPct.toFixed(2)}%`;
  if (diffPixelsEl) diffPixelsEl.textContent = `${diffPixels.toLocaleString()} / ${totalPixels.toLocaleString()}`;
  if (maxDeltaEl) maxDeltaEl.textContent = `${maxDelta} / 255`;
  if (diffBadge) diffBadge.textContent = `${diffPct.toFixed(2)}% Diff`;

  // Signal quality card
  const maeEl = document.getElementById('metric-mae');
  const psnrEl = document.getElementById('metric-psnr');
  const budgetStatusEl = document.getElementById('metric-budget-status');

  const mae = candidate.metrics?.meanAbsoluteError ?? 0;
  const psnr = candidate.metrics?.psnr ?? 99.9;
  const maxDiffAllowed =
    activePreset === 'custom'
      ? customTolerancePct
      : TOLERANCE_PRESETS[activePreset].maxDiffPercent;

  const passes = diffPct <= maxDiffAllowed;

  if (maeEl) maeEl.textContent = mae.toFixed(2);
  if (psnrEl) psnrEl.textContent = `${psnr.toFixed(1)} dB`;
  if (budgetStatusEl) {
    budgetStatusEl.textContent = passes ? 'Passes Budget' : 'Exceeds Budget';
    budgetStatusEl.className = passes ? 'metric-val text-success' : 'metric-val';
    if (!passes) budgetStatusEl.style.color = 'var(--color-rose-600)';
  }
}

function renderCodeOutput(candidate: OptimizationResult): void {
  const codeEl = document.getElementById('code-output');
  const statsEl = document.getElementById('code-stats-text');

  if (codeEl) codeEl.textContent = candidate.markup;
  if (statsEl) {
    const lines = candidate.markup.split('\n').length;
    statsEl.textContent = `${lines} lines • ${formatBytes(candidate.byteSize)}`;
  }
}

/**
 * Download SVG markup as a local file.
 */
function downloadSvg(markup: string, filename: string): void {
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
    SAMPLE_SVGS.forEach((sample, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sample-chip ${index === 0 ? 'active' : ''}`;
      btn.setAttribute('data-sample-id', sample.id);
      btn.textContent = sample.name;
      btn.title = sample.description;
      btn.addEventListener('click', () => {
        originalSvgMarkup = sample.markup;
        runAnalysis();
      });
      sampleContainer.appendChild(btn);
    });
  }

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

  fileInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text && text.includes('<svg')) {
          originalSvgMarkup = text;
          runAnalysis();
        }
      };
      reader.readAsText(file);
    }
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
    const file = e.dataTransfer?.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text && text.includes('<svg')) {
          originalSvgMarkup = text;
          runAnalysis();
        }
      };
      reader.readAsText(file);
    }
  });

  // Paste raw SVG
  const btnProcessPasted = document.getElementById('btn-process-pasted');
  const textarea = document.getElementById('svg-textarea') as HTMLTextAreaElement | null;
  btnProcessPasted?.addEventListener('click', () => {
    const text = textarea?.value;
    if (text && text.includes('<svg')) {
      originalSvgMarkup = text;
      runAnalysis();
    }
  });

  // Tolerance Preset buttons
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset') as TolerancePreset;
      if (p) {
        activePreset = p;
        runAnalysis();
      }
    });
  });

  // Custom tolerance slider
  const customSlider = document.getElementById('custom-tolerance-slider') as HTMLInputElement | null;
  customSlider?.addEventListener('input', () => {
    customTolerancePct = parseFloat(customSlider.value);
    activePreset = 'custom';
    runAnalysis();
  });

  // Tier buttons
  const tierBtns = document.querySelectorAll('.tier-btn');
  tierBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tier = Number(btn.getAttribute('data-tier')) as PrecisionTier;
      setActiveTier(tier);
    });
  });

  // View mode tabs
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode') as ViewMode;
      if (mode) {
        activeViewMode = mode;
        const candidate =
          currentAnalysis?.candidates.find((c) => c.precision === activeTier) ||
          currentAnalysis?.candidates[0];
        if (candidate) renderComparisonViews(candidate);
      }
    });
  });

  // Onion skin slider
  const onionSlider = document.getElementById('onion-slider') as HTMLInputElement | null;
  onionSlider?.addEventListener('input', () => {
    onionOpacity = parseInt(onionSlider.value, 10);
    const onionCand = document.getElementById('onion-layer-cand');
    const onionValue = document.getElementById('onion-value');
    if (onionCand) onionCand.style.opacity = `${onionOpacity / 100}`;
    if (onionValue) onionValue.textContent = `${onionOpacity}% Blend`;
  });

  // Copy Markup
  const btnCopyHeader = document.getElementById('btn-copy-code-header');
  const btnCopy = document.getElementById('btn-copy-code');
  const btnCopyText = document.getElementById('btn-copy-text');

  function handleCopy(): void {
    const candidate =
      currentAnalysis?.candidates.find((c) => c.precision === activeTier) ||
      currentAnalysis?.candidates[0];
    if (candidate) {
      navigator.clipboard.writeText(candidate.markup);
      if (btnCopyText) {
        btnCopyText.textContent = 'Copied!';
        setTimeout(() => {
          btnCopyText.textContent = 'Copy Markup';
        }, 1500);
      }
    }
  }

  btnCopyHeader?.addEventListener('click', handleCopy);
  btnCopy?.addEventListener('click', handleCopy);

  // Download SVG
  const btnDownloadHeader = document.getElementById('btn-download-svg');
  const btnDownload = document.getElementById('btn-download-code');

  function handleDownload(): void {
    const candidate =
      currentAnalysis?.candidates.find((c) => c.precision === activeTier) ||
      currentAnalysis?.candidates[0];
    if (candidate) {
      downloadSvg(candidate.markup, `optimized-p${activeTier}.svg`);
    }
  }

  btnDownloadHeader?.addEventListener('click', handleDownload);
  btnDownload?.addEventListener('click', handleDownload);
}

// Bootstrap on DOM load
if (typeof document !== 'undefined') {
  setupEventListeners();
  runAnalysis();
}
