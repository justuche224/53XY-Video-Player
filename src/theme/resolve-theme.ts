export type Material3Scheme = Record<string, string>;
export interface Material3Theme {
  light: Material3Scheme;
  dark: Material3Scheme;
}
export type ColorSchemeName = 'light' | 'dark';

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 } as const;
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

export interface ThemeTokens {
  isDark: boolean;
  colors: Material3Scheme;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  icon: typeof ICON;
  elevation: (level: ElevationLevel) => string;
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
  };
}
