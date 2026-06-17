import { Stack } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { runMigrations } from '@/db/migrate';
import { MIGRATIONS } from '@/db/schema';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';

async function onDbInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await runMigrations(db, MIGRATIONS);
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
        <ThemeProvider>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
