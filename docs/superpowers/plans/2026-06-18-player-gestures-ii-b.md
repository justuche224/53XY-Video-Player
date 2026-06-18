# Plan 3b-ii-b — Lock + Edge-Tap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lock control (hide chrome + ignore gestures, tap→reveal→tap to unlock) and stop the edge double-tap from also toggling a control by gating double-tap to controls-hidden.

**Architecture:** A `LockOverlay` component owns the locked-state touch surface; `player.tsx` renders it instead of the gesture layer + chrome while `locked`. The edge-tap conflict is resolved by a visibility guard: `handleDoubleTap` no-ops while controls are visible (read via a ref to avoid a stale gesture closure).

**Tech Stack:** Expo SDK 56, RN 0.85, `react-native-reanimated`. Pure JS — no new deps, no native rebuild.

## Global Constraints

- **UI-only change → gate is `tsc --noEmit` clean + the 82-test suite staying green** (no new pure logic; no RN renderer tests for the player).
- **Commits: plain conventional — NO `Co-Authored-By:` and NO "Generated with" trailer.**
- **No new dependencies, no native rebuild** — ships via Fast Refresh.
- **Edge-tap fix is the documented simpler fallback:** double-tap-seek/play-pause acts only when controls are HIDDEN. The proper fix (chrome buttons in one RNGH gesture arena via a `GestureButton` + `requireExternalGestureToFail` on the screen double-tap, wired through context) is deferred — see the spec; revisit only if double-tap-while-controls-showing is wanted.
- **Lock scope:** gates touch + chrome only; does not change orientation or playback.
- **`player.tsx` lifecycle is load-bearing:** the locked branch must not unmount/break the player, resume/progress effects, or cached refs — locking only changes which overlay renders on top of the same `VideoView`/`player`.

---

### Task 1: Lock control + double-tap gate

**Files:**
- Create: `src/components/player/lock-overlay.tsx`
- Modify: `src/app/player.tsx` (locked state, 🔓 button in `topBarRight`, locked-branch render, `controlsVisibleRef`, double-tap gate)

**Interfaces:**
- Consumes: `useTheme` is NOT needed (chrome uses fixed white — match existing player components); Reanimated.
- Produces: `LockOverlay` props `{ onUnlock: () => void }`.

**`lock-overlay.tsx` (use verbatim):**

```tsx
// src/components/player/lock-overlay.tsx
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const REVEAL_MS = 3000;
const FADE_MS = 200;

interface LockOverlayProps {
  onUnlock: () => void;
}

export function LockOverlay({ onUnlock }: LockOverlayProps) {
  const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reveal() {
    setVisible(true);
    opacity.value = withTiming(1, { duration: FADE_MS });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS });
      setVisible(false);
    }, REVEAL_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pillStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // Full-screen catcher: any tap reveals the unlock pill (and re-arms the timer).
    <Pressable style={StyleSheet.absoluteFill} onPress={reveal}>
      <View style={styles.center} pointerEvents="box-none">
        {/* Pill only captures touches while visible, so a tap on the hidden
            pill area falls through to the catcher above and just reveals. */}
        <Animated.View style={pillStyle} pointerEvents={visible ? 'auto' : 'none'}>
          <Pressable onPress={onUnlock} style={styles.pill}>
            <Text style={styles.text}>{'🔒  Tap to unlock'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

**`player.tsx` wiring (behavior contract):**
- Add `const [locked, setLocked] = useState(false);`
- Add a 🔓 lock button to `topBarRight` (the `View` that already holds the tracks/rotate `PressableScale`s), matching their style: `<PressableScale onPress={() => setLocked(true)} style={styles.iconButton}><Text style={styles.iconText}>{'🔓'}</Text></PressableScale>`.
- **Locked branch:** when `locked`, render only the `VideoView` + `<LockOverlay onUnlock={() => setLocked(false)} />` (do NOT render `PlayerGestures`, `ControlsOverlay`, `GestureIndicators`, `PanIndicators`, or `TracksSheet`). When not locked, render the existing tree unchanged. Structure it so the `VideoView`/`player` stays mounted in both branches (only the overlays differ) — e.g. keep `<VideoView>` outside the conditional and switch only the overlay layers.
- **Double-tap gate:** add `const controlsVisibleRef = useRef(false);` and keep it synced: `useEffect(() => { controlsVisibleRef.current = controlsVisible; }, [controlsVisible]);`. In `handleDoubleTap`, early-return when controls are visible — first line: `if (controlsVisibleRef.current) return;`. (Leaves long-press and pan unchanged.)

- [ ] **Step 1:** Create `src/components/player/lock-overlay.tsx` verbatim above.
- [ ] **Step 2:** In `player.tsx`, add the `locked` state, the 🔓 button in `topBarRight`, and the locked-branch render (keep `VideoView`/`player` mounted across both branches; render `LockOverlay` when locked, the existing overlays when not).
- [ ] **Step 3:** `npx tsc --noEmit` → clean; `npm test` → 82 green. Commit:

```bash
git add src/components/player/lock-overlay.tsx src/app/player.tsx
git commit -m "feat(player): lock control (hide chrome, tap-to-reveal-then-tap to unlock)"
```

- [ ] **Step 4:** Add `controlsVisibleRef` + its sync effect, and the `if (controlsVisibleRef.current) return;` guard at the top of `handleDoubleTap`.
- [ ] **Step 5:** `npx tsc --noEmit` → clean; `npm test` → 82 green. Commit:

```bash
git add src/app/player.tsx
git commit -m "fix(player): gate double-tap to controls-hidden to stop edge double-tap toggling a control"
```

**Device checklist (user, Fast Refresh — no rebuild):**
- Tapping 🔓 hides all controls and the video keeps playing; gestures (skip/2×/swipe) do nothing while locked.
- A single tap while locked shows the "🔒 Tap to unlock" pill; it auto-hides after ~3 s; tapping it unlocks and restores the controls.
- With controls **hidden**: double-tap left/right still skips, center still play/pauses.
- With controls **showing**: double-tapping an edge no longer flips play/pause (it simply does nothing — single-tap to hide first, then double-tap to skip). Long-press-2× and the brightness/volume/scrub swipes still work in both states.

---

## Final whole-branch review

After Task 1, one terse whole-branch review (opus): `tsc` clean, suite green, no
`Co-Authored-By`/"Generated with" trailers; the locked branch keeps `VideoView`/`player`
mounted (no playback/lifecycle break) and the `LockOverlay` timer is cleaned up; the
double-tap gate reads the ref (not stale state) and leaves long-press/pan untouched. Then
hand the user the device checklist; merge after they verify.

## Self-review notes
- **Spec coverage:** lock state + 🔓 button ✓(T1) · LockOverlay tap→reveal→tap-unlock ✓(T1) ·
  locked hides chrome + ignores gestures ✓(T1 branch) · double-tap gated to controls-hidden
  ✓(T1) · fallback rationale + deferred proper fix documented ✓(spec).
- **No new pure logic** → suite unchanged (82); UI/gesture device-verified.
- **Type consistency:** `LockOverlay` `onUnlock` prop matches the `player.tsx` call site;
  `controlsVisibleRef` mirrors the existing `controlsVisible` state.
