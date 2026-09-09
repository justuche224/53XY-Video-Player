import { Stack } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';
import { runMigrations } from '@/db/migrate';
import { MIGRATIONS } from '@/db/schema';
import { FilterSettingsProvider } from '@/library/filter-settings';
import { LibraryProvider } from '@/library/library-provider';
import { ThumbnailSweep } from '@/media/thumbnail-sweep';
import { OnboardingGate } from '@/onboarding/onboarding-gate';
import { OnboardingProvider, useOnboarding } from '@/onboarding/onboarding-provider';
import { MediaAccessProvider } from '@/permissions/media-access-provider';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

async function onDbInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  // Must be set outside a transaction — SQLite ignores it once one is open.
  // manual_groups relies on ON DELETE CASCADE when a video is removed.
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.withTransactionAsync(async () => {
    await runMigrations(db, MIGRATIONS);
  });
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

/**
 * The splash must wait for the onboarding gate to resolve from SQLite, or the
 * user sees a frame of Home before it snaps to the tour. `useOnboarding`
 * needs to be inside the provider, so the hide is extracted into this small
 * child component. Fonts are no longer a condition here — `RootLayout`
 * already blocks rendering this whole tree until fonts settle (loaded or
 * failed), so by the time this mounts fonts are a non-issue.
 */
function SplashGate() {
  const { status } = useOnboarding();
  useEffect(() => {
    if (status !== 'resolving') SplashScreen.hideAsync();
  }, [status]);
  return null;
}

/**
 * Belt-and-suspenders: hides the splash unconditionally after a timeout, no
 * matter what state the gate, fonts, or DB init are in. Covers every render-
 * phase throw below `ErrorBoundary` that isn't the SQLite one already handled
 * there, and a `getSetting` that hangs rather than rejects (the gate's own
 * `.catch` only covers rejection, not a promise that never settles).
 * `hideAsync()` is safe to call more than once.
 */
function useSplashWatchdog(timeoutMs = 5000) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);
}

/**
 * LibraryProvider must not fire the media permission dialog while the tour
 * is pending — the tour owns the timing of that dialog.
 */
function GatedLibraryProvider({ children }: { children: ReactNode }) {
  const { status } = useOnboarding();
  return <LibraryProvider autoRequest={status === 'done'}>{children}</LibraryProvider>;
}

export default function RootLayout() {
  // `error` is non-null when a font fails to load (bad network on first run,
  // corrupt cache, etc). Previously only `fontsLoaded` gated the return below,
  // so a font failure left it false forever and RootLayout returned `null`
  // forever — a permanently blank app behind a splash that never hides.
  // Degrading to system fonts on failure is strictly better than a brick.
  const [fontsLoaded, fontsError] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  useSplashWatchdog();

  if (!fontsLoaded && !fontsError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
          <FilterSettingsProvider>
            <OnboardingProvider>
              <MediaAccessProvider>
                <GatedLibraryProvider>
                  <ThemeProvider>
                    <SplashGate />
                    <OnboardingGate />
                    <ThemedStatusBar />
                    <ThumbnailSweep />
                    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="group" />
                      <Stack.Screen name="player" options={{ animation: 'default' }} />
                      <Stack.Screen name="playlist" />
                      <Stack.Screen name="moment" />
                      <Stack.Screen name="add-to-playlist" />
                      <Stack.Screen name="settings/player" />
                      <Stack.Screen name="settings/library-filters" />
                      <Stack.Screen name="settings/hidden-folders" />
                      <Stack.Screen name="settings/about" />
                    </Stack>
                  </ThemeProvider>
                </GatedLibraryProvider>
              </MediaAccessProvider>
            </OnboardingProvider>
          </FilterSettingsProvider>
        </SQLiteProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
