import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { resolveTheme, type Material3Theme, type ThemeTokens } from './resolve-theme';

// Brand violet (the app-icon accent). Seeds the whole Material You palette when
// the system can't supply a dynamic source color (Android < 12, dynamic off).
const FALLBACK_SOURCE_COLOR = '#5E4FA6';
const ThemeContext = createContext<ThemeTokens | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { theme } = useMaterial3Theme({ fallbackSourceColor: FALLBACK_SOURCE_COLOR });
  const tokens = useMemo(
    // Double-cast: @pchmn's scheme has a nested `elevation` object incompatible with our flat Material3Scheme (Record<string, string>).
    () => resolveTheme(theme as unknown as Material3Theme, scheme === 'dark' ? 'dark' : 'light'),
    [theme, scheme],
  );
  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
