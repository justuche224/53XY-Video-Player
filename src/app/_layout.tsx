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
import { ThemeProvider, useTheme } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

async function onDbInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
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
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="group" />
                  <Stack.Screen name="player" />
                  <Stack.Screen name="playlist" />
                  <Stack.Screen name="add-to-playlist" />
                </Stack>
              </ThemeProvider>
            </LibraryProvider>
          </FilterSettingsProvider>
        </SQLiteProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
