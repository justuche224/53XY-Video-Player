# Visual Cohesion — Phases 4–5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the cluttered single-scroll Settings screen into a tidy landing list + four focused sub-screens (Player / Library filters / Hidden folders / About) built on a new `ListItem`, and add restrained, on-brand motion (a continue-watching hero entrance + consistent detail-screen push transitions, both reduced-motion aware).

**Architecture:** Continues on branch `feat/visual-cohesion`, on top of Phases 1–3. Settings becomes a navigation landing using the canonical `AppBar` + a new `ListItem`; each category moves to its own pushed route under `app/settings/`, reusing the existing `FilterChips`/`NamePatternList`/`FolderIgnoreList`/`CustomLengthDialog`/`SettingSwitch` components and the root `FilterSettingsProvider` (so no prop drilling). The full-library read needed by two sub-screens is centralized in a small `useAllVideos` hook. Motion is added with Reanimated layout animations gated on `useReducedMotion()`.

**Tech Stack:** Expo SDK 56, React Native 0.85 (new-arch), expo-router (typed routes), expo-constants, react-native-reanimated 4, `@pchmn/expo-material3-theme`, Jest (pure-logic tests only).

**Spec:** [docs/superpowers/specs/2026-06-25-visual-cohesion-design-system.md](../specs/2026-06-25-visual-cohesion-design-system.md) §4 (Settings split) and §7 (motion). Phases 1–3 plan: [2026-06-25-visual-cohesion-phases-1-3.md](./2026-06-25-visual-cohesion-phases-1-3.md).

## Global Constraints

- **Package manager is `bun`.** `npx expo install` for Expo deps; never `npm install`.
- **Commits: plain conventional commits. NO `Co-Authored-By` / "Generated with" trailers.**
- **Per task, before commit:** `npx tsc --noEmit` clean AND `npm test` green AND `git status` clean after commit.
- **No component/render test setup exists** (Jest = pure-logic only). New screens/components are verified by `tsc` + suite-green + device. Do not add `@testing-library/*`.
- **Typed-routes caveat (important):** `experiments.typedRoutes` generates the `Href` union from `.expo/types/router.d.ts`, which is gitignored and only regenerates when `expo start`/`expo run` runs — which the agent cannot run. So `router.push('/settings/...')` to a brand-new route file will FAIL `tsc` until regenerated. Cast these new pushes `as any` (the codebase already does this for `/playlist` and `/add-to-playlist` — match that pattern). Existing route pushes are unaffected.
- **Theme access** via `useTheme()`; text via `<AppText variant=…>`; never hardcode type sizes/weights in new screens. Reuse existing components verbatim where possible.
- **JS-only** — no native modules touched; `npx expo start` reload suffices. (New route files may need an `expo start` restart to regenerate typed routes on device.)
- Device verification deferred to the user's build, per project convention.

---

# Phase 4 — Settings split

### Task 1: `ListItem` component

**Files:**
- Create: `src/components/list-item.tsx`

**Interfaces:**
- Consumes: `AppText`, `PressableScale`, `useTheme` (`{ colors, spacing, radius, icon }`).
- Produces: `ListItem` with props `{ icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; trailing?: ReactNode; onPress?: () => void }`. Renders a leading icon in a tonal circle, headline (`title`) + optional supporting (`meta`) text, and a trailing slot — defaulting to a chevron when `onPress` is set and no `trailing` is provided.

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

export function ListItem({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  icon?: IoniconName;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const { colors, spacing, radius, icon: iconSize } = useTheme();
  const showChevron = !!onPress && trailing === undefined;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.row, { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radius.md }]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222', borderRadius: radius.pill }]}>
          <Ionicons name={icon} size={iconSize.md} color={colors.onSurfaceVariant ?? colors.onSurface} />
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>{subtitle}</AppText> : null}
      </View>
      {trailing !== undefined ? trailing : null}
      {showChevron ? <Ionicons name="chevron-forward" size={iconSize.md} color={colors.onSurfaceVariant ?? colors.onSurface} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/list-item.tsx
git commit -m "feat(ui): ListItem component for settings/nav rows"
```

---

### Task 2: `useAllVideos` hook

**Files:**
- Create: `src/library/use-all-videos.ts`

**Interfaces:**
- Consumes: `useSQLiteContext`, `getAllVideos` from `@/db/videos-repo`, `LibraryVideo`.
- Produces: `useAllVideos(): LibraryVideo[]` — loads the full unfiltered library once on mount (used by the Library-filters hidden-count and the Hidden-folders list).

- [ ] **Step 1: Create the hook**

```ts
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getAllVideos } from '@/db/videos-repo';
import type { LibraryVideo } from './types';

/** Loads the full, unfiltered library once (Settings folder list + hidden count). */
export function useAllVideos(): LibraryVideo[] {
  const db = useSQLiteContext();
  const [all, setAll] = useState<LibraryVideo[]>([]);
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((rows) => { if (!cancelled) setAll(rows); })
      .catch(() => { /* non-essential read; ignore */ });
    return () => { cancelled = true; };
  }, [db]);
  return all;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/library/use-all-videos.ts
git commit -m "feat(settings): useAllVideos hook for full-library reads"
```

---

### Task 3: Player settings sub-screen

**Files:**
- Create: `src/app/settings/player.tsx`

**Interfaces:**
- Consumes: `AppBar`, `Screen`, `SettingSwitch`, `useBackgroundPlay` (`{ backgroundPlay, setBackgroundPlay }`), `usePictureInPicture` (`{ pictureInPicture, setPictureInPicture }`), `useTheme`.

- [ ] **Step 1: Create the screen**

```tsx
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { SettingSwitch } from '@/components/setting-switch';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { useTheme } from '@/theme/theme-provider';

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { backgroundPlay, setBackgroundPlay } = useBackgroundPlay();
  const { pictureInPicture, setPictureInPicture } = usePictureInPicture();
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Player" variant="detail" onBack={() => router.back()} />
      <View style={{ gap: spacing.sm }}>
        <SettingSwitch label="Play video in background" value={backgroundPlay} onValueChange={setBackgroundPlay} />
        <SettingSwitch label="Picture in Picture" value={pictureInPicture} onValueChange={setPictureInPicture} />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/settings/player.tsx
git commit -m "feat(settings): Player sub-screen"
```

---

### Task 4: Library filters sub-screen

**Files:**
- Create: `src/app/settings/library-filters.tsx`

**Interfaces:**
- Consumes: `AppBar`, `AppText`, `Screen`, `FilterChips` (`{ presets, value, onSelect, onCustom }`) + `LengthPreset`, `NamePatternList` (`{ patterns, onAdd, onRemove }`), `CustomLengthDialog` (`{ visible, initialMs, onCancel, onConfirm }`), `useFilterSettings` (`{ filter, setMin, setMax, addNamePattern, removeNamePattern }`), `applyFilters`, `useAllVideos`, `useTheme`.

- [ ] **Step 1: Create the screen**

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { CustomLengthDialog } from '@/components/custom-length-dialog';
import { FilterChips, type LengthPreset } from '@/components/filter-chips';
import { NamePatternList } from '@/components/name-pattern-list';
import { Screen } from '@/components/screen';
import { applyFilters } from '@/library/filter-videos';
import { useFilterSettings } from '@/library/filter-settings';
import { useAllVideos } from '@/library/use-all-videos';
import { useTheme } from '@/theme/theme-provider';

const MIN_PRESETS: LengthPreset[] = [
  { label: '10s', ms: 10_000 }, { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 }, { label: '5m', ms: 300_000 },
];
const MAX_PRESETS: LengthPreset[] = [
  { label: '1h', ms: 3_600_000 }, { label: '2h', ms: 7_200_000 }, { label: '3h', ms: 10_800_000 },
];

function LabelRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.labelRow}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceVariant ?? '#aaa'} />
      <AppText variant="titleSmall" color={colors.onSurfaceVariant ?? colors.onSurface}>{text}</AppText>
    </View>
  );
}

export default function LibraryFiltersScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { filter, setMin, setMax, addNamePattern, removeNamePattern } = useFilterSettings();
  const [dialog, setDialog] = useState<'min' | 'max' | null>(null);
  const allVideos = useAllVideos();
  const hidden = allVideos.length - applyFilters(allVideos, filter).length;

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Library filters" variant="detail" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl * 2 }} bounces overScrollMode="always">
        <LabelRow icon="time-outline" text="Hide videos shorter than" />
        <FilterChips presets={MIN_PRESETS} value={filter.minDurationMs} onSelect={setMin} onCustom={() => setDialog('min')} />
        <LabelRow icon="hourglass-outline" text="Hide videos longer than" />
        <FilterChips presets={MAX_PRESETS} value={filter.maxDurationMs} onSelect={setMax} onCustom={() => setDialog('max')} />
        <LabelRow icon="text-outline" text="Ignore videos named" />
        <NamePatternList patterns={filter.namePatterns} onAdd={addNamePattern} onRemove={removeNamePattern} />
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {hidden > 0 ? `Hiding ${hidden} video${hidden === 1 ? '' : 's'}` : 'No videos hidden'}
        </AppText>
      </ScrollView>
      <CustomLengthDialog
        visible={dialog !== null}
        initialMs={dialog === 'min' ? filter.minDurationMs : dialog === 'max' ? filter.maxDurationMs : null}
        onCancel={() => setDialog(null)}
        onConfirm={(ms) => {
          if (dialog === 'min') setMin(ms);
          else if (dialog === 'max') setMax(ms);
          setDialog(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/settings/library-filters.tsx
git commit -m "feat(settings): Library filters sub-screen"
```

---

### Task 5: Hidden folders sub-screen

**Files:**
- Create: `src/app/settings/hidden-folders.tsx`

**Interfaces:**
- Consumes: `AppBar`, `Screen`, `FolderIgnoreList` (`{ folders, ignoredFolders, onToggle }`) + `FolderEntry`, `useFilterSettings` (`{ filter, toggleFolder }`), `groupByFolder`, `useAllVideos`, `useTheme`.

- [ ] **Step 1: Create the screen**

```tsx
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { FolderIgnoreList, type FolderEntry } from '@/components/folder-ignore-list';
import { Screen } from '@/components/screen';
import { useFilterSettings } from '@/library/filter-settings';
import { groupByFolder } from '@/library/group-videos';
import { useAllVideos } from '@/library/use-all-videos';
import { useTheme } from '@/theme/theme-provider';

export default function HiddenFoldersScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { filter, toggleFolder } = useFilterSettings();
  const allVideos = useAllVideos();
  const folderEntries = useMemo<FolderEntry[]>(
    () =>
      groupByFolder(allVideos)
        .map((g) => ({ path: g.key, name: g.title, count: g.count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allVideos],
  );

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Hidden folders" variant="detail" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} bounces overScrollMode="always">
        <FolderIgnoreList folders={folderEntries} ignoredFolders={filter.ignoredFolders} onToggle={toggleFolder} />
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/settings/hidden-folders.tsx
git commit -m "feat(settings): Hidden folders sub-screen"
```

---

### Task 6: About sub-screen

**Files:**
- Create: `src/app/settings/about.tsx`

**Interfaces:**
- Consumes: `AppBar`, `AppText`, `Screen`, `useTheme`, `expo-constants` (`Constants.expoConfig?.version`).

- [ ] **Step 1: Create the screen**

```tsx
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function AboutScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="About" variant="detail" onBack={() => router.back()} />
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <AppText variant="display">53XY</AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>Version {version}</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface} style={{ marginTop: spacing.md }}>
          A fast, local video player with smart library grouping, resume, and Material You theming.
        </AppText>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/settings/about.tsx
git commit -m "feat(settings): About sub-screen"
```

---

### Task 7: Settings landing list + route registration

**Files:**
- Modify (full rewrite): `src/app/(tabs)/settings.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `AppBar`, `ListItem` (Task 1), `Screen`, `useTheme`, `TAB_BAR_CLEARANCE`. Navigates to the four sub-screens created in Tasks 3–6.

- [ ] **Step 1: Replace `(tabs)/settings.tsx` with the landing list**

```tsx
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { ListItem } from '@/components/list-item';
import { Screen } from '@/components/screen';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { useTheme } from '@/theme/theme-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Settings" />
      <ScrollView
        contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.xl + TAB_BAR_CLEARANCE }}
        bounces
        overScrollMode="always"
      >
        <ListItem icon="play-circle-outline" title="Player" subtitle="Background play, Picture in Picture" onPress={() => router.push('/settings/player' as any)} />
        <ListItem icon="funnel-outline" title="Library filters" subtitle="Hide videos by length or name" onPress={() => router.push('/settings/library-filters' as any)} />
        <ListItem icon="folder-outline" title="Hidden folders" subtitle="Choose which folders appear" onPress={() => router.push('/settings/hidden-folders' as any)} />
        <ListItem icon="information-circle-outline" title="About" subtitle="Version & info" onPress={() => router.push('/settings/about' as any)} />
      </ScrollView>
    </Screen>
  );
}
```

(The `as any` casts are required because typed-routes' generated `Href` union won't include the new files until `expo start` regenerates it — see Global Constraints. The codebase already casts `/playlist`/`/add-to-playlist` pushes the same way.)

- [ ] **Step 2: Register the sub-screen routes in `_layout.tsx`**

In `src/app/_layout.tsx`, inside the root `<Stack screenOptions={{ headerShown: false }}>`, add the four screens alongside the existing entries:

```tsx
<Stack.Screen name="settings/player" />
<Stack.Screen name="settings/library-filters" />
<Stack.Screen name="settings/hidden-folders" />
<Stack.Screen name="settings/about" />
```

- [ ] **Step 3: Typecheck + suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green (260 tests). Confirm no leftover references to the old Settings body:
Run: `grep -n "FilterChips\|NamePatternList\|FolderIgnoreList\|CustomLengthDialog\|SettingSwitch\|getAllVideos\|useBackgroundPlay" src/app/\(tabs\)/settings.tsx` → expected: no matches (all moved to sub-screens).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(tabs\)/settings.tsx src/app/_layout.tsx
git commit -m "feat(settings): split Settings into landing list + sub-screens"
```

---

# Phase 5 — Motion polish

### Task 8: Continue-watching hero entrance (reduced-motion aware)

**Files:**
- Modify: `src/components/continue-watching-hero.tsx`

**Rationale:** the hero is the signature element — a single restrained entrance (fade + slight rise) makes it feel intentional. Everything else stays still. Gated on `useReducedMotion()` so it's disabled when the user prefers reduced motion.

- [ ] **Step 1: Add the entrance animation**

In `src/components/continue-watching-hero.tsx`, update the imports to add Reanimated:

```tsx
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
```

Inside the component, before the `return`, add:

```tsx
const reducedMotion = useReducedMotion();
```

Wrap the existing `<PressableScale>…</PressableScale>` in an `Animated.View` that carries the entrance, leaving the `PressableScale` and its contents exactly as they are:

```tsx
return (
  <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280)}>
    <PressableScale
      onPress={onPress}
      style={[styles.card, { backgroundColor: elevation(2), borderRadius: radius.xl, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.md }]}
    >
      {/* …existing poster + body unchanged… */}
    </PressableScale>
  </Animated.View>
);
```

- [ ] **Step 2: Typecheck + suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green.

- [ ] **Step 3: Commit**

```bash
git add src/components/continue-watching-hero.tsx
git commit -m "feat(motion): subtle hero entrance, reduced-motion aware"
```

---

### Task 9: Consistent detail-screen push transition

**Files:**
- Modify: `src/app/_layout.tsx`

**Rationale:** unify how pushed detail screens (group, playlist, add-to-playlist, settings sub-screens) animate in, for a cohesive feel. Use Android's standard horizontal slide. Leave the player's transition on the default (it manages orientation; a forced animation can fight the rotation) by setting the animation per-screen rather than globally, OR set it globally and exempt the player.

- [ ] **Step 1: Set a shared slide animation, exempt the player**

In `src/app/_layout.tsx`, change the root Stack's `screenOptions` to include the shared animation, and override the player screen to keep the default:

```tsx
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
```

(Keep the `(tabs)` entry first. The `settings/*` entries were added in Task 7 — this step only adds the `animation` options.)

- [ ] **Step 2: Typecheck + suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green.

- [ ] **Step 3: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat(motion): consistent slide transition for detail screens"
```

---

## Final verification (end of Phases 4–5)

- [ ] **Run the full suite + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: clean + 260 tests green.

- [ ] **Confirm Settings fully migrated**

Run: `grep -rn "FilterChips\|NamePatternList\|FolderIgnoreList\|CustomLengthDialog" src/app/\(tabs\)/settings.tsx`
Expected: no matches (these now live only in the sub-screens).

- [ ] **Hand off to user for device verification** with this checklist:
  - **First run `npx expo start -c`** (clears Metro cache so typed routes regenerate for the new `settings/*` screens).
  - Settings tab shows a clean 4-item list (Player / Library filters / Hidden folders / About), each with a leading icon + chevron.
  - Each item pushes a full-screen sub-screen with a back arrow; all controls work (toggles persist; length chips + custom dialog; name patterns add/remove; folder switches; "Hiding N videos" count on Library filters).
  - About shows 53XY + version.
  - The continue-watching hero fades/rises in subtly on Home; with system "Remove animations" on, it appears instantly (no entrance).
  - Pushing into a group / playlist / settings sub-screen slides in from the right; opening the player is unaffected.

## Self-review notes (author)

- **Spec coverage:** §4 Settings split → landing (T7) + Player (T3) + Library filters (T4) + Hidden folders (T5) + About (T6), built on `ListItem` (T1, the deferred Phase-2 component) and `useAllVideos` (T2). §7 motion → hero entrance (T8) + detail-screen transitions (T9), both reduced-motion/player-safe. `SectionHeader` already exists from Phase 2; not needed here since each sub-screen is single-purpose.
- **Type consistency:** sub-screens reuse the exact prop shapes of `FilterChips`/`NamePatternList`/`FolderIgnoreList`/`CustomLengthDialog`/`SettingSwitch`/`useFilterSettings` verbatim from the current `settings.tsx`; `useAllVideos` returns `LibraryVideo[]` consumed identically by T4/T5. `ListItem` trailing/onPress contract matches its T7 usage (icon + subtitle + default chevron).
- **No placeholders:** every screen's full code is given. New-route `tsc` failure is pre-empted with `as any` casts per the typed-routes caveat.
- **Deferred/again:** the Settings cosmetic note from Phases 1–3 (ad-hoc `styles.section`) is resolved here — that old body is deleted in T7. The Minor cleanups logged at the end of Phases 1–3 (badge radius token, unused `ROW_THUMB`) are not in this plan's scope; fold separately if desired.
