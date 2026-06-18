# Plan 3b-i — Discrete Gestures (design)

_Date: 2026-06-18 · Branch: `feat/player-gestures-i` · Part of Plan 3b (the gesture layer)._

Adds the first signature gestures onto the existing 3a player overlay. **Pure JS —
no new dependency, no native rebuild** (volume/brightness/scrub/lock are Plan 3b-ii).

## Scope
**In:** long-press → **2× while held**, double-tap **left/right half → seek ∓10 s**, and
their on-screen indicators. Single-tap-toggle (exists in 3a) folds into the new gesture
layer.

**Deferred to 3b-ii:** vertical swipe brightness (left) / volume (right, via
`player.volume`), full-screen horizontal drag-scrub, lock.

## Architecture — a dedicated gesture layer
Today `controls-overlay.tsx` couples scrim + tap + control bars in one `Pressable`.
Restructure the player into three stacked layers so gestures and buttons never fight:
1. **Gesture layer** — full-screen `GestureDetector`, always capturing, just above the
   `VideoView`.
2. **Chrome overlay** — scrim + top/center/bottom bars, on top, with
   **`pointerEvents="box-none"`** so only the actual buttons capture touches; taps on
   empty space fall through to the gesture layer. Replaces the outer `Pressable`; the
   auto-hide/fade opacity logic stays.
3. **Indicators layer** — `pointerEvents="none"`, for the 2× pill and seek indicator.

Single-tap-toggle, double-tap-seek, and long-press then all live in **one** composed
gesture and behave the same whether controls are shown or hidden, while control buttons
still get their own presses.

## Gesture composition
`Gesture.Race(longPress, Gesture.Exclusive(doubleTap, singleTap))`:
- **`Tap().numberOfTaps(1)`** → toggle controls. The single tap must wait for the double
  tap to fail, so a real double-tap does not also toggle.
- **`Tap().numberOfTaps(2)`** → read tap `x` vs. `width / 2` → `player.seekBy(±10)`;
  clamp to `[0, duration]`; update the cached position ref + the seekbar position state.
- **`LongPress().minDuration(350)`** → `onStart`: `player.playbackRate = 2`;
  `onEnd`/`onFinalize`: restore `player.playbackRate = rate` (the user's chosen chip
  value — the persistent rate chip is left untouched). Worklet→JS via `scheduleOnRN`.

## Indicators (Reanimated fade, ~600 ms auto-dismiss)
- **2× boost**: small pill near top-center (e.g. `2× ▶▶`), visible only while the
  long-press is held.
- **Double-tap seek**: brief pill centered in the tapped half — `« 10s` (left) /
  `10s »` (right).

## Defaults
Seek step **10 s**, boost rate **2×**, long-press activation **350 ms**, indicator fade
**~600 ms**.

## Components / files
- New `src/player/seek.ts` (pure): `seekTarget(currentSec, deltaSec, durationSec)` →
  clamped target seconds; `tapSide(x, width)` → `'left' | 'right'`.
- New `src/components/player/player-gestures.tsx` — the `GestureDetector` layer (composed
  gesture; props: callbacks `onToggleControls`, `onSeekSide(side)`, `onBoostStart`,
  `onBoostEnd`).
- New `src/components/player/gesture-indicators.tsx` — the 2× pill + seek pill
  (props: `boostActive`, `seekFlash: { side, nonce } | null`).
- Modify `src/components/player/controls-overlay.tsx` — switch the outer `Pressable`
  to `pointerEvents="box-none"`; the tap-toggle moves to the gesture layer.
- Modify `src/app/player.tsx` — render the three layers; wire gesture callbacks to
  `seekTarget`/`player`, the boost rate save/restore, and indicator state.

## Verified against installed SDK 56
- `player.seekBy(seconds)`, `player.playbackRate`, `player.currentTime`/`duration` exist
  (used in 3a; in `VideoPlayer.types.d.ts`).
- `react-native-gesture-handler` + `react-native-reanimated` + `scheduleOnRN`
  (`react-native-worklets`) already installed and used by the seekbar.

## Testing
Jest covers the pure `seek.ts` helpers (`seekTarget` clamping; `tapSide` boundaries).
Gesture composition, layering, and indicators are device-verified (consistent with 3a).
Keep the suite green + `tsc --noEmit` clean.
