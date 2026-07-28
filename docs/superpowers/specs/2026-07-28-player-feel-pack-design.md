# Player Feel Pack — Design

**Date:** 2026-07-28
**Scope:** Three player-surface features, built in order: (A) aspect modes + pinch-zoom, (B) binge pack (autoplay-next + sleep timer), (C) scrub preview thumbnails. Each ships independently with tests green before the next starts.

## Goals

Close the "feel" gap against best-in-class players (MX Player, VLC, YouTube) while staying local-first. Non-goals: casting, network streams, equalizer, online subtitle download.

---

## A. Aspect modes + pinch-zoom

### Modes

Cycle order: **Fit → Crop → Stretch → 100%**.

- **Fit** — letterbox, whole frame visible (today's behavior; default).
- **Crop** — fills screen, preserves ratio, edges cut.
- **Stretch** — fills screen, ignores ratio.
- **100%** — pixel-true: video rendered at natural pixel size, centered.

### Model

A pure module `src/player/zoom.ts` owns all math. Inputs: screen size, video natural size, state (named mode or free scale). Output: render rect (width, height, offsets) for the video container.

- Fit, Crop, and 100% are uniform scales of the same `contentFit="contain"` baseline: Fit = 1.0, Crop = cover-ratio, 100% = naturalWidth / containBaseWidth. The `VideoView` keeps `contentFit="contain"`; its container is sized/scaled from the render rect.
- **Stretch** is the sole non-uniform case: special-cased as full-screen `VideoView` with `contentFit="fill"`.
- Natural size source: expo-video source-load event, falling back to width/height from the media-library scan. Until natural size is known, 100% is unreachable (pinch and the other modes work without it); verify the exact v56 event shape against https://docs.expo.dev/versions/v56.0.0/ before coding.

### Pinch gesture

- Two-finger `Gesture.Pinch` added to the player arena. It cannot collide with the single-finger pan/double-tap wedges, but it is wired with the same raw-gesture discipline this repo already uses, and regression-tested on-device (adb) against: double-tap seek zones, brightness/volume swipes, drag-scrub, long-press boost, lock overlay.
- While pinching: continuous free scale, clamped to [0.25×, `maxPinchScale`] of Fit, where `maxPinchScale = max(4.0, crop×1.3, pixel×1.3)` so full-screen Crop and 100% are always finger-reachable regardless of screen/video geometry; center HUD (pan-indicator pattern) shows live percentage ("115%").
- Live snap preview: while pinching, whenever release would snap to a named mode the HUD shows that mode's name instead of the %, with a haptic tick on zone entry (preview uses the same `snapZoom` call as release, so they can never disagree).
- On release: if final scale is within **6%** of a named uniform mode's scale, animate-snap to that mode and show its name in the HUD; otherwise stay at the free scale and show the %.
- Pinching while in Stretch first exits Stretch to the uniform Fit baseline (scale 1), then follows the fingers.
- Pinch is disabled while the lock overlay is active.

### Chrome

Cycle button in the bottom bar (adjacent to the speed chip). Tap advances the mode; the center HUD announces the new mode name. Icon reflects current mode.

### Persistence

- SQLite migration **v5** (schema is already at v4 — playlists): add `display_mode TEXT` (nullable) to `watch_progress`.
- Written only when the resting state is a named mode ≠ Fit; cleared (NULL) when the user returns to Fit.
- Free-zoom % is session-only. Applied on player load before first frame is visible.

### Tests

Unit tests for `zoom-model.ts`: render-rect math for each mode across landscape/portrait screens × landscape/portrait/square videos, snap thresholds, clamping, mode cycling, Stretch-exit behavior. Gesture interplay verified manually on-device.

---

## B. Binge pack

### B1. Autoplay-next countdown

- Trigger: expo-video play-to-end event **and** a next neighbor exists (existing `playlist.ts` neighbor logic) **and** the setting is enabled **and** no end-of-video sleep timer is armed.
- Setting: "Autoplay next episode", **default on**, in Settings → Player (SQLite `settings` table).
- Card (overlay, replaces replay state): next video's thumbnail, label via `episode-label.ts`, "Playing in 5…" with an animated countdown ring, buttons **Cancel** and **Play now**.
  - Countdown: 5 seconds. Expiry or **Play now** → advance via existing next-video path.
  - **Cancel** → dismiss card, revert to today's replay state for the current video.
- No neighbor, setting off, or sleep-timer suppression → replay behavior unchanged.
- Countdown state machine is pure logic (`src/player/autoplay-next.ts`), unit-tested (trigger conditions, expiry, cancel, suppression).

### B2. Sleep timer

- Entry: moon icon in the player top bar → small sheet: **End of video · 15 min · 30 min · 60 min · custom** (stepper, 5-min increments).
- Active state: remaining minutes badged on the moon icon; reopening the sheet shows remaining time with **Cancel timer** and the presets (picking one replaces the timer).
- Expiry: over the final 10 s ramp `player.volume` → 0, then pause and restore volume; snackbar "Sleep timer paused playback".
- **End of video** mode: playback runs to the end of the current video, then pauses. **Precedence: an armed end-of-video sleep timer suppresses autoplay-next.**
- Timer lives in player state; leaving the player cancels it. Timer/fade logic pure and unit-tested.

---

## C. Scrub preview thumbnails

### Generation

- Trigger: first open of a video in the player with no existing strip → background job starts (and resumes if a strip is partial).
- Frames via `expo-video-thumbnails`, interval = `clamp(duration / 50, 5 s, 60 s)`, ~160 px wide, quality tuned for ~1–2 MB per video.
- Output: per-video directory under the app cache (`previews/<videoId>/`) holding numbered frames + `manifest.json` (interval, expected count, completed indices). No DB migration.
- One frame at a time, lowest priority, yields to the UI thread; safe to interrupt — the manifest makes the job resumable and a partial strip immediately usable.

### Scrub UI

- Shown during **seekbar drag** and **horizontal drag-scrub**: a bubble above the touch point with the nearest completed frame and the target timestamp. Position driven by Reanimated, clamped to screen edges.
- Frame not yet generated → bubble shows timestamp only. Never a spinner; never a farther-away frame that could mislead.
- Bubble hides on release; existing scrub HUD behavior otherwise unchanged.

### Cleanup

- When the media scan drops a video, its preview directory is deleted alongside its other cached artifacts.
- Global size cap / LRU eviction: **backlog**, not in this scope.

### Tests

Unit tests: interval calculation, nearest-completed-frame selection, manifest resume logic. Bubble tracking verified on-device.

---

## Build order & delivery

A → B → C. Each feature is its own commit series; `tsc` clean and Jest green before moving on. On-device verification via adb for every gesture-touching change.
