export type Material3Scheme = Record<string, string>;
export interface Material3Theme {
  light: Material3Scheme;
  dark: Material3Scheme;
}
export type ColorSchemeName = 'light' | 'dark';

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * The Material 3 Expressive corner-radius scale. Every key maps to a real M3
 * shape token (values from `androidx/compose/material3/tokens/ShapeTokens.kt` —
 * m3.material.io renders client-side and can't be read by a fetcher).
 *
 * `md` is deliberately M3 `corner.large` (16) rather than `corner.medium` (12):
 * it is the workhorse token here — cards, row thumbnails and posters all use it —
 * and 12 was the source of the app reading too sharp. The Expressive `*Increased`
 * steps (`lg`, `xxl`) are what give the app its rounder-than-baseline feel.
 */
export const RADIUS = {
  none: 0, //   M3 corner.none
  xs: 4, //     M3 corner.extraSmall
  sm: 8, //     M3 corner.small
  md: 16, //    M3 corner.large
  lg: 20, //    M3 corner.largeIncreased
  xl: 28, //    M3 corner.extraLarge
  xxl: 32, //   M3 corner.extraLargeIncreased
  max: 48, //   M3 corner.extraExtraLarge
  pill: 999, // M3 corner.full
} as const;

export const ICON = { sm: 18, md: 24, lg: 28, hero: 64 } as const;

export type ElevationLevel = 0 | 1 | 2 | 3;

const ELEVATION_TOKENS: Record<ElevationLevel, string> = {
  0: 'surface',
  1: 'surfaceContainerLow',
  2: 'surfaceContainer',
  3: 'surfaceContainerHigh',
};

// M3 tonal elevation: higher levels read as lighter/tinted surfaces. Falls back
// to surfaceVariant/surface if a tone is missing from the generated scheme.
export function elevationColor(colors: Material3Scheme, level: ElevationLevel): string {
  return colors[ELEVATION_TOKENS[level]] ?? colors.surfaceVariant ?? colors.surface ?? '#1c1b1f';
}

/**
 * Content colours for anything drawn directly on top of video artwork. These are
 * intentionally fixed rather than themed, for the same reason the player chrome is
 * (see HANDOFF §4): a thumbnail is arbitrary imagery, so `onSurface` under a light
 * theme would be near-black text on a dark frame. Artwork always gets a scrim, and
 * a scrim always wants white.
 */
export const ON_ARTWORK = {
  primary: '#ffffff',
  secondary: 'rgba(255,255,255,0.74)',
  /** Filled chip behind icon buttons and tab bars floating over artwork. */
  chip: 'rgba(0,0,0,0.45)',
  /** Tonal (secondary) button sitting on artwork. */
  tonal: 'rgba(255,255,255,0.18)',
  /** Unfilled portion of a progress track on artwork. */
  track: 'rgba(255,255,255,0.28)',
} as const;

/**
 * M3 elevation as a React Native 0.85 native `boxShadow` string.
 *
 * M3 uses two shadows per level: a tight key light and a wider ambient one. Dark
 * schemes get a much weaker shadow because tonal elevation (the
 * `surfaceContainer*` ramp) is what actually separates surfaces there — a strong
 * shadow on a dark background just muddies it.
 */
export function shadowFor(isDark: boolean, level: ElevationLevel): string {
  if (level === 0) return 'none';
  const key = isDark ? 0.24 : 0.18;
  const ambient = isDark ? 0.12 : 0.1;
  const spread = { 1: [1, 3, 1], 2: [2, 6, 2], 3: [4, 8, 3] }[level] as [number, number, number];
  return (
    `0px 1px 2px 0px rgba(0,0,0,${key}), ` +
    `0px ${spread[0]}px ${spread[1]}px ${spread[2]}px rgba(0,0,0,${ambient})`
  );
}

export interface ThemeTokens {
  isDark: boolean;
  colors: Material3Scheme;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  icon: typeof ICON;
  elevation: (level: ElevationLevel) => string;
  shadow: (level: ElevationLevel) => string;
}

export function resolveTheme(
  theme: Material3Theme,
  scheme: ColorSchemeName | null | undefined,
): ThemeTokens {
  const isDark = scheme === 'dark';
  const colors = isDark ? theme.dark : theme.light;
  return {
    isDark,
    colors,
    spacing: SPACING,
    radius: RADIUS,
    icon: ICON,
    elevation: (level) => elevationColor(colors, level),
    shadow: (level) => shadowFor(isDark, level),
  };
}
