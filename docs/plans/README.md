# 53XY Implementation Roadmap (v1)

v1 is built as **three sequential plans**, each producing working, runnable software.
Execute in order — later plans consume interfaces produced by earlier ones.

See [../2026-06-17-video-player-v1-design.md](../2026-06-17-video-player-v1-design.md)
for the approved design and [../00-vision-and-context.md](../00-vision-and-context.md)
for the vision.

| # | Plan | Delivers (runnable result) | Status |
|---|------|----------------------------|--------|
| 1 | [2026-06-17-foundation.md](./2026-06-17-foundation.md) | App boots as a custom dev build: Material You theme (follows system light/dark), initialized SQLite DB, navigation skeleton with empty themed screens, Jest test harness green. | ✅ Code-complete on `feat/foundation` (10/10 tests, tsc clean, whole-branch review passed); ✅ device-verified on device (SM-S901N): boots, Material You, light/dark, nav, DB init all confirmed |
| 2A | [2026-06-17-library-a-data-grouping.md](./2026-06-17-library-a-data-grouping.md) | Device video scan (media-library class API) → folder-derivation, title-normalization, episode-parsing, grouping engine → SQLite upsert; migration transaction + error boundary; proven by unit tests + an on-device debug list. | ✅ Merged to master; device-verified (scan+group+persist work; grouping refinement backlogged) |
| 2B | [2026-06-17-library-b-ui.md](./2026-06-17-library-b-ui.md) | Adaptive grid/list library, Videos/Folders segmented tabs, search, group-detail screen, thumbnails (expo-video-thumbnails + expo-image), resume badges, animations. | ✅ Merged to master (45 tests, tsc clean, whole-branch review passed); device verify pending reload |
| 3a | [../superpowers/plans/2026-06-18-player-core-3a.md](../superpowers/plans/2026-06-18-player-core-3a.md) | Core `expo-video` player: custom control overlay, auto-resume + snackbar, progress writing, orientation, keep-awake, next/prev in group, embedded subtitle/audio tracks, pitch-preserved speed. | ✅ Merged to master (68 tests, tsc clean, whole-branch review passed); device-verified on SM-S901N |
| 3b | `2026-06-XX-player-gestures.md` (TBD) | Signature gesture layer on the 3a overlay: long-press-2×, double-tap-seek, swipe brightness/volume, full-screen drag-scrub, lock. | Not written |

> **Library split rationale:** the library subsystem is large, so it's two plans — 2A builds the testable data/grouping engine, 2B builds the UI on top. The `expo-media-library` API changed substantially in SDK 56 (class-based `Query`/`Asset`; `getAssetsAsync` deprecated); `Asset.getInfo()` returns metadata in one call and `duration` is in **milliseconds**.

## Testing reality (read before executing)
This is a native app. We split code so the **pure logic** (filename normalizer,
grouping, progress math, theme-token resolution, settings serialization) is
extracted into plain TypeScript modules and covered by **real Jest unit tests**.
Code that depends on native modules or a device (the SQLite engine itself,
`expo-media-library` scanning, `expo-video` playback, gesture/brightness behavior)
is verified via explicit **on-device manual checklists** included in each task.
Plans never pretend a device-only behavior is unit-tested.

## Carry-forward into the Library plan (from Foundation review)
- Add a `SQLiteProvider` error fallback / `onError` — a thrown `onInit`/migration error currently shows a blank screen.
- Wrap each migration's `up` + `user_version` bump in a transaction (harmless for v1's single idempotent migration; matters once v2 ships data transforms).
- Tighten `Material3Scheme` from `Record<string,string>` to a named-color-key union when the palette stabilizes (the current `as unknown as Material3Theme` cast lets a bad key resolve to `undefined` at runtime instead of a compile error).

## Build reality
Native modules require a **custom dev build** (`npx expo prebuild` + `npx expo run:android`
or an EAS dev build), not Expo Go. Per `AGENTS.md`, always read
https://docs.expo.dev/versions/v56.0.0/ before writing code against an SDK.
