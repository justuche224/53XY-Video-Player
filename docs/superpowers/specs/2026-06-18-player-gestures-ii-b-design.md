# Plan 3b-ii-b — Lock + Edge-Tap Fix (design)

_Date: 2026-06-18 · Branch: `feat/player-gestures-ii-b` · Final piece of Plan 3b (the gesture layer)._

Adds a **lock** control and resolves the deferred **edge-double-tap-while-controls-showing**
bug. **Pure JS — no new deps, no native rebuild.**

## Part 1 — Lock
- **State:** `locked` boolean in `player.tsx`. A 🔓 button in the top-bar right slot (next to
  tracks/rotate) sets `locked = true`.
- **While locked:** render neither the chrome nor the gesture layer — instead render a single
  full-screen **`LockOverlay`** (`src/components/player/lock-overlay.tsx`) above the
  `VideoView`. It absorbs all touches so nothing else fires. A single tap reveals a centered
  **"🔒 Tap to unlock"** pill (Reanimated fade, auto-hides ~3 s); tapping the pill calls
  `onUnlock` → `locked = false`, restoring chrome + gestures. Playback continues underneath.
- **Scope:** lock only gates touch + chrome; it does not change orientation or playback
  (YAGNI — orientation-freeze can come later).

## Part 2 — Edge-tap fix (simpler fallback, by decision)
**Bug:** with controls showing, an edge double-tap genuinely toggles a control (play state
flips) on top of skipping — the chrome buttons are RN `Pressable`s in a separate touch
system from the gesture layer, so a double-tap can both skip and land a control press.

**Chosen fix — gate double-tap to controls-hidden:** the double-tap-seek / center-play-pause
gesture only acts when the **controls are hidden**. When controls are showing, you use the
visible controls (seekbar, play/pause button); a double-tap there is ignored, so it can no
longer double-fire. Implementation: `handleDoubleTap` early-returns when controls are visible
(read via a `controlsVisibleRef` to avoid a stale gesture closure). Long-press-2× and the pan
gestures are unchanged (they were not part of the reported conflict).

**Why the fallback (documented for later tinkering):** the "correct" fix is to bring the
chrome buttons into the **same RNGH gesture arena** — a `GestureButton` (RNGH `Gesture.Tap`
+ scale) that `requireExternalGestureToFail(doubleTapRef)`, wired to the screen's double-tap
through a small `PlayerGestureContext`, swapped in for `PressableScale` across the player
chrome. That makes a double-tap-while-controls-showing yield the button press, so double-tap
could work in both states. It was deferred because it's a multi-file refactor touching a
shared button component and adds a ~250 ms confirm delay to every control tap. **Revisit
this if we ever want double-tap-seek to work while the controls are visible.**

## Files
- Create: `src/components/player/lock-overlay.tsx` (tap → reveal pill → tap-to-unlock).
- Modify: `src/app/player.tsx` — `locked` state + branch (render `LockOverlay` when locked,
  else gestures + chrome); `controlsVisibleRef` synced from `controlsVisible`; `handleDoubleTap`
  early-returns when controls visible.
- Modify: `src/components/player/top-bar.tsx` (or the player's top-bar right slot in
  `player.tsx`) — add the 🔓 lock button.

## Testing
No new pure logic, so the Jest suite is unchanged (82). Lock flow and the double-tap gate are
device-verified (UI/gesture, consistent with the rest of Plan 3). `tsc --noEmit` clean.

## Verified context
- The 🔓 lock button lives alongside the existing tracks (⊕) / rotate buttons built in the
  player's `topBarRight` (`player.tsx`).
- `controlsVisible` already exists in `player.tsx` (lifted in 3b-i) and drives chrome
  visibility; the gate reads a ref mirror of it.
