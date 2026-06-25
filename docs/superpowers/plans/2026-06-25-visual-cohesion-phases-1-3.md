# Visual Cohesion — Phases 1–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a shared design-system foundation (typography, elevation, icon tokens, brand font) and canonical UI components (MediaRow, MediaCard, AppBar, hero), then apply them to Home and the library/group/history/playlist screens — fixing the "incoherent" feel, the mis-placed Resume FAB, and the cramped playlist controls.

**Architecture:** Tokens-first. Phase 1 adds tokens + an `<AppText>` wrapper + the Space Grotesk display font + a brand-violet fallback seed. Phase 2 builds canonical components that consume those tokens. Phase 3 rewires screens onto the canonical components and replaces the floating Resume FAB with a "Continue watching" hero. Existing row components are re-implemented as thin wrappers over `MediaRow`/`MediaCard`, so screen call-sites stay stable and code stays DRY.

**Tech Stack:** Expo SDK 56, React Native 0.85 (new-arch only), expo-router, `@shopify/flash-list` v2, react-native-gesture-handler, reanimated, `@pchmn/expo-material3-theme`, `@expo-google-fonts/space-grotesk`, Jest (pure-logic tests only).

**Spec:** [docs/superpowers/specs/2026-06-25-visual-cohesion-design-system.md](../specs/2026-06-25-visual-cohesion-design-system.md). This plan covers spec Phases 1–3 only. Phase 4 (Settings split — incl. `ListItem`) and Phase 5 (motion polish) are intentionally out of scope and follow after device-verification.

## Global Constraints

- **Package manager is `bun`.** Use `npx expo install <pkg>` for Expo/RN deps; `bun add` for others. Never `npm install`.
- **Commits: plain conventional commits. NO `Co-Authored-By` / "Generated with" trailers.**
- **Per task, before commit:** `npx tsc --noEmit` clean AND `npm test` green AND `git status` clean after commit.
- **The project has NO component/render test setup** (Jest runs pure-logic tests only). New *pure* token modules get Jest tests; React components are verified by `tsc` + suite-green + the user's device build. Do not add `@testing-library/*`.
- **JS-only reloads suffice EXCEPT Task 4** (adds a font asset → needs a Metro restart / `npx expo start -c`, and a fresh dev-client build if fonts aren't picked up). FlashList is native but no FlashList API changes here.
- **Theme access:** always via `useTheme()` from `@/theme/theme-provider`. Never hardcode colors except scrim/utility blacks already in the codebase.
- **Read `AGENTS.md`:** Expo SDK 56 APIs — verify against installed `node_modules` types when unsure.
- Device (visual) verification is deferred to the user's own build per project convention.

---

# Phase 1 — Foundation tokens

### Task 1: Typography tokens + `AppText`

**Files:**
- Create: `src/theme/typography.ts`
- Create: `src/theme/__tests__/typography.test.ts`
- Create: `src/components/app-text.tsx`

**Interfaces:**
- Produces: `TYPOGRAPHY: Record<TypeVariant, TypeStyle>`, `FONTS`, `type TypeVariant`, `type TypeStyle`; `AppText` component with props `{ variant?: TypeVariant; color?: string; style?; ...TextProps }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/__tests__/typography.test.ts
import { TYPOGRAPHY, FONTS } from '../typography';

describe('typography tokens', () => {
  it('defines every variant with a positive size and line height', () => {
    const variants = ['display', 'headline', 'title', 'titleSmall', 'body', 'label', 'meta', 'episode'] as const;
    for (const v of variants) {
      expect(TYPOGRAPHY[v].fontSize).toBeGreaterThan(0);
      expect(TYPOGRAPHY[v].lineHeight).toBeGreaterThanOrEqual(TYPOGRAPHY[v].fontSize);
    }
  });

  it('uses the display font family only for display + headline', () => {
    expect(TYPOGRAPHY.display.fontFamily).toBe(FONTS.displayBold);
    expect(TYPOGRAPHY.headline.fontFamily).toBe(FONTS.display);
    expect(TYPOGRAPHY.title.fontFamily).toBeUndefined();
    expect(TYPOGRAPHY.body.fontFamily).toBeUndefined();
  });

  it('keeps row-title at 16/600 (the one canonical list-title value)', () => {
    expect(TYPOGRAPHY.title.fontSize).toBe(16);
    expect(TYPOGRAPHY.title.fontWeight).toBe('600');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/typography.test.ts`
Expected: FAIL — cannot find module `../typography`.

- [ ] **Step 3: Create the typography module**

```ts
// src/theme/typography.ts
import type { TextStyle } from 'react-native';

// Font-family keys must match the names passed to useFonts() in _layout.tsx.
// Body text intentionally has no family → system default (Roboto on Android).
export const FONTS = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

export type TypeVariant =
  | 'display' | 'headline' | 'title' | 'titleSmall' | 'body' | 'label' | 'meta' | 'episode';

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  fontFamily?: string;
}

export const TYPOGRAPHY: Record<TypeVariant, TypeStyle> = {
  display:    { fontSize: 28, lineHeight: 34, fontWeight: '700', fontFamily: FONTS.displayBold },
  headline:   { fontSize: 22, lineHeight: 28, fontWeight: '600', fontFamily: FONTS.display },
  title:      { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  body:       { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label:      { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  meta:       { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  episode:    { fontSize: 12, lineHeight: 16, fontWeight: '700' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/typography.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the `AppText` component**

```tsx
// src/components/app-text.tsx
import { Text, type TextProps } from 'react-native';

import { TYPOGRAPHY, type TypeVariant } from '@/theme/typography';
import { useTheme } from '@/theme/theme-provider';

export function AppText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; color?: string }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[TYPOGRAPHY[variant], { color: color ?? colors.onSurface }, style]} />;
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/theme/typography.ts src/theme/__tests__/typography.test.ts src/components/app-text.tsx
git commit -m "feat(theme): typography ramp + AppText"
```

---

### Task 2: Elevation, icon & radius tokens

**Files:**
- Modify: `src/theme/resolve-theme.ts`
- Modify: `src/theme/__tests__/resolve-theme.test.ts`

**Interfaces:**
- Consumes: existing `SPACING`, `RADIUS`, `resolveTheme`, `Material3Scheme`.
- Produces: `ICON`, `type ElevationLevel`, `elevationColor(colors, level)`; `ThemeTokens` gains `icon: typeof ICON` and `elevation: (level: ElevationLevel) => string`; `RADIUS` gains `xl: 28`.

- [ ] **Step 1: Write the failing test**

Add to `src/theme/__tests__/resolve-theme.test.ts` (append; keep existing tests):

```ts
import { elevationColor, ICON, RADIUS, resolveTheme } from '../resolve-theme';

const SCHEME = {
  surface: '#100', surfaceContainerLow: '#111', surfaceContainer: '#122',
  surfaceContainerHigh: '#133', surfaceVariant: '#199',
};
const THEME = { light: SCHEME, dark: SCHEME } as any;

describe('elevation + icon + radius tokens', () => {
  it('maps elevation levels to surface-container tones', () => {
    expect(elevationColor(SCHEME, 0)).toBe('#100');
    expect(elevationColor(SCHEME, 1)).toBe('#111');
    expect(elevationColor(SCHEME, 2)).toBe('#122');
    expect(elevationColor(SCHEME, 3)).toBe('#133');
  });

  it('falls back to surfaceVariant when a tone is absent', () => {
    expect(elevationColor({ surfaceVariant: '#199' }, 2)).toBe('#199');
  });

  it('exposes icon scale and an xl radius', () => {
    expect(ICON.md).toBe(24);
    expect(RADIUS.xl).toBe(28);
  });

  it('attaches icon + elevation to resolved tokens', () => {
    const t = resolveTheme(THEME, 'dark');
    expect(t.icon.lg).toBe(28);
    expect(t.elevation(2)).toBe('#122');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/resolve-theme.test.ts`
Expected: FAIL — `elevationColor`/`ICON`/`RADIUS.xl`/`t.icon` undefined.

- [ ] **Step 3: Update `resolve-theme.ts`**

Replace the `RADIUS` line and the `ThemeTokens`/`resolveTheme` definitions:

```ts
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
```

(Keep the existing type exports `Material3Scheme`, `Material3Theme`, `ColorSchemeName` unchanged at the top of the file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/theme/__tests__/resolve-theme.test.ts`
Expected: PASS (existing tests + 4 new).

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green.

- [ ] **Step 6: Commit**

```bash
git add src/theme/resolve-theme.ts src/theme/__tests__/resolve-theme.test.ts
git commit -m "feat(theme): elevation, icon, and xl-radius tokens"
```

---

### Task 3: Reseed fallback palette from brand violet

**Files:**
- Modify: `src/theme/theme-provider.tsx:7`

- [ ] **Step 1: Change the fallback source color**

In `src/theme/theme-provider.tsx`, replace:

```ts
const FALLBACK_SOURCE_COLOR = '#FF6B00';
```

with:

```ts
// Brand violet (the app-icon accent). Seeds the whole Material You palette when
// the system can't supply a dynamic source color (Android < 12, dynamic off).
const FALLBACK_SOURCE_COLOR = '#5E4FA6';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/theme/theme-provider.tsx
git commit -m "feat(theme): seed fallback palette from brand violet"
```

---

### Task 4: Load Space Grotesk + gate splash

**Files:**
- Modify: `package.json` (via `expo install`)
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `FONTS` keys from Task 1 (`SpaceGrotesk_600SemiBold`, `SpaceGrotesk_700Bold`).

- [ ] **Step 1: Install the font package**

Run: `npx expo install @expo-google-fonts/space-grotesk expo-splash-screen`
Expected: both resolve to SDK-56-compatible versions (`expo-splash-screen` already present; this is a no-op or confirms it).

- [ ] **Step 2: Gate render on font load in `_layout.tsx`**

Add imports at the top of `src/app/_layout.tsx`:

```tsx
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
```

Immediately after the imports (module scope), add:

```tsx
SplashScreen.preventAutoHideAsync();
```

Then at the very top of the `RootLayout` function body, before the `return`:

```tsx
const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });

useEffect(() => {
  if (fontsLoaded) SplashScreen.hideAsync();
}, [fontsLoaded]);

if (!fontsLoaded) return null;
```

- [ ] **Step 3: Typecheck + suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock src/app/_layout.tsx
git commit -m "feat(theme): load Space Grotesk display font, gate splash"
```

> **Device note for the user:** this task adds a font asset. Run `npx expo start -c` (clear cache); if the display font doesn't render, a fresh dev-client build (`npx expo run:android`) is needed.

---

# Phase 2 — Canonical components

### Task 5: Restyle `DurationBadge`

**Files:**
- Modify: `src/components/duration-badge.tsx`

**Rationale:** make it a rounded pill using the `meta` type token + a softer scrim. White-on-scrim is kept (legibility over arbitrary thumbnails); the harsh full-black is softened and the radius tokenized.

- [ ] **Step 1: Replace the file**

```tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { formatTime } from '@/player/format-time';

export function DurationBadge({ ms }: { ms: number | null | undefined }) {
  if (!ms || ms <= 0) return null;
  return (
    <View style={styles.badge}>
      <AppText variant="meta" color="#fff" style={styles.text}>{formatTime(ms / 1000)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  text: { lineHeight: 14 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/duration-badge.tsx
git commit -m "feat(ui): pill duration badge on type token"
```

---

### Task 6: `MediaRow` — the canonical list row

**Files:**
- Create: `src/components/media-row.tsx`

**Interfaces:**
- Consumes: `AppText`, `DurationBadge`, `ProgressBar`, `PressableScale`, `useTheme`.
- Produces: `MediaRow` with props
  `{ thumbnail: ReactNode; title: string; titleLines?: number; overline?: string; meta?: string; percent?: number; durationMs?: number | null; trailing?: ReactNode; onPress?: () => void; onLongPress?: () => void }`,
  and `ROW_THUMB = { width: 100, height: 56 }`. Progress renders as a bar woven into the **bottom edge of the thumbnail** (signature #3) for every row.

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { DurationBadge } from './duration-badge';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { useTheme } from '@/theme/theme-provider';

// One canonical thumbnail size for every list row (16:9-ish).
export const ROW_THUMB = { width: 100, height: 56 } as const;

export function MediaRow({
  thumbnail,
  title,
  titleLines = 2,
  overline,
  meta,
  percent = 0,
  durationMs,
  trailing,
  onPress,
  onLongPress,
}: {
  thumbnail: ReactNode;
  title: string;
  titleLines?: number;
  overline?: string;
  meta?: string;
  percent?: number;
  durationMs?: number | null;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radius.md }]}
    >
      <View style={[styles.thumb, { width: ROW_THUMB.width, height: ROW_THUMB.height, borderRadius: radius.sm, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        {thumbnail}
        <DurationBadge ms={durationMs} />
        {percent > 0 ? (
          <View style={styles.progress}><ProgressBar percent={percent} /></View>
        ) : null}
      </View>
      <View style={styles.body}>
        {overline ? <AppText variant="episode" color={colors.primary}>{overline}</AppText> : null}
        <AppText variant="title" numberOfLines={titleLines}>{title}</AppText>
        {meta ? <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>{meta}</AppText> : null}
      </View>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  thumb: { overflow: 'hidden' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  body: { flex: 1, gap: 2 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (component unused so far — that's fine; it's consumed in Phase 3).

- [ ] **Step 3: Commit**

```bash
git add src/components/media-row.tsx
git commit -m "feat(ui): canonical MediaRow component"
```

---

### Task 7: `MediaCard` — the canonical grid card

**Files:**
- Create: `src/components/media-card.tsx`

**Interfaces:**
- Produces: `MediaCard` with props `{ thumbnail: ReactNode; title: string; meta?: string; percent?: number; durationMs?: number | null; onPress: () => void }`. Poster is 16:10; progress woven into the poster's bottom edge.

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { DurationBadge } from './duration-badge';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { useTheme } from '@/theme/theme-provider';

export function MediaCard({
  thumbnail,
  title,
  meta,
  percent = 0,
  durationMs,
  onPress,
}: {
  thumbnail: ReactNode;
  title: string;
  meta?: string;
  percent?: number;
  durationMs?: number | null;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flex: 1, margin: spacing.sm, borderRadius: radius.md, overflow: 'hidden' }}>
      <View style={[styles.poster, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        {thumbnail}
        <DurationBadge ms={durationMs} />
        {percent > 0 ? (
          <View style={styles.progress}><ProgressBar percent={percent} /></View>
        ) : null}
      </View>
      <View style={{ marginTop: spacing.sm, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>{title}</AppText>
        {meta ? <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>{meta}</AppText> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  poster: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/media-card.tsx
git commit -m "feat(ui): canonical MediaCard component"
```

---

### Task 8: `SectionHeader` + `AppBar`

**Files:**
- Create: `src/components/section-header.tsx`
- Create: `src/components/app-bar.tsx`

**Interfaces:**
- Produces:
  - `SectionHeader` with props `{ title: string }`.
  - `AppBar` with props `{ title: string; variant?: 'large' | 'detail'; onBack?: () => void; accessory?: ReactNode; right?: ReactNode }`. `large` renders the title in the `display` variant (wordmark, brand font); `detail` renders a back chevron + `headline` title.

> `ListItem` (spec Phase 2) is intentionally **deferred to Phase 4**, where Settings — its only consumer — is built. Building it now would be unused (YAGNI) and un-verifiable.

- [ ] **Step 1: Create `SectionHeader`**

```tsx
// src/components/section-header.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/theme-provider';

export function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
});
```

- [ ] **Step 2: Create `AppBar`**

```tsx
// src/components/app-bar.tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme-provider';

export function AppBar({
  title,
  variant = 'large',
  onBack,
  accessory,
  right,
}: {
  title: string;
  variant?: 'large' | 'detail';
  onBack?: () => void;
  accessory?: ReactNode;
  right?: ReactNode;
}) {
  const { colors, icon } = useTheme();
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {variant === 'detail' && onBack ? (
          <PressableScale onPress={onBack} style={styles.back}>
            <Ionicons name="arrow-back" size={icon.md} color={colors.onSurface} />
          </PressableScale>
        ) : null}
        <AppText variant={variant === 'large' ? 'display' : 'headline'} numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {accessory}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: 16 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  back: { padding: 4 },
  title: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/section-header.tsx src/components/app-bar.tsx
git commit -m "feat(ui): SectionHeader and unified AppBar"
```

---

# Phase 3 — Home + hero + rollout

### Task 9: `ContinueWatchingHero`

**Files:**
- Create: `src/components/continue-watching-hero.tsx`

**Interfaces:**
- Consumes: `AppText`, `VideoThumbnail`, `ProgressBar`, `PressableScale`, `parseEpisode`, `formatEpisodeLabel`, `formatTime`, `useTheme`, `LibraryVideo`.
- Produces: `ContinueWatchingHero` with props `{ video: LibraryVideo; percent: number; onPress: () => void }`. Renders an elevation-2 card: left poster (140×80) with a ▶ overlay, right column with episode overline + title + "{N} left" + progress.

- [ ] **Step 1: Create the component**

```tsx
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

export function ContinueWatchingHero({
  video,
  percent,
  onPress,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
}) {
  const { colors, spacing, radius, icon, elevation } = useTheme();
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);
  const remainingMs = video.durationMs ? video.durationMs * (1 - Math.min(percent, 1)) : 0;
  const remaining = remainingMs > 0 ? `${formatTime(remainingMs / 1000)} left` : 'Resume';

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, { backgroundColor: elevation(2), borderRadius: radius.xl, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.md }]}
    >
      <View style={[styles.poster, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        <VideoThumbnail video={video} style={styles.fill} />
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={icon.lg} color="#fff" />
        </View>
      </View>
      <View style={styles.body}>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {label ? `Continue · ${label}` : 'Continue watching'}
        </AppText>
        <AppText variant="title" numberOfLines={2}>{video.filename}</AppText>
        <View style={{ gap: 4 }}>
          <AppText variant="label" color={colors.primary}>{remaining}</AppText>
          <ProgressBar percent={percent > 0 ? percent : 0.001} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  poster: { width: 140, height: 80, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  body: { flex: 1, gap: 4 },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/continue-watching-hero.tsx
git commit -m "feat(home): continue-watching hero component"
```

---

### Task 10: Re-implement `GroupRow` + `GroupCard` on the canonical components

**Files:**
- Modify: `src/components/group-row.tsx`
- Modify: `src/components/group-card.tsx`

**Interfaces:**
- Public props of both are unchanged (`{ group: Group; percent: number; onPress: () => void }`) so `index.tsx` needs no edits here.

- [ ] **Step 1: Replace `group-row.tsx`**

```tsx
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { ThumbnailCollage } from './thumbnail-collage';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const GroupRow = memo(function GroupRow({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const { colors, icon } = useTheme();
  const totalMs = group.items.reduce((acc, v) => acc + (v.durationMs ?? 0), 0);
  return (
    <MediaRow
      thumbnail={<ThumbnailCollage videos={group.items} style={styles.fill} />}
      title={group.title}
      titleLines={1}
      meta={`${group.count} video${group.count === 1 ? '' : 's'}`}
      percent={percent}
      durationMs={totalMs}
      onPress={onPress}
      trailing={<Ionicons name="chevron-forward" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />}
    />
  );
});

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
```

- [ ] **Step 2: Replace `group-card.tsx`**

```tsx
import { memo } from 'react';
import { StyleSheet } from 'react-native';

import { MediaCard } from './media-card';
import { ThumbnailCollage } from './thumbnail-collage';
import type { Group } from '@/library/types';

export const GroupCard = memo(function GroupCard({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const totalMs = group.items.reduce((acc, v) => acc + (v.durationMs ?? 0), 0);
  return (
    <MediaCard
      thumbnail={<ThumbnailCollage videos={group.items} style={styles.fill} />}
      title={group.title}
      meta={`${group.count} video${group.count === 1 ? '' : 's'}`}
      percent={percent}
      durationMs={totalMs}
      onPress={onPress}
    />
  );
});

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/group-row.tsx src/components/group-card.tsx
git commit -m "refactor(ui): GroupRow/GroupCard on MediaRow/MediaCard"
```

---

### Task 11: Re-implement `EpisodeRow` on `MediaRow`

**Files:**
- Modify: `src/components/episode-row.tsx`

**Interfaces:** props unchanged (`{ video: LibraryVideo; percent: number; onPress: () => void }`).

- [ ] **Step 1: Replace the file**

```tsx
import { StyleSheet } from 'react-native';

import { MediaRow } from './media-row';
import { VideoThumbnail } from './video-thumbnail';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';

export function EpisodeRow({ video, percent, onPress }: { video: LibraryVideo; percent: number; onPress: () => void }) {
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);
  return (
    <MediaRow
      thumbnail={<VideoThumbnail video={video} style={styles.fill} />}
      overline={label || undefined}
      title={video.filename}
      percent={percent}
      durationMs={video.durationMs}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/episode-row.tsx
git commit -m "refactor(ui): EpisodeRow on MediaRow"
```

---

### Task 12: Re-implement `HistoryRow` on `MediaRow` (keep swipe-delete)

**Files:**
- Modify: `src/components/history-row.tsx`

**Interfaces:** props unchanged (`{ video; percent; onPress; onRemove }`).

- [ ] **Step 1: Replace the file**

```tsx
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const HistoryRow = memo(function HistoryRow({
  video,
  percent,
  onPress,
  onRemove,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, icon } = useTheme();
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onRemove} style={[styles.remove, { backgroundColor: colors.error ?? '#B00020' }]}>
          <Ionicons name="trash-outline" size={icon.md} color={colors.onError ?? '#fff'} />
        </Pressable>
      )}
    >
      <MediaRow
        thumbnail={<VideoThumbnail video={video} style={styles.fill} />}
        title={video.filename}
        meta={video.folder}
        percent={percent}
        durationMs={video.durationMs}
        onPress={onPress}
      />
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  remove: { width: 72, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/history-row.tsx
git commit -m "refactor(ui): HistoryRow on MediaRow"
```

---

### Task 13: Re-implement `PlaylistRow` on `MediaRow`

**Files:**
- Modify: `src/components/playlist-row.tsx`

**Interfaces:** props unchanged (`{ playlist; videos; onPress; onLongPress? }`).

- [ ] **Step 1: Replace the file**

```tsx
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { ThumbnailCollage } from './thumbnail-collage';
import type { PlaylistRow as PlaylistRowType } from '@/db/playlists-repo';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function PlaylistRow({
  playlist,
  videos,
  onPress,
  onLongPress,
}: {
  playlist: PlaylistRowType;
  videos: LibraryVideo[];
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, icon } = useTheme();
  return (
    <MediaRow
      thumbnail={<ThumbnailCollage videos={videos} style={styles.fill} />}
      title={playlist.name}
      titleLines={1}
      meta={`${playlist.itemCount} video${playlist.itemCount === 1 ? '' : 's'}`}
      onPress={onPress}
      onLongPress={onLongPress}
      trailing={<Ionicons name="chevron-forward" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />}
    />
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/playlist-row.tsx
git commit -m "refactor(ui): PlaylistRow on MediaRow"
```

---

### Task 14: Re-implement `PlaylistItemRow` — swipe-delete + clean reorder control

**Files:**
- Modify: `src/components/playlist-item-row.tsx`

**Interfaces:**
- Props unchanged in signature (`{ video; percent; onPress; onMoveUp?; onMoveDown?; onRemove?; canMoveUp?; canMoveDown? }`) so `playlist.tsx`'s wiring keeps working. `onRemove` now fires from a swipe instead of a trash button; the up/down chevrons become a single tidy stacked reorder control in the trailing slot.

> **Scope note:** true drag-and-drop reorder is deferred (needs a draggable-list dep that's risky on RN 0.85 new-arch + FlashList — consistent with the project's libVLC-style caution). This task delivers the *visual* fix: removes the cramped trash button (now swipe-to-delete, matching History) and tidies the reorder chevrons.

- [ ] **Step 1: Replace the file**

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function PlaylistItemRow({
  video,
  percent,
  onPress,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const { colors, icon } = useTheme();
  const handle = (
    <View style={styles.reorder}>
      <Pressable onPress={onMoveUp} disabled={!canMoveUp} hitSlop={6} style={{ opacity: canMoveUp ? 1 : 0.25 }}>
        <Ionicons name="chevron-up" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />
      </Pressable>
      <Pressable onPress={onMoveDown} disabled={!canMoveDown} hitSlop={6} style={{ opacity: canMoveDown ? 1 : 0.25 }}>
        <Ionicons name="chevron-down" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />
      </Pressable>
    </View>
  );
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onRemove} style={[styles.remove, { backgroundColor: colors.error ?? '#B00020' }]}>
          <Ionicons name="trash-outline" size={icon.md} color={colors.onError ?? '#fff'} />
        </Pressable>
      )}
    >
      <MediaRow
        thumbnail={<VideoThumbnail video={video} style={styles.fill} />}
        title={video.filename}
        percent={percent}
        durationMs={video.durationMs}
        onPress={onPress}
        trailing={handle}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  reorder: { alignItems: 'center', justifyContent: 'center' },
  remove: { width: 72, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Remove the now-dead `Alert`-based remove confirm path in `playlist.tsx`**

In `src/app/playlist.tsx`, `handleRemoveItem` currently shows a confirm `Alert`. Swipe-to-delete is itself the confirmation gesture, so simplify it to remove directly:

```tsx
const handleRemoveItem = async (videoId: string) => {
  if (!id) return;
  await removeItem(db, id, videoId);
  loadData();
};
```

(Leave the rest of `playlist.tsx` untouched in this task; the AppBar swap happens in Task 16.)

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/playlist-item-row.tsx src/app/playlist.tsx
git commit -m "feat(playlists): swipe-to-delete + tidy reorder control"
```

---

### Task 15: Home — AppBar wordmark + hero, remove Resume FAB

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Delete: `src/components/resume-fab.tsx`
- Modify: `src/components/screen-header.tsx` consumers are migrated in Tasks 15–16; the file is deleted in Task 16.

**Interfaces:**
- Consumes: `AppBar` (Task 8), `ContinueWatchingHero` (Task 9).

- [ ] **Step 1: Swap imports in `index.tsx`**

Remove these imports:

```tsx
import { ScreenHeader } from '@/components/screen-header';
import { ResumeFab } from '@/components/resume-fab';
```

Add:

```tsx
import { AppBar } from '@/components/app-bar';
import { ContinueWatchingHero } from '@/components/continue-watching-hero';
```

- [ ] **Step 2: Replace the header JSX**

Replace the `<ScreenHeader ... />` block with:

```tsx
<AppBar
  title="53XY"
  accessory={refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
  right={
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceVariant ?? '#222', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, gap: 16 }}>
      <SortButton sortKey={sortKey} sortDir={sortDir} onPress={() => setSortOpen(true)} />
      <LayoutToggle value={layout} onChange={onLayout} />
    </View>
  }
/>
```

- [ ] **Step 3: Render the hero, drop the FAB**

Insert the hero immediately *above* the `<View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>` search/tabs block:

```tsx
{resumeTarget ? (
  <ContinueWatchingHero
    video={resumeTarget}
    percent={progress.get(resumeTarget.id)?.percent ?? 0}
    onPress={onResume}
  />
) : null}
```

Then delete the FAB line near the end of the component:

```tsx
{resumeTarget ? <ResumeFab onPress={onResume} bottomOffset={TAB_BAR_CLEARANCE} /> : null}
```

(`TAB_BAR_CLEARANCE` is still used by `contentContainerStyle` — keep that import.)

- [ ] **Step 4: Delete the FAB component**

```bash
git rm src/components/resume-fab.tsx
```

- [ ] **Step 5: Typecheck + suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green. (If `tsc` flags an unused `ResumeFab`/`ScreenHeader` import, ensure Step 1 removed them.)

- [ ] **Step 6: Commit**

```bash
git add src/app/(tabs)/index.tsx
git commit -m "feat(home): wordmark AppBar + continue-watching hero, remove FAB"
```

---

### Task 16: Migrate History, Playlists, Playlist, Group headers to `AppBar`; delete `ScreenHeader`

**Files:**
- Modify: `src/app/(tabs)/history.tsx`
- Modify: `src/app/(tabs)/playlists.tsx`
- Modify: `src/app/playlist.tsx`
- Modify: `src/app/group.tsx`
- Delete: `src/components/screen-header.tsx`

- [ ] **Step 1: History — AppBar + SectionHeader**

In `src/app/(tabs)/history.tsx`: replace `import { ScreenHeader } from '@/components/screen-header';` with `import { AppBar } from '@/components/app-bar';` and `import { SectionHeader } from '@/components/section-header';`. Replace the `<ScreenHeader title="History" right={...} />` with:

```tsx
<AppBar
  title="History"
  right={
    <Pressable onPress={onClearAll} hitSlop={10}>
      <Ionicons name="trash-outline" size={22} color={colors.onSurface} />
    </Pressable>
  }
/>
```

Replace the `renderSectionHeader` body with:

```tsx
renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
```

Remove the now-unused `styles.section` entry and the `StyleSheet` import if nothing else uses it (the `Text` import may also become unused — remove if so; `tsc`/lint will tell you).

- [ ] **Step 2: Playlists — AppBar**

In `src/app/(tabs)/playlists.tsx`: swap `ScreenHeader` import for `AppBar`, and replace `<ScreenHeader title="Playlists" right={...} />` with `<AppBar title="Playlists" right={...} />` (keep the existing `right` add-button JSX verbatim).

- [ ] **Step 3: Playlist detail — AppBar detail variant**

In `src/app/playlist.tsx`: replace the custom `<View style={styles.header}>…</View>` block (the back/title/actions row) with:

```tsx
<AppBar
  title={playlist.name}
  variant="detail"
  onBack={() => router.back()}
  right={
    <>
      <PressableScale onPress={handlePlayAll} style={{ padding: 4, opacity: items.length ? 1 : 0.3 }} disabled={!items.length}>
        <Ionicons name="play" size={24} color={colors.primary} />
      </PressableScale>
      <PressableScale onPress={() => { setNewName(playlist.name); setRenameVisible(true); }} style={{ padding: 4 }}>
        <MaterialIcons name="edit" size={24} color={colors.onSurface} />
      </PressableScale>
      <PressableScale onPress={handleDelete} style={{ padding: 4 }}>
        <Ionicons name="trash-outline" size={24} color={colors.error ?? '#ef4444'} />
      </PressableScale>
    </>
  }
/>
```

Add `import { AppBar } from '@/components/app-bar';`. Remove the now-unused `header`, `headerLeft`, `headerRight`, `title` entries from the local `StyleSheet` (keep the modal styles).

- [ ] **Step 4: Group detail — AppBar instead of native Stack header**

In `src/app/group.tsx`: remove the `<Stack.Screen options={{ headerShown: true, ... }} />` block and the `Stack` import. Add `import { AppBar } from '@/components/app-bar';` and render, as the first child inside `<Screen>`:

```tsx
<AppBar title={group?.title ?? 'Group'} variant="detail" onBack={() => router.back()} />
```

- [ ] **Step 5: Delete `ScreenHeader`**

```bash
git rm src/components/screen-header.tsx
```

- [ ] **Step 6: Typecheck + suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green. Grep to confirm no stragglers:
Run: `grep -rn "screen-header\|ScreenHeader" src` → expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add src/app/(tabs)/history.tsx src/app/(tabs)/playlists.tsx src/app/playlist.tsx src/app/group.tsx
git commit -m "feat(ui): unify screen headers on AppBar"
```

---

## Final verification (end of Phases 1–3)

- [ ] **Run the full suite + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: clean + all tests green (the prior 82 + new typography/elevation tests).

- [ ] **Confirm dead components are gone**

Run: `grep -rn "resume-fab\|ResumeFab\|screen-header\|ScreenHeader" src`
Expected: no matches.

- [ ] **Hand off to user for device verification** with this checklist:
  - Home shows the **53XY** wordmark in Space Grotesk; a **Continue watching** hero appears (when there's resume history) and resumes on tap; no floating Resume pill.
  - List + grid rows look uniform (one thumbnail size, one title size, progress woven into the thumbnail's bottom edge).
  - History day headers render; swipe-to-delete works.
  - Playlist detail: header is back + play/edit/delete; rows swipe-to-delete; up/down reorder still works.
  - Group detail header matches the others.
  - Toggle Material You off (or test on a device that can't supply dynamic color) → palette is violet, not orange.

## Self-review notes (author)

- **Spec coverage:** §3.1 typography → T1; §3.2 font → T1+T4; §3.3 fallback seed → T3; §3.4 elevation → T2; §3.5 icon/radius → T2; §4 MediaRow/MediaCard/SectionHeader/AppBar + unified delete/reorder → T6–T8, T12, T14; `ListItem` explicitly deferred to Phase 4. §5 hero → T9; typographic voice applied via AppText in T8–T16. §6 screen applications → T10–T16 (Settings split is Phase 4, out of scope). §7 motion: existing `PressableScale`/tab spring retained; new motion is Phase 5.
- **Type consistency:** `MediaRow`/`MediaCard` prop names (`thumbnail`, `percent`, `durationMs`, `trailing`, `overline`, `meta`) are used identically in T10–T14; `ROW_THUMB` exported but consumers pass fill-style thumbnails. `elevation(level)`/`icon` added to `ThemeTokens` in T2 and consumed in T9/T8.
- **No placeholders:** every code step is complete; no TBDs.
