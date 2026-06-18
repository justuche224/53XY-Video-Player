# 53XY — Handoff / Pick-Up Guide

**Read this first when resuming.** It's the single entry point to continue the project in a fresh chat.

_Last updated: after Plan 3a (the core player) was built, device-verified on the SM-S901N, and merged to `master`._

---

## TL;DR — where we are, what's next
- **53XY** is an Android-first, "best of all worlds" local video player built with **Expo SDK 56 / React Native 0.85**.
- **Done & merged to `master` (all device-verified on the user's SM-S901N):** Foundation, the full Library (data + grouping engine + adaptive UI + polish), **Plan 3a — the core player**, **Plan 3b-i — discrete gestures** (long-press→2×, 3-zone double-tap), and **Plan 3b-ii-a — pan gestures** (vertical-left swipe = brightness via `expo-brightness`; vertical-right = **system media volume via a local Expo native module** `modules/system-volume`; full-screen horizontal drag-scrub with preview+commit; HUDs).
- **Next: Plan 3b-ii-b — lock + the edge-tap fix** (not started): a lock control (hide chrome + ignore gestures), plus the deferred edge-double-tap-while-controls-showing fix (compose chrome buttons into the gesture system).
- **Immediate next action:** brainstorm Plan 3b-ii-b, then spec → plan → subagent-driven build → device verify → merge.
- **NATIVE NOTE:** the player now uses a **local Expo module** (`modules/system-volume`, Kotlin AudioManager `STREAM_MUSIC`) for volume — `player.volume` (ExoPlayer) corrupts audio on-device, so volume goes through the system stream. Any change touching it needs `npx expo run:android` (rebuild), not Fast Refresh. Local modules autolink from `modules/`.
- **Known issue to revisit in 3b-ii-b:** while controls are *showing*, an edge double-tap can also toggle a control on top of skipping. Partially hardened (bar containers `box-none`, chrome `pointerEvents="none"` when hidden); full fix likely needs the chrome buttons composed into the gesture system (RNGH cross-gesture relations).
- **Known issue to revisit in 3b-ii:** while controls are *showing*, an edge double-tap can also toggle a control (perceived play/pause) on top of skipping. Partially hardened (bar containers `box-none`, chrome `pointerEvents="none"` when hidden) but not fully fixed — likely needs the chrome buttons composed into the gesture system (RNGH cross-gesture relations) rather than overlapping RN Pressables.

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
| **Plan 3b-ii-b — Lock + edge-tap fix** | Lock control; fix edge-double-tap-while-controls-showing | ⏳ **not started — do this next** |

Plans live in [plans/](./plans/) ([roadmap](./plans/README.md)); the 3a/3b specs+plans are under [superpowers/](./superpowers/). Tests: **82 passing**, `npx tsc --noEmit` clean.

## Plan 3a — the core player (DONE, merged, device-verified)
`src/app/player.tsx` is now the real player: `expo-video` surface (native controls hidden), a custom Reanimated/gesture-handler **control overlay** (top bar with back/title/tracks/rotate, center play-pause + prev/next, bottom seekbar + time + speed chip), **auto-resume + "Resumed at …" snackbar**, throttled `watch_progress` writes (+ flush on pause/background/unmount via cached refs), **auto-rotate + manual rotate**, keep-awake, **next/prev within the group**, embedded **subtitle/audio track** selection, and **pitch-preserved** speed (`preservesPitch`). Pure logic lives in `src/player/` (format-time, resume, playlist `neighbors`, progress-writer) and is Jest-tested; UI/native is device-verified. Spec + plan: [superpowers/specs/2026-06-18-player-core-3a-design.md](./superpowers/specs/2026-06-18-player-core-3a-design.md), [superpowers/plans/2026-06-18-player-core-3a.md](./superpowers/plans/2026-06-18-player-core-3a.md).

### Key 3a gotchas (learned on-device)
- **`useVideoPlayer({ uri })` recreates the player whenever `uri` changes** (keyed on `JSON.stringify(source)` in `useReleasingSharedObject`). Switch videos by changing the `uri` route param (`router.setParams`), NOT `player.replace`; key the subscription + resume effects on `[player]` so they re-bind to the new instance.
- **Flush progress from cached position/duration refs, never `player.currentTime`** — expo-video releases the player before unmount cleanup runs (else: "Cannot use shared object that was already released").
- **Player chrome must be fixed white**, not theme `onSurface` (near-black on dark video under a light theme); wrap controls in safe-area insets.
- **Library lists refetch progress via `useFocusEffect`**, so resume bars update on return from the player.

## Plan 3b — the gesture layer (what it must do, NOT started)
Layer the signature gestures onto the existing overlay (replace the overlay's plain tap `Pressable` with a gesture detector):
- **Long-press → 2× while held**, **double-tap left/right → seek ∓N s**, **vertical swipe** = brightness (left, `expo-brightness`, installed) / volume (right, **needs a volume approach — likely a new dep + native rebuild**), full-screen horizontal drag = scrub.
- **Lock** control (hide chrome + ignore gesture touches) — deferred from 3a to pair with gestures.
- Optional: bundle **FlashList** if thumbnails should keep pace during a continuous fling.
- Start with a brainstorm: gesture thresholds (long-press delay, double-tap zones, seek seconds), volume dependency, lock behavior. Also a known 3a follow-up: gate the resume seek on the player's ready/status event instead of seeking immediately after creation.

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
