# 53XY — Handoff / Pick-Up Guide

**Read this first when resuming.** It's the single entry point to continue the project in a fresh chat.

_Last updated: after the library was completed, polished, and merged to `master` (commit `80cd8bc`)._

---

## TL;DR — where we are, what's next
- **53XY** is an Android-first, "best of all worlds" local video player built with **Expo SDK 56 / React Native 0.85**.
- **Done & merged to `master` (all device-verified on the user's SM-S901N):** Foundation, the full Library (data + grouping engine + adaptive UI), and a round of polish (scroll perf, cache-first background rescan, grouping refinement, multi-thumbnail collages).
- **Next big piece: Plan 3 — the custom player** (not started). It needs a native rebuild and should start with a short brainstorm on gesture/control specifics.
- **Immediate next action:** brainstorm Plan 3 (the player), then spec → plan → subagent-driven build → device verify → merge.

## What this app is (vision)
The full vision is in [00-vision-and-context.md](./00-vision-and-context.md) (the user's original ask verbatim). In short: take the best of VLC + MX Player and fix what they get wrong — smart auto-grouping, folder view, resume + progress, **long-press-to-2×**, double-tap-seek, swipe brightness/volume, advanced filters — with a **beautiful Material You UI** and smooth, satisfying animations. v1 scope = Foundation → Library → Player. Filters/libVLC fallback/playlists are v2.

## Status by plan
| Plan | What | Status |
|---|---|---|
| Foundation | Themed app shell, Material You (follows system), SQLite + migrations, nav skeleton, Jest harness | ✅ merged, device-verified |
| Library 2A | Device scan (media-library class API) → folder/title/episode parsing → grouping engine → SQLite | ✅ merged, device-verified |
| Library 2B | Adaptive grid/list UI, Videos/Folders tabs, search, group detail, thumbnails, player placeholder | ✅ merged, device-verified |
| Library polish | Scroll perf (FlatList tuning, idle-callback thumbnails), cache-first background rescan, grouping refinement (conservative numeric merge), multi-thumbnail collages | ✅ merged, device-verified |
| **Plan 3 — Player** | Custom `expo-video` gesture player | ⏳ **not started — do this next** |

Plans live in [plans/](./plans/) ([roadmap](./plans/README.md)). Tests: **55 passing**, `npx tsc --noEmit` clean.

## Plan 3 — the player (what it must do)
Replace the placeholder route `src/app/player.tsx` (currently receives `videoId`/`uri`/`title` params) with the real player:
- `expo-video` (ExoPlayer) surface, native controls hidden, **custom gesture overlay** (Reanimated + gesture-handler, both installed).
- **Long-press → 2× while held**, **double-tap left/right → seek ∓N s**, **vertical swipe** = brightness (left, `expo-brightness`, installed) / volume (right, needs a volume approach — likely a new dep → part of the rebuild), horizontal drag = scrub, single tap = toggle controls.
- Controls: play/pause, seekbar, speed, lock, rotate, **next/prev within the group**, basic subtitle/audio track.
- **Writes `watch_progress`** (position_ms, percent via `computeProgressPercent`, last_played_at) → this lights up the resume progress bars already wired into the library.
- **Needs a native rebuild** (first real `expo-video` playback + brightness/volume). Bundle **FlashList** into this rebuild IF the user wants thumbnails to keep pace during a continuous fling (optional).
- Start with a brainstorm: control layout, gesture thresholds (long-press delay, double-tap zones, seek seconds), volume approach, lock behavior.

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
- **Run/build:** `npx expo start` (JS reload, for JS-only changes) or `npx expo run:android` (full rebuild, when native modules change). The user runs these.

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
