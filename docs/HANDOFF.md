# 53XY — Handoff / Pick-Up Guide

**Read this first when resuming.** It's the single entry point to continue the project in a fresh chat.

_Last updated: after the **app.config.ts + build-variants** migration — moved `app.json` into a dynamic `app.config.ts`, renamed the package off `com.pineappsolutions.x53XY` to **`com.jvstuche.fiftythreexy`** with per-variant ids (dev `.dev` / preview `.preview` / prod base) so all three install side-by-side, and added an EAS `production-apk` profile so prod ships as a sideloadable APK. Merged to `master`. Just before that: the **shared library cache + un-gated playback** perf fix — a root `LibraryProvider` owns one cached `videos` array that `useLibrary`/`useGroups` consume (no per-nav full-table read); the player plays immediately and applies the resume seek async (killed the 3–5s black screen). Prior work: v2 **advanced filters** (length + name-pattern + folder ignore), **library sort options**, the **FlashList migration**, **UI Polish**, **QOL Polish** — all device-verified on the SM-S901N. (libVLC fallback is parked — too big/native to do blind.)_

---

## TL;DR — where we are, what's next
- **53XY** is an Android-first, "best of all worlds" local video player built with **Expo SDK 56 / React Native 0.85**.
- **v1 is COMPLETE** — Foundation, the full Library (data + grouping + adaptive UI + polish), and the whole custom **Player (Plan 3: 3a core + 3b gestures)** are all built, merged to `master`, and device-verified on the user's SM-S901N. The original v1 vision (Foundation → Library → Player) is done.
- **Player capabilities:** `expo-video` playback, custom control overlay, auto-resume + snackbar, progress writes, orientation, keep-awake, next/prev in group, subtitle/audio tracks, pitch-preserved speed; gestures — long-press→2×, 3-zone double-tap (back / play-pause / forward), swipe brightness (left) / system volume (right), horizontal drag-scrub, and lock.
- **v2 in progress — advanced filters:** the **length filter** (first slice) is merged: persistent min/max duration ignore rules, set in Settings (preset chips + custom number/unit dialog + live "Hiding N videos" footer), stored in SQLite settings, exposed via `FilterSettingsProvider`/`useFilterSettings`, applied before grouping in **both** `useLibrary` and `useGroups` (so library, folders, search, group detail, and player prev/next all respect it). Semantics: hide strictly `< min` / `> max`; videos exactly at a threshold or with unknown duration stay. Pure logic (`src/library/filter-videos.ts`) is Jest-tested (10 tests); device-verified. Spec/plan: [superpowers/specs/2026-06-18-library-length-filter-design.md](./superpowers/specs/2026-06-18-library-length-filter-design.md), [superpowers/plans/2026-06-18-library-length-filter.md](./superpowers/plans/2026-06-18-library-length-filter.md).
- **Name-pattern + folder ignore filters merged** (second v2 slice): ignore videos by filename pattern (case-insensitive **substring** or anchored **glob** `*`/`?`) and ignore whole **folders**. Filter model extended to `LibraryFilter`; patterns/folders persisted as JSON arrays in SQLite settings; composed `applyFilters` (length+name+folder) used in both `useLibrary`/`useGroups`. Settings UI: removable pattern list + add field (`NamePatternList`), per-folder switches sourced from the library's folders (`FolderIgnoreList`), shared "Hiding N videos" footer. Pure matchers (`matchesNamePattern`/`applyNameFilter`/`applyFolderFilter`/`applyFilters`) Jest-tested. Spec/plan: [superpowers/specs/2026-06-18-library-name-folder-filters-design.md](./superpowers/specs/2026-06-18-library-name-folder-filters-design.md), [superpowers/plans/2026-06-18-library-name-folder-filters.md](./superpowers/plans/2026-06-18-library-name-folder-filters.md).
- **Library sort options merged:** home screen can sort groups by **name / total length / date added / date modified**, either direction, persisted (`sort.key`/`sort.dir`). Pure `sortGroups` in `src/library/sort-groups.ts` (nulls-last for dates, length sums item durations, title tie-break) runs after `filterGroups` in `index.tsx`; `SortButton` header control opens a `SortSheet`. Jest-tested. Spec/plan: [superpowers/specs/2026-06-18-library-sort-options-design.md](./superpowers/specs/2026-06-18-library-sort-options-design.md), [superpowers/plans/2026-06-18-library-sort-options.md](./superpowers/plans/2026-06-18-library-sort-options.md).
- **FlashList migration merged:** home library (grid+list) and group-detail lists now use `@shopify/flash-list@2.0.2` (v2, new-arch, auto-measuring — no `estimatedItemSize`) for smoother thumbnail fling via cell recycling; dropped the old FlatList tuning props + `LIST_ROW_HEIGHT`. **FlashList is native → changes that re-touch it need `npx expo run:android`.** Spec/plan: [superpowers/specs/2026-06-18-flashlist-migration-design.md](./superpowers/specs/2026-06-18-flashlist-migration-design.md), [superpowers/plans/2026-06-18-flashlist-migration.md](./superpowers/plans/2026-06-18-flashlist-migration.md).
- **UI Polish merged:** Unified icons (`Ionicons` and `MaterialIcons`) replacing placeholder emojis/text across the home screen, player chrome, and settings. Applied properly themed headers to `GroupDetailScreen` and `SettingsScreen` to fix the stark white defaults in dark mode. Added `bounces={true}` and `overScrollMode="always"` to all list views to fix scroll stiffness. Added sleek duration badges overlaid on all video thumbnails (home and group screens). Spec/plan: [superpowers/specs/2026-06-18-ui-polish-design.md](./superpowers/specs/2026-06-18-ui-polish-design.md), [superpowers/plans/2026-06-18-ui-polish.md](./superpowers/plans/2026-06-18-ui-polish.md).
- **QOL Polish merged:** Added a clear button to the search bar, beautiful empty states with icons for library and group views, native Android touch ripples (`android_ripple`) clamped to thumbnail borders, leading icons on the Settings screen, and subtle `expo-haptics` feedback when engaging/releasing 2x speed in the player.
- **Next v2 candidates** (nothing in flight): **playlists**, and the two deferred player refinements below. **libVLC fallback is parked** — RN 0.85 is new-arch-only so community VLC libs don't drop in; it needs a custom Expo native module (libvlc-android + Fabric view + engine abstraction + fallback detection), adds real APK weight, and can't be agent-built/verified. Revisit only when there's appetite for a large, build-heavy native effort.
- **NATIVE NOTE:** the player uses a **local Expo module** (`modules/system-volume`, Kotlin AudioManager `STREAM_MUSIC`) for volume — `player.volume` (ExoPlayer) corrupts audio on-device, so volume goes through the system stream. Changes touching it need `npx expo run:android` (rebuild), not Fast Refresh. Local modules autolink from `modules/`.
- **Deferred player refinements (optional):** (1) double-tap-seek is gated to **controls-hidden** as the simpler fix for the edge-double-tap-toggles-a-control bug; the proper fix is to compose the chrome buttons into one RNGH gesture arena (`GestureButton` + `requireExternalGestureToFail`, via context) so double-tap can work with controls showing — see the 3b-ii-b spec. (2) resume seek currently fires immediately on a fresh/`replace`d player; gate it on the player's ready/status event.

## What this app is (vision)
The full vision is in [00-vision-and-context.md](./00-vision-and-context.md) (the user's original ask verbatim). In short: take the best of VLC + MX Player and fix what they get wrong — smart auto-grouping, folder view, resume + progress, **long-press-to-2×**, double-tap-seek, swipe brightness/volume, advanced filters — with a **beautiful Material You UI** and smooth, satisfying animations. v1 scope = Foundation → Library → Player. Filters/libVLC fallback/playlists are v2.

## Status by plan
| Plan | What | Status |
|---|---|---|
| Foundation | Themed app shell, Material You (follows system), SQLite + migrations, nav skeleton, Jest harness | ✅ merged, device-verified |
| Library 2A | Device scan (media-library class API) → folder/title/episode parsing → grouping engine → SQLite | ✅ merged, device-verified |
| Library 2B | Adaptive grid/list UI, Videos/Folders tabs, search, group detail, thumbnails, player placeholder | ✅ merged, device-verified |
| Library polish | Scroll perf (FlatList tuning, idle-callback thumbnails), cache-first background rescan, grouping refinement (conservative numeric merge), multi-thumbnail collages | ✅ merged, device-verified |
| Plan 3a — Core player | `expo-video` playback, custom overlay, resume+snackbar, progress writes, orientation, keep-awake, next/prev, track select, pitch-preserved speed | ✅ merged, device-verified |
| Plan 3b-i — Discrete gestures | Long-press→2× while held; 3-zone double-tap (left/center/right = back / play-pause / forward) + indicators | ✅ merged, device-verified (one deferred edge-tap issue) |
| Plan 3b-ii-a — Pan gestures | Swipe brightness (left) / system volume (right, local Expo module) / horizontal drag-scrub + HUDs | ✅ merged, device-verified |
| Plan 3b-ii-b — Lock + edge-tap fix | Lock control (tap→reveal→tap unlock); double-tap gated to controls-hidden | ✅ merged, device-verified |
| **v1 complete** | Foundation + Library + Player all shipped | 🎉 |
| v2 — Length filter | Persistent min/max duration ignore rules; Settings UI (chips + custom dialog + hidden-count footer); applied in useLibrary + useGroups | ✅ merged, device-verified |
| v2 — Name + folder filters | Ignore by filename pattern (substring/glob) + ignore folders; LibraryFilter model, JSON-array persistence, composed applyFilters; Settings pattern list + folder switches | ✅ merged, device-verified |
| v2 — Sort options | Home-screen sort by name/length/date-added/date-modified, either direction, persisted; sortGroups + SortButton/SortSheet | ✅ merged, device-verified |
| v2 — FlashList | Library (grid+list) + group-detail lists on @shopify/flash-list v2 for fling perf; native dep (rebuild to verify) | ✅ merged, device-verified |
| v2 — UI Polish | Unified Ionicons/MaterialIcons across the app, themed headers for Settings/Group, scroll overscroll/bounces for all lists, duration badges on thumbnails | ✅ merged, device-verified |
| v2 — QOL Polish | Search clear button, premium empty states, native android ripples, Settings screen icons, Player 2x haptics | ✅ merged, device-verified |
| Perf — Shared library cache | Root `LibraryProvider` owns one cached `videos` array; `useLibrary`/`useGroups` are thin consumers (no per-nav `SELECT * FROM videos`); player plays immediately + resume seek async (kills 3–5s black screen); group empty-state gated on loading | ✅ merged |
| Config — app.config.ts + variants | `app.json` → dynamic `app.config.ts`; package renamed to `com.jvstuche.fiftythreexy` with `APP_VARIANT` dev/preview/prod ids; `eas.json` env per profile + `production-apk` profile; scheme `fiftythreexy` | ✅ merged |

Plans live in [plans/](./plans/) ([roadmap](./plans/README.md)); the 3a/3b specs+plans are under [superpowers/](./superpowers/). Tests: **82 passing**, `npx tsc --noEmit` clean.

## Plan 3a — the core player (DONE, merged, device-verified)
`src/app/player.tsx` is now the real player: `expo-video` surface (native controls hidden), a custom Reanimated/gesture-handler **control overlay** (top bar with back/title/tracks/rotate, center play-pause + prev/next, bottom seekbar + time + speed chip), **auto-resume + "Resumed at …" snackbar**, throttled `watch_progress` writes (+ flush on pause/background/unmount via cached refs), **auto-rotate + manual rotate**, keep-awake, **next/prev within the group**, embedded **subtitle/audio track** selection, and **pitch-preserved** speed (`preservesPitch`). Pure logic lives in `src/player/` (format-time, resume, playlist `neighbors`, progress-writer) and is Jest-tested; UI/native is device-verified. Spec + plan: [superpowers/specs/2026-06-18-player-core-3a-design.md](./superpowers/specs/2026-06-18-player-core-3a-design.md), [superpowers/plans/2026-06-18-player-core-3a.md](./superpowers/plans/2026-06-18-player-core-3a.md).

### Key 3a gotchas (learned on-device)
- **`useVideoPlayer({ uri })` recreates the player whenever `uri` changes** (keyed on `JSON.stringify(source)` in `useReleasingSharedObject`). Switch videos by changing the `uri` route param (`router.setParams`), NOT `player.replace`; key the subscription + resume effects on `[player]` so they re-bind to the new instance.
- **Flush progress from cached position/duration refs, never `player.currentTime`** — expo-video releases the player before unmount cleanup runs (else: "Cannot use shared object that was already released").
- **Player chrome must be fixed white**, not theme `onSurface` (near-black on dark video under a light theme); wrap controls in safe-area insets.
- **Library lists refetch progress via `useFocusEffect`**, so resume bars update on return from the player.

## Plan 3b — the gesture layer (DONE, merged, device-verified)
Composed gesture layer (`src/components/player/player-gestures.tsx`) over the overlay, built in three sub-plans (specs/plans under [superpowers/](./superpowers/)):
- **3b-i (discrete):** long-press → **2× while held**; **3-zone double-tap** (left = −10s, center = play/pause, right = +10s) with indicators. Pure helpers `src/player/seek.ts` (`seekTarget`, `tapZone`) Jest-tested.
- **3b-ii-a (pan):** vertical-left swipe = **brightness** (`expo-brightness`, restored on exit); vertical-right = **system media volume** via the local Expo module `modules/system-volume`; full-screen horizontal **drag-scrub** (preview + commit on release); HUDs; axis-lock; `VERTICAL_GAIN` sensitivity. Pure helpers `src/player/pan.ts` Jest-tested.
- **3b-ii-b (lock + edge-fix):** **lock** control (`lock-overlay.tsx`, tap→reveal→tap to unlock); double-tap **gated to controls-hidden** to stop the edge-double-tap-toggles-a-control bug.

### Key 3b gotchas (learned on-device)
- **Volume must use the system stream, not `player.volume`** — ExoPlayer's per-player volume corrupts audio on-device. The local `modules/system-volume` Kotlin module sets `AudioManager.STREAM_MUSIC`. Worklet→JS hops use `scheduleOnRN` (not deprecated `runOnJS`); pure helpers are called on the JS thread, never inside a worklet.
- **Chrome buttons (RN `Pressable`) overlap the gesture layer**, so a double-tap could also fire a control. Current fix gates double-tap to controls-hidden; the proper fix (RNGH gesture arena: `GestureButton` + `requireExternalGestureToFail`, via context) is **deferred** — see the 3b-ii-b spec.

### Deferred player refinements (optional, for whenever)
- RNGH gesture-arena fix so double-tap works *while controls are showing* (see above).
- Gate the **resume seek** on the player's ready/status event instead of seeking immediately after a fresh/`replace`d player.
- Optional **FlashList** for thumbnail fling perf.

## How we work (process — keep doing this)
1. **brainstorm** (superpowers:brainstorming) → get design approval → 2. **writing-plans** → bite-sized TDD plan in `docs/plans/` → 3. **subagent-driven-development**: fresh implementer subagent per task + review, then a final whole-branch review (opus) → 4. user does the **native build / device verify** → 5. **finishing-a-development-branch**: merge to `master`, delete branch.
- **Feature branch per plan** (e.g. `feat/foundation`); never implement on `master` directly. Merge when device-verified.
- **Progress ledger** lives at `.git/sdd/progress.md` during execution (recovery map).

### User preferences (IMPORTANT — also in memory)
- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Keep token usage lean:** terse reviewers (verdict + real issues only), lightweight controller checks (`tsc` + tests + commit-clean grep) for transcription tasks instead of full reviewer subagents, cheapest model that fits (haiku for transcription), minimal narration. Don't spin fix loops on speculative/out-of-scope findings — log them and move on.
- **Device/native verification is deferred to the user's own build** (no device available to the agent) — do all code/tests/`tsc`/commits, then hand the user a build command + a checklist. Tell the user up front when a change first *calls* a new native module (it needs a rebuild).

## Key facts & gotchas
- **`AGENTS.md`: Expo HAS CHANGED — read https://docs.expo.dev/versions/v56.0.0/ before writing any SDK code.** Verify against installed `node_modules/<pkg>/build/types/*.d.ts` when docs are thin.
- **Package manager is `bun`** (`bun.lock`). Use `npx expo install` for Expo deps; `bun add` for others. Tests/typecheck: `npm test`, `npx tsc --noEmit`.
- **expo-media-library SDK 56 is class-based**: `new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).orderBy(AssetField.CREATION_TIME).exe()` → `Asset[]`; `await asset.getInfo()` returns metadata in one call; **`duration` is in milliseconds**; `uri` is a `file://` path (folder derived from it). Legacy `getAssetsAsync` is deprecated/throws.
- **`tsconfig.json` sets `types: ["jest","node"]`** (needed for jest globals; disables auto-@types inclusion — add new @types here if a dep needs ambient globals).
- **Typed routes** (`experiments.typedRoutes`): `.expo/types/router.d.ts` is gitignored and regenerated by `expo start`. After adding a new route file, `tsc` may complain until expo regenerates it (the user's reload handles it).
- **Android-only.** `/android`, `/ios`, `.expo/` are gitignored (CNG — regenerated by prebuild/start).
- **Run/build:** `npx expo start` (JS reload, for JS-only changes) or `npx expo run:android` (full rebuild, when native modules change). The user runs these. `npm start`/`npm run android` set `APP_VARIANT=development` for the local dev variant.
- **App config & build variants:** config lives in **`app.config.ts`** (dynamic — there is no `app.json`). Package id + app name switch on `process.env.APP_VARIANT`: dev → `com.jvstuche.fiftythreexy.dev` "53XY (Dev)", preview → `…preview` "53XY (Preview)", prod → `com.jvstuche.fiftythreexy` "53XY" — so all three install side-by-side. `eas.json` sets `APP_VARIANT` per build profile. **Editing the EAS `projectId` must be done by hand** in `app.config.ts` (`extra.eas.projectId`) — `eas init`/CLI does **not** auto-edit dynamic configs. Profiles: `development`, `preview` (APK), `production` (AAB, for Play Store), `production-apk` (extends production → sideloadable APK). EAS owner `justuche224`, projectId `bfc694a1-7674-4389-a33d-45206bfbe9e8`.

## Key files (orientation)
- Data: `src/db/` (schema/migrations, videos-repo, progress-repo, settings-repo, progress math), `src/media/` (media-scanner, derive-folder, thumbnails).
- Grouping engine (pure, tested): `src/library/normalize-title.ts`, `parse-episode.ts`, `group-videos.ts` (incl. conservative numeric merge), `filter-groups.ts`, `episode-label.ts`.
- Hooks: `src/library/use-library.ts` (cache-first + background rescan), `use-groups.ts` (read-only, for detail).
- UI: `src/app/` (index = library, group.tsx = detail, player.tsx = placeholder, settings.tsx, _layout.tsx = providers + error boundary), `src/components/` (group-card, group-row, episode-row, thumbnail-collage, video-thumbnail, progress-bar, pressable-scale, segmented-tabs, layout-toggle, search-bar, screen), `src/theme/` (Material You provider + token resolver).

## Deferred / backlog (not blocking)
- Grouping: number-prefixed siblings with no clean anchor stay split (conservative, by design); screen-recording bucketing. See [grouping-refinement-backlog.md](./grouping-refinement-backlog.md).
- `SQLiteProvider`/error-boundary themed fallback (class component can't use `useTheme`).
- `videos.size_bytes` unused until v2 filters; thumbnail frame-time tuning; FlashList (with Plan 3 rebuild).
- v2 features: advanced filters (ignore by length/name, folder-only), libVLC fallback for exotic codecs, playlists.

## Memory (auto-loaded each session)
- `project-53xy-video-player` — project summary. `keep-token-usage-lean` — the lean-process preference.
