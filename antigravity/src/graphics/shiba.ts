export type ShibaType = 'aka' | 'kuro' | 'shiro';

interface ShibaColors {
  body: string;
  bodyDark: string;
  white: string;
  earInner: string;
  eyes: string;
  nose: string;
  cheeks: string;
}

const SHIBA_PALETTES: Record<ShibaType, ShibaColors> = {
  aka: {
    body: '#E78B3F',
    bodyDark: '#CE6F24',
    white: '#FFF7ED',
    earInner: '#F8B4B4',
    eyes: '#261C14',
    nose: '#261C14',
    cheeks: '#FF8A80',
  },
  kuro: {
    body: '#374151',
    bodyDark: '#1F2937',
    white: '#FEF3C7',
    earInner: '#9CA3AF',
    eyes: '#111827',
    nose: '#111827',
    cheeks: '#F87171',
  },
  shiro: {
    body: '#F9FAFB',
    bodyDark: '#E5E7EB',
    white: '#FFFFFF',
    earInner: '#FCE7F3',
    eyes: '#374151',
    nose: '#374151',
    cheeks: '#F472B6',
  },
};

/**
 * Returns an inline SVG string for the Shiba Inu.
 */
export function getShibaSvg(
  type: ShibaType = 'aka',
  state: 'normal' | 'conflict' | 'happy' = 'normal'
): string {
  const c = SHIBA_PALETTES[type] || SHIBA_PALETTES.aka;

  // Eyes and eyebrows based on state
  let eyesSvg = `
    <!-- Normal eyes -->
    <ellipse cx="36" cy="52" rx="4.5" ry="5.5" fill="${c.eyes}" />
    <ellipse cx="64" cy="52" rx="4.5" ry="5.5" fill="${c.eyes}" />
    <!-- Eye highlights -->
    <circle cx="34.5" cy="50" r="1.8" fill="#FFFFFF" />
    <circle cx="62.5" cy="50" r="1.8" fill="#FFFFFF" />
  `;

  let browsSvg = `
    <!-- Cute Maro eyebrows -->
    <ellipse cx="36" cy="41" rx="4" ry="3" fill="${c.white}" />
    <ellipse cx="64" cy="41" rx="4" ry="3" fill="${c.white}" />
  `;

  let mouthSvg = `
    <!-- Happy open mouth -->
    <path d="M 44 65 Q 50 69 56 65" fill="none" stroke="${c.eyes}" stroke-width="2.5" stroke-linecap="round" />
  `;

  let extraSvg = '';

  if (state === 'conflict') {
    // Worried / sweat
    eyesSvg = `
      <!-- Worried closed squint eyes -->
      <path d="M 32 54 Q 37 49 41 54" fill="none" stroke="${c.eyes}" stroke-width="3" stroke-linecap="round" />
      <path d="M 59 54 Q 63 49 68 54" fill="none" stroke="${c.eyes}" stroke-width="3" stroke-linecap="round" />
    `;
    browsSvg = `
      <!-- Slanted troubled eyebrows -->
      <ellipse cx="35" cy="40" rx="3.5" ry="2.5" fill="${c.white}" transform="rotate(-15 35 40)" />
      <ellipse cx="65" cy="40" rx="3.5" ry="2.5" fill="${c.white}" transform="rotate(15 65 40)" />
    `;
    mouthSvg = `
      <path d="M 45 66 Q 50 62 55 66" fill="none" stroke="${c.eyes}" stroke-width="2.5" stroke-linecap="round" />
    `;
    extraSvg = `
      <!-- Sweat drop -->
      <path d="M 75 38 C 75 34 78 30 78 30 C 78 30 81 34 81 38 C 81 41 78.5 43 75 38 Z" fill="#60A5FA" />
    `;
  } else if (state === 'happy') {
    // Joyful arc eyes
    eyesSvg = `
      <path d="M 31 52 Q 36 45 42 52" fill="none" stroke="${c.eyes}" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 58 52 Q 64 45 70 52" fill="none" stroke="${c.eyes}" stroke-width="3.5" stroke-linecap="round" />
    `;
    mouthSvg = `
      <path d="M 43 63 Q 50 74 57 63 Z" fill="#FF8A80" stroke="${c.eyes}" stroke-width="2" />
    `;
    extraSvg = `
      <!-- Sparkles -->
      <circle cx="20" cy="30" r="2.5" fill="#FBBF24" />
      <circle cx="80" cy="28" r="2.5" fill="#FBBF24" />
    `;
  }

  return `
    <svg viewBox="0 0 100 100" class="shiba-svg shiba-${state} shiba-type-${type}">
      <g class="shiba-body-group">
        <!-- Ears -->
        <path d="M 22 42 L 32 14 Q 40 24 42 34 Z" fill="${c.body}" />
        <path d="M 26 38 L 33 19 Q 38 27 38 34 Z" fill="${c.earInner}" />

        <path d="M 78 42 L 68 14 Q 60 24 58 34 Z" fill="${c.body}" />
        <path d="M 74 38 L 67 19 Q 62 27 62 34 Z" fill="${c.earInner}" />

        <!-- Round Head -->
        <ellipse cx="50" cy="54" rx="38" ry="34" fill="${c.body}" />

        <!-- White Muzzle & Cheeks (Urajiro) -->
        <path d="M 24 64 C 24 48 38 46 50 56 C 62 46 76 48 76 64 C 76 78 64 85 50 85 C 36 85 24 78 24 64 Z" fill="${c.white}" />

        <!-- Eyebrows -->
        ${browsSvg}

        <!-- Eyes -->
        ${eyesSvg}

        <!-- Blush Cheeks -->
        <circle cx="28" cy="62" r="5" fill="${c.cheeks}" opacity="0.45" />
        <circle cx="72" cy="62" r="5" fill="${c.cheeks}" opacity="0.45" />

        <!-- Nose -->
        <polygon points="46,58 54,58 50,63" fill="${c.nose}" rx="1" />

        <!-- Mouth -->
        ${mouthSvg}

        ${extraSvg}
      </g>
    </svg>
  `;
}

/**
 * Returns an inline SVG string for the Paw Mark (🐾).
 */
export function getPawSvg(): string {
  return `
    <svg viewBox="0 0 40 40" class="paw-svg">
      <!-- Main pad -->
      <path d="M 20 23 C 14 23 12 28 15 32 C 18 35 22 35 25 32 C 28 28 26 23 20 23 Z" fill="currentColor" opacity="0.8" />
      <!-- Toe pads -->
      <ellipse cx="12" cy="19" rx="3.2" ry="4.2" fill="currentColor" opacity="0.8" transform="rotate(-25 12 19)" />
      <ellipse cx="17.5" cy="14" rx="3.2" ry="4.5" fill="currentColor" opacity="0.8" transform="rotate(-8 17.5 14)" />
      <ellipse cx="23.5" cy="14" rx="3.2" ry="4.5" fill="currentColor" opacity="0.8" transform="rotate(8 23.5 14)" />
      <ellipse cx="29" cy="19" rx="3.2" ry="4.2" fill="currentColor" opacity="0.8" transform="rotate(25 29 19)" />
    </svg>
  `;
}

/**
 * Region color palettes (soft, distinct, harmonious pastel colors).
 */
export const REGION_COLORS = [
  '#FDE68A', // Warm Butter / Yellow
  '#A7F3D0', // Mint / Sage Green
  '#BAE6FD', // Sky Blue
  '#FED7AA', // Apricot / Peach
  '#DDD6FE', // Lavender / Soft Violet
  '#FBCFE8', // Rose / Light Pink
  '#C7D2FE', // Periwinkle
  '#D9F99D', // Lime Green
  '#F5D0FE', // Lilac
  '#E2E8F0', // Slate Mist
];
