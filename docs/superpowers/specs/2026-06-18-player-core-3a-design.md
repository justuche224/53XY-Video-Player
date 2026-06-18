# Plan 3a — Core Playback (design)

_Date: 2026-06-18 · Branch: `feat/player-core` · Part of Plan 3 (the player)._

Replaces the placeholder `src/app/player.tsx` with a real `expo-video` player and a
custom control overlay. Plan 3b (separate brainstorm) adds the signature gesture layer.

## Scope
**In:** real `expo-video` playback, custom control overlay (native controls hidden),
auto-resume + undo, progress writing, orientation (auto + manual), keep-awake,
next/prev within group, embedded subtitle/audio track selection, speed control.

**Deferred to 3b:** long-press 2×, double-tap seek, swipe brightness/volume,
full-screen drag-scrub, and **lock** (it exists to block accidental gesture touches).
**Volume** needs no 3a work — hardware buttons work natively; the volume *swipe* and its
dependency land in 3b.

## Architecture / components
- **`src/app/player.tsx`** — screen. Creates the player via `useVideoPlayer(source)`,
  renders full-bleed `VideoView` (`nativeControls={false}`, `contentFit="contain"`) with
  the control overlay on top. Owns playback state, resume, progress-write lifecycle,
  orientation, keep-awake.
- **`src/components/player/`** — presentational, each small & isolatable:
  - `controls-overlay.tsx` — auto-hide wrapper; basic `Pressable` tap-to-toggle
    (3b upgrades this to the gesture detector).
  - `top-bar.tsx` (back, title, rotate, tracks), `center-controls.tsx`
    (prev / play-pause / next), `bottom-bar.tsx` (seekbar + elapsed/total + speed chip).
  - `seekbar.tsx` — Reanimated + gesture-handler draggable scrubber (**no new dep**).
  - `tracks-sheet.tsx` — subtitle/audio menu from `availableSubtitleTracks` /
    `availableAudioTracks`.
- **`src/player/`** — pure, unit-tested logic (the testable core; UI/playback is
  device-verified):
  - `resume.ts` → `shouldResume(positionMs, percent)` (reuses `isCompleted`: finished ⇒ 0).
  - `format-time.ts` → `mm:ss` / `h:mm:ss`.
  - `playlist.ts` → `neighbors(items, currentId)` ⇒ `{ prev, next, index }`.
  - `progress-writer.ts` → throttle/decide-when-to-write logic (SQLite call injected).

## Data flow — next/prev
Player route gains optional `groupKey` + `mode`. From **group detail**, pass them; the
player calls existing `useGroups(mode)`, finds the group, and `neighbors(group.items,
videoId)` yields prev/next (buttons disabled when absent). From a **single-item open**
(`index.tsx`), no `groupKey` ⇒ next/prev hidden. Re-deriving via the existing hook keeps
the route URL small and reuses the tested grouping engine — no list serialization.

## Resume & progress writing
- On load: read `watch_progress` for `videoId`; if `shouldResume`, set
  `player.currentTime = savedSeconds`, play, show an auto-dismiss snackbar
  **"Resumed at 12:34 · Restart"** (Restart → seek 0).
- **New `upsertProgress(db, { videoId, positionMs, percent, completed, lastPlayedAt })`**
  in `progress-repo.ts` (`INSERT … ON CONFLICT(video_id) DO UPDATE`). `percent` via
  `computeProgressPercent`, `completed` via `isCompleted`.
- Write cadence: throttled every ~5 s while playing, **and** on pause / background
  (AppState) / unmount / switching to next-prev. Lights up the library's existing
  progress bars.

## Orientation / keep-awake / native
- `expo-screen-orientation`: on focus allow all + follow sensor; rotate button
  forces/locks landscape↔portrait; **on blur/unmount restore portrait**.
- `expo-keep-awake`: active while playing, released on pause/unmount.
- **New deps:** `expo-screen-orientation`, `expo-keep-awake` (`npx expo install`).
  **Requires a native rebuild** (`npx expo run:android`) — first real `expo-video`
  playback + two new native modules. User does the build + device verify.

## Testing
Jest covers the pure core: `shouldResume`, `format-time`, `neighbors`, progress-writer
throttle/decision, and `upsertProgress` round-trip. Overlay/playback/orientation are on
the device checklist. Keep the suite green (currently 55) + `tsc --noEmit` clean.

## Verified against installed SDK 56
- `expo-video` exposes `availableSubtitleTracks`, `availableAudioTracks`, `subtitleTrack`,
  `audioTrack`, `currentTime`, `duration`, `playbackRate`, `seekBy` (checked in
  `node_modules/expo-video/build/VideoPlayer.types.d.ts`).
- `watch_progress` columns: `video_id, position_ms, percent, completed, last_played_at`.
- `isCompleted(percent, 0.95)` and `computeProgressPercent` already exist in `src/db/progress.ts`.
- `expo-video`, `expo-brightness`, `react-native-reanimated`, `react-native-gesture-handler`
  already installed; `expo-screen-orientation` + `expo-keep-awake` are the only new 3a deps.
