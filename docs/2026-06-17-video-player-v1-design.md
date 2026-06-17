# 53XY Video Player — v1 Design

Status: **Approved (brainstorm)** · Date: 2026-06-17 · Scope: **v1 core**
See also: [00-vision-and-context.md](./00-vision-and-context.md)

---

## Goal

A beautiful, smooth, Android-first local video player. v1 delivers the solid core:
device-wide video scanning with smart grouping, an adaptive library UI, a custom
gesture-rich player, resume-everywhere, and Material You theming. Power-user filters
and a libVLC fallback are deferred to v2.

## Tech stack

| Need | Choice | Notes |
|---|---|---|
| Playback | `expo-video` | ExoPlayer/Media3, hardware decode, custom controls (native controls hidden) |
| Find videos | `expo-media-library` | MediaStore enumeration; folders surface as "albums" |
| Thumbnails | `expo-video-thumbnails` + `expo-image` | Generate once, cache, fast display |
| Persistence | `expo-sqlite` | Resume positions + settings; scales to thousands of files |
| Gestures / animation | `react-native-reanimated` + `react-native-gesture-handler` | Already installed |
| Theme | `@pchmn/expo-material3-theme` | Wallpaper-based Material You palette + system light/dark |
| Brightness | `expo-brightness` | Window brightness for left-side swipe |
| Volume | volume module (e.g. `react-native-volume-manager`) | System volume for right-side swipe |

**Build reality:** native modules → requires a **custom dev build** (`expo prebuild` /
EAS), not Expo Go. Read https://docs.expo.dev/versions/v56.0.0/ before coding.

## Architecture overview

Units are designed to be independently understandable and testable, communicating
through narrow interfaces.

```
expo-router routes:  / (library)  ·  /group/[id]  ·  /player  ·  /settings

┌─────────────────────────────────────────────────────────────┐
│ UI layer (screens + components, Reanimated animations)         │
│   Library screen · Group detail · Player screen · Settings      │
└───────────────▲───────────────────────────▲──────────────────┘
                │                            │
┌───────────────┴──────────┐   ┌─────────────┴───────────────┐
│ Grouping engine (pure)    │   │ Theme provider (Material 3)  │
└───────────────▲──────────┘   └──────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────────┐
│ Data layer                                                     │
│  MediaLibrary service (scan)  ·  SQLite store (progress/settings)│
└───────────────────────────────────────────────────────────────┘
```

## Components

### 1. MediaLibrary service
- Requests `READ_MEDIA_VIDEO` permission; handles denied/limited states.
- Enumerates videos via `expo-media-library`: `uri`, filename, duration, size,
  width/height, folder (album), creation time.
- Incremental refresh (detect added/removed since last scan).
- **Interface:** `scanVideos(): Promise<VideoAsset[]>`, `getFolders(): Folder[]`.

### 2. Grouping engine (pure functions, unit-tested)
- **Normalizer:** strips `SxxExx` / `1x01` markers, years, quality tags (`720p`,
  `1080p`, `HDR`), release groups (`GalaxyTV`, `JOIN @...`), bracketed junk;
  converts `.`/`_` to spaces; trims.
- **Cluster:** groups normalized titles into shows. `Banshee S01E01 GalaxyTV` +
  `Banshee S02E03 GalaxyTV` → group **"Banshee"** (30 items), episodes sortable by
  season/episode.
- Modes: **by name** (default) and **by folder**.
- **Interface:** `groupByName(videos): Group[]`, `groupByFolder(videos): Group[]`.
- Pure and deterministic → covered by Jest unit tests.

### 3. SQLite store
- Tables:
  - `videos` — cached metadata (id, uri, name, duration, size, w, h, folder, mtime).
  - `watch_progress` — `video_id`, `position_ms`, `percent`, `completed`, `last_played_at`.
  - `settings` — key/value (layout mode, theme mode, seek-seconds, etc.).
- **Interface:** `saveProgress()`, `getProgress()`, `getSetting()/setSetting()`.

### 4. Library UI
- Tabs: **All videos** (grouped) · **Folders** · Playlists (stub for v2).
- **Grid⇄list toggle**, persisted in settings; default **grid**.
- Group card → `/group/[id]` detail listing episodes.
- Progress bars + "resume" badges on items; thumbnails via `expo-image`.
- Search box (title filter).

### 5. Player screen (the differentiator)
`expo-video` `VideoView` with native controls hidden; custom overlay built on
Reanimated + gesture-handler:
- **Long-press anywhere → 2× while held**, release restores prior rate; shows a
  "2× ⏩" pill.
- **Double-tap left/right → seek ∓N s** (default 10, configurable) with ripple anim.
- **Vertical swipe:** left half = brightness (`expo-brightness`), right half =
  volume (volume module), each with a HUD overlay.
- **Horizontal drag = scrub.** Single tap = toggle controls.
- Controls bar: play/pause, seekbar + time, speed, lock, rotate, **next/prev within
  group**, basic subtitle/audio track switch.
- **Auto-saves position** on tick/pause/unmount → auto-resume on reopen.

### 6. Theme provider
- Material 3 dynamic palette via `@pchmn/expo-material3-theme`; **follows system
  light/dark**; graceful fallback palette on Android < 12.
- Exposes design tokens (colors, elevation, radii) via context.
- Animations: shared-element-style transitions grid → detail → player, spring
  physics, satisfying tactile feedback.

## Data flow
1. App launch → request permission → `scanVideos()` → upsert into `videos` table.
2. Library screen reads `videos`, runs grouping engine, joins `watch_progress` for
   bars/badges, renders grid/list per `settings`.
3. Tap group → detail → tap episode → `/player` with the video + its group playlist.
4. Player ticks position → `saveProgress()`; on reopen, resumes from `position_ms`.

## Error handling
- Permission denied / limited → explanatory screen with re-request CTA.
- Empty library → friendly empty state.
- Unplayable file (codec) → friendly error; **v2 hook:** offer libVLC fallback.
- Thumbnail generation failure → placeholder, no crash.

## Testing
- **Grouping engine:** Jest unit tests (normalizer + clustering) — the core logic.
- **SQLite store:** unit tests against an in-memory/temp DB.
- **Player gestures:** primarily manual on device (hard to unit test reliably).

## Out of scope for v1 (→ v2)
- Advanced filters (ignore by length/name, folder-only views, filter presets).
- libVLC fallback for exotic codecs.
- Playlists, advanced subtitle/audio tuning.

## Open questions / decisions for implementation planning
- Volume-control module selection (system vs in-player volume) and its config plugin.
- Thumbnail strategy: lazy on-demand vs background pre-generation.
- Grouping aggressiveness tuning (false-merge risk) — may expose a sensitivity knob.
