import type { SvgSample } from '../types.js';

export const SAMPLE_SVGS: SvgSample[] = [
  {
    id: 'precision-badge',
    name: 'Precision Badge (Arcs & Curves)',
    description: 'Elliptical arcs, smooth cubic Bézier curves, and symmetric star geometry.',
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="Precision Badge">
  <title>Precision Geometric Badge</title>
  <defs>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0369a1" stop-opacity="0.2" />
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="#f8fafc" />
  <!-- Outer outer arc ring -->
  <path d="M 200.000 30.000 A 170.000 170.000 0 1 1 199.900 30.000 Z" fill="none" stroke="url(#ringGrad)" stroke-width="12.500" />
  <!-- Smooth Bézier emblem -->
  <path d="M 200.000 65.542 C 245.123 65.542 334.456 102.345 334.456 195.678 C 334.456 288.901 254.321 334.456 200.000 334.456 C 145.679 334.456 65.544 288.901 65.544 195.678 C 65.544 102.345 154.877 65.542 200.000 65.542 Z" fill="url(#badgeGrad)" />
  <!-- Precision star path with arc cutouts -->
  <path d="M 200.000 110.125 L 224.719 160.203 L 279.973 168.232 L 239.986 207.202 L 249.426 262.228 L 200.000 236.242 L 150.574 262.228 L 160.014 207.202 L 120.027 168.232 L 175.281 160.203 Z" fill="#ffffff" stroke="#0284c7" stroke-width="3.250" stroke-linejoin="round" />
  <circle cx="200.000" cy="200.000" r="18.750" fill="#0284c7" />
  <circle cx="200.000" cy="200.000" r="8.250" fill="#ffffff" />
</svg>`,
  },
  {
    id: 'subpixel-schematic',
    name: 'Sub-Pixel Micro-Circuit (Fine Coordinates)',
    description: 'High-density decimal coordinates (3-4 decimals) testing coordinate quantization limits.',
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="Micro-Circuit Schematic">
  <title>Micro-Circuit Vector Schematic</title>
  <rect width="400" height="400" fill="#0b1329" />
  <!-- Grid of microscopic bus lines -->
  <g stroke="#38bdf8" stroke-width="1.250" fill="none" opacity="0.85">
    <path d="M 50.125 50.375 L 120.625 50.375 L 150.875 80.625 L 250.375 80.625 L 280.625 50.375 L 349.875 50.375" />
    <path d="M 50.125 120.250 L 95.375 120.250 L 135.625 160.500 L 265.375 160.500 L 305.625 120.250 L 349.875 120.250" />
    <path d="M 50.125 200.125 L 180.250 200.125 L 200.500 220.375 L 220.750 200.125 L 349.875 200.125" />
    <path d="M 50.125 280.750 L 110.250 280.750 L 140.500 250.500 L 260.500 250.500 L 290.750 280.750 L 349.875 280.750" />
    <path d="M 50.125 349.625 L 130.375 349.625 L 170.625 309.375 L 230.375 309.375 L 270.625 349.625 L 349.875 349.625" />
  </g>
  <!-- Micro nodes with fine center coordinates -->
  <g fill="#38bdf8">
    <circle cx="150.875" cy="80.625" r="4.125" />
    <circle cx="250.375" cy="80.625" r="4.125" />
    <circle cx="135.625" cy="160.500" r="4.125" />
    <circle cx="265.375" cy="160.500" r="4.125" />
    <circle cx="200.500" cy="220.375" r="5.250" fill="#f43f5e" />
    <circle cx="140.500" cy="250.500" r="4.125" />
    <circle cx="260.500" cy="250.500" r="4.125" />
  </g>
  <!-- Central processor unit polygon -->
  <polygon points="175.250,175.250 225.750,175.250 225.750,225.750 175.250,225.750" fill="#1e293b" stroke="#f43f5e" stroke-width="2.125" />
</svg>`,
  },
  {
    id: 'transform-matrix-gear',
    name: 'Planetary Gear (Nested Transforms & Matrices)',
    description: 'Complex rotational transforms and affine matrix multipliers.',
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="Planetary Gear">
  <title>Planetary Gear Mechanism</title>
  <rect width="400" height="400" fill="#f1f5f9" />
  <g transform="translate(200.000, 200.000)">
    <!-- Central Hub -->
    <circle cx="0.000" cy="0.000" r="45.000" fill="#0f172a" />
    <circle cx="0.000" cy="0.000" r="18.500" fill="#ffffff" />
    <!-- 8 Cog teeth using matrix transforms -->
    <g fill="#334155">
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(1.000, 0.000, 0.000, 1.000, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(0.7071, 0.7071, -0.7071, 0.7071, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(0.000, 1.000, -1.000, 0.000, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(-0.7071, 0.7071, -0.7071, -0.7071, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(-1.000, 0.000, 0.000, -1.000, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(-0.7071, -0.7071, 0.7071, -0.7071, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(0.000, -1.000, 1.000, 0.000, 0.000, 0.000)" />
      <rect x="-12.500" y="-120.000" width="25.000" height="30.000" rx="4.000" transform="matrix(0.7071, -0.7071, 0.7071, 0.7071, 0.000, 0.000)" />
    </g>
    <!-- Outer Gear Body Ring -->
    <circle cx="0.000" cy="0.000" r="100.000" fill="none" stroke="#334155" stroke-width="22.000" />
    <circle cx="0.000" cy="0.000" r="75.000" fill="none" stroke="#0284c7" stroke-width="3.500" stroke-dasharray="12 6" />
  </g>
</svg>`,
  },
  {
    id: 'gradient-mask-sphere',
    name: 'Volumetric Orb (Defs, Gradients & Clip Paths)',
    description: 'Multi-stop gradients, clip paths, and SVG masks preserving semantic structures.',
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="Volumetric Orb">
  <title>Volumetric Orb Vector Asset</title>
  <defs>
    <radialGradient id="sphereGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="45%" stop-color="#0284c7" />
      <stop offset="85%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <clipPath id="circleClip">
      <circle cx="200.000" cy="200.000" r="120.000" />
    </clipPath>
    <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="#020617" />
  <g clip-path="url(#circleClip)">
    <circle cx="200.000" cy="200.000" r="120.000" fill="url(#sphereGrad)" />
    <!-- Ambient specular reflection arc -->
    <ellipse cx="165.000" cy="130.000" rx="60.000" ry="32.000" fill="url(#highlightGrad)" transform="rotate(-25.000, 165.000, 130.000)" />
    <!-- Equatorial rim bands -->
    <path d="M 80.000 200.000 Q 200.000 260.000 320.000 200.000" fill="none" stroke="#38bdf8" stroke-width="2.500" opacity="0.4" />
    <path d="M 95.000 230.000 Q 200.000 280.000 305.000 230.000" fill="none" stroke="#38bdf8" stroke-width="1.800" opacity="0.3" />
  </g>
</svg>`,
  },
  {
    id: 'typography-badge',
    name: 'Typography & Semantics (Text, Title, Aria)',
    description: 'SVG with semantic text elements, tspan, accessible title, and descriptive metadata.',
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-labelledby="svgTitle svgDesc">
  <title id="svgTitle">Precision Engineering Certified</title>
  <desc id="svgDesc">An authentic certification badge vector asset containing typography and vector stars.</desc>
  <rect width="400" height="400" fill="#f8fafc" />
  <circle cx="200.000" cy="200.000" r="150.000" fill="#ffffff" stroke="#0f172a" stroke-width="6.000" />
  <circle cx="200.000" cy="200.000" r="135.000" fill="none" stroke="#0284c7" stroke-width="2.500" stroke-dasharray="6 4" />
  <!-- Typography nodes -->
  <text x="200.000" y="145.000" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20.000" font-weight="700" text-anchor="middle" fill="#0f172a" letter-spacing="3.000">PROJECT FOUNDRY</text>
  <text x="200.000" y="195.000" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36.000" font-weight="900" text-anchor="middle" fill="#0284c7">PRECISION</text>
  <text x="200.000" y="240.000" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16.000" font-weight="600" text-anchor="middle" fill="#64748b" letter-spacing="5.000">CERTIFIED SVG</text>
  <!-- Three rating stars -->
  <g fill="#f59e0b" transform="translate(140.000, 260.000)">
    <polygon points="15.000,2.000 19.000,10.000 28.000,11.000 21.000,17.000 23.000,26.000 15.000,21.000 7.000,26.000 9.000,17.000 2.000,11.000 11.000,10.000" />
    <polygon points="60.000,2.000 64.000,10.000 73.000,11.000 66.000,17.000 68.000,26.000 60.000,21.000 52.000,26.000 54.000,17.000 47.000,11.000 56.000,10.000" />
    <polygon points="105.000,2.000 109.000,10.000 118.000,11.000 111.000,17.000 113.000,26.000 105.000,21.000 97.000,26.000 99.000,17.000 92.000,11.000 101.000,10.000" />
  </g>
</svg>`,
  },
];
