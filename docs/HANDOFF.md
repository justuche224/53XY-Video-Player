# 53XY — Handoff / Pick-Up Guide

**Read this first when resuming.** It's the single entry point to continue the project in a fresh chat.

---

## 1. What this app is

**53XY** is an Android-first, "best of all worlds" local video player built with **Expo SDK 56 / React Native 0.85**. The full vision is in [00-vision-and-context.md](./00-vision-and-context.md). In short: take the best of VLC + MX Player and fix what they get wrong — smart auto-grouping, folder view, resume + progress, long-press-to-2×, double-tap-seek, swipe brightness/volume, advanced filters — with a **beautiful Material You UI** and smooth, satisfying animations.

### Current capabilities
- **Library:** device scan → folder/title/episode parsing → grouping engine → adaptive grid/list UI, Videos/Folders tabs, search, group detail, thumbnails, multi-thumbnail collages, FlashList recycling, duration badges, empty states, android ripples.
- **Player:** `expo-video` playback, custom Reanimated/gesture-handler control overlay, auto-resume + snackbar, progress writes, orientation, keep-awake, next/prev in group, subtitle/audio tracks, pitch-preserved speed, replay-at-end fix. Gestures: long-press→2× (with haptics), 3-zone double-tap (back/play-pause/forward), swipe brightness (left) / system volume (right), horizontal drag-scrub, lock overlay. Background audio play and automatic PiP on swipe-home (toggled via Settings).
- **Filters & sort:** persistent min/max duration ignore, filename pattern ignore (substring/glob), folder ignore, composed `applyFilters`; sort by name/length/date-added/date-modified.
- **History & resume:** YouTube-style Watch History screen (day-bucketed, search, swipe-remove, clear-all, tap-to-resume); home-screen Resume FAB (most-recent existing video, group context for next/prev).
- **Infra:** Material You theming, SQLite + 3 migrations, shared library cache (`LibraryProvider`), dynamic `app.config.ts` with dev/preview/prod build variants (side-by-side installs), EAS profiles incl. `production-apk`.

---

## 2. Status table — single source of truth

> **Update rule:** when a feature ships, update its row here + append one bullet to §7 Changelog. That's it.

| Plan | What | Status |
|---|---|---|
| Foundation | Themed app shell, Material You, SQLite + migrations, nav skeleton, Jest harness | ✅ merged, device-verified |
| Library 2A | Device scan → folder/title/episode parsing → grouping engine → SQLite | ✅ merged, device-verified |
| Library 2B | Adaptive grid/list UI, Videos/Folders tabs, search, group detail, thumbnails | ✅ merged, device-verified |
| Library polish | Scroll perf, cache-first background rescan, conservative numeric merge, multi-thumbnail collages | ✅ merged, device-verified |
| Plan 3a — Core player | `expo-video`, custom overlay, resume+snackbar, progress writes, orientation, keep-awake, next/prev, tracks, speed | ✅ merged, device-verified |
| Plan 3b-i — Discrete gestures | Long-press→2×; 3-zone double-tap + indicators | ✅ merged, device-verified |
| Plan 3b-ii-a — Pan gestures | Swipe brightness / system volume / horizontal drag-scrub + HUDs | ✅ merged, device-verified |
| Plan 3b-ii-b — Lock + edge-tap fix | Lock overlay; double-tap gated to controls-hidden | ✅ merged, device-verified |
| **v1 complete** | Foundation + Library + Player all shipped | 🎉 |
| v2 — Length filter | Persistent min/max duration ignore; Settings chips + custom dialog + hidden-count footer | ✅ merged, device-verified |
| v2 — Name + folder filters | Filename pattern ignore (substring/glob) + folder ignore; composed `applyFilters` | ✅ merged, device-verified |
| v2 — Sort options | Sort by name/length/date-added/date-modified, persisted; `SortButton`/`SortSheet` | ✅ merged, device-verified |
| v2 — FlashList | `@shopify/flash-list` v2 for library + group-detail lists (native dep) | ✅ merged, device-verified |
| v2 — UI Polish | Unified icons, themed headers, scroll overscroll/bounces, duration badges | ✅ merged, device-verified |
| v2 — QOL Polish | Search clear, empty states, android ripples, Settings icons, player 2x haptics | ✅ merged, device-verified |
| v2 — Player replay fix | Replay at end-of-video (seek to 0 + replay icon) | ✅ merged, device-verified |
| Perf — Shared library cache | Root `LibraryProvider`; thin `useLibrary`/`useGroups` consumers; immediate playback + async resume seek | ✅ merged |
| Config — app.config.ts + variants | Dynamic config; package `com.jvstuche.fiftythreexy` with per-variant ids; `production-apk` profile | ✅ merged |
| v2 — Watch History | `/history` screen: day-bucketed, search, swipe-remove, clear-all, tap-to-resume; cascade-prune orphans; migration v3 | ✅ merged, device-verified |
| v2 — Resume FAB | Home-screen "▶ Resume" FAB → most-recent existing video with group next/prev; `resolveLastPlayed` Jest-tested | ✅ merged |
| Playlists | User-created playlists, manual reordering, player integration. | **Completed** |
| Bottom tab bar | Flat Material You tab bar (Home/Playlists/History/Settings); `(tabs)` group | ✅ merged (device-verify pending) |
| Visual cohesion 1–3 | Design-system foundation (typography ramp + `AppText`, M3 tonal elevation/icon/radius tokens, Space Grotesk display font, brand-violet fallback seed); canonical `MediaRow`/`MediaCard`/`AppBar`/`SectionHeader`; continue-watching hero replacing the Resume FAB; all rows/cards/headers unified | ✅ merged |
| Visual cohesion 4–5 | Settings split into landing list + Player/Library filters/Hidden folders/About sub-screens (`ListItem`, `useAllVideos`); restrained motion (reduced-motion-aware hero entrance + consistent detail-screen slide) | ✅ merged |
| Long-press context menu | Add to playlist, mark as read directly from list. | 📋 backlog — parked |
| libVLC fallback | Custom Expo native module for exotic codecs (large native effort, parked) | 📋 backlog — parked |
| Player: gesture-arena fix | RNGH `GestureButton` + `requireExternalGestureToFail` so double-tap works with controls showing | 📋 backlog — optional |
| Player: gated resume seek | Gate resume seek on player ready/status event instead of seeking immediately | 📋 backlog — optional |
| Grouping refinements | Number-prefixed siblings, screen-recording bucketing | 📋 backlog — by design |
| Themed error boundary | `SQLiteProvider` fallback (class component can't use `useTheme`) | 📋 backlog — minor |

Tests: **260 passing**, `npx tsc --noEmit` clean.

Plans live in [plans/](./plans/) ([roadmap](./plans/README.md)); 3a/3b specs+plans under [superpowers/](./superpowers/).

---

## 3. What's next

Nothing is in flight. The visual-cohesion overhaul (Phases 1–5) is merged. Next candidates from the backlog rows above:
- **Visual-cohesion follow-ups** (Minor, logged from review): stop `VideoThumbnail`/`ThumbnailCollage` double-rounding inside clipping containers (the radii are currently matched as a workaround); drop the unused `ROW_THUMB` export; route the duration-badge radius through the `RADIUS` scale.
- **Navigation perf** — tap→transition feels slow in dev; group-detail re-derives grouping over the whole library on mount and the player init is heavy. Verify on a release build first; if real, defer heavy mount work past first paint.
- **libVLC fallback** — parked. RN 0.85 is new-arch-only so community VLC libs don't drop in; needs a custom Expo native module (libvlc-android + Fabric view + engine abstraction), adds APK weight, can't be agent-built/verified. Revisit only when there's appetite for a large native effort.
- **Playlist drag-and-drop reorder** — deferred from visual cohesion (needs a draggable-list dep risky on RN 0.85 new-arch + FlashList); swipe-delete + up/down chevrons ship today.
- Player refinements (gesture-arena fix, gated resume seek) are optional polish.

---

## 4. Architecture & gotchas

### Key files
- **Data:** `src/db/` (schema/migrations, videos-repo, progress-repo, settings-repo, progress math), `src/media/` (media-scanner, derive-folder, thumbnails).
- **Grouping engine** (pure, tested): `src/library/normalize-title.ts`, `parse-episode.ts`, `group-videos.ts` (conservative numeric merge), `filter-groups.ts`, `episode-label.ts`.
- **Filters** (pure, tested): `src/library/filter-videos.ts` (length + name-pattern + folder; composed `applyFilters`).
- **Sort** (pure, tested): `src/library/sort-groups.ts` (`sortGroups`, nulls-last).
- **History** (pure, tested): `src/history/bucket-day.ts`, `assemble-history.ts`.
- **Resume** (pure, tested): `src/player/resume-last.ts` (`resolveLastPlayed`).
- **Hooks:** `src/library/use-library.ts` (cache-first + background rescan), `use-groups.ts` (read-only, for detail).
- **Player:** `src/app/player.tsx` + `src/components/player/` (overlay, gestures, lock) + `src/player/` (format-time, resume, playlist `neighbors`, progress-writer, seek, pan).
- **UI:** `src/app/` (index = library, group.tsx, player.tsx, history.tsx, settings.tsx, _layout.tsx = providers + error boundary), `src/components/` (group-card, group-row, episode-row, thumbnail-collage, video-thumbnail, progress-bar, pressable-scale, segmented-tabs, layout-toggle, search-bar, screen, resume-fab), `src/theme/` (Material You provider + token resolver).

### Key facts
- **`AGENTS.md`: Expo HAS CHANGED — read https://docs.expo.dev/versions/v56.0.0/ before writing any SDK code.** Verify against installed `node_modules/<pkg>/build/types/*.d.ts` when docs are thin.
- **Package manager is `bun`** (`bun.lock`). Use `npx expo install` for Expo deps; `bun add` for others. Tests/typecheck: `npm test`, `npx tsc --noEmit`.
- **expo-media-library SDK 56 is class-based**: `new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).orderBy(AssetField.CREATION_TIME).exe()` → `Asset[]`; `await asset.getInfo()` returns metadata in one call; **`duration` is in milliseconds**; `uri` is a `file://` path (folder derived from it). Legacy `getAssetsAsync` is deprecated/throws.
- **`tsconfig.json` sets `types: ["jest","node"]`** — needed for jest globals; disables auto-@types inclusion — add new @types here if a dep needs ambient globals.
- **Typed routes** (`experiments.typedRoutes`): `.expo/types/router.d.ts` is gitignored and regenerated by `expo start`. After adding a new route file, `tsc` may complain until expo regenerates it.
- **Android-only.** `/android`, `/ios`, `.expo/` are gitignored (CNG — regenerated by prebuild/start).
- **Run/build:** `npx expo start` (JS reload, for JS-only changes) or `npx expo run:android` (full rebuild, when native modules change). `npm start`/`npm run android` set `APP_VARIANT=development` for the local dev variant.
- **App config & build variants:** config lives in **`app.config.ts`** (dynamic — no `app.json`). Package id + app name switch on `APP_VARIANT`: dev → `com.jvstuche.fiftythreexy.dev` "53XY (Dev)", preview → `…preview` "53XY (Preview)", prod → `com.jvstuche.fiftythreexy` "53XY". `eas.json` sets `APP_VARIANT` per profile. **Editing the EAS `projectId` must be done by hand** in `app.config.ts` (`extra.eas.projectId`) — `eas init` does NOT auto-edit dynamic configs. Profiles: `development`, `preview` (APK), `production` (AAB), `production-apk` (sideloadable APK). EAS owner `justuche224`, projectId `bfc694a1-7674-4389-a33d-45206bfbe9e8`.
- **FlashList is native** → changes that re-touch it need `npx expo run:android`.

### Player gotchas (learned on-device)
- **`useVideoPlayer({ uri })` recreates the player whenever `uri` changes** (keyed on `JSON.stringify(source)`). Switch videos by changing the `uri` route param (`router.setParams`), NOT `player.replace`; key subscription + resume effects on `[player]` so they re-bind.
- **Flush progress from cached position/duration refs, never `player.currentTime`** — expo-video releases the player before unmount cleanup runs ("Cannot use shared object that was already released").
- **Player chrome must be fixed white**, not theme `onSurface` (near-black on dark video under a light theme); wrap controls in safe-area insets.
- **Library lists refetch progress via `useFocusEffect`**, so resume bars update on return from the player.
- **Volume must use the system stream, not `player.volume`** — ExoPlayer's per-player volume corrupts audio. The local `modules/system-volume` Kotlin module sets `AudioManager.STREAM_MUSIC`. Worklet→JS hops use `scheduleOnRN` (not deprecated `runOnJS`); pure helpers are called on the JS thread, never inside a worklet. **Changes to `modules/system-volume` need `npx expo run:android`.**
- **Chrome buttons overlap the gesture layer** — double-tap gated to controls-hidden as the simpler fix. Proper fix (RNGH gesture arena) is deferred.

---

## 5. How we work

1. **brainstorm** (superpowers:brainstorming) → get design approval → 2. **writing-plans** → bite-sized TDD plan in `docs/plans/` → 3. **subagent-driven-development**: fresh implementer subagent per task + review, then a final whole-branch review (opus) → 4. user does the **native build / device verify** → 5. **finishing-a-development-branch**: merge to `master`, delete branch.
- **Feature branch per plan** (e.g. `feat/foundation`); never implement on `master` directly. Merge when device-verified.
- **Progress ledger** lives at `.git/sdd/progress.md` during execution (recovery map).

### User preferences (IMPORTANT — also in memory)
- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Keep token usage lean:** terse reviewers (verdict + real issues only), lightweight controller checks (`tsc` + tests + commit-clean grep) for transcription tasks instead of full reviewer subagents, cheapest model that fits (haiku for transcription), minimal narration. Don't spin fix loops on speculative/out-of-scope findings — log them and move on.
- **Device/native verification is deferred to the user's own build** (no device available to the agent) — do all code/tests/`tsc`/commits, then hand the user a build command + a checklist. Tell the user up front when a change first *calls* a new native module (it needs a rebuild).

---

## 6. Memory (auto-loaded each session)
- `project-53xy-video-player` — project summary. `keep-token-usage-lean` — the lean-process preference.

---

## 7. Changelog

> Append-only, newest first. One bullet per shipped feature. Keep only the latest ~5 here; archive older entries to [CHANGELOG.md](./CHANGELOG.md).

- **Visual cohesion (design system, Phases 1–5)** — a Material-You-correct "M3 + a signature" overhaul. Foundation: a shared typography ramp + `<AppText>`, M3 tonal `elevation()`/`ICON`/`RADIUS.xl` tokens, the **Space Grotesk** display font, and a brand-violet (`#5E4FA6`) fallback palette seed. Canonical components — `MediaRow`, `MediaCard`, `AppBar`, `SectionHeader`, `ListItem` — replace the per-screen variants (all rows/cards/headers re-based onto them; pill `DurationBadge`; progress woven into the thumbnail). Signatures: a **continue-watching hero** (list header on Home) that replaced the floating Resume FAB, the typographic wordmark, and the progress-in-poster card. Settings split into a landing list + Player / Library filters / Hidden folders / About sub-screens (`useAllVideos`). Restrained motion: reduced-motion-aware hero entrance + consistent `slide_from_right` detail transitions (player exempted). Playlist gained swipe-to-delete (true drag-reorder deferred). Specs/plans under [superpowers/](./superpowers/) (`2026-06-25-visual-cohesion-*`). JS-only except the new font asset (needs a rebuild).
- **Background Play & PiP** — Video plays seamlessly in the background and transitions to Picture-in-Picture automatically when swiping home (requires Android 12+ or iOS). Settings toggles via `SettingSwitch`, backed by SQLite (`useBackgroundPlay`, `usePictureInPicture`). Relies on `expo-video` config plugin for native capabilities. Spec/plan: [background-pip](./superpowers/plans/2026-06-23-background-pip.md).
- **Bottom tab bar** — top nav-icon row replaced by a 4-tab bottom bar (Home/Playlists/History/Settings) via an Expo Router `(tabs)` group. Flat Material You `tabBar` (`src/components/tab-bar.tsx`) flush at the bottom edge with a spring-animated `secondaryContainer` active pill (the floating lift-into-circle variant was tried first but looked detached on device). Detail screens stay full-screen; Home header keeps Sort+Layout only; Resume FAB raised above the bar. Pure `tabIconFor` Jest-tested. JS-only. Spec: [bottom-tab-bar-design](./superpowers/specs/2026-06-23-bottom-tab-bar-design.md).
- **Playlists** — user-created playlists with manual reordering and player integration (`playlistId` param drives next/prev); home-header entry, `ThumbnailCollage` empty-guard, local `uuidv4`. Spec/plan: [playlists-design](./superpowers/specs/2026-06-21-playlists-design.md), [playlists-plan](./superpowers/plans/2026-06-21-playlists.md).
- **Resume FAB** — home-screen "▶ Resume" extended FAB → opens player on most-recent existing video, resumes at position with group next/prev. `resolveLastPlayed` (Jest-tested) skips deleted, FAB hidden when none resolve. Component `src/components/resume-fab.tsx`; wiring in `index.tsx`. JS-only. Spec/plan: [resume-fab-design](./superpowers/specs/2026-06-21-resume-fab-design.md), [resume-fab-plan](./superpowers/plans/2026-06-21-resume-fab.md).
- **Watch History** — YouTube-style `/history` screen reading `watch_progress` ordered by `last_played_at`, joined against library cache, day-bucketed (Today/Yesterday/date), filename search, swipe-remove, clear-all, tap-to-resume. Deleted-media drop + scan-time cascade-prune (`deleteProgressByIds`). Migration v3 indexes `watch_progress(last_played_at)`. Pure `bucket-day`/`assemble-history` Jest-tested. JS-only. Spec/plan: [history-design](./superpowers/specs/2026-06-21-watch-history-design.md), [history-plan](./superpowers/plans/2026-06-21-watch-history.md).
- **app.config.ts + build variants** — `app.json` → dynamic `app.config.ts`; package renamed to `com.jvstuche.fiftythreexy` with per-variant ids (dev/preview/prod side-by-side); `production-apk` EAS profile.

Older entries archived in [CHANGELOG.md](./CHANGELOG.md).
