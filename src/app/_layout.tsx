import { Stack } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';
import { runMigrations } from '@/db/migrate';
import { MIGRATIONS } from '@/db/schema';
import { FilterSettingsProvider } from '@/library/filter-settings';
import { LibraryProvider } from '@/library/library-provider';
import { ThumbnailSweep } from '@/media/thumbnail-sweep';
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
          <FilterSettingsProvider>
            <LibraryProvider>
              <ThemeProvider>
                <ThemedStatusBar />
                <ThumbnailSweep />
                <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="group" />
                  <Stack.Screen name="player" options={{ animation: 'default' }} />
                  <Stack.Screen name="playlist" />
                  <Stack.Screen name="add-to-playlist" />
                  <Stack.Screen name="settings/player" />
                  <Stack.Screen name="settings/library-filters" />
                  <Stack.Screen name="settings/hidden-folders" />
                  <Stack.Screen name="settings/about" />
                </Stack>
              </ThemeProvider>
            </LibraryProvider>
          </FilterSettingsProvider>
        </SQLiteProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
