# 53XY Implementation Roadmap (v1)

v1 is built as **three sequential plans**, each producing working, runnable software.
Execute in order — later plans consume interfaces produced by earlier ones.

See [../2026-06-17-video-player-v1-design.md](../2026-06-17-video-player-v1-design.md)
for the approved design and [../00-vision-and-context.md](../00-vision-and-context.md)
for the vision.

| # | Plan | Delivers (runnable result) | Status |
|---|------|----------------------------|--------|
| 1 | [2026-06-17-foundation.md](./2026-06-17-foundation.md) | App boots as a custom dev build: Material You theme (follows system light/dark), initialized SQLite DB, navigation skeleton with empty themed screens, Jest test harness green. | ✅ Code-complete on `feat/foundation` (10/10 tests, tsc clean, whole-branch review passed); **on-device verification pending user's native build** |
| 2 | `2026-06-XX-library.md` (TBD) | Device video scan → grouping engine → adaptive grid/list library, Folders tab, group-detail screen, thumbnails, resume badges, search. | Not written |
| 3 | `2026-06-XX-player.md` (TBD) | Custom `expo-video` player: long-press-2×, double-tap-seek, swipe brightness/volume, scrub, custom controls, auto-resume, next/prev in group. | Not written |

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
