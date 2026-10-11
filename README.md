# SVG Precision Lab — Zero-Install SVG Path Precision Optimizer

> Zero-install, browser-based SVG path precision optimizer with visual-error tolerance budgeting and pixel diff heatmap verification.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Network Dependencies](https://img.shields.io/badge/Privacy-100%25%20Client--Side-emerald.svg)](README.md)

---

## Overview

Most SVG optimizers either provide a single decimal slider (like SVGOMG) without perceptual error feedback, or operate headlessly via CLI (like SVGO) where visual degradation cannot be inspected. 

**SVG Precision Lab** introduces **Visual-Error Tolerance Budgeting**:
1. It analyzes your SVG across multiple precision tiers (`P3`, `P2`, `P1`, `P0`).
2. Renders original and candidate outputs under controlled canvas conditions.
3. Quantifies mathematical pixel divergence (MAE, Diff Percentage, Max Channel Delta, PSNR).
4. Recommends the smallest file that remains strictly within your selected visual tolerance budget.
5. Provides three interactive visual comparison modes (Side-by-Side, Onion Skin, and Diff Heatmap) so you can verify rendering fidelity before saving.

---

## Key Features

- **Tolerance Budgeting Presets:**
  - **Strict ($\le 0.1\%$ diff):** Sub-pixel accuracy. Best for fine logos, typography, and precision icons.
  - **Balanced ($\le 0.5\%$ diff):** Production default. Coordinate rounding imperceptible at standard display scales.
  - **Compact ($\le 1.5\%$ diff):** Aggressive quantization for maximum file reduction. Best for decorative backgrounds and hero graphics.
  - **Custom:** Interactive slider from $0.05\%$ to $3.00\%$ for fine-tuned error limits.
- **Three Inspection Modes:**
  - **Side-by-Side:** Direct side-by-side comparison with real-time file size and savings badges.
  - **Onion Skin:** Interactive opacity slider ($0\%-100\%$) to scrub between original and candidate artwork.
  - **Diff Heatmap:** High-contrast false-color pixel visualization highlighting exactly where coordinates shifted.
- **Semantic & Vector Integrity:**
  - **Arc Flag Protection:** Preserves binary `0`/`1` flags in SVG `A/a` arc commands.
  - **ViewBox Stability:** Enforces decimal safeguards on `viewBox` attributes to prevent aspect ratio collapse.
  - **Affine Matrix Safety:** Retains precision on `transform="matrix(...)"` values to prevent skew distortion.
  - **Defs & Gradients:** Retains `<defs>`, `<linearGradient>`, `<radialGradient>`, `<clipPath>`, `<mask id="...">`, and metadata.
  - **Typography & Accessibility:** Retains `<text>`, `<tspan>`, `<title>`, `<desc>`, `role="img"`, and `aria-*` tags.
- **Privacy Guarantee:**
  - 100% client-side execution in local browser memory. No SVG data is ever transmitted over the network.
- **True Bandwidth Metrics:**
  - Measures both raw UTF-8 byte size and real gzip compression size via web `CompressionStream('gzip')`.

---

## Built-in Test Corpus

SVG Precision Lab comes pre-loaded with five diverse test fixtures:
1. **Precision Badge:** Elliptical arcs, cubic Bézier curves, and symmetric star geometry.
2. **Sub-Pixel Micro-Circuit:** High-density 3-4 decimal coordinates testing quantization limits.
3. **Planetary Gear:** Rotational transforms and affine matrix multipliers.
4. **Volumetric Orb:** Multi-stop gradients, clip paths, and SVG masks.
5. **Typography & Semantics:** Accessible SVG containing semantic text and aria titles.

---

## Getting Started

### Prerequisites
- Node.js >= 20.0.0 (LTS recommended)
- pnpm >= 9.0.0

### Development
```bash
# Install dependencies
pnpm install

# Start local Vite development server
pnpm dev
```

### Production Build & Typecheck
```bash
# Verify TypeScript types
pnpm typecheck

# Run unit tests
pnpm test

# Build production bundle into /dist
pnpm build

# Preview build locally
pnpm preview
```

---

## Technical Disclosure

Pixel diff metrics are computed via a standardized 400×400 canvas rasterizer with sub-pixel thresholding ($8/255$ channel delta) to isolate genuine coordinate shifts from minor raster anti-aliasing variations. Vector rendering remains sharp at all arbitrary display scales.

---

## License

MIT License. Copyright (c) 2026 Project Foundry. Non-commercial personal utility released under Project Foundry.
