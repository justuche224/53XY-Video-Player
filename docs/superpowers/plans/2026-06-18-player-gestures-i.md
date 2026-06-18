# Plan 3b-i — Discrete Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add long-press→2×-while-held and double-tap-left/right→seek∓10s to the player, with on-screen indicators, via a dedicated gesture layer.

**Architecture:** A pure `src/player/seek.ts` (clamped seek target + tap side) is unit-tested. A new full-screen `GestureDetector` layer sits above the `VideoView` and below the chrome; the chrome overlay becomes `pointerEvents="box-none"` so its buttons still work while empty-space touches fall through to the gesture layer. `player.tsx` wires the composed gesture to the player and indicator state.

**Tech Stack:** Expo SDK 56, React Native 0.85, `react-native-gesture-handler`, `react-native-reanimated` v4, `react-native-worklets` (`scheduleOnRN`), `expo-video`. All already installed — **pure JS, no native rebuild**.

## Global Constraints

- **Pure logic → Jest; gesture/UI/native → `tsc --noEmit` clean + the 68-test suite staying green** (codebase convention; no RN renderer tests for the player).
- **Commits: plain conventional commits — NO `Co-Authored-By:` and NO "Generated with" trailer.**
- **No new dependencies. No native rebuild** — ships via Fast Refresh.
- **Worklet→JS boundary:** gesture callbacks that touch the player or React state must hop via `scheduleOnRN(fn, ...args)` from `react-native-worklets` (NOT the deprecated `runOnJS`). See `src/components/player/seekbar.tsx` for the established pattern.
- **expo-video API (used in 3a):** `player.seekBy(seconds)`, `player.playbackRate` (assignable), `player.currentTime`/`player.duration` (seconds). `player` from `useVideoPlayer` — already created in `player.tsx`.
- **Defaults:** seek step `10`, boost rate `2`, long-press activation `350` ms, indicator fade `~600` ms.
- **`player.tsx` lifecycle is load-bearing** — the resume/progress/subscription effects and the cached `lastPositionSecRef`/`lastDurationSecRef` must not be broken. A double-tap seek must update `lastPositionSecRef` (like `handleSeek` does) so a flush right after still records the right position.

---

### Task 1: Pure seek helpers

**Files:**
- Create: `src/player/seek.ts`
- Test: `src/player/__tests__/seek.test.ts`

**Interfaces:**
- Produces:
  - `seekTarget(currentSec: number, deltaSec: number, durationSec: number): number` — `currentSec + deltaSec` clamped to `[0, durationSec]`; if `durationSec <= 0` clamp lower bound only (`Math.max(0, currentSec + deltaSec)`).
  - `tapSide(x: number, width: number): 'left' | 'right'` — `'left'` when `x < width / 2`, else `'right'`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/player/__tests__/seek.test.ts
import { seekTarget, tapSide } from '../seek';

describe('seekTarget', () => {
  it('adds the delta within bounds', () => {
    expect(seekTarget(30, 10, 120)).toBe(40);
    expect(seekTarget(30, -10, 120)).toBe(20);
  });
  it('clamps to the start', () => {
    expect(seekTarget(5, -10, 120)).toBe(0);
  });
  it('clamps to the duration', () => {
    expect(seekTarget(118, 10, 120)).toBe(120);
  });
  it('clamps only the lower bound when duration is unknown', () => {
    expect(seekTarget(5, -10, 0)).toBe(0);
    expect(seekTarget(5, 10, 0)).toBe(15);
  });
});

describe('tapSide', () => {
  it('returns left in the left half', () => {
    expect(tapSide(10, 100)).toBe('left');
  });
  it('returns right at or past the midpoint', () => {
    expect(tapSide(50, 100)).toBe('right');
    expect(tapSide(90, 100)).toBe('right');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail** — `npm test -- src/player/__tests__/seek` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/player/seek.ts
export function seekTarget(currentSec: number, deltaSec: number, durationSec: number): number {
  const target = currentSec + deltaSec;
  const lower = Math.max(0, target);
  if (durationSec <= 0) return lower;
  return Math.min(durationSec, lower);
}

export function tapSide(x: number, width: number): 'left' | 'right' {
  return x < width / 2 ? 'left' : 'right';
}
```

- [ ] **Step 4: Run tests** — `npm test -- src/player/__tests__/seek` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/player/seek.ts src/player/__tests__/seek.test.ts
git commit -m "feat(player): pure seek-target and tap-side helpers"
```

---

### Task 2: Gesture layer, indicators, and player wiring

Adds the composed gesture (tap / double-tap / long-press), the indicators, and the
three-layer restructure. Device-verified; gate on `tsc` + the suite + the checklist.

**Files:**
- Create: `src/components/player/player-gestures.tsx`
- Create: `src/components/player/gesture-indicators.tsx`
- Modify: `src/components/player/controls-overlay.tsx` (outer touchable → `box-none`)
- Modify: `src/app/player.tsx` (render the three layers; wire callbacks + indicator state)

**Interfaces:**
- Consumes: `seekTarget`, `tapSide` from `@/player/seek`; `scheduleOnRN` from
  `react-native-worklets`; `Gesture`, `GestureDetector` from `react-native-gesture-handler`.
- Produces:
  - `PlayerGestures` props: `{ onToggleControls: () => void; onSeekSide: (side: 'left' | 'right') => void; onBoostStart: () => void; onBoostEnd: () => void; children?: ReactNode }` — renders a full-screen `GestureDetector` wrapping a transparent `StyleSheet.absoluteFill` view.
  - `GestureIndicators` props: `{ boostActive: boolean; seekFlash: { side: 'left' | 'right'; nonce: number } | null }`.

**`player-gestures.tsx` — the gesture composition (this is the high-risk part; use it verbatim):**

The gesture view is full-screen, and `e.x` is the tap x within it, so the side is decided
by comparing against half the view width. The width isn't on the event, so capture it via
`onLayout` into a shared value (mirroring `seekbar.tsx`'s `barWidth`) and compute
`tapSide(e.x, width.value)` inside the worklet. Use this verbatim:

```tsx
// src/components/player/player-gestures.tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { tapSide } from '@/player/seek';

interface PlayerGesturesProps {
  onToggleControls: () => void;
  onSeekSide: (side: 'left' | 'right') => void;
  onBoostStart: () => void;
  onBoostEnd: () => void;
  children?: ReactNode;
}

export function PlayerGestures({
  onToggleControls,
  onSeekSide,
  onBoostStart,
  onBoostEnd,
  children,
}: PlayerGesturesProps) {
  // Full-screen width, worklet-accessible, for left/right tap-side decisions.
  const width = useSharedValue(0);

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_e, success) => {
      'worklet';
      if (success) scheduleOnRN(onToggleControls);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((e, success) => {
      'worklet';
      if (success) scheduleOnRN(onSeekSide, tapSide(e.x, width.value));
    });

  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      'worklet';
      scheduleOnRN(onBoostStart);
    })
    .onFinalize(() => {
      'worklet';
      scheduleOnRN(onBoostEnd);
    });

  const composed = Gesture.Race(longPress, Gesture.Exclusive(doubleTap, singleTap));

  return (
    <GestureDetector gesture={composed}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(ev) => {
          width.value = ev.nativeEvent.layout.width;
        }}>
        {children}
      </View>
    </GestureDetector>
  );
}
```

Note `tapSide` is a plain function imported into the worklet — it is small and pure, so it
inlines fine; if Reanimated complains about it not being a worklet, mark it with a
`'worklet';` directive in `seek.ts` (it has no side effects, so this is safe).

**`player.tsx` wiring (behavior contract):**
- Replace the single `<ControlsOverlay>{bars}</ControlsOverlay>` subtree with three layers inside the root `View`, in this z-order:
  1. `<VideoView … />` (unchanged).
  2. `<PlayerGestures onToggleControls={…} onSeekSide={handleSeekSide} onBoostStart={handleBoostStart} onBoostEnd={handleBoostEnd} />` — empty full-screen catcher.
  3. `<ControlsOverlay playing={playing}>` with the existing `TopBar`/`CenterControls`/`BottomBar`/snackbar children (now `box-none`).
  4. `<GestureIndicators boostActive={boostActive} seekFlash={seekFlash} />`.
- `onToggleControls`: call into the overlay's show/hide. Simplest: lift the overlay's visibility toggle to a handler the overlay exposes, OR keep the overlay's internal auto-hide and add an imperative toggle. Concretely: give `ControlsOverlay` an optional `toggleSignal` or expose a ref; **recommended** — move the `controlsVisible` boolean + show/hide into `player.tsx` state and pass `visible` + `onRequestToggle` into `ControlsOverlay` (it already animates opacity from a prop). Keep auto-hide-while-playing behavior.
- `handleSeekSide(side)`: `const target = seekTarget(lastPositionSecRef.current, side === 'left' ? -10 : 10, lastDurationSecRef.current); player.currentTime = target; setPositionSec(target); lastPositionSecRef.current = target; setSeekFlash({ side, nonce: nonce + 1 });` (nonce via a ref-backed counter or `useState` increment so repeated same-side taps re-trigger the flash).
- `handleBoostStart()`: `boostPrevRateRef.current = player.playbackRate; player.playbackRate = 2; setBoostActive(true);`
- `handleBoostEnd()`: `player.playbackRate = boostPrevRateRef.current; setBoostActive(false);`
- Do **not** change the persistent `rate` chip state on boost.

**`gesture-indicators.tsx` (behavior contract):**
- Absolute-fill container, `pointerEvents="none"`.
- 2× pill near top-center, shown (Reanimated fade) only while `boostActive`. Content e.g. `2× ▶▶`, white text on `rgba(0,0,0,0.6)` pill — match the chrome's white-on-scrim style.
- Seek pill centered in the tapped half: on `seekFlash` change, fade in `« 10s` (left) / `10s »` (right), auto-fade after ~600 ms. Re-trigger when `nonce` changes (use it as the effect dependency).

**`controls-overlay.tsx` change:**
- The outer touchable is no longer the tap handler (tap moved to the gesture layer). Change the root from `Pressable onPress={handleTap}` to a plain `Animated.View` (or `View`) with **`pointerEvents="box-none"`** so buttons capture but empty space falls through to the gesture layer. Remove the now-unused `handleTap`/tap-toggle internals; keep the opacity/auto-hide animation. Visibility is now driven by the `visible` prop from `player.tsx` (per the wiring above).

- [ ] **Step 1:** Build `src/player/seek.ts` consumers — create `player-gestures.tsx` (composed gesture, width via `onLayout` shared value + `tapSide`, all worklet→JS via `scheduleOnRN`).
- [ ] **Step 2:** Create `gesture-indicators.tsx` (2× pill + seek pill, Reanimated fade, `pointerEvents="none"`).
- [ ] **Step 3:** Refactor `controls-overlay.tsx` to `box-none` and a `visible` prop; lift `controlsVisible` + toggle into `player.tsx`, keeping auto-hide-while-playing.
- [ ] **Step 4:** Wire the three layers + `handleSeekSide`/`handleBoostStart`/`handleBoostEnd` + indicator state in `player.tsx`. Ensure `handleSeekSide` updates `lastPositionSecRef`.
- [ ] **Step 5:** `npx tsc --noEmit` → clean; `npm test` → all green (Task 1 added seek tests to the prior 68; no UI tests here).
- [ ] **Step 6: Commit**

```bash
git add src/components/player/player-gestures.tsx src/components/player/gesture-indicators.tsx src/components/player/controls-overlay.tsx src/app/player.tsx
git commit -m "feat(player): long-press 2x and double-tap seek gestures with indicators"
```

**Device checklist (user, Fast Refresh — no rebuild):**
- Single tap still shows/hides controls.
- Double-tap left jumps back 10s; double-tap right jumps forward 10s; a `« 10s`/`10s »` pill flashes on the tapped side; the seekbar reflects the jump.
- A double-tap doesn't also toggle the controls.
- Press-and-hold anywhere → playback goes 2× with a `2×` pill; releasing returns to the prior speed (and the speed chip is unchanged).
- Long-press near a control button still works (or at least doesn't fire a button by accident); buttons themselves still tap normally.
- Seeking via double-tap, then backing out, records the jumped-to position on the library bar.

---

## Final whole-branch review

After Task 2, one terse whole-branch review (opus): `tsc` clean, suite green, no
`Co-Authored-By`/"Generated with" trailers, the gesture composition is correct
(double-tap excludes single-tap; long-press races cleanly; worklet→JS via `scheduleOnRN`,
no `runOnJS`), `box-none` doesn't break button touches or the existing auto-hide, and the
seek path keeps `lastPositionSecRef` in sync. Then hand the user the device checklist;
merge to `master` after they verify.

## Self-review notes
- **Spec coverage:** long-press 2× ✓(T2) · double-tap seek ∓10s by side ✓(T2, uses T1) ·
  single-tap-toggle folded into gesture layer ✓(T2) · three-layer architecture +
  `box-none` ✓(T2) · 2× + seek indicators ✓(T2) · pure helpers tested ✓(T1).
- **Deferred to 3b-ii (not here, by design):** vertical swipe brightness/volume,
  full-screen drag-scrub, lock.
- **Type consistency:** `seekTarget`/`tapSide` signatures consistent T1→T2;
  `PlayerGestures`/`GestureIndicators` prop shapes consistent within T2.
