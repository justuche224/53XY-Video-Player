export type Material3Scheme = Record<string, string>;
export interface Material3Theme {
  light: Material3Scheme;
  dark: Material3Scheme;
}
export type ColorSchemeName = 'light' | 'dark';

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export interface ThemeTokens {
  isDark: boolean;
  colors: Material3Scheme;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
}

export function resolveTheme(
  theme: Material3Theme,
  scheme: ColorSchemeName | null | undefined,
): ThemeTokens {
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: isDark ? theme.dark : theme.light,
    spacing: SPACING,
    radius: RADIUS,
  };
}
