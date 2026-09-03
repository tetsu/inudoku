export type ShibaType = 'aka' | 'kuro' | 'shiro';

interface ShibaTheme {
  bodyGradStart: string;
  bodyGradEnd: string;
  bodyDark: string;
  muzzleGradStart: string;
  muzzleGradEnd: string;
  earInnerStart: string;
  earInnerEnd: string;
  eyes: string;
  nose: string;
  cheeks: string;
  pawColor: string;
}

const SHIBA_THEMES: Record<ShibaType, ShibaTheme> = {
  aka: {
    bodyGradStart: '#F59E0B',
    bodyGradEnd: '#D97706',
    bodyDark: '#B45309',
    muzzleGradStart: '#FFFDF9',
    muzzleGradEnd: '#FDF3E7',
    earInnerStart: '#FCA5A5',
    earInnerEnd: '#F87171',
    eyes: '#1C1917',
    nose: '#1C1917',
    cheeks: '#FB7185',
    pawColor: '#78350F',
  },
  kuro: {
    bodyGradStart: '#4B5563',
    bodyGradEnd: '#1F2937',
    bodyDark: '#111827',
    muzzleGradStart: '#FEF3C7',
    muzzleGradEnd: '#FDE68A',
    earInnerStart: '#9CA3AF',
    earInnerEnd: '#6B7280',
    eyes: '#030712',
    nose: '#030712',
    cheeks: '#F43F5E',
    pawColor: '#374151',
  },
  shiro: {
    bodyGradStart: '#FFFFFF',
    bodyGradEnd: '#F3F4F6',
    bodyDark: '#E5E7EB',
    muzzleGradStart: '#FFFFFF',
    muzzleGradEnd: '#F9FAFB',
    earInnerStart: '#FCE7F3',
    earInnerEnd: '#F472B6',
    eyes: '#374151',
    nose: '#374151',
    cheeks: '#FB7185',
    pawColor: '#9CA3AF',
  },
};

/**
 * Returns a rich, 3D-like cozy vector SVG for the Shiba Inu (Zoodoku style).
 */
export function getShibaSvg(
  type: ShibaType = 'aka',
  state: 'normal' | 'conflict' | 'happy' = 'normal'
): string {
  const t = SHIBA_THEMES[type] || SHIBA_THEMES.aka;
  const uniqueId = `shiba-${type}-${state}-${Math.random().toString(36).substring(2, 7)}`;

  // Eyes and expression based on state
  let eyesAndMouthSvg = '';
  let sweatOrSparkle = '';

  if (state === 'conflict') {
    // Worried / troubled expression
    eyesAndMouthSvg = `
      <!-- Eyebrows troubled -->
      <ellipse cx="36" cy="38" rx="4.5" ry="3" fill="${t.muzzleGradStart}" transform="rotate(-18 36 38)" />
      <ellipse cx="64" cy="38" rx="4.5" ry="3" fill="${t.muzzleGradStart}" transform="rotate(18 64 38)" />

      <!-- Squint eyes with stress marks -->
      <path d="M 31 52 Q 37 46 43 52" fill="none" stroke="${t.eyes}" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 57 52 Q 63 46 69 52" fill="none" stroke="${t.eyes}" stroke-width="3.5" stroke-linecap="round" />

      <!-- Wavy worried mouth -->
      <path d="M 44 68 Q 50 64 56 68" fill="none" stroke="${t.eyes}" stroke-width="2.6" stroke-linecap="round" />
    `;
    sweatOrSparkle = `
      <!-- Big anime sweat drop -->
      <g class="shiba-sweat">
        <path d="M 76 34 C 76 30 80 25 80 25 C 80 25 84 30 84 34 C 84 37 82 39 80 39 C 78 39 76 37 76 34 Z" fill="#60A5FA" />
        <ellipse cx="78.5" cy="32" rx="1.2" ry="2" fill="#DBEAFE" opacity="0.8" />
      </g>
    `;
  } else if (state === 'happy') {
    // Joyful cheering expression
    eyesAndMouthSvg = `
      <!-- Maro eyebrows -->
      <ellipse cx="35" cy="39" rx="5" ry="3.5" fill="${t.muzzleGradStart}" />
      <ellipse cx="65" cy="39" rx="5" ry="3.5" fill="${t.muzzleGradStart}" />

      <!-- Joyful closed arc eyes -->
      <path d="M 29 52 Q 36 43 43 52" fill="none" stroke="${t.eyes}" stroke-width="4" stroke-linecap="round" />
      <path d="M 57 52 Q 64 43 71 52" fill="none" stroke="${t.eyes}" stroke-width="4" stroke-linecap="round" />

      <!-- Open smiling mouth with pink tongue -->
      <path d="M 42 64 Q 50 78 58 64 Z" fill="#F43F5E" stroke="${t.eyes}" stroke-width="2" stroke-linejoin="round" />
      <path d="M 45 68 Q 50 76 55 68" fill="#FDA4AF" />
    `;
    sweatOrSparkle = `
      <!-- Sparkle stars -->
      <g class="shiba-sparkle">
        <path d="M 18 28 Q 20 22 22 28 Q 28 30 22 32 Q 20 38 18 32 Q 12 30 18 28 Z" fill="#FBBF24" />
        <path d="M 82 24 Q 83.5 19 85 24 Q 90 25.5 85 27 Q 83.5 32 82 27 Q 77 25.5 82 24 Z" fill="#FBBF24" />
      </g>
    `;
  } else {
    // Cute, cozy standard expression (large shiny puppy eyes!)
    eyesAndMouthSvg = `
      <!-- Round Maro eyebrows -->
      <ellipse cx="36" cy="40" rx="4.8" ry="3.8" fill="${t.muzzleGradStart}" />
      <ellipse cx="64" cy="40" rx="4.8" ry="3.8" fill="${t.muzzleGradStart}" />

      <!-- Left Eye with cute shine -->
      <circle cx="36" cy="52" r="6" fill="${t.eyes}" />
      <circle cx="34" cy="50" r="2.2" fill="#FFFFFF" />
      <circle cx="38" cy="54" r="1.1" fill="#FFFFFF" />

      <!-- Right Eye with cute shine -->
      <circle cx="64" cy="52" r="6" fill="${t.eyes}" />
      <circle cx="62" cy="50" r="2.2" fill="#FFFFFF" />
      <circle cx="66" cy="54" r="1.1" fill="#FFFFFF" />

      <!-- Cute w-mouth -->
      <path d="M 43 65 Q 47 69 50 66 Q 53 69 57 65" fill="none" stroke="${t.eyes}" stroke-width="2.6" stroke-linecap="round" />
    `;
  }

  return `
    <svg viewBox="0 0 100 100" class="shiba-svg shiba-${state} shiba-type-${type}">
      <defs>
        <!-- Gradients for rich 3D look -->
        <linearGradient id="${uniqueId}-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${t.bodyGradStart}" />
          <stop offset="100%" stop-color="${t.bodyGradEnd}" />
        </linearGradient>

        <linearGradient id="${uniqueId}-muzzle" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${t.muzzleGradStart}" />
          <stop offset="100%" stop-color="${t.muzzleGradEnd}" />
        </linearGradient>

        <linearGradient id="${uniqueId}-ear" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${t.earInnerStart}" />
          <stop offset="100%" stop-color="${t.earInnerEnd}" />
        </linearGradient>

        <!-- Drop Shadow Filter -->
        <filter id="${uniqueId}-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#451A03" flood-opacity="0.2" />
        </filter>
      </defs>

      <g filter="url(#${uniqueId}-shadow)">
        <!-- Left Ear -->
        <path d="M 21 44 L 29 12 Q 38 20 41 33 Z" fill="url(#${uniqueId}-body)" />
        <path d="M 26 39 L 31 18 Q 36 24 37 32 Z" fill="url(#${uniqueId}-ear)" />

        <!-- Right Ear -->
        <path d="M 79 44 L 71 12 Q 62 20 59 33 Z" fill="url(#${uniqueId}-body)" />
        <path d="M 74 39 L 69 18 Q 64 24 63 32 Z" fill="url(#${uniqueId}-ear)" />

        <!-- Chubby Head -->
        <ellipse cx="50" cy="54" rx="39" ry="34" fill="url(#${uniqueId}-body)" />

        <!-- White Muzzle & Cheeks (Urajiro) with puffy 3D curves -->
        <path d="M 23 62 C 23 46 36 44 50 54 C 64 44 77 46 77 62 C 77 78 65 87 50 87 C 35 87 23 78 23 62 Z" fill="url(#${uniqueId}-muzzle)" />

        <!-- Cute Little Paws peeking from bottom -->
        <ellipse cx="38" cy="85" rx="7" ry="5.5" fill="url(#${uniqueId}-muzzle)" stroke="${t.bodyDark}" stroke-width="1.2" />
        <ellipse cx="62" cy="85" rx="7" ry="5.5" fill="url(#${uniqueId}-muzzle)" stroke="${t.bodyDark}" stroke-width="1.2" />

        <!-- Blush Cheeks -->
        <ellipse cx="27" cy="62" rx="6" ry="4" fill="${t.cheeks}" opacity="0.4" />
        <ellipse cx="73" cy="62" rx="6" ry="4" fill="${t.cheeks}" opacity="0.4" />

        <!-- Eyes and Mouth -->
        ${eyesAndMouthSvg}

        <!-- Cute Soft Triangle Nose -->
        <path d="M 45.5 58 C 47 56.5 53 56.5 54.5 58 C 55.5 59.5 51.5 64 50 64 C 48.5 64 44.5 59.5 45.5 58 Z" fill="${t.nose}" />
        <ellipse cx="48.5" cy="58.5" rx="1.2" ry="0.8" fill="#FFFFFF" opacity="0.7" />

        <!-- Extra animations / props -->
        ${sweatOrSparkle}
      </g>
    </svg>
  `;
}

/**
 * Returns a warm, cozy wooden-stamp style Paw Print (🐾) for marking cells.
 */
export function getPawSvg(): string {
  return `
    <svg viewBox="0 0 40 40" class="paw-svg">
      <defs>
        <filter id="paw-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#451A03" flood-opacity="0.15" />
        </filter>
      </defs>
      <g filter="url(#paw-shadow)">
        <!-- Main heart-shaped paw pad -->
        <path d="M 20 22 C 14 22 11.5 27.5 14.5 32 C 17.5 35.5 22.5 35.5 25.5 32 C 28.5 27.5 26 22 20 22 Z" fill="#92400E" opacity="0.55" />
        <!-- 4 Cute toe pads -->
        <ellipse cx="11.5" cy="18" rx="3" ry="4.2" fill="#92400E" opacity="0.55" transform="rotate(-28 11.5 18)" />
        <ellipse cx="17.2" cy="13.2" rx="3.2" ry="4.5" fill="#92400E" opacity="0.55" transform="rotate(-10 17.2 13.2)" />
        <ellipse cx="23.2" cy="13.2" rx="3.2" ry="4.5" fill="#92400E" opacity="0.55" transform="rotate(10 23.2 13.2)" />
        <ellipse cx="28.8" cy="18" rx="3" ry="4.2" fill="#92400E" opacity="0.55" transform="rotate(28 28.8 18)" />
      </g>
    </svg>
  `;
}

/**
 * Zoodoku-style Cozy Nature Pastel Colors for Regions.
 * Distinct, gentle, warm, and comfortable for long-term puzzle playing.
 */
export const REGION_COLORS = [
  '#FEF3C7', // Sunny Honey (Warm cream yellow)
  '#D1FAE5', // Forest Meadow (Soft mint sage)
  '#E0F2FE', // Morning Sky (Gentle pastel blue)
  '#FFEDD5', // Cozy Peach (Warm apricot)
  '#EDE9FE', // Dreamy Lavender (Soft violet)
  '#FCE7F3', // Cherry Blossom (Pastel rose)
  '#CCFBF1', // Crystal Stream (Turquoise tint)
  '#ECFCCB', // Spring Sprouts (Lime yellow)
  '#F3E8FF', // Orchid Mist (Delicate lilac)
  '#F1F5F9', // Cloud Slate (Clean soft grey)
];
