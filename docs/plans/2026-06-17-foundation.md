# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a clean, themed, runnable 53XY custom dev build: Material You theme that follows system light/dark, an initialized & migrated SQLite database, a navigation skeleton with empty themed screens, and a green Jest harness for the pure logic we'll grow.

**Architecture:** Wipe the Expo starter template to a blank `src/app`. Keep all pure, device-independent logic (theme-token resolution, DB migration runner, progress math) in plain TypeScript modules under `src/` covered by real Jest unit tests. Wrap the app in three providers — `GestureHandlerRootView`, `SQLiteProvider` (runs migrations on init), and our `ThemeProvider` (Material You via `@pchmn/expo-material3-theme`). Native-dependent behavior is verified on-device via explicit checklists.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-router, expo-sqlite, `@pchmn/expo-material3-theme`, react-native-gesture-handler (installed), Jest + jest-expo.

## Global Constraints

- **Expo SDK pin:** all Expo packages installed via `npx expo install` so versions match SDK 56 (`expo@~56.0.12`). Never hand-edit Expo dep versions.
- **Read docs first:** per `AGENTS.md`, consult https://docs.expo.dev/versions/v56.0.0/ before writing code against any SDK module.
- **Platform:** Android-only target. Do not add iOS/web-specific behavior.
- **Path alias:** `@/*` → `./src/*`, `@/assets/*` → `./assets/*` (already in `tsconfig.json`).
- **Source layout:** only screens/layouts live in `src/app`; all other code lives elsewhere under `src/`.
- **DB name:** `p53xy.db` everywhere.
- **Pure-logic test rule:** modules under test must NOT import native/Expo modules, so Jest runs them in plain Node. Native code is device-verified, never asserted as unit-tested.
- **Reanimated/Worklets babel:** SDK 56's `babel-preset-expo` auto-injects the worklets plugin when reanimated is installed — do NOT add a manual babel plugin (double-application breaks builds).

---

### Task 1: Reset template + Jest harness

Wipe the starter demo to a blank app and stand up the test runner with one passing sanity test. The reset deletes the template's `src/` (theme, demo components, hooks) and `scripts/`, leaving a minimal `src/app/index.tsx` + `_layout.tsx`.

**Files:**
- Run: `scripts/reset-project.js` (deletes `src/` + `scripts/`, recreates blank `src/app/`)
- Modify: `package.json` (add `test` script + `jest` preset + dev deps)
- Create: `src/lib/__tests__/sanity.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npm test` command using the `jest-expo` preset; blank `src/app/index.tsx` and `src/app/_layout.tsx`.

- [ ] **Step 1: Wipe the template (delete mode)**

The script is interactive; pipe `n` to choose delete (not move-to-/example):

```bash
echo "n" | node ./scripts/reset-project.js
```

Expected output ends with `✅ Project reset complete.` and leaves blank `src/app/index.tsx` + `src/app/_layout.tsx`. Note: this also deletes `scripts/` (including the reset script itself) — that's intended.

- [ ] **Step 2: Install test dev-dependencies**

```bash
npx expo install jest-expo jest @types/jest react-test-renderer @testing-library/react-native -- --save-dev
```

(Packages come before `--`; everything after `--` is forwarded to the package manager, so these land in `devDependencies`. Using `expo install` keeps `jest-expo`/`react-test-renderer` aligned to SDK 56.)

- [ ] **Step 3: Add Jest config + test script to `package.json`**

Add the `test` script under `"scripts"` and a top-level `"jest"` block:

```jsonc
// in "scripts":
"test": "jest",
// new top-level key:
"jest": {
  "preset": "jest-expo",
  "testMatch": ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"]
}
```

- [ ] **Step 4: Write the failing sanity test**

```ts
// src/lib/__tests__/sanity.test.ts
describe('test harness', () => {
  it('runs pure TypeScript', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `npm test`
Expected: PASS, 1 test passed. (jest-expo bootstraps cleanly; if it reports "0 tests" check `testMatch`.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: reset template and add jest harness"
```

---

### Task 2: Install native dependencies + configure app.json + boot

Add every native module v1 needs, declare Android permissions/plugins, generate the native project, and confirm the blank app boots as a custom dev build on a device/emulator.

**Files:**
- Modify: `package.json` (native deps, via `expo install`)
- Modify: `app.json` (plugins + Android permissions)
- Create (generated): `android/` (via `expo prebuild`)

**Interfaces:**
- Consumes: blank app from Task 1.
- Produces: installed & autolinked `expo-video`, `expo-media-library`, `expo-sqlite`, `expo-video-thumbnails`, `expo-brightness`, `@pchmn/expo-material3-theme`; a buildable `android/` project.

- [ ] **Step 1: Install the Expo native modules**

```bash
npx expo install expo-video expo-media-library expo-sqlite expo-video-thumbnails expo-brightness
```

- [ ] **Step 2: Install the Material You theme module**

```bash
npm install @pchmn/expo-material3-theme
```

- [ ] **Step 3: Configure plugins + Android permissions in `app.json`**

Replace the `"plugins"` array and the `"android"` block in `app.json` with the following (keep all other keys unchanged):

```jsonc
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#E6F4FE",
    "foregroundImage": "./assets/images/android-icon-foreground.png",
    "backgroundImage": "./assets/images/android-icon-background.png",
    "monochromeImage": "./assets/images/android-icon-monochrome.png"
  },
  "predictiveBackGestureEnabled": false,
  "permissions": [
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_EXTERNAL_STORAGE"
  ]
},
"plugins": [
  "expo-router",
  "expo-video",
  "expo-sqlite",
  [
    "expo-media-library",
    {
      "photosPermission": "Allow 53XY to access your videos.",
      "savePhotosPermission": "Allow 53XY to save videos.",
      "isAccessMediaLocationEnabled": true
    }
  ],
  [
    "expo-splash-screen",
    {
      "backgroundColor": "#208AEF",
      "android": { "image": "./assets/images/splash-icon.png", "imageWidth": 76 }
    }
  ]
]
```

- [ ] **Step 2 docs check:** Before editing, skim https://docs.expo.dev/versions/v56.0.0/sdk/media-library/#configuration-in-appjson to confirm the plugin option names above are current for SDK 56. Fix any drift.

- [ ] **Step 3b: Verify config compiles**

Run: `npx expo config --type prebuild > /dev/null && echo OK`
Expected: prints `OK` with no schema errors.

- [ ] **Step 4: Generate native project**

```bash
npx expo prebuild --platform android --clean
```

Expected: creates `android/` with no errors.

- [ ] **Step 5: DEVICE VERIFICATION — boot the app**

Run: `npx expo run:android` (device or emulator connected).
Manual checklist:
- [ ] App builds and installs without native link errors.
- [ ] Blank "Edit src/app/index.tsx…" screen renders.
- [ ] No red-box runtime error on launch.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add native deps (video, media-library, sqlite, thumbnails, brightness, material3) and android config"
```

---

### Task 3: Theme tokens + pure resolver (TDD)

The pure core of theming: given a Material 3 theme object (`{ light, dark }`) and the active color scheme, produce our `ThemeTokens` (active palette + spacing/radius scales). No native imports → fully unit-tested.

**Files:**
- Create: `src/theme/resolve-theme.ts`
- Test: `src/theme/__tests__/resolve-theme.test.ts`

**Interfaces:**
- Consumes: nothing native.
- Produces:
  - `type Material3Scheme = Record<string, string>`
  - `interface Material3Theme { light: Material3Scheme; dark: Material3Scheme }`
  - `type ColorSchemeName = 'light' | 'dark'`
  - `interface ThemeTokens { isDark: boolean; colors: Material3Scheme; spacing: typeof SPACING; radius: typeof RADIUS }`
  - `const SPACING`, `const RADIUS`
  - `function resolveTheme(theme: Material3Theme, scheme: ColorSchemeName | null | undefined): ThemeTokens`

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/__tests__/resolve-theme.test.ts
import { resolveTheme, SPACING, RADIUS, type Material3Theme } from '../resolve-theme';

const fake: Material3Theme = {
  light: { primary: '#ffffff', background: '#ffffff', onSurface: '#000000' },
  dark: { primary: '#000000', background: '#000000', onSurface: '#ffffff' },
};

describe('resolveTheme', () => {
  it('selects the dark palette when scheme is dark', () => {
    const t = resolveTheme(fake, 'dark');
    expect(t.isDark).toBe(true);
    expect(t.colors).toBe(fake.dark);
  });

  it('selects the light palette for light or null scheme', () => {
    expect(resolveTheme(fake, 'light').colors).toBe(fake.light);
    expect(resolveTheme(fake, null).isDark).toBe(false);
    expect(resolveTheme(fake, undefined).colors).toBe(fake.light);
  });

  it('exposes the spacing and radius scales', () => {
    const t = resolveTheme(fake, 'light');
    expect(t.spacing).toBe(SPACING);
    expect(t.radius).toBe(RADIUS);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- resolve-theme`
Expected: FAIL — cannot find module `../resolve-theme`.

- [ ] **Step 3: Write the implementation**

```ts
// src/theme/resolve-theme.ts
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
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- resolve-theme`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/theme/resolve-theme.ts src/theme/__tests__/resolve-theme.test.ts
git commit -m "feat: pure Material3 theme-token resolver"
```

---

### Task 4: SQLite migration runner + schema + progress math (TDD)

The pure, device-independent DB logic: a migration runner driven by `PRAGMA user_version`, the v1 schema, and watch-progress math. The migration runner is tested against an in-memory fake implementing the minimal DB interface — no native SQLite needed.

**Files:**
- Create: `src/db/migrate.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/progress.ts`
- Test: `src/db/__tests__/migrate.test.ts`
- Test: `src/db/__tests__/progress.test.ts`

**Interfaces:**
- Consumes: nothing native.
- Produces:
  - `interface MigrationDb { execAsync(source: string): Promise<unknown>; getFirstAsync<T>(source: string): Promise<T | null> }`
  - `interface Migration { version: number; up: string }`
  - `function runMigrations(db: MigrationDb, migrations: Migration[]): Promise<number>` (returns the version after running)
  - `const MIGRATIONS: Migration[]`, `const LATEST_VERSION: number`
  - `function computeProgressPercent(positionMs: number, durationMs: number | null | undefined): number` (clamped 0–1)
  - `function isCompleted(percent: number, threshold?: number): boolean`

- [ ] **Step 1: Write the failing migration-runner test**

```ts
// src/db/__tests__/migrate.test.ts
import { runMigrations, type Migration, type MigrationDb } from '../migrate';

function makeFakeDb(startVersion = 0) {
  let version = startVersion;
  const executed: string[] = [];
  const db: MigrationDb = {
    async execAsync(source: string) {
      executed.push(source);
      const m = source.match(/PRAGMA user_version\s*=\s*(\d+)/);
      if (m) version = Number(m[1]);
      return undefined;
    },
    async getFirstAsync<T>(_source: string) {
      return { user_version: version } as unknown as T;
    },
  };
  return { db, executed, getVersion: () => version };
}

const MIGRATIONS: Migration[] = [
  { version: 1, up: 'CREATE TABLE a (id);' },
  { version: 2, up: 'CREATE TABLE b (id);' },
];

describe('runMigrations', () => {
  it('applies all pending migrations from a fresh db and returns latest version', async () => {
    const { db, executed, getVersion } = makeFakeDb(0);
    const result = await runMigrations(db, MIGRATIONS);
    expect(result).toBe(2);
    expect(getVersion()).toBe(2);
    expect(executed).toContain('CREATE TABLE a (id);');
    expect(executed).toContain('CREATE TABLE b (id);');
  });

  it('skips already-applied migrations', async () => {
    const { db, executed } = makeFakeDb(1);
    const result = await runMigrations(db, MIGRATIONS);
    expect(result).toBe(2);
    expect(executed).toContain('CREATE TABLE b (id);');
    expect(executed).not.toContain('CREATE TABLE a (id);');
  });

  it('is a no-op when already at latest', async () => {
    const { db, executed } = makeFakeDb(2);
    const result = await runMigrations(db, MIGRATIONS);
    expect(result).toBe(2);
    expect(executed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- migrate`
Expected: FAIL — cannot find module `../migrate`.

- [ ] **Step 3: Implement the migration runner**

```ts
// src/db/migrate.ts
export interface MigrationDb {
  execAsync(source: string): Promise<unknown>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

export interface Migration {
  version: number;
  up: string;
}

export async function runMigrations(
  db: MigrationDb,
  migrations: Migration[],
): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const m of pending) {
    await db.execAsync(m.up);
    await db.execAsync(`PRAGMA user_version = ${m.version}`);
  }
  return pending.length ? pending[pending.length - 1].version : current;
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- migrate`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the v1 schema**

```ts
// src/db/schema.ts
import type { Migration } from './migrate';

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY NOT NULL,
        uri TEXT NOT NULL,
        filename TEXT NOT NULL,
        duration_ms INTEGER,
        size_bytes INTEGER,
        width INTEGER,
        height INTEGER,
        folder TEXT,
        modified_at INTEGER,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS watch_progress (
        video_id TEXT PRIMARY KEY NOT NULL,
        position_ms INTEGER NOT NULL DEFAULT 0,
        percent REAL NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        last_played_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
];

export const LATEST_VERSION = 1;
```

- [ ] **Step 6: Write the failing progress-math test**

```ts
// src/db/__tests__/progress.test.ts
import { computeProgressPercent, isCompleted } from '../progress';

describe('computeProgressPercent', () => {
  it('returns the fraction watched', () => {
    expect(computeProgressPercent(30_000, 120_000)).toBeCloseTo(0.25);
  });
  it('clamps to [0,1] and handles missing duration', () => {
    expect(computeProgressPercent(-5, 100)).toBe(0);
    expect(computeProgressPercent(200, 100)).toBe(1);
    expect(computeProgressPercent(50, 0)).toBe(0);
    expect(computeProgressPercent(50, null)).toBe(0);
  });
});

describe('isCompleted', () => {
  it('is true at/above the threshold', () => {
    expect(isCompleted(0.96)).toBe(true);
    expect(isCompleted(0.5)).toBe(false);
    expect(isCompleted(0.8, 0.8)).toBe(true);
  });
});
```

- [ ] **Step 7: Run test — verify it fails**

Run: `npm test -- progress`
Expected: FAIL — cannot find module `../progress`.

- [ ] **Step 8: Implement progress math**

```ts
// src/db/progress.ts
export function computeProgressPercent(
  positionMs: number,
  durationMs: number | null | undefined,
): number {
  if (!durationMs || durationMs <= 0) return 0;
  const pct = positionMs / durationMs;
  if (pct < 0) return 0;
  if (pct > 1) return 1;
  return pct;
}

export function isCompleted(percent: number, threshold = 0.95): boolean {
  return percent >= threshold;
}
```

- [ ] **Step 9: Run tests — verify all pass**

Run: `npm test -- progress migrate`
Expected: PASS (migrate 3 + progress 3).

- [ ] **Step 10: Commit**

```bash
git add src/db
git commit -m "feat: sqlite migration runner, v1 schema, and progress math"
```

---

### Task 5: Provider wiring + root layout (device-verified)

Wire the three providers into the app root and run migrations on DB init via `SQLiteProvider`. This is native-integration code, verified on device (the pure pieces it composes are already unit-tested in Tasks 3–4).

**Files:**
- Create: `src/theme/theme-provider.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `resolveTheme`, `ThemeTokens` (Task 3); `runMigrations`, `MIGRATIONS` (Task 4); `useMaterial3Theme` from `@pchmn/expo-material3-theme`.
- Produces:
  - `function ThemeProvider({ children }: { children: ReactNode }): JSX.Element`
  - `function useTheme(): ThemeTokens`

- [ ] **Step 1: Docs check** — confirm the `@pchmn/expo-material3-theme` hook shape (`const { theme } = useMaterial3Theme({ fallbackSourceColor })` returning `{ light, dark }`) against the package README before coding.

- [ ] **Step 2: Write the ThemeProvider**

```tsx
// src/theme/theme-provider.tsx
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { resolveTheme, type Material3Theme, type ThemeTokens } from './resolve-theme';

const FALLBACK_SOURCE_COLOR = '#FF6B00';
const ThemeContext = createContext<ThemeTokens | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { theme } = useMaterial3Theme({ fallbackSourceColor: FALLBACK_SOURCE_COLOR });
  const tokens = useMemo(
    () => resolveTheme(theme as Material3Theme, scheme === 'dark' ? 'dark' : 'light'),
    [theme, scheme],
  );
  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- [ ] **Step 3: Rewrite the root layout to compose all providers**

```tsx
// src/app/_layout.tsx
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
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`runMigrations` accepts `SQLiteDatabase` because it structurally satisfies `MigrationDb`.)

- [ ] **Step 5: DEVICE VERIFICATION**

Run: `npx expo run:android`
Manual checklist:
- [ ] App launches with no red box (providers mount cleanly).
- [ ] Status bar style matches system light/dark (toggle system theme to confirm it flips).
- [ ] DB init runs without error (no "SQLiteProvider onInit" red box). Optional: temporarily `console.log` inside `onDbInit` and confirm it fires once.

- [ ] **Step 6: Commit**

```bash
git add src/theme/theme-provider.tsx src/app/_layout.tsx
git commit -m "feat: wire gesture-handler, sqlite migrations, and Material You theme providers"
```

---

### Task 6: Empty themed screens + navigation skeleton

Replace the blank index with a themed Library placeholder and add a Settings screen, both consuming `useTheme`. Confirms the theme actually paints the UI and navigation works — the canvas the Library/Player plans build on.

**Files:**
- Create: `src/components/screen.tsx`
- Modify: `src/app/index.tsx`
- Create: `src/app/settings.tsx`

**Interfaces:**
- Consumes: `useTheme` (Task 5).
- Produces: `function Screen({ children, style }): JSX.Element` — a themed full-bleed safe container used by all screens.

- [ ] **Step 1: Write the themed Screen container**

```tsx
// src/components/screen.tsx
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.safe, style]}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
```

- [ ] **Step 2: Replace the index screen with a themed Library placeholder**

```tsx
// src/app/index.tsx
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function LibraryScreen() {
  const { colors, spacing } = useTheme();
  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
        <Link href="/settings" style={[styles.link, { color: colors.primary }]}>
          Settings
        </Link>
      </View>
      <View style={styles.center}>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface }}>
          Your library will appear here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 3: Add the Settings screen**

```tsx
// src/app/settings.tsx
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  return (
    <Screen style={{ padding: spacing.lg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <View style={styles.center}>
        <Text style={{ color: colors.onSurface }}>Settings coming soon.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: DEVICE VERIFICATION**

Run: `npx expo run:android` (or reload if already running).
Manual checklist:
- [ ] Library screen shows "53XY" title + "Settings" link on a themed background.
- [ ] Background/text colors are wallpaper-derived on Android 12+ (change wallpaper accent to confirm); fallback orange accent on older devices.
- [ ] Tapping "Settings" navigates to the Settings screen; back returns.
- [ ] Toggling system dark/light repaints both screens.

- [ ] **Step 6: Final regression — full test suite**

Run: `npm test`
Expected: PASS — all suites (sanity, resolve-theme, migrate, progress).

- [ ] **Step 7: Commit**

```bash
git add src/components/screen.tsx src/app/index.tsx src/app/settings.tsx
git commit -m "feat: themed Screen container, Library placeholder, and Settings screen"
```

---

## Definition of Done (Foundation)

- `npm test` green: sanity + resolve-theme (3) + migrate (3) + progress (3).
- `npx tsc --noEmit` clean.
- Custom dev build boots on Android with no red box.
- Material You colors follow the wallpaper and flip with system light/dark.
- SQLite DB `p53xy.db` initializes and migrates to version 1 on first launch.
- Navigation between Library and Settings works.

## Notes for the next plan (Library)
- `videos` / `watch_progress` / `settings` tables exist and are migrated.
- Access the DB in screens via `useSQLiteContext()` from `expo-sqlite`.
- Theme tokens are available via `useTheme()`; use `colors`, `spacing`, `radius`.
- `computeProgressPercent` / `isCompleted` are ready for progress bars/badges.
- Reminder: `expo-media-library` Asset `duration` units — **confirm seconds vs ms on-device** during the Library plan and normalize to `duration_ms` before storing.
