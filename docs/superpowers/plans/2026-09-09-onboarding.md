# Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A six-slide first-run carousel that owns both permission asks, followed by three in-context teaching surfaces, so a new user discovers Moments, grouping, continuity and the player gestures instead of never finding them.

**Architecture:** `/onboarding` is a real expo-router route entered with `router.replace()`. A new `OnboardingProvider` reads version state from the existing `settings` key/value table (no migration); a new `MediaAccessProvider` hoists the media-library permission hook out of `LibraryProvider` so onboarding can own the timing of the system dialog. Coach marks are tiered by risk — a one-shot card in the player, an inline chip on Home, a rich empty state on Moments — deliberately not one generic anchored-spotlight system.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-router 56, expo-sqlite, expo-media-library, react-native-reanimated 4.3, react-native-safe-area-context. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-09-onboarding-design.md](../specs/2026-09-09-onboarding-design.md)

## Global Constraints

- **Expo SDK 56.** Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify against `node_modules/<pkg>/build/types/*.d.ts` when docs are thin (`AGENTS.md`).
- **No new dependencies.** Everything here is buildable from what `package.json` already has.
- **JS-only.** No task in this plan touches `modules/` or `app.config.ts`, so no `expo prebuild` / `run:android` is needed — `npx expo start` and a reload is enough.
- **Commits are plain conventional commits.** No `Co-Authored-By:` trailer, no "Generated with Claude Code" line. This is a hard user preference.
- **Design tokens only.** Colors come from `useTheme().colors` (Material You). Spacing from `spacing` (4/8 scale). Radii from `radius` — the stated shape rule for this feature is: **actions are `radius.pill`, cards `radius.md`, mockup chrome `radius.sm`.** Never a raw hex except the existing `ON_ARTWORK` constants.
- **One accent.** The Material You `colors.primary` is the only accent. No second hue. The app's violet brand seed (`#5E4FA6`) is a Material You *source color*, not a gradient CTA — do not add gradient buttons.
- **No emoji in UI chrome.** Icons are `@expo/vector-icons` Ionicons, matching the rest of the app.
- **One label per intent.** The primary advance action is **"Next"** on every slide that has one; the final action is **"Start watching"**; the permission actions are **"Allow"** and **"Not now"**; the coach-mark dismiss label is **"Got it"**. Do not introduce "Get started", "Continue", or "Begin".
- **Reduced motion.** Every animated mockup checks `useReducedMotion()` from `react-native-reanimated` and renders its settled final frame when true — the pattern already used in `src/components/home-hero.tsx:48`.
- **Text sizing.** Use `AppText` variants (`display`/`headline`/`title`/`body`/`meta`), never raw `<Text>` with inline `fontSize`.
- **Tap targets ≥ 44dp.** `PressableScale` does not currently forward
  `accessibilityLabel` / `accessibilityRole` / `hitSlop`; Task 4 adds them as
  optional pass-throughs (matching `IconButton`'s existing contract) and every
  later task relies on that.
- **Device verification is the user's.** No device is available to the implementer. Every task ends green on `npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"` and `npx tsc --noEmit`; on-device checks are collected in the checklist at the end of this plan for the user to run.

---

### Task 1: Onboarding policy — constants, gate, pager, slide data

Pure logic first, so every later task builds on named, tested functions.

**Files:**
- Create: `src/onboarding/policy.ts`
- Create: `src/onboarding/slides.ts`
- Test: `src/onboarding/__tests__/policy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ONBOARDING_VERSION: number` (= 1)
  - `SETTING_KEYS` — `{ onboardingVersion: 'onboarding_version', playerCoach: 'coach_player_gestures', homeCoach: 'coach_home_longpress', homeVisits: 'home_visit_count' }`
  - `resolveOnboardingGate(stored: string | null, current: number): 'needed' | 'done'`
  - `nextSlideIndex(current: number, total: number): number`
  - `prevSlideIndex(current: number): number`
  - `isLastSlide(current: number, total: number): boolean`
  - `SLIDES: OnboardingSlide[]` and `type OnboardingSlide = { key: SlideKey; headline: string; body: string; action: 'next' | 'video-access' | 'all-files' | 'finish' }`
  - `type SlideKey = 'welcome' | 'grouping' | 'continuity' | 'gestures' | 'moments' | 'done'`

- [ ] **Step 1: Write the failing test**

Create `src/onboarding/__tests__/policy.test.ts`:

```ts
import {
  ONBOARDING_VERSION,
  isLastSlide,
  nextSlideIndex,
  prevSlideIndex,
  resolveOnboardingGate,
} from '../policy';
import { SLIDES } from '../slides';

describe('resolveOnboardingGate', () => {
  it('needs onboarding when nothing is stored', () => {
    expect(resolveOnboardingGate(null, 1)).toBe('needed');
  });

  it('needs onboarding when the stored version is behind', () => {
    expect(resolveOnboardingGate('0', 1)).toBe('needed');
  });

  it('is done when the stored version matches', () => {
    expect(resolveOnboardingGate('1', 1)).toBe('done');
  });

  it('is done when the stored version is ahead (downgraded build)', () => {
    expect(resolveOnboardingGate('9', 1)).toBe('done');
  });

  it('treats unparseable stored values as never onboarded', () => {
    expect(resolveOnboardingGate('yes', 1)).toBe('needed');
    expect(resolveOnboardingGate('', 1)).toBe('needed');
  });
});

describe('pager bounds', () => {
  it('advances within range', () => {
    expect(nextSlideIndex(0, 6)).toBe(1);
    expect(nextSlideIndex(4, 6)).toBe(5);
  });

  it('does not advance past the last slide', () => {
    expect(nextSlideIndex(5, 6)).toBe(5);
  });

  it('goes back within range', () => {
    expect(prevSlideIndex(3)).toBe(2);
  });

  it('is a no-op going back from the first slide', () => {
    expect(prevSlideIndex(0)).toBe(0);
  });

  it('knows the last slide', () => {
    expect(isLastSlide(5, 6)).toBe(true);
    expect(isLastSlide(4, 6)).toBe(false);
  });
});

describe('SLIDES', () => {
  it('is the six slides the spec defines, in order', () => {
    expect(SLIDES.map((s) => s.key)).toEqual([
      'welcome',
      'grouping',
      'continuity',
      'gestures',
      'moments',
      'done',
    ]);
  });

  it('puts the video-access ask first so the scan runs during the tour', () => {
    expect(SLIDES[0].action).toBe('video-access');
  });

  it('asks for all-files access on the moments slide', () => {
    expect(SLIDES[4].action).toBe('all-files');
  });

  it('finishes on the last slide', () => {
    expect(SLIDES[SLIDES.length - 1].action).toBe('finish');
  });

  it('uses one label per intent', () => {
    const bodies = SLIDES.map((s) => s.body);
    expect(bodies.every((b) => b.length > 0)).toBe(true);
    expect(new Set(SLIDES.map((s) => s.key)).size).toBe(SLIDES.length);
  });

  it('ships version 1', () => {
    expect(ONBOARDING_VERSION).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/onboarding --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: FAIL — "Cannot find module '../policy'".

- [ ] **Step 3: Write the implementation**

Create `src/onboarding/policy.ts`:

```ts
/**
 * First-run tour policy. Version-gated rather than keyed on "has the library
 * ever been scanned" so the tour shows once for every install including
 * existing ones, can be re-triggered by bumping the constant when a major
 * feature lands, and can be tested without clearing app data.
 */
export const ONBOARDING_VERSION = 1;

/** Keys in the existing `settings` key/value table. No migration needed. */
export const SETTING_KEYS = {
  onboardingVersion: 'onboarding_version',
  playerCoach: 'coach_player_gestures',
  homeCoach: 'coach_home_longpress',
  homeVisits: 'home_visit_count',
} as const;

/**
 * A stored value we cannot parse means we have no evidence the user ever saw
 * the tour, so we show it. A stored version *ahead* of ours is a downgraded
 * build — showing an older tour to someone who has seen a newer one is noise,
 * so that counts as done.
 */
export function resolveOnboardingGate(
  stored: string | null,
  current: number,
): 'needed' | 'done' {
  if (stored === null) return 'needed';
  const parsed = Number.parseInt(stored, 10);
  if (!Number.isFinite(parsed)) return 'needed';
  return parsed >= current ? 'done' : 'needed';
}

export function nextSlideIndex(current: number, total: number): number {
  return Math.min(current + 1, total - 1);
}

/**
 * Back on the first slide is a no-op, not an app exit — an accidental back
 * press should not close the app the user just installed.
 */
export function prevSlideIndex(current: number): number {
  return Math.max(0, current - 1);
}

export function isLastSlide(current: number, total: number): boolean {
  return current === total - 1;
}
```

Create `src/onboarding/slides.ts`:

```ts
export type SlideKey =
  | 'welcome'
  | 'grouping'
  | 'continuity'
  | 'gestures'
  | 'moments'
  | 'done';

/**
 * `action` is what the slide's primary button does, not what it says. The
 * copy for each action is fixed globally (one label per intent): 'next' →
 * "Next", 'finish' → "Start watching", 'video-access' → "Allow access to your
 * videos", 'all-files' → "Allow" beside a peer "Not now".
 */
export type SlideAction = 'next' | 'video-access' | 'all-files' | 'finish';

export interface OnboardingSlide {
  key: SlideKey;
  headline: string;
  body: string;
  action: SlideAction;
}

/**
 * Order does real work: granting video access on slide 1 means the library
 * scan runs in the background while the user swipes through slides 2–5, so the
 * tour ends on a populated Home instead of a spinner.
 */
export const SLIDES: OnboardingSlide[] = [
  {
    key: 'welcome',
    headline: '53XY',
    body: 'Your videos, organised — and a player that gets out of the way.',
    action: 'video-access',
  },
  {
    key: 'grouping',
    headline: 'Your library, sorted for you',
    body: 'Loose files collapse into series with episode numbers. Prefer the disk? The Folders tab is right there.',
    action: 'next',
  },
  {
    key: 'continuity',
    headline: 'Never lose your place',
    body: 'Every video remembers where you stopped. Pick up from Home, or from your full watch history.',
    action: 'next',
  },
  {
    key: 'gestures',
    headline: 'The player answers to your thumb',
    body: 'Double-tap to skip, swipe for brightness and volume, hold for 2×, pinch to zoom.',
    action: 'next',
  },
  {
    key: 'moments',
    headline: 'Save the scene, not a screenshot',
    body: 'Capture the exact frame with its title, timestamp and the subtitle line on screen. Storage access keeps moments safe even if you reinstall — and lets 53XY read .srt subtitle files, which Android does not treat as media.',
    action: 'all-files',
  },
  {
    key: 'done',
    headline: "You're set",
    body: 'Everything else is waiting in the app. Take a look.',
    action: 'finish',
  },
];
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx jest src/onboarding --testPathIgnorePatterns "/node_modules/|/\.claude/" && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/onboarding/policy.ts src/onboarding/slides.ts src/onboarding/__tests__/policy.test.ts
git commit -m "feat(onboarding): version gate, pager bounds and slide data"
```

---

### Task 2: `MediaAccessProvider` — one owner of permission state

This is the task that reaches into existing code. `LibraryProvider` currently
holds `usePermissions` itself and requests unprompted on mount. Two hook
instances would hold independent state, so onboarding cannot simply add its
own — the hook must be hoisted.

**Files:**
- Create: `src/permissions/video-access.ts`
- Create: `src/permissions/media-access-provider.tsx`
- Modify: `src/library/library-provider.tsx:1,53,98,131`
- Modify: `src/app/_layout.tsx`
- Test: `src/permissions/__tests__/video-access.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `resolveVideoAccess(permission: { granted: boolean; canAskAgain: boolean } | null): VideoAccess`
  - `type VideoAccess = 'unknown' | 'granted' | 'askable' | 'blocked'`
  - `MediaAccessProvider({ children }: { children: ReactNode })`
  - `useMediaAccess(): { videoAccess: VideoAccess; requestVideoAccess: () => Promise<void>; allFilesAccess: boolean; recheckAllFilesAccess: () => void }`
  - `LibraryProvider` gains prop `autoRequest?: boolean` (default `true`).

- [ ] **Step 1: Write the failing test**

Create `src/permissions/__tests__/video-access.test.ts`:

```ts
import { resolveVideoAccess } from '../video-access';

describe('resolveVideoAccess', () => {
  it('is unknown while the permission is still resolving', () => {
    expect(resolveVideoAccess(null)).toBe('unknown');
  });

  it('is granted when granted', () => {
    expect(resolveVideoAccess({ granted: true, canAskAgain: false })).toBe('granted');
  });

  it('is askable when not granted but the dialog can still be shown', () => {
    expect(resolveVideoAccess({ granted: false, canAskAgain: true })).toBe('askable');
  });

  it('is blocked when denied and the dialog would silently no-op', () => {
    expect(resolveVideoAccess({ granted: false, canAskAgain: false })).toBe('blocked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/permissions --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: FAIL — "Cannot find module '../video-access'".

- [ ] **Step 3: Write the pure helper**

Create `src/permissions/video-access.ts`:

```ts
export type VideoAccess = 'unknown' | 'granted' | 'askable' | 'blocked';

/**
 * `blocked` matters because requesting again after the user has permanently
 * denied silently resolves without showing a dialog — the UI has to deep-link
 * to app settings instead of pretending an ask happened.
 */
export function resolveVideoAccess(
  permission: { granted: boolean; canAskAgain: boolean } | null,
): VideoAccess {
  if (!permission) return 'unknown';
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'askable' : 'blocked';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/permissions --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: PASS.

- [ ] **Step 5: Write the provider**

Create `src/permissions/media-access-provider.tsx`:

```tsx
import { usePermissions } from 'expo-media-library';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { invalidateMomentsDir } from '@/moments/storage';
import { canReadFolder } from '@/subtitles/storage-access';
import { resolveVideoAccess, type VideoAccess } from './video-access';

/** The always-present volume root all-files access is probed against. */
const EXTERNAL_STORAGE_ROOT = 'file:///storage/emulated/0';

interface MediaAccess {
  videoAccess: VideoAccess;
  requestVideoAccess: () => Promise<void>;
  allFilesAccess: boolean;
  recheckAllFilesAccess: () => void;
}

const MediaAccessContext = createContext<MediaAccess | null>(null);

/**
 * The single owner of media permission state, mounted above LibraryProvider.
 *
 * LibraryProvider used to hold `usePermissions` itself and fire the request on
 * mount. That had to move: the onboarding tour needs to control *when* the
 * system dialog appears (after the slide that explains why), and two separate
 * `usePermissions` instances hold independent state — granting through one
 * would not reliably wake the other, leaving the library unscanned.
 */
export function MediaAccessProvider({ children }: { children: ReactNode }) {
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [allFilesAccess, setAllFilesAccess] = useState(() => canReadFolder(EXTERNAL_STORAGE_ROOT));

  const requestVideoAccess = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  /**
   * Re-probe after the user comes back from the system settings trip.
   *
   * `invalidateMomentsDir()` is not optional. `ensureMomentsDir()` caches its
   * answer for the life of the process, so a grant made mid-session would read
   * as granted while every captured frame kept landing in the app-document
   * fallback until the next app start — silent, and painful to trace.
   */
  const recheckAllFilesAccess = useCallback(() => {
    invalidateMomentsDir();
    setAllFilesAccess(canReadFolder(EXTERNAL_STORAGE_ROOT));
  }, []);

  const value = useMemo<MediaAccess>(
    () => ({
      videoAccess: resolveVideoAccess(permission),
      requestVideoAccess,
      allFilesAccess,
      recheckAllFilesAccess,
    }),
    [permission, requestVideoAccess, allFilesAccess, recheckAllFilesAccess],
  );

  return <MediaAccessContext.Provider value={value}>{children}</MediaAccessContext.Provider>;
}

export function useMediaAccess(): MediaAccess {
  const ctx = useContext(MediaAccessContext);
  if (!ctx) throw new Error('useMediaAccess must be used within a MediaAccessProvider');
  return ctx;
}
```

- [ ] **Step 6: Rewire `LibraryProvider`**

In `src/library/library-provider.tsx`:

Remove the `usePermissions` import (line 1) and replace it with:

```ts
import { useMediaAccess } from '@/permissions/media-access-provider';
```

Change the signature and the permission line (around line 53):

```tsx
export function LibraryProvider({
  children,
  autoRequest = true,
}: {
  children: ReactNode;
  autoRequest?: boolean;
}) {
  const db = useSQLiteContext();
  const { videoAccess, requestVideoAccess } = useMediaAccess();
```

Replace the permission branch inside the background-scan effect (around line 98):

```ts
      if (videoAccess === 'unknown') return; // permission still resolving
      if (videoAccess !== 'granted') {
        // While the onboarding tour is pending it owns the timing of the
        // system dialog — firing it here would put it behind the carousel,
        // before the slide that explains why we need it.
        if (autoRequest && videoAccess === 'askable') await requestVideoAccess();
        else if (videoAccess === 'blocked') setPermDenied(true);
        return;
      }
```

And update the effect's dependency array (around line 131):

```ts
  }, [videoAccess, requestVideoAccess, autoRequest, db, token]);
```

- [ ] **Step 7: Mount the provider**

In `src/app/_layout.tsx`, add the import:

```ts
import { MediaAccessProvider } from '@/permissions/media-access-provider';
```

and wrap `LibraryProvider`:

```tsx
          <FilterSettingsProvider>
            <MediaAccessProvider>
              <LibraryProvider>
                <ThemeProvider>
```

with the matching closing tags. (`OnboardingProvider` slots in above
`MediaAccessProvider` in Task 3 — leave room for it.)

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/" && npx tsc --noEmit`
Expected: all existing tests still pass (432 + 4 new), tsc clean.

- [ ] **Step 9: Commit**

```bash
git add src/permissions src/library/library-provider.tsx src/app/_layout.tsx
git commit -m "refactor(permissions): hoist media permission state into MediaAccessProvider"
```

---

### Task 3: `OnboardingProvider`, splash gating and the route redirect

**Files:**
- Create: `src/onboarding/onboarding-provider.tsx`
- Create: `src/onboarding/onboarding-gate.tsx`
- Create: `src/app/onboarding.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `ONBOARDING_VERSION`, `SETTING_KEYS`, `resolveOnboardingGate` (Task 1).
- Produces:
  - `OnboardingProvider({ children })`
  - `useOnboarding(): { status: 'resolving' | 'needed' | 'done'; complete: () => Promise<void>; restart: () => Promise<void> }`
  - Route `/onboarding` rendering a placeholder this task, filled in by Task 4.

- [ ] **Step 1: Write the provider**

Create `src/onboarding/onboarding-provider.tsx`:

```tsx
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getSetting, setSetting } from '@/db/settings-repo';
import { ONBOARDING_VERSION, SETTING_KEYS, resolveOnboardingGate } from './policy';

export type OnboardingStatus = 'resolving' | 'needed' | 'done';

interface Onboarding {
  status: OnboardingStatus;
  complete: () => Promise<void>;
  restart: () => Promise<void>;
}

const OnboardingContext = createContext<Onboarding | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<OnboardingStatus>('resolving');

  useEffect(() => {
    let cancelled = false;
    getSetting(db, SETTING_KEYS.onboardingVersion)
      .then((stored) => {
        if (cancelled) return;
        setStatus(resolveOnboardingGate(stored, ONBOARDING_VERSION));
      })
      // A settings read failure must not wedge the app behind a splash screen.
      // Falling through to 'done' shows the library; the tour is replayable
      // from Settings → About.
      .catch(() => {
        if (!cancelled) setStatus('done');
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const complete = useCallback(async () => {
    await setSetting(db, SETTING_KEYS.onboardingVersion, String(ONBOARDING_VERSION));
    setStatus('done');
  }, [db]);

  /** Settings → About "Show the tour again": re-arms the coach marks too, not
   *  just the carousel, so the whole first-run experience replays. */
  const restart = useCallback(async () => {
    await Promise.all([
      setSetting(db, SETTING_KEYS.onboardingVersion, '0'),
      setSetting(db, SETTING_KEYS.playerCoach, '0'),
      setSetting(db, SETTING_KEYS.homeCoach, '0'),
      setSetting(db, SETTING_KEYS.homeVisits, '0'),
    ]);
    setStatus('needed');
  }, [db]);

  const value = useMemo<Onboarding>(() => ({ status, complete, restart }), [status, complete, restart]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): Onboarding {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
```

- [ ] **Step 2: Write the gate**

Create `src/onboarding/onboarding-gate.tsx`:

```tsx
import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useOnboarding } from './onboarding-provider';

/**
 * Redirects into the tour when it is due. Renders nothing.
 *
 * `replace`, never `push`: this is a one-way door in both directions. Back
 * from inside the tour must not reach a library the user has not granted
 * access to, and back from the library must not walk into a half-finished
 * tour.
 */
export function OnboardingGate() {
  const { status } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'needed') return;
    if (pathname === '/onboarding') return;
    router.replace('/onboarding');
  }, [status, pathname, router]);

  return null;
}
```

- [ ] **Step 3: Add the route placeholder**

Create `src/app/onboarding.tsx`:

```tsx
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';

export default function OnboardingScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="display">53XY</AppText>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Wire the root layout — provider, gate, splash timing**

In `src/app/_layout.tsx`:

Add imports:

```ts
import { OnboardingGate } from '@/onboarding/onboarding-gate';
import { OnboardingProvider, useOnboarding } from '@/onboarding/onboarding-provider';
```

The splash currently hides on fonts alone. It must also wait for the gate to
resolve from SQLite, or the user sees a frame of Home before it snaps to the
tour. Because `useOnboarding` needs to be *inside* the provider, extract the
hide into a small child component:

```tsx
function SplashGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { status } = useOnboarding();
  useEffect(() => {
    if (fontsLoaded && status !== 'resolving') SplashScreen.hideAsync();
  }, [fontsLoaded, status]);
  return null;
}
```

Delete the existing `useEffect` that calls `SplashScreen.hideAsync()` on
`fontsLoaded`, and keep the `if (!fontsLoaded) return null;` guard. Then nest:

```tsx
        <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
          <FilterSettingsProvider>
            <OnboardingProvider>
              <MediaAccessProvider>
                <LibraryProvider>
                  <ThemeProvider>
                    <SplashGate fontsLoaded={fontsLoaded} />
                    <OnboardingGate />
                    <ThemedStatusBar />
                    <ThumbnailSweep />
                    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                      <Stack.Screen name="(tabs)" />
```

(keep the remaining `Stack.Screen` entries as they are, and close the new
providers in reverse order).

The `fade` animation on the onboarding screen is deliberate: a
`slide_from_right` into a first-run tour implies the user navigated somewhere
they can come back from, which is exactly what `replace` has ruled out.

- [ ] **Step 5: Gate `LibraryProvider`'s auto-request on the tour**

Still in `_layout.tsx`, `LibraryProvider` must not fire the dialog while the
tour is pending. Add a thin wrapper below `OnboardingProvider`:

```tsx
function GatedLibraryProvider({ children }: { children: ReactNode }) {
  const { status } = useOnboarding();
  return <LibraryProvider autoRequest={status === 'done'}>{children}</LibraryProvider>;
}
```

and use `<GatedLibraryProvider>` in place of `<LibraryProvider>` in the tree
above. Add `type ReactNode` to the existing `react` import.

- [ ] **Step 6: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: tsc clean, all tests pass.

> If `tsc` complains that `/onboarding` is not a known route, that is the
> typed-routes cache (`.expo/types/router.d.ts` is gitignored and regenerated
> by `expo start`). Run `npx expo start` once to regenerate, then re-run `tsc`.
> This is documented in HANDOFF §4.

- [ ] **Step 7: Commit**

```bash
git add src/onboarding src/app/onboarding.tsx src/app/_layout.tsx
git commit -m "feat(onboarding): route gate, provider and splash-held first run"
```

---

### Task 4: The carousel shell

Pager, slide chrome, skip, Android back, completion. Slides render their copy
from `SLIDES`; the animated mockups arrive in Tasks 7–8 and the permission
wiring in Tasks 5–6.

**Files:**
- Create: `src/components/onboarding/slide-frame.tsx`
- Create: `src/components/onboarding/pager-dots.tsx`
- Modify: `src/app/onboarding.tsx`

**Interfaces:**
- Consumes: `SLIDES`, `nextSlideIndex`, `prevSlideIndex`, `isLastSlide` (Task 1); `useOnboarding` (Task 3).
- Produces:
  - `SlideFrame({ headline, body, mockup }: { headline: string; body: string; mockup: ReactNode })` — the shared slide composition. Actions are rendered by the screen, not the frame, so the footer stays pinned while the frame cross-fades.
  - `PagerDots({ count, index })`

- [ ] **Step 1: Forward accessibility props on `PressableScale`**

`src/components/pressable-scale.tsx` does not currently accept
`accessibilityLabel`, `accessibilityRole` or `hitSlop`, and the onboarding
text buttons need all three. Add them as optional pass-throughs, matching the
contract `IconButton` already has:

```tsx
export function PressableScale({
  onPress,
  onLongPress,
  disabled,
  children,
  style,
  morph,
  accessibilityLabel,
  accessibilityRole,
  hitSlop,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  morph?: { from: number; to: number };
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  hitSlop?: number;
}) {
```

and forward them on the `AnimatedPressable`:

```tsx
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      hitSlop={hitSlop}
```

Add `type AccessibilityRole` to the existing `react-native` type import. Do not
change any existing behaviour — every current caller omits all three.

- [ ] **Step 2: Write `PagerDots`**

Create `src/components/onboarding/pager-dots.tsx`:

```tsx
import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export function PagerDots({ count, index }: { count: number; index: number }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${count}`}
      style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 6,
            // The active dot stretches rather than growing a second hue —
            // one accent, and shape carries the state.
            width: i === index ? 20 : 6,
            borderRadius: radius.pill,
            backgroundColor:
              i === index ? colors.primary : colors.surfaceContainerHighest ?? colors.surfaceVariant,
          }}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 3: Write `SlideFrame`**

Create `src/components/onboarding/slide-frame.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

/**
 * The shared composition every slide uses: mockup in the upper band, copy
 * beneath it, actions pinned to the bottom by the caller. Fixing the mockup
 * band's height here is what stops the headline from jumping between slides.
 */
export function SlideFrame({
  headline,
  body,
  mockup,
}: {
  headline: string;
  body: string;
  mockup: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const { height } = useWindowDimensions();
  const bandHeight = Math.round(Math.min(360, Math.max(240, height * 0.4)));

  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      <View style={{ height: bandHeight, alignItems: 'center', justifyContent: 'center' }}>
        {mockup}
      </View>
      <View style={{ gap: spacing.md, paddingTop: spacing.xl }}>
        <AppText variant="display">{headline}</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {body}
        </AppText>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Write the carousel screen**

Replace `src/app/onboarding.tsx` entirely:

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { PagerDots } from '@/components/onboarding/pager-dots';
import { SlideFrame } from '@/components/onboarding/slide-frame';
import { isLastSlide, nextSlideIndex, prevSlideIndex } from '@/onboarding/policy';
import { SLIDES } from '@/onboarding/slides';
import { useOnboarding } from '@/onboarding/onboarding-provider';
import { useTheme } from '@/theme/theme-provider';

export default function OnboardingScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { complete } = useOnboarding();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = isLastSlide(index, SLIDES.length);

  const finish = useCallback(async () => {
    await complete();
    router.replace('/(tabs)');
  }, [complete, router]);

  const advance = useCallback(() => {
    if (last) {
      void finish();
      return;
    }
    setIndex((i) => nextSlideIndex(i, SLIDES.length));
  }, [last, finish]);

  /**
   * One switch over `slide.action`, with an arm for every action from the
   * start. Tasks 5 and 6 replace the 'video-access' and 'all-files' arms in
   * place — appending a separate ternary instead would drop whichever arm was
   * written first.
   */
  const renderFooterAction = () => {
    switch (slide.action) {
      case 'video-access':
        return <PillButton label="Next" onPress={advance} />; // Task 5 replaces this arm
      case 'all-files':
        return <PillButton label="Next" onPress={advance} />; // Task 6 replaces this arm
      case 'finish':
        return <PillButton label="Start watching" onPress={advance} />;
      case 'next':
      default:
        return <PillButton label="Next" onPress={advance} />;
    }
  };

  // Android hardware back walks the pager, and is a no-op on slide 1 — an
  // accidental back press should not close the app the user just installed.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setIndex((i) => prevSlideIndex(i));
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  return (
    <Screen>
      {/* `Screen` already applies the safe-area insets — do not add
          useSafeAreaInsets() padding on top of it or they double up. */}
      <View style={{ flex: 1, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.xl, height: 44, justifyContent: 'center' }}>
          {last ? null : (
            <PressableScale
              onPress={finish}
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
              hitSlop={12}
            >
              <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>
                Skip
              </AppText>
            </PressableScale>
          )}
        </View>

        <Animated.View
          key={slide.key}
          style={{ flex: 1 }}
          entering={reducedMotion ? undefined : FadeIn.duration(220)}
          exiting={reducedMotion ? undefined : FadeOut.duration(140)}
        >
          <SlideFrame headline={slide.headline} body={slide.body} mockup={null} />
        </Animated.View>

        <View
          style={{
            paddingHorizontal: spacing.xl,
            gap: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PagerDots count={SLIDES.length} index={index} />
          {renderFooterAction()}
        </View>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/pressable-scale.tsx src/components/onboarding src/app/onboarding.tsx
git commit -m "feat(onboarding): carousel shell with pager, skip and back handling"
```

---

### Task 5: Slide 1 — video access

**Files:**
- Modify: `src/app/onboarding.tsx`

**Interfaces:**
- Consumes: `useMediaAccess` (Task 2), the carousel shell (Task 4).
- Produces: nothing new; the `'video-access'` slide action becomes functional.

- [ ] **Step 1: Wire the action**

In `src/app/onboarding.tsx`, add the import:

```ts
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { useMediaAccess } from '@/permissions/media-access-provider';
```

and inside the component:

```tsx
  const { videoAccess, requestVideoAccess } = useMediaAccess();

  const askVideoAccess = useCallback(async () => {
    if (videoAccess === 'blocked') {
      // Requesting again after a permanent denial resolves silently without
      // showing a dialog, so send the user where the toggle actually is.
      const pkg = Application.applicationId;
      await IntentLauncher.startActivityAsync(
        'android.settings.APPLICATION_DETAILS_SETTINGS',
        pkg ? { data: `package:${pkg}` } : undefined,
      );
      return;
    }
    if (videoAccess === 'askable') await requestVideoAccess();
    advance();
  }, [videoAccess, requestVideoAccess, advance]);
```

Note `Application.applicationId`, not the config-derived package id — the dev,
preview and production variants install side by side and the JS config is not a
reliable witness to which is running (HANDOFF §4).

- [ ] **Step 2: Replace the `'video-access'` arm of `renderFooterAction`**

Edit that one arm in place — leave the other three exactly as they are:

```tsx
      case 'video-access':
        return (
          <PillButton
            label={videoAccess === 'granted' ? 'Next' : 'Allow access to your videos'}
            onPress={videoAccess === 'granted' ? advance : askVideoAccess}
          />
        );
```

When access is already granted (an existing install), the CTA collapses to the
ordinary advance rather than firing a dialog that would not appear.

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/app/onboarding.tsx
git commit -m "feat(onboarding): request video access from the first slide"
```

---

### Task 6: Slide 5 — all-files access

**Files:**
- Modify: `src/app/onboarding.tsx`

**Interfaces:**
- Consumes: `useMediaAccess` (Task 2), `openAllFilesAccessSettings` (`src/subtitles/storage-access.ts`).
- Produces: nothing new; the `'all-files'` slide action becomes functional.

- [ ] **Step 1: Wire the action**

Add the import:

```ts
import { AppState } from 'react-native';
import { openAllFilesAccessSettings } from '@/subtitles/storage-access';
```

and inside the component:

```tsx
  const { allFilesAccess, recheckAllFilesAccess } = useMediaAccess();

  // MANAGE_EXTERNAL_STORAGE has no runtime dialog — granting it is a trip to
  // a system settings screen. Re-probe when the app comes back to the
  // foreground rather than assuming the trip succeeded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheckAllFilesAccess();
    });
    return () => sub.remove();
  }, [recheckAllFilesAccess]);
```

Add `useEffect` to the existing `react` import.

- [ ] **Step 2: Replace the `'all-files'` arm of `renderFooterAction`**

Edit that one arm in place — leave the other three exactly as they are,
including the `'video-access'` arm Task 5 wrote:

```tsx
      case 'all-files':
        return allFilesAccess ? (
          <PillButton label="Next" onPress={advance} />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <PressableScale
              onPress={advance}
              accessibilityRole="button"
              accessibilityLabel="Skip storage access for now"
              hitSlop={12}
            >
              <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>
                Not now
              </AppText>
            </PressableScale>
            <PillButton label="Allow" onPress={() => void openAllFilesAccessSettings()} />
          </View>
        );
```

`Not now` is a peer of `Allow`, not a de-emphasized escape: this is a
permission Android itself treats as sensitive, and the existing point-of-use
prompts in the player and in Settings → Player remain as the fallback, so
nothing is permanently lost by declining here.

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/app/onboarding.tsx
git commit -m "feat(onboarding): explain and request all-files access on the moments slide"
```

---

### Task 7: Mockups I — grouping and continuity

Animated mockups built from theme tokens. No image assets, no new deps.

**Files:**
- Create: `src/components/onboarding/mockup-grouping.tsx`
- Create: `src/components/onboarding/mockup-continuity.tsx`
- Modify: `src/app/onboarding.tsx`

**Interfaces:**
- Consumes: theme tokens.
- Produces: `MockupGrouping()`, `MockupContinuity()` — both take no props.

**Motion contract for every mockup in Tasks 7–8:**
- Purpose in one word, stated in a comment at the top of the file. If you
  cannot name it, delete the animation.
- Timing motion only, under 300 ms per step, strong ease-out
  (`Easing.bezier(0.23, 1, 0.32, 1)`). Never ease-in on an entrance.
- `transform` and `opacity` only.
- `useReducedMotion()` → render the settled final frame, no animation.
- The loop rests. A mockup that never stops moving competes with the copy the
  user is trying to read: run the sequence once on mount, then hold.

- [ ] **Step 1: Write `MockupGrouping`**

Create `src/components/onboarding/mockup-grouping.tsx`:

```tsx
// Purpose: explanation. Three loose filenames collapse into one series card,
// which is exactly what the grouping engine does and is impossible to convey
// in a still.
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const FILES = ['Show.S01E01.1080p.mkv', 'Show.S01E02.1080p.mkv', 'Show.S01E03.1080p.mkv'];

export function MockupGrouping() {
  const { colors, spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  // 0 = loose files, 1 = collapsed into the series card.
  const collapse = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    collapse.set(withDelay(400, withTiming(1, { duration: 280, easing: EASE })));
  }, [reduced, collapse]);

  const card = useAnimatedStyle(() => ({
    opacity: collapse.get(),
    transform: [{ scale: 0.95 + collapse.get() * 0.05 }],
  }));

  return (
    <View style={{ width: '100%', gap: spacing.sm }}>
      {FILES.map((name, i) => (
        <LooseFileRow key={name} name={name} index={i} collapse={collapse} />
      ))}

      <Animated.View
        style={[
          card,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
            borderRadius: radius.md,
            padding: spacing.lg,
            gap: spacing.xs,
          },
        ]}
      >
        <AppText variant="title">Show</AppText>
        <AppText variant="meta" color={colors.primary}>
          3 episodes · S01E01–E03
        </AppText>
      </Animated.View>
    </View>
  );
}

/**
 * A child component rather than an inline `useAnimatedStyle` inside the map —
 * hooks must not be called in a loop, even one over a fixed-length constant.
 */
function LooseFileRow({
  name,
  index,
  collapse,
}: {
  name: string;
  index: number;
  collapse: SharedValue<number>;
}) {
  const { colors, spacing, radius } = useTheme();
  // Each row slides down and fades as the card takes over; the last row
  // travels least, so the stack visibly converges rather than sliding as a
  // block.
  const row = useAnimatedStyle(() => ({
    opacity: 1 - collapse.get(),
    transform: [{ translateY: collapse.get() * (16 - index * 6) }],
  }));
  return (
    <Animated.View
      style={[
        row,
        {
          backgroundColor: colors.surfaceContainerLow ?? colors.surfaceVariant,
          borderRadius: radius.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
        {name}
      </AppText>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Write `MockupContinuity`**

Create `src/components/onboarding/mockup-continuity.tsx`:

```tsx
// Purpose: state change. The progress line filling is the whole feature —
// a static bar at 60% says "a bar exists", a bar that fills says "it
// remembers".
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const TARGET = 0.62;

export function MockupContinuity() {
  const { colors, spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? TARGET : 0);

  useEffect(() => {
    if (reduced) return;
    progress.set(withDelay(300, withTiming(TARGET, { duration: 280, easing: EASE })));
  }, [reduced, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View
      style={{
        width: '100%',
        backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          height: 96,
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          borderRadius: radius.sm,
        }}
      />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="meta" color={colors.primary}>
          CONTINUE WATCHING
        </AppText>
        <AppText variant="title">Show · S01E02</AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          18 minutes left
        </AppText>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[fill, { height: 4, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Mount them in the carousel**

In `src/app/onboarding.tsx`, add a mockup lookup and pass it to `SlideFrame`:

```tsx
import { MockupContinuity } from '@/components/onboarding/mockup-continuity';
import { MockupGrouping } from '@/components/onboarding/mockup-grouping';

const MOCKUPS: Partial<Record<SlideKey, () => ReactNode>> = {
  grouping: MockupGrouping,
  continuity: MockupContinuity,
};
```

and in the render:

```tsx
          <SlideFrame
            headline={slide.headline}
            body={slide.body}
            mockup={(() => {
              const Mockup = MOCKUPS[slide.key];
              return Mockup ? <Mockup /> : null;
            })()}
          />
```

Add `type SlideKey` to the `@/onboarding/slides` import and `type ReactNode` to
the `react` import.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/components/onboarding src/app/onboarding.tsx
git commit -m "feat(onboarding): animated grouping and continuity mockups"
```

---

### Task 8: Mockups II — gestures and moments

**Files:**
- Create: `src/components/onboarding/mockup-gestures.tsx`
- Create: `src/components/onboarding/mockup-moments.tsx`
- Modify: `src/app/onboarding.tsx`

**Interfaces:**
- Consumes: theme tokens; the `MOCKUPS` map from Task 7.
- Produces: `MockupGestures()`, `MockupMoments()`.

The motion contract from Task 7 applies unchanged.

- [ ] **Step 1: Write `MockupGestures`**

Create `src/components/onboarding/mockup-gestures.tsx`:

```tsx
// Purpose: explanation. A 2×2 of the four gestures with their zones drawn on
// a stand-in video frame — the point is *where* on the screen each one lives,
// which a list of words cannot carry.
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

const GESTURES: { icon: IoniconName; label: string }[] = [
  { icon: 'play-forward-outline', label: 'Double-tap to skip' },
  { icon: 'sunny-outline', label: 'Swipe left edge for brightness' },
  { icon: 'volume-high-outline', label: 'Swipe right edge for volume' },
  { icon: 'speedometer-outline', label: 'Hold anywhere for 2×' },
];

export function MockupGestures() {
  const { spacing, radius, icon } = useTheme();
  return (
    <View
      style={{
        width: '100%',
        // Artwork colours are fixed white-on-scrim, not themed — a stand-in
        // video frame is arbitrary imagery, the same reason player chrome is
        // fixed (HANDOFF §4).
        backgroundColor: '#101014',
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      {GESTURES.map((g) => (
        <View key={g.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: ON_ARTWORK.tonal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={g.icon} size={icon.md} color={ON_ARTWORK.primary} />
          </View>
          <AppText variant="body" color={ON_ARTWORK.primary} style={{ flex: 1 }}>
            {g.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Write `MockupMoments`**

Create `src/components/onboarding/mockup-moments.tsx`:

```tsx
// Purpose: spatial continuity. The frame lifting out of the video and landing
// as a card with its note attached is the mental model of the whole feature —
// a moment is a thing that leaves the video and survives on its own.
import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

export function MockupMoments() {
  const { colors, spacing, radius, icon } = useTheme();
  const reduced = useReducedMotion();
  // 0 = frame sitting in the video, 1 = lifted out as a saved card.
  const lift = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    lift.set(withDelay(400, withTiming(1, { duration: 300, easing: EASE })));
  }, [reduced, lift]);

  const card = useAnimatedStyle(() => ({
    opacity: lift.get(),
    transform: [{ translateY: (1 - lift.get()) * 24 }, { scale: 0.95 + lift.get() * 0.05 }],
  }));

  return (
    <View style={{ width: '100%', gap: spacing.md }}>
      <View
        style={{
          height: 132,
          backgroundColor: '#101014',
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="bookmark" size={icon.lg} color={ON_ARTWORK.primary} />
      </View>

      <Animated.View
        style={[
          card,
          {
            backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
            borderRadius: radius.md,
            padding: spacing.lg,
            gap: spacing.xs,
          },
        ]}
      >
        <AppText variant="meta" color={colors.primary}>
          S01E02 · 24:11
        </AppText>
        <AppText variant="body">“You were never supposed to find that.”</AppText>
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 3: Register both in the mockup map**

In `src/app/onboarding.tsx`, extend `MOCKUPS`:

```tsx
const MOCKUPS: Partial<Record<SlideKey, () => ReactNode>> = {
  grouping: MockupGrouping,
  continuity: MockupContinuity,
  gestures: MockupGestures,
  moments: MockupMoments,
};
```

with the matching imports.

- [ ] **Step 4: Slop pre-flight**

Mechanically count across `src/components/onboarding/` and `src/app/onboarding.tsx`:

- distinct accent hues → must be exactly 1 (`colors.primary`)
- corner radii → every one from the `radius` scale, matching the stated rule (actions pill, cards `md`, mockup chrome `sm`)
- emoji in UI chrome → 0
- gradients → 0
- duplicate labels for one intent → 0 ("Next", "Start watching", "Allow", "Not now", "Skip" and nothing else)

A failed count is a fix, not a judgment call.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/components/onboarding src/app/onboarding.tsx
git commit -m "feat(onboarding): gesture and moments mockups"
```

---

### Task 9: Coach marks — policy and the player gesture card

**Files:**
- Create: `src/onboarding/coach.ts`
- Create: `src/onboarding/use-coach-flag.ts`
- Create: `src/components/player/gesture-coach-card.tsx`
- Modify: `src/app/player.tsx`
- Test: `src/onboarding/__tests__/coach.test.ts`

**Interfaces:**
- Consumes: `SETTING_KEYS` (Task 1), `useOnboarding` (Task 3).
- Produces:
  - `shouldShowPlayerCard(dismissed: boolean, onboardingDone: boolean): boolean`
  - `shouldShowHomeHint(dismissed: boolean, visitCount: number): boolean`
  - `useCoachFlag(key: string): { ready: boolean; dismissed: boolean; dismiss: () => void }`
  - `GestureCoachCard({ onDismiss }: { onDismiss: () => void })`

- [ ] **Step 1: Write the failing test**

Create `src/onboarding/__tests__/coach.test.ts`:

```ts
import { shouldShowHomeHint, shouldShowPlayerCard } from '../coach';

describe('shouldShowPlayerCard', () => {
  it('shows once onboarding is done and the card has not been dismissed', () => {
    expect(shouldShowPlayerCard(false, true)).toBe(true);
  });

  it('does not show while onboarding is still pending', () => {
    expect(shouldShowPlayerCard(false, false)).toBe(false);
  });

  it('does not show once dismissed', () => {
    expect(shouldShowPlayerCard(true, true)).toBe(false);
  });
});

describe('shouldShowHomeHint', () => {
  it('waits for the second visit', () => {
    expect(shouldShowHomeHint(false, 1)).toBe(false);
    expect(shouldShowHomeHint(false, 2)).toBe(true);
  });

  it('keeps showing on later visits until dismissed', () => {
    expect(shouldShowHomeHint(false, 7)).toBe(true);
  });

  it('does not show once dismissed', () => {
    expect(shouldShowHomeHint(true, 9)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/onboarding --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: FAIL — "Cannot find module '../coach'".

- [ ] **Step 3: Write the policy**

Create `src/onboarding/coach.ts`:

```ts
export function shouldShowPlayerCard(dismissed: boolean, onboardingDone: boolean): boolean {
  return onboardingDone && !dismissed;
}

/**
 * The hint waits for the second Home visit. On the first the library is often
 * still scanning and the user is busy reading their own file names — a tip
 * competing with that is a tip nobody reads.
 */
export function shouldShowHomeHint(dismissed: boolean, visitCount: number): boolean {
  return !dismissed && visitCount >= 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/onboarding --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: PASS.

- [ ] **Step 5: Write the flag hook**

Create `src/onboarding/use-coach-flag.ts`:

```ts
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getSetting, setSetting } from '@/db/settings-repo';

/**
 * A one-shot coach-mark flag backed by the settings table. `ready` gates
 * rendering: the card must not flash for one frame before the stored value
 * arrives from SQLite.
 */
export function useCoachFlag(key: string) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSetting(db, key)
      .then((v) => {
        if (cancelled) return;
        setDismissed(v === '1');
        setReady(true);
      })
      // Failing closed means a missed tip, not a stuck overlay.
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, key]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void setSetting(db, key, '1');
  }, [db, key]);

  return { ready, dismissed, dismiss };
}
```

- [ ] **Step 6: Write the card**

Create `src/components/player/gesture-coach-card.tsx`:

```tsx
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { MockupGestures } from '@/components/onboarding/mockup-gestures';
import { PillButton } from '@/components/pill-button';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

/**
 * A full-screen one-shot card, deliberately NOT an anchored spotlight with a
 * measured cutout.
 *
 * The player's touch handling is an RNGH gesture arena
 * (player-gesture-relations.ts, player-pressable-scale.tsx,
 * blocksExternalGesture) that has already produced two separate wedge bugs.
 * Laying a measuring, ref-registering overlay on top of that arena is a
 * regression risk out of proportion to the benefit. This card sits above
 * everything, owns all touches while visible, and unmounts cleanly.
 */
export function GestureCoachCard({ onDismiss }: { onDismiss: () => void }) {
  const { spacing } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      exiting={reduced ? undefined : FadeOut.duration(140)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.xl,
        zIndex: 100,
      }}
    >
      <AppText variant="headline" color={ON_ARTWORK.primary}>
        The player answers to your thumb
      </AppText>
      <View style={{ width: '100%' }}>
        <MockupGestures />
      </View>
      <PillButton label="Got it" onPress={onDismiss} />
    </Animated.View>
  );
}
```

- [ ] **Step 7: Mount it in the player**

In `src/app/player.tsx`, add imports:

```ts
import { GestureCoachCard } from '@/components/player/gesture-coach-card';
import { shouldShowPlayerCard } from '@/onboarding/coach';
import { SETTING_KEYS } from '@/onboarding/policy';
import { useCoachFlag } from '@/onboarding/use-coach-flag';
import { useOnboarding } from '@/onboarding/onboarding-provider';
```

In the component body:

```tsx
  const { status: onboardingStatus } = useOnboarding();
  const playerCoach = useCoachFlag(SETTING_KEYS.playerCoach);
  const showCoach =
    playerCoach.ready &&
    shouldShowPlayerCard(playerCoach.dismissed, onboardingStatus === 'done');
```

Render it as the **last child** of the screen's outermost view — after the
gesture layer, the controls overlay, and the autoplay card — so it is on top of
everything and no sibling can steal its touches:

```tsx
      {showCoach ? <GestureCoachCard onDismiss={playerCoach.dismiss} /> : null}
```

- [ ] **Step 8: Typecheck, test, commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/onboarding src/components/player/gesture-coach-card.tsx src/app/player.tsx
git commit -m "feat(onboarding): one-shot gesture coach card in the player"
```

---

### Task 10: Coach marks — the Home hint chip

**Files:**
- Create: `src/components/onboarding/hint-chip.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `shouldShowHomeHint`, `useCoachFlag`, `SETTING_KEYS`.
- Produces: `HintChip({ icon, text, onDismiss })`.

- [ ] **Step 1: Write the chip**

Create `src/components/onboarding/hint-chip.tsx`:

```tsx
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

export function HintChip({
  icon,
  text,
  onDismiss,
}: {
  icon: IoniconName;
  text: string;
  onDismiss: () => void;
}) {
  const { colors, spacing, radius, icon: iconSize } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      exiting={reduced ? undefined : FadeOut.duration(140)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.secondaryContainer ?? colors.surfaceContainer ?? colors.surfaceVariant,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <Ionicons
        name={icon}
        size={iconSize.md}
        color={colors.onSecondaryContainer ?? colors.onSurface}
      />
      <AppText variant="body" color={colors.onSecondaryContainer ?? colors.onSurface} style={{ flex: 1 }}>
        {text}
      </AppText>
      <PressableScale
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        hitSlop={12}
      >
        <Ionicons
          name="close"
          size={iconSize.md}
          color={colors.onSecondaryContainer ?? colors.onSurface}
        />
      </PressableScale>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Count the visit and render the hint**

In `src/app/(tabs)/index.tsx`, add imports:

```ts
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/settings-repo';
import { HintChip } from '@/components/onboarding/hint-chip';
import { shouldShowHomeHint } from '@/onboarding/coach';
import { SETTING_KEYS } from '@/onboarding/policy';
import { useCoachFlag } from '@/onboarding/use-coach-flag';
```

In the component body, count visits once per focus:

```tsx
  const db = useSQLiteContext();
  const homeCoach = useCoachFlag(SETTING_KEYS.homeCoach);
  const [visits, setVisits] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSetting(db, SETTING_KEYS.homeVisits).then((raw) => {
        if (cancelled) return;
        const next = (Number.parseInt(raw ?? '0', 10) || 0) + 1;
        setVisits(next);
        void setSetting(db, SETTING_KEYS.homeVisits, String(next));
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const showHint = homeCoach.ready && shouldShowHomeHint(homeCoach.dismissed, visits);
```

Render it at the top of the existing `listHeader` (the value passed to
`ListHeaderComponent`, `index.tsx:386`) so it scrolls with the content and
needs no measurement — nothing to break when FlashList recycles rows:

```tsx
      {showHint ? (
        <HintChip
          icon="hand-left-outline"
          text="Long-press any video to select, share, or move it to another group."
          onDismiss={homeCoach.dismiss}
        />
      ) : null}
```

`useState`, `useCallback` and `useFocusEffect` are already imported in this
file; add only what is missing.

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/components/onboarding/hint-chip.tsx "src/app/(tabs)/index.tsx"
git commit -m "feat(onboarding): delayed long-press hint on Home"
```

---

### Task 11: The Moments empty state

The best-value teaching surface in the design: it needs no flag, never fires at
a bad time, and cannot go stale, because it is only ever visible to someone who
has no moments. The current empty state is a bare icon and "No moments yet"
(`src/app/(tabs)/moments.tsx:188`), built from raw `<Text>` with inline font
sizes.

**Files:**
- Create: `src/components/onboarding/moments-empty-state.tsx`
- Modify: `src/app/(tabs)/moments.tsx:188-210`

**Interfaces:**
- Consumes: theme tokens.
- Produces: `MomentsEmptyState({ restoreSlot }: { restoreSlot?: ReactNode })`.

- [ ] **Step 1: Write the component**

Create `src/components/onboarding/moments-empty-state.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

const STEPS: { icon: IoniconName; text: string }[] = [
  { icon: 'play-circle-outline', text: 'Play anything and pause on a scene worth keeping.' },
  { icon: 'bookmark-outline', text: 'Tap the bookmark in the player’s top bar.' },
  { icon: 'create-outline', text: 'The note fills itself from the subtitle on screen — edit it or leave it.' },
];

/**
 * A composed empty state, not a shrug. Someone looking at this screen has
 * never made a moment, so the screen's job is to say exactly how — the tab is
 * the only place in the app where that instruction is guaranteed to be
 * relevant.
 */
export function MomentsEmptyState({ restoreSlot }: { restoreSlot?: ReactNode }) {
  const { colors, spacing, radius, icon } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.pill,
            backgroundColor: colors.secondaryContainer ?? colors.surfaceContainer ?? colors.surfaceVariant,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="bookmark"
            size={icon.lg}
            color={colors.onSecondaryContainer ?? colors.onSurface}
          />
        </View>
        <AppText variant="headline">No moments yet</AppText>
        <AppText
          variant="body"
          color={colors.onSurfaceVariant ?? colors.onSurface}
          style={{ textAlign: 'center' }}
        >
          A moment saves the exact frame with its title, timestamp and the line
          being spoken — and outlives the video file.
        </AppText>
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        {STEPS.map((step) => (
          <View key={step.text} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Ionicons name={step.icon} size={icon.md} color={colors.primary} />
            <AppText variant="body" style={{ flex: 1 }}>
              {step.text}
            </AppText>
          </View>
        ))}
      </View>

      {restoreSlot}
    </View>
  );
}
```

- [ ] **Step 2: Swap it in**

In `src/app/(tabs)/moments.tsx`, replace the `ListEmptyComponent` value with:

```tsx
        ListEmptyComponent={
          <MomentsEmptyState
            restoreSlot={
              restorable > 0 ? (
                /* the existing restore block, unchanged — the count text and
                   its PressableScale, moved in here verbatim */
              ) : null
            }
          />
        }
```

Move the existing restore UI (the `restorable > 0` branch and its
`PressableScale` calling `restoreMomentsFromManifest`) into `restoreSlot`
**without changing its behaviour** — it is device-verified restore logic and
this task is presentation only. Add the import and drop any now-unused
`Ionicons`/`Text` imports the old block leaves behind.

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit && npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git add src/components/onboarding/moments-empty-state.tsx "src/app/(tabs)/moments.tsx"
git commit -m "feat(onboarding): teach capture from the Moments empty state"
```

---

### Task 12: Replay from Settings → About

**Files:**
- Modify: `src/app/settings/about.tsx`

**Interfaces:**
- Consumes: `useOnboarding().restart` (Task 3).
- Produces: nothing.

- [ ] **Step 1: Add the row**

In `src/app/settings/about.tsx`, add imports:

```ts
import { ListItem } from '@/components/list-item';
import { useOnboarding } from '@/onboarding/onboarding-provider';
```

and inside the component:

```tsx
  const { restart } = useOnboarding();

  const replay = async () => {
    await restart();
    router.replace('/onboarding');
  };
```

Render it below the existing description block:

```tsx
      <View style={{ paddingTop: spacing.xl }}>
        <ListItem
          icon="sparkles-outline"
          title="Show the tour again"
          subtitle="Replay the intro and the in-app tips"
          onPress={replay}
        />
      </View>
```

`restart()` clears the coach-mark flags as well as the tour version, so the
player card, the Home hint and the tour all re-arm together — replaying only
the carousel would be a half-reset.

- [ ] **Step 2: Full verification**

```bash
npx tsc --noEmit
npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"
git status --short
```

Expected: tsc clean, all tests pass, no uncommitted stragglers.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/about.tsx
git commit -m "feat(onboarding): replay the tour from Settings → About"
```

---

## Device-verification checklist (for the user)

JS-only — `npx expo start` and a reload is enough, no rebuild. No device is
available to the implementing agent, so every item below is unverified until
you run it. Per the appllama design skill, the motion items want a **screen
recording watched twice** — once at speed for feel, once scrubbed frame by
frame — not a glance.

**First run**
- [ ] Settings → About → "Show the tour again", then confirm the tour appears
      with no flash of Home first (the splash should hold until it is ready).
- [ ] Slide 1 "Allow access to your videos" shows the system dialog; granting
      it advances, and by slide 6 the library behind is already populated.
- [ ] Deny video access instead: the tour continues, and the end lands on the
      existing "denied" library state rather than an empty list.
- [ ] Android hardware back walks slides backwards; on slide 1 it does nothing
      and does **not** exit the app.
- [ ] "Skip" from any slide lands on Home, and back from Home exits the app —
      it must never re-enter the tour.
- [ ] Finish the tour normally; back from Home exits the app.

**All-files access**
- [ ] Slide 5 "Allow" opens the system All-files-access screen for the build
      you are actually running — check the app name in the system UI matches
      the variant ("53XY (Dev)" vs "53XY"), since they install side by side.
- [ ] Grant it, return to the app: the slide updates to show access is held.
- [ ] **Then capture a moment without restarting the app**, and confirm the
      frame lands in `/storage/emulated/0/53XY/Moments`, not the app-document
      fallback. This is the `invalidateMomentsDir()` path — the whole reason
      that call exists.
- [ ] Choose "Not now" instead: the tour continues, and the existing
      point-of-use prompt still appears at first capture.

**Motion and appearance**
- [ ] Record the whole tour and watch it twice. Every slide transition and
      every mockup animation: no dropped frames, no wrong-theme frame, no
      layout jump when the headline changes length.
- [ ] Light theme and dark theme, both.
- [ ] Enable Reduce Motion in Android accessibility settings and re-run: every
      mockup shows its settled final state, nothing animates, nothing is blank.
- [ ] Rotate to landscape mid-tour, if the device allows it.

**Coach marks**
- [ ] Open the player for the first time after the tour: the gesture card
      appears above everything, "Got it" dismisses it, and it does not come
      back on the next open.
- [ ] **After dismissing, exercise the full player gesture set** — double-tap
      left/centre/right, brightness and volume swipes, long-press 2×, pinch
      zoom, pause, subtitle select, lock. This is the RNGH arena the card sits
      above; a wedge here is the regression this design was shaped to avoid.
- [ ] Home: the hint chip does not appear on the first visit, appears on the
      second, and stays dismissed after you close it.
- [ ] Moments tab with no moments: the new empty state renders. With a backup
      folder present, the restore prompt still appears inside it and still
      restores.
