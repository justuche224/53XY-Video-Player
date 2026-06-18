# Plan 3b-ii-a — Pan Gestures (design)

_Date: 2026-06-18 · Branch: `feat/player-gestures-ii-a` · Part of Plan 3b-ii (drag gestures + lock)._

Adds a full-screen pan to the player gesture layer. **Pure JS — no new deps, no
permissions, no native rebuild** (`expo-brightness` already linked; `player.volume` is the
expo-video API).

## Scope
**In:** vertical swipe **left half → brightness**, vertical swipe **right half → volume**,
**horizontal drag → scrub** (preview, commit on release), each with a HUD indicator.

**Deferred to 3b-ii-b:** lock, and the known edge-double-tap-while-controls-showing fix.

## Architecture
- Add `Gesture.Pan()` to the composed gesture in `player-gestures.tsx`:
  `Gesture.Race(pan, longPress, Gesture.Exclusive(doubleTap, singleTap))`. A tap that moves
  past threshold becomes a pan; a still hold stays long-press; a clean tap stays a tap —
  gesture-handler resolves by activation.
- **Axis lock on gesture start:** on the first significant movement decide once —
  `|dx| > |dy|` → horizontal (scrub), else vertical — and keep that axis for the whole drag
  (no mid-drag flip), tracked in a shared value. For vertical, the **half** (start x vs.
  width/2) picks brightness (left) vs. volume (right).
- Worklet computes axis/half/deltas; hops to JS via `scheduleOnRN`; JS applies the effect
  and updates HUD state.

## New pure helpers (`src/player/pan.ts`, Jest-tested)
- `panAxis(dx: number, dy: number): 'horizontal' | 'vertical'` — `Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'`.
- `panHalf(x: number, width: number): 'left' | 'right'` — `x < width / 2 ? 'left' : 'right'`.
- `clamp01(v: number): number` — clamp to `[0, 1]`.
- `scrubDeltaSec(dx: number, width: number, windowSec: number): number` — `(dx / width) * windowSec`
  (a full-width drag = ±`windowSec`). The committed target reuses the existing `seekTarget`
  clamp from `src/player/seek.ts`.

## Behavior
- **Brightness (vertical, left):** `getBrightnessAsync()` saved on mount; each update sets
  `setBrightnessAsync(clamp01(start − dy/height))` (drag up = brighter); **restore the saved
  value on unmount**.
- **Volume (vertical, right):** each update sets `player.volume = clamp01(start − dy/height)`
  (drag up = louder).
- **Scrub (horizontal):** while dragging, show a target-time bubble and move the seekbar but
  **don't seek**; on release `player.currentTime = target` and sync `lastPositionSecRef`
  (so a flush records the jumped-to position). Full-width = ±`windowSec` (default 120 s).
- **Sensitivity defaults:** full half-screen vertical swipe ≈ full 0→1 brightness/volume
  (`delta = −dy / screenHeight`); full-width horizontal ≈ ±120 s. Adjustable.

## Indicators (`src/components/player/pan-indicators.tsx`, new — keeps `gesture-indicators` focused)
- Vertical HUD: a centered pill with an icon + a thin level bar — ☀ brightness, 🔊 volume —
  shown while that drag is active (driven by `{ kind: 'brightness' | 'volume', level: number } | null`).
- Scrub HUD: a center bubble `12:30  +0:45` (target time + signed delta) while dragging
  (driven by `{ targetSec: number, deltaSec: number } | null`), reusing `formatTime`.

## Verified against installed SDK 56
- `expo-brightness`: `getBrightnessAsync()` / `setBrightnessAsync(0..1)` are **app-level, no
  permission** (only `setSystemBrightnessAsync`/`restoreSystemBrightnessAsync` need
  `SYSTEM_BRIGHTNESS`). Already installed/linked since the 3a build.
- `player.volume` is a settable `0..1` float (`VideoPlayer.types.d.ts`).
- `react-native-gesture-handler` `Gesture.Pan()`, `react-native-reanimated`, `scheduleOnRN`
  (`react-native-worklets`) already installed and used by the seekbar/gesture layer.

## Testing
Jest covers `panAxis`, `panHalf`, `clamp01`, `scrubDeltaSec` (+ existing `seekTarget` reused
for the commit clamp). Gestures, brightness/volume application, and the HUDs are
device-verified. Suite stays green, `tsc --noEmit` clean.
