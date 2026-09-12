# Onboarding — teaching 53XY's invisible half

**Status:** designed, not yet implemented.
**Date:** 2026-09-09

## 1. The problem

53XY has accumulated a large surface of capability that a new user has no way
to find. The features split cleanly into three tiers by discoverability:

| Tier | Capability |
|---|---|
| **Invisible without being told** | Moments (frame capture + subtitle-seeded note), long-press multi-select (share / delete / move-to-group / mark played), manual group overrides, filters (hide clips under N minutes, ignore patterns and folders) |
| **Discoverable but easy to miss** | Player gestures (3-zone double-tap, swipe brightness/volume, long-press→2×, pinch-zoom + aspect modes), sleep timer, scrub previews, external subtitles + delay bar |
| **Self-evident once seen** | Auto-grouping into series, Folders view, continue-watching hero, watch history, playlists, autoplay-next, background play / PiP |

Moments is the worst case: it is the app's most distinctive feature, it is
reachable only from a single icon in the player's top bar, and it depends on a
permission the app currently asks for in the middle of the user's first capture
attempt — the least persuasive possible moment.

There is a second, quieter problem. **All-files access is currently requested at
point of use**, which means it is requested while the user is trying to do
something else. Both Moments (writing frames to shared storage) and external
subtitles (reading `.srt` files, which Android does not classify as media) need
it, and both currently interrupt a task to ask for it.

## 2. What this is

A first-run flow with two parts:

1. **A six-slide carousel** covering the app's story and both permissions.
2. **Three in-context teaching surfaces** that fire after the carousel, where
   the features actually live.

Plus an escape hatch: a Skip control throughout, and a **Settings → About →
"Show the tour again"** row that resets both the carousel and the coach marks.

Non-goals: no video assets, no new dependencies, no second visual language. The
onboarding is built from the app's existing M3 Expressive tokens, `AppText`
ramp, Space Grotesk display face, and Reanimated — it inherits the user's
Material You palette like everything else.

## 3. Navigation semantics

Onboarding is a **real route** (`/onboarding`), not an overlay above the tabs.
An overlay would leave the tab stack alive underneath it, fight the Android back
button, and muddy status-bar ownership.

The route is entered with `router.replace()`, never `push()`. This is a
**one-way door in both directions**:

- Back from inside the tour must not return to a library the user has not yet
  granted access to.
- Back from the library must not walk into a half-finished tour.

Finishing (or skipping) `replace()`s to `/(tabs)`. The Android hardware back
button inside onboarding moves to the previous slide, and on slide 1 it is a
no-op rather than an app exit — an accidental back press on the first slide
should not close the app the user just installed.

## 4. Architecture

### 4.1 Provider order

```
SQLiteProvider
  FilterSettingsProvider
    OnboardingProvider      ← new: reads/writes onboarding + coach state
      MediaAccessProvider   ← new: single owner of permission state
        LibraryProvider
          ThemeProvider
            <OnboardingGate />   ← performs the redirect
            <Stack>
```

### 4.2 `MediaAccessProvider` — one owner of permission state

**This is the part that reaches into existing code.** `LibraryProvider` today
calls `usePermissions({ granularPermissions: ['video'] })` itself and requests
the permission unprompted on mount (`library-provider.tsx:53`, `:98`). Two
problems for onboarding:

1. If the provider asks first, the system dialog fires *behind* the carousel,
   before the slide that explains why.
2. If onboarding instead owns its own `usePermissions` instance, the two hook
   instances hold independent state — granting through onboarding's copy would
   not reliably wake `LibraryProvider`'s copy, and the scan would not start.

So the hook is **hoisted** into a new `MediaAccessProvider`, which becomes the
single source of truth for:

- `videoAccess: 'unknown' | 'granted' | 'askable' | 'blocked'` — derived from the
  `usePermissions` result by a pure `resolveVideoAccess()`.
- `requestVideoAccess()` — the one call site for the system dialog.
- `allFilesAccess: boolean` — probed via the existing
  `canReadFolder()` (`src/subtitles/storage-access.ts`), which tests the real
  capability by listing a directory rather than proxying it.
- `recheckAllFilesAccess()` — re-probes after the user returns from the system
  settings trip, and calls the existing `invalidateMomentsDir()`
  (`src/moments/storage.ts:173`) so the per-run cached moments directory is
  re-resolved against the newly granted permission. **Without this the first
  capture after granting still writes to the app-document fallback**, because
  `ensureMomentsDir()` caches its answer for the life of the process.

`LibraryProvider` then consumes `MediaAccessProvider` instead of holding the
hook, and gains an `autoRequest` gate: while onboarding is pending it will not
fire the dialog itself, but everything else about it — cache-first read,
background scan, reconcile — is untouched.

### 4.3 State and persistence

No migration. The `settings` table is already a key/value store with
`getSetting` / `setSetting` (`src/db/settings-repo.ts`).

| Key | Value | Meaning |
|---|---|---|
| `onboarding_version` | `"1"` | Highest tour version completed or skipped |
| `coach_player_gestures` | `"1"` | Player gesture card dismissed |
| `coach_home_longpress` | `"1"` | Home long-press hint dismissed |
| `home_visit_count` | integer string | Drives the delayed Home hint |

`ONBOARDING_VERSION = 1` is a module constant. The gate is a pure function:

```ts
resolveOnboardingGate(stored: string | null, current: number): 'needed' | 'done'
```

Version-gating rather than "has the library ever been scanned" means the tour
shows once for **every** install including existing ones, can be re-triggered by
bumping the constant when a major feature lands, and — practically — can be
tested without clearing app data.

### 4.4 Splash timing

`_layout.tsx` currently hides the splash as soon as fonts load. It must now wait
on fonts **and** the onboarding gate resolving from SQLite. Otherwise the user
sees a frame of Home before it snaps to the tour — the exact stutter that makes
a first run feel broken.

## 5. The carousel

Six slides. The ordering does real work: **granting video access on slide 1
means the library scan runs in the background while the user swipes through
slides 2–5**, so the tour ends on a populated Home instead of a spinner. This is
the main reason permissions come first rather than last.

Each slide is a full-screen composition: an animated mockup in the upper two
thirds, a display-face headline, one line of body copy, and the pager plus
primary action pinned to the bottom safe area. Skip sits quietly top-right.

| # | Slide | Mockup | Action |
|---|---|---|---|
| 1 | **Welcome** — what 53XY is | Wordmark, `53` in `onSurface` + `XY` in the Material You accent, as on Home | `Allow access to your videos` → system dialog |
| 2 | **Smart grouping** | Loose filenames snapping into one series card with episode numbers; the Folders tab shown as the escape hatch | Next |
| 3 | **Continuity** | The continue-watching hero filling its progress bar, history stacked behind it | Next |
| 4 | **Player gestures** | Four-up: double-tap seek, swipe brightness/volume, long-press 2×, pinch zoom | Next |
| 5 | **Moments** | A frame lifting out of the video with a subtitle-seeded note attached | `Allow` / `Not now` → `openAllFilesAccessSettings()` |
| 6 | **Done** | Settled composition, no motion | `Start watching` → `replace('/(tabs)')` |

### 5.1 Slide 1 — video access

If the permission is already granted (an existing install), the CTA renders as a
satisfied state and advances without a dialog. If it is `blocked`
(`canAskAgain === false`), the CTA deep-links to app settings instead, since
requesting again would silently no-op.

Declining does not block the tour. The user continues to slide 2 and lands on
the existing `LibraryProvider` `'denied'` state at the end, which already
handles this case.

### 5.2 Slide 5 — all-files access

This is a **system settings round trip**, not a dialog — `MANAGE_EXTERNAL_STORAGE`
has no runtime prompt. The slide therefore has to earn the trip before taking
it: it names both things the permission buys (Moments frames that survive
uninstall; `.srt` subtitle files, which Android does not treat as media) before
offering `Allow`.

`Not now` is a peer of `Allow`, not a de-emphasized escape. This permission is
one Android itself treats as sensitive, and the existing point-of-use prompts in
the player and in Settings → Player remain as the fallback for anyone who
declines — nothing is lost permanently by saying no here.

On return from the settings trip, `recheckAllFilesAccess()` re-probes and
invalidates the moments-directory cache (§4.2). The slide reflects the real
result rather than assuming the trip succeeded.

## 6. Coach marks — tiered by risk

Three surfaces, three different mechanisms. They are deliberately *not* one
generic anchored-spotlight system.

### 6.1 Player — one-shot gesture card

On the first player open after onboarding, a full-screen dismissible card
presents the four gestures, reusing slide 4's mockups. It is **not** an anchored
spotlight with a measured cutout.

The reason is specific to this codebase. The player's touch handling is an RNGH
gesture arena (`player-gesture-relations.ts`, `player-pressable-scale.tsx`,
`blocksExternalGesture`) that has already produced two separate wedge bugs —
the chrome-button overlap fix, then the root-cause fix where RNGH's `Pressable`
corrupted the arena after a single press. Laying a measuring, ref-registering
overlay on top of that arena is a regression risk out of all proportion to the
benefit. A card that sits above everything, owns all touches while visible, and
unmounts cleanly on dismiss has none of that exposure.

Dismissal writes `coach_player_gestures`. The card appears once.

### 6.2 Home — delayed hint chip

An inline dismissible chip under the header teaches long-press multi-select. It
appears on the **second** Home visit, not the first: on the first visit the
library is often still scanning and the user is busy reading their own file
names. Driven by `home_visit_count` and a pure `shouldShowHomeHint()`.

Inline in the list header — no measurement, so nothing to break when FlashList
recycles rows.

### 6.3 Moments tab — rich empty state

Not a one-shot at all. The Moments tab, when empty, becomes a real teaching
surface: what a moment is, and the exact gesture that makes one. This is the
best-value surface in the whole design — it needs no flag, never fires at a bad
time, and cannot go stale, because it is only ever visible to someone who has no
moments.

## 7. Replay

**Settings → About** gains a "Show the tour again" row. It clears
`onboarding_version`, `coach_player_gestures`, `coach_home_longpress` and
`home_visit_count`, then `replace()`s to `/onboarding` — so the coach marks
re-arm too, not just the carousel.

## 8. Testable surface

Everything that can be pure, is. Following the project's existing convention,
Jest covers logic and the UI is verified on device.

- `resolveOnboardingGate(stored, current)` — version comparison, null, garbage input
- `resolveVideoAccess(permission)` — the four-state mapping including `canAskAgain === false`
- `shouldShowHomeHint(dismissed, visitCount)`
- `shouldShowPlayerCard(dismissed, onboardingDone)`
- `nextSlideIndex` / `prevSlideIndex` / `isLastSlide` — pager bounds, including
  the back-on-slide-1 no-op
- Slide definitions as data, so the set can be asserted rather than read off a render tree

## 9. Risks and decisions

- **Slide 1 permission timing.** If the system dialog were to fire before the
  carousel mounts, the whole "explain, then ask" premise collapses. This is why
  `LibraryProvider`'s unprompted request is gated rather than left alone — it is
  the one existing behaviour the design must actively suppress.
- **The moments-dir cache.** Granting all-files access mid-onboarding without
  calling `invalidateMomentsDir()` produces a silent, hard-to-trace bug: the
  permission reads as granted, but frames keep landing in the app-document
  fallback for the rest of the process lifetime.
- **Appllama and Material You.** The `appllama-app-design-skill` enforces Apple
  HIG fidelity. 53XY is Android-first with its own M3 Expressive token set. The
  skill's *structural* judgment is adopted — navigation semantics, one-way
  doors, purposeful motion, perceived performance — while the existing Material
  You system stays the visual authority. No iOS chrome on an Android player.
- **Six slides is at the ceiling.** If device testing shows drop-off, slides 2
  and 3 (grouping, continuity) merge into one "your library, organised" slide.
  Slides 1, 4, 5 and 6 are load-bearing and do not merge.
- **Reduced motion.** The animated mockups must honour the same
  reduced-motion check the home hero already uses, degrading to their settled
  final frame rather than to nothing.
