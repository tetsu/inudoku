export type ShibaType = 'aka' | 'kuro' | 'shiro';

interface ShibaTheme {
  fur: string;
  /** Feet and tail sit behind the face, so they take a shade darker fur */
  furBack: string;
  cream: string;
  /** 麻呂眉 (the eyebrow dots); tan on a black shiba */
  brow: string;
  /** Ring around the eyes so they read on dark fur */
  eyeRing: string;
  /** Edge line so a white shiba doesn't vanish into light cells */
  edge: string;
}

const INK = '#231B15';

const SHIBA_THEMES: Record<ShibaType, ShibaTheme> = {
  aka: {
    fur: '#D9822B',
    furBack: '#B86B20',
    cream: '#FFF3DF',
    brow: '#FFF3DF',
    eyeRing: 'none',
    edge: 'none',
  },
  kuro: {
    fur: '#2F2925',
    furBack: '#1E1A17',
    cream: '#F3E6D0',
    brow: '#D59A5B',
    eyeRing: '#D59A5B',
    edge: 'none',
  },
  shiro: {
    fur: '#F1E6D4',
    furBack: '#E2D3BC',
    cream: '#FFFFFF',
    brow: '#E4D3B8',
    eyeRing: 'none',
    edge: '#CDB898',
  },
};

/**
 * Returns an inline SVG of the Shibadoku shiba: a deadpan square face tile
 * standing on two stubby feet, with its curled tail peeking out from behind.
 * Coordinates are drawn on a 100×100 face grid and scaled into the box so
 * the feet fit underneath.
 */
export function getShibaSvg(
  type: ShibaType = 'aka',
  state: 'normal' | 'conflict' | 'happy' = 'normal'
): string {
  const t = SHIBA_THEMES[type] || SHIBA_THEMES.aka;
  const uniqueId = `shiba-${type}-${state}-${Math.random().toString(36).substring(2, 7)}`;
  const edge = t.edge === 'none' ? '' : `stroke="${t.edge}" stroke-width="2"`;
  // Line-drawn eyes need the tan ring colour to show up on black fur
  const eyeLine = t.eyeRing === 'none' ? INK : t.eyeRing;

  let face = '';
  let extra = '';

  if (state === 'conflict') {
    // Doesn't cry: just goes flat-eyed and silent, with a sweat drop
    face = `
      <path d="M 27 46 L 39 46 M 61 46 L 73 46" stroke="${eyeLine}" stroke-width="3.4" stroke-linecap="round" />
      <path d="M 44 79 L 56 79" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" />
    `;
    extra = `
      <g class="shiba-sweat">
        <path d="M 86 44 C 86 39 91 33 91 33 C 91 33 96 39 96 44 C 96 47.5 93.8 50 91 50 C 88.2 50 86 47.5 86 44 Z" fill="#60A5FA" />
      </g>
    `;
  } else if (state === 'happy') {
    // Quietly proud: eyes closed into arcs, a small smile, tail wagging
    face = `
      <path d="M 28 47 Q 33 40 38 47 M 62 47 Q 67 40 72 47" fill="none" stroke="${eyeLine}" stroke-width="3.2" stroke-linecap="round" />
      <path d="M 42 77 Q 46 83 50 78 Q 54 83 58 77" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" />
    `;
    extra = `
      <g class="shiba-sparkle">
        <path d="M 6 14 Q 8 8 10 14 Q 16 16 10 18 Q 8 24 6 18 Q 0 16 6 14 Z" fill="#FBBF24" />
      </g>
    `;
  } else {
    // Deadpan: two small dots set far apart
    face = `
      <circle cx="33" cy="45" r="3.8" fill="${INK}" stroke="${t.eyeRing}" stroke-width="1.6" />
      <circle cx="67" cy="45" r="3.8" fill="${INK}" stroke="${t.eyeRing}" stroke-width="1.6" />
      <path d="M 43 78 Q 46.5 81.5 50 78 Q 53.5 81.5 57 78" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" />
    `;
  }

  const tail =
    state === 'happy'
      ? `<g class="shiba-tail is-wagging">
           <path d="M 84 42 C 102 32 99 9 87 11 C 78 13 80 24 87 23" fill="none" stroke="${t.furBack}" stroke-width="8" stroke-linecap="round" />
         </g>`
      : `<g class="shiba-tail">
           <path d="M 86 46 C 104 42 106 18 94 16 C 84 15 83 27 91 28" fill="none" stroke="${t.furBack}" stroke-width="8" stroke-linecap="round" />
         </g>`;

  return `
    <svg viewBox="0 0 100 100" class="shiba-svg shiba-${state} shiba-type-${type}">
      <defs>
        <filter id="${uniqueId}-shadow" x="-15%" y="-15%" width="130%" height="135%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.2" />
        </filter>
      </defs>

      <g filter="url(#${uniqueId}-shadow)">
        <!-- Tail, behind the face -->
        <g transform="translate(9 1) scale(0.82)">${tail}</g>

        <!-- Two stubby feet straight under the chin -->
        <rect x="29" y="78" width="13" height="18" rx="4" fill="${t.fur}" ${edge} />
        <rect x="29" y="89" width="13" height="7" rx="3" fill="${t.cream}" />
        <rect x="58" y="78" width="13" height="18" rx="4" fill="${t.fur}" ${edge} />
        <rect x="58" y="89" width="13" height="7" rx="3" fill="${t.cream}" />

        <!-- The face tile is the whole body -->
        <g transform="translate(9 1) scale(0.82)">
          <polygon points="12,34 22,4 42,22" fill="${t.fur}" ${edge} stroke-linejoin="round" />
          <polygon points="58,22 78,4 88,34" fill="${t.fur}" ${edge} stroke-linejoin="round" />
          <polygon points="20,26 24,13 34,22" fill="${t.cream}" />
          <polygon points="66,22 76,13 80,26" fill="${t.cream}" />
          <rect x="10" y="18" width="80" height="78" rx="12" fill="${t.fur}" ${edge} />
          <!-- Urajiro: cream cheeks and muzzle, fur dipping to a point at the nose -->
          <path d="M 10 62 Q 10 50 23 50 Q 38 50 45 63 L 50 68 L 55 63 Q 62 50 77 50 Q 90 50 90 62 L 90 84 Q 90 96 78 96 L 22 96 Q 10 96 10 84 Z" fill="${t.cream}" />
          <!-- 麻呂眉 -->
          <ellipse cx="33" cy="35" rx="6" ry="3.5" fill="${t.brow}" />
          <ellipse cx="67" cy="35" rx="6" ry="3.5" fill="${t.brow}" />
          ${face}
          <ellipse cx="50" cy="70" rx="5.5" ry="4" fill="${INK}" />
          ${extra}
        </g>
      </g>
    </svg>
  `;
}

/**
 * Returns the iconic white rounded Cross (❌) from Meowdoku / Zoodoku.
 */
export function getCrossSvg(color: string = '#FFFFFF'): string {
  return `
    <svg viewBox="0 0 48 48" class="cross-svg" style="display: block; width: 100%; height: 100%;">
      <g style="filter: drop-shadow(0 1.5px 1.5px rgba(0, 0, 0, 0.22));">
        <line x1="12" y1="12" x2="36" y2="36" stroke="${color}" stroke-width="8.5" stroke-linecap="round" />
        <line x1="36" y1="12" x2="12" y2="36" stroke="${color}" stroke-width="8.5" stroke-linecap="round" />
      </g>
    </svg>
  `;
}

/**
 * Returns paw mark SVG
 */
export function getPawSvg(): string {
  return getCrossSvg(); // Meowdoku primarily uses the white rounded cross
}

/**
 * Returns the iconic white rounded Question Mark (❓) for tentative/hypothetical notes.
 */
export function getQuestionSvg(color: string = '#FFFFFF'): string {
  return `
    <svg viewBox="0 0 48 48" class="question-svg" style="display: block; width: 100%; height: 100%;">
      <g style="filter: drop-shadow(0 1.5px 1.5px rgba(0, 0, 0, 0.22));">
        <path
          d="M16 16 C16 10.5 20.5 8 24 8 C28 8 32 10.8 32 15.5 C32 19.5 28.5 22 25 24.5 C24 25.3 24 26.5 24 28.5"
          fill="none"
          stroke="${color}"
          stroke-width="7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="24" cy="38" r="2.2" fill="${color}" />
      </g>
    </svg>
  `;
}

/**
 * Exactly matched palette from Meowdoku / Zoodoku screenshot:
 * Clean, saturated, distinct solid pastel colors with no dark borders.
 */
export const REGION_COLORS = [
  '#7DCB66', // 0: Meadow Green
  '#3CAFD9', // 1: Sky Cyan Blue
  '#CF6485', // 2: Rose Berry Magenta
  '#C49610', // 3: Mustard Gold
  '#8879D6', // 4: Lavender Purple
  '#F48EDB', // 5: Bubblegum Pink
  '#996141', // 6: Warm Cinnamon Brown
  '#F68F55', // 7: Salmon Coral Orange
  '#F8CD77', // 8: Sunny Cream Yellow
  '#2E8854', // 9: Forest Green
];

/**
 * Color Universal Design (CUD) / Okabe-Ito accessible palette:
 * Optimized for Protanopia, Deuteranopia, and Tritanopia with distinct lightness/chroma.
 */
export const CUD_REGION_COLORS = [
  '#E69F00', // 0: Orange / Warm Amber
  '#56B4E9', // 1: Sky Blue
  '#009E73', // 2: Bluish Green
  '#F0E442', // 3: Yellow
  '#0072B2', // 4: Blue
  '#D55E00', // 5: Vermilion
  '#CC79A7', // 6: Reddish Purple
  '#888888', // 7: Neutral Grey
  '#332288', // 8: Indigo
  '#117733', // 9: Deep Green
];

