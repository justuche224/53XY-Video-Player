# Plan 3a — Core Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `src/app/player.tsx` with a real `expo-video` player that resumes, writes progress, rotates, keeps the screen awake, walks next/prev within a group, and selects embedded subtitle/audio tracks — all behind a custom control overlay.

**Architecture:** Pure, unit-tested logic lives in `src/player/` (time formatting, resume decision, playlist neighbors, progress-write decision). The screen (`src/app/player.tsx`) owns the `useVideoPlayer` instance and lifecycle (resume, throttled progress writes, orientation, keep-awake). Presentational overlay pieces live in `src/components/player/`. The signature gesture layer is **Plan 3b** and is out of scope here.

**Tech Stack:** Expo SDK 56, React Native 0.85, `expo-video`, `expo-screen-orientation` (new), `expo-keep-awake` (new), `react-native-reanimated` + `react-native-gesture-handler` (installed, for the seekbar), `expo-sqlite`, Jest + jest-expo.

## Global Constraints

- **Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code** (AGENTS.md). When docs are thin, verify against `node_modules/<pkg>/build/**/*.d.ts`.
- **Android-only.** `/android`, `/ios`, `.expo/` are gitignored (CNG).
- **Package manager `bun`**; install Expo deps with `npx expo install`. Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **Commits: plain conventional commits — NO `Co-Authored-By:` and NO "Generated with…" trailer.**
- **Codebase test convention:** pure logic → Jest; SQL/UI/native → `tsc` + device checklist (no SQLite in unit tests). Do not add a SQLite test harness.
- **`expo-video` API (verified in `VideoPlayer.types.d.ts`):** `useVideoPlayer(source)`; `player.currentTime` (seconds, read/write seek), `player.duration` (seconds), `player.playing`, `player.play()`, `player.pause()`, `player.playbackRate`, `player.seekBy(s)`, `player.replace(source)`, `availableSubtitleTracks`/`subtitleTrack`, `availableAudioTracks`/`audioTrack`. `<VideoView player nativeControls={false} contentFit="contain" />`.
- **`watch_progress` columns:** `video_id, position_ms, percent, completed, last_played_at`.
- **Theme:** `useTheme()` from `@/theme/theme-provider` returns `{ colors, spacing }`. Reuse existing `@/components/pressable-scale` for tappable controls. Match existing component style (see `src/components/episode-row.tsx`).
- **Currency:** durations from `watch_progress`/repo are **milliseconds**; `expo-video` time is **seconds**. Convert at the boundary.

---

### Task 1: Pure player helpers

**Files:**
- Create: `src/player/format-time.ts`
- Create: `src/player/resume.ts`
- Create: `src/player/playlist.ts`
- Test: `src/player/__tests__/format-time.test.ts`, `resume.test.ts`, `playlist.test.ts`

**Interfaces:**
- Consumes: `isCompleted` from `@/db/progress`.
- Produces:
  - `formatTime(totalSeconds: number): string` — `m:ss` when <1h, `h:mm:ss` when ≥1h; negative/NaN → `0:00`.
  - `shouldResume(positionMs: number, percent: number): boolean` — true when `positionMs > 5000` and `!isCompleted(percent)`.
  - `neighbors<T extends { id: string }>(items: T[], currentId: string): { prev: T | null; next: T | null; index: number }` — index `-1` and both null when not found.

- [ ] **Step 1: Write failing tests**

```ts
// src/player/__tests__/format-time.test.ts
import { formatTime } from '../format-time';
describe('formatTime', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(754)).toBe('12:34');
  });
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });
  it('clamps bad input to 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});
```

```ts
// src/player/__tests__/resume.test.ts
import { shouldResume } from '../resume';
describe('shouldResume', () => {
  it('resumes mid-video past the 5s floor', () => {
    expect(shouldResume(30_000, 0.25)).toBe(true);
  });
  it('does not resume within the first 5s', () => {
    expect(shouldResume(4_000, 0.01)).toBe(false);
  });
  it('does not resume a finished video', () => {
    expect(shouldResume(600_000, 0.98)).toBe(false);
  });
});
```

```ts
// src/player/__tests__/playlist.test.ts
import { neighbors } from '../playlist';
const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
describe('neighbors', () => {
  it('returns prev/next around the current item', () => {
    expect(neighbors(items, 'b')).toEqual({ prev: { id: 'a' }, next: { id: 'c' }, index: 1 });
  });
  it('nulls prev at the start and next at the end', () => {
    expect(neighbors(items, 'a').prev).toBeNull();
    expect(neighbors(items, 'c').next).toBeNull();
  });
  it('returns index -1 and null neighbors when absent', () => {
    expect(neighbors(items, 'z')).toEqual({ prev: null, next: null, index: -1 });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail** — `npm test -- src/player` → FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// src/player/format-time.ts
export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
```

```ts
// src/player/resume.ts
import { isCompleted } from '@/db/progress';
const RESUME_FLOOR_MS = 5_000;
export function shouldResume(positionMs: number, percent: number): boolean {
  return positionMs > RESUME_FLOOR_MS && !isCompleted(percent);
}
```

```ts
// src/player/playlist.ts
export function neighbors<T extends { id: string }>(
  items: T[],
  currentId: string,
): { prev: T | null; next: T | null; index: number } {
  const index = items.findIndex((it) => it.id === currentId);
  if (index === -1) return { prev: null, next: null, index: -1 };
  return {
    prev: index > 0 ? items[index - 1] : null,
    next: index < items.length - 1 ? items[index + 1] : null,
    index,
  };
}
```

- [ ] **Step 4: Run tests** — `npm test -- src/player` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/player
git commit -m "feat(player): pure helpers for time, resume, playlist neighbors"
```

---

### Task 2: Progress writing (decision + DB writer)

**Files:**
- Create: `src/player/progress-writer.ts`
- Test: `src/player/__tests__/progress-writer.test.ts`
- Modify: `src/db/progress-repo.ts` (add `upsertProgress`)

**Interfaces:**
- Consumes: `computeProgressPercent`, `isCompleted` from `@/db/progress`; `SQLiteDatabase` from `expo-sqlite`.
- Produces:
  - `buildProgress(positionMs: number, durationMs: number | null, nowMs: number): ProgressWrite` where `ProgressWrite = { positionMs: number; percent: number; completed: boolean; lastPlayedAt: number }`. `percent` via `computeProgressPercent`; `completed` via `isCompleted`.
  - `shouldWrite(lastWriteMs: number, nowMs: number, intervalMs?: number): boolean` — true when `nowMs - lastWriteMs >= intervalMs` (default `5000`).
  - `upsertProgress(db, videoId: string, w: ProgressWrite): Promise<void>` in `progress-repo.ts`.

- [ ] **Step 1: Write failing test** (pure pieces only — SQL is device-verified per convention)

```ts
// src/player/__tests__/progress-writer.test.ts
import { buildProgress, shouldWrite } from '../progress-writer';
describe('buildProgress', () => {
  it('computes percent and completion from position/duration', () => {
    expect(buildProgress(30_000, 120_000, 111)).toEqual({
      positionMs: 30_000, percent: 0.25, completed: false, lastPlayedAt: 111,
    });
  });
  it('marks completed past the 95% threshold', () => {
    expect(buildProgress(98_000, 100_000, 5).completed).toBe(true);
  });
  it('yields percent 0 when duration is unknown', () => {
    expect(buildProgress(30_000, null, 5).percent).toBe(0);
  });
});
describe('shouldWrite', () => {
  it('throttles writes to the interval', () => {
    expect(shouldWrite(0, 4_999)).toBe(false);
    expect(shouldWrite(0, 5_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npm test -- progress-writer` → FAIL.

- [ ] **Step 3: Implement the pure module**

```ts
// src/player/progress-writer.ts
import { computeProgressPercent, isCompleted } from '@/db/progress';
export interface ProgressWrite {
  positionMs: number;
  percent: number;
  completed: boolean;
  lastPlayedAt: number;
}
const WRITE_INTERVAL_MS = 5_000;
export function buildProgress(
  positionMs: number,
  durationMs: number | null,
  nowMs: number,
): ProgressWrite {
  const percent = computeProgressPercent(positionMs, durationMs);
  return { positionMs, percent, completed: isCompleted(percent), lastPlayedAt: nowMs };
}
export function shouldWrite(lastWriteMs: number, nowMs: number, intervalMs = WRITE_INTERVAL_MS): boolean {
  return nowMs - lastWriteMs >= intervalMs;
}
```

- [ ] **Step 4: Add the DB writer** in `src/db/progress-repo.ts` (append; keep existing `getProgressMap`)

```ts
import type { ProgressWrite } from '@/player/progress-writer';

export async function upsertProgress(
  db: SQLiteDatabase,
  videoId: string,
  w: ProgressWrite,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO watch_progress (video_id, position_ms, percent, completed, last_played_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET
       position_ms = excluded.position_ms,
       percent = excluded.percent,
       completed = excluded.completed,
       last_played_at = excluded.last_played_at`,
    [videoId, w.positionMs, w.percent, w.completed ? 1 : 0, w.lastPlayedAt],
  );
}
```

- [ ] **Step 5: Verify & commit** — `npm test -- progress-writer` → PASS; `npx tsc --noEmit` → clean.

```bash
git add src/player/progress-writer.ts src/player/__tests__/progress-writer.test.ts src/db/progress-repo.ts
git commit -m "feat(player): progress write decision + upsertProgress writer"
```

---

### Task 3: Player screen — playback, resume, progress, keep-awake

Replaces the placeholder. **No overlay yet** (Task 4) — temporarily show native controls so the screen is verifiable on its own. Device-verified (no Jest); gate on `tsc` + the checklist.

**Files:**
- Modify: `src/app/player.tsx` (full rewrite)
- Install: `npx expo install expo-screen-orientation expo-keep-awake`

**Interfaces:**
- Consumes: route params `{ videoId, uri, title }` (existing); `useVideoPlayer`/`VideoView` from `expo-video`; `getProgressMap`, `upsertProgress` from `@/db`; `buildProgress`, `shouldWrite`, `shouldResume` from `@/player`; `useSQLiteContext`.
- Produces: a working player route. Later tasks add the overlay (Task 4) and next/prev + tracks + rotate (Task 5).

**Behavior contract:**
1. Create the player: `const player = useVideoPlayer({ uri }, (p) => { p.timeUpdateEventInterval = 1; })`. Render `<VideoView style={StyleSheet.absoluteFill} player={player} nativeControls contentFit="contain" />` (temporary `nativeControls`). Wrap in `<View>` with black background, `<Stack.Screen options={{ headerShown: false }} />`, hide the status bar (`expo-status-bar` `hidden`, already a dep — verify).
2. **Resume:** on mount read the saved entry: `const map = await getProgressMap(db); const saved = map.get(videoId)`. If `saved && shouldResume(saved.positionMs, saved.percent)`, set `player.currentTime = saved.positionMs / 1000` before/at play. Then `player.play()`. (Snackbar UI is Task 4 — for now just resume.)
3. **Progress writes:** subscribe to playback time. Keep a `lastWriteRef`. On each tick while `player.playing`, if `shouldWrite(lastWriteRef.current, Date.now())`, call `upsertProgress(db, videoId, buildProgress(player.currentTime * 1000, player.duration ? player.duration * 1000 : null, Date.now()))` and set `lastWriteRef`. Use the player's `timeUpdate` event (`player.addListener('timeUpdate', …)`) — **verify the exact event name/payload in `VideoPlayerEvents.types.d.ts`**; fall back to a `setInterval(1000)` polling `player.currentTime` if the event API differs.
4. **Flush on exit:** write once more (unthrottled) on pause, on `AppState` background, and on unmount — so progress is never lost. Use `useFocusEffect`/`useEffect` cleanup + an `AppState` listener.
5. **Keep-awake:** `useKeepAwake()` from `expo-keep-awake` (simplest — keeps awake for the screen's lifetime; acceptable for v1).

- [ ] **Step 1:** Install deps: `npx expo install expo-screen-orientation expo-keep-awake`. Confirm they land in `package.json`.
- [ ] **Step 2:** Read the verified API surface — skim `node_modules/expo-video/build/VideoPlayerEvents.types.d.ts` and `useVideoPlayer.d.ts` to confirm the time-update event name and `timeUpdateEventInterval`.
- [ ] **Step 3:** Rewrite `src/app/player.tsx` per the behavior contract above. Convert ms↔s at every boundary. Import the pure helpers; do **not** reimplement percent/resume logic inline.
- [ ] **Step 4:** `npx tsc --noEmit` → clean. `npm test` → all green (Tasks 1–2 added the new pure tests to the prior 55; no UI tests here).
- [ ] **Step 5: Commit**

```bash
git add src/app/player.tsx package.json bun.lock
git commit -m "feat(player): real expo-video playback with resume, progress writes, keep-awake"
```

**Device checklist (user, after a native rebuild — `npx expo run:android`):** video plays; a partially-watched item resumes near where you left off; a finished item starts at 0; backing out and reopening shows an updated library progress bar; screen does not dim during playback.

---

### Task 4: Control overlay

Custom overlay replacing `nativeControls`. Presentational pieces in `src/components/player/`, wired by `player.tsx`. Device-verified; gate on `tsc` + checklist.

**Files:**
- Create: `src/components/player/controls-overlay.tsx` — auto-hide container; a `Pressable` (full-bleed, `StyleSheet.absoluteFill`) toggles visibility; auto-hides after 3s while playing; animate opacity with Reanimated. (3b replaces this `Pressable` with the gesture detector.)
- Create: `src/components/player/top-bar.tsx` — back button (`router.back()`) + centered `title` (props: `{ title, onBack }`). Leave room for rotate/tracks buttons added in Task 5 (accept optional `right?: ReactNode`).
- Create: `src/components/player/center-controls.tsx` — play/pause button (props: `{ playing, onToggle }`); leave slots for prev/next (optional `onPrev?`, `onNext?`, `hasPrev?`, `hasNext?` — rendered disabled/hidden when absent, used in Task 5).
- Create: `src/components/player/bottom-bar.tsx` — `seekbar` + `formatTime(position)` / `formatTime(duration)` labels + a speed chip (cycles `1× → 1.5× → 2× → 0.5× → 1×`; props `{ rate, onCycleRate }`).
- Create: `src/components/player/seekbar.tsx` — Reanimated + gesture-handler draggable scrubber. Props `{ positionSec, durationSec, onSeek(sec) }`. While dragging, show the dragged value and suppress incoming position updates; commit `onSeek` on release. **No new dependency.**
- Modify: `src/app/player.tsx` — drop `nativeControls`, render `<VideoView … nativeControls={false} />` with `<ControlsOverlay>` on top; lift play/pause, rate, and seek handlers (`player.currentTime = sec`) into the screen.

**Interfaces:**
- Consumes: `formatTime` from `@/player/format-time`; `useTheme`; `@/components/pressable-scale`.
- Produces: overlay components consumed only by `player.tsx`.

**Behavior contract:**
- Tap toggles controls; controls auto-hide after 3s of no interaction while playing; stay visible while paused.
- Play/pause reflects `player.playing` and calls `player.play()`/`player.pause()`.
- Seekbar drag sets `player.currentTime`; the bar tracks `player.currentTime`/`player.duration` when not dragging.
- Speed chip sets `player.playbackRate` through the cycle above.

- [ ] **Step 1:** Build the five components above, matching existing component style (`useTheme` tokens, `pressable-scale`). Keep each file focused.
- [ ] **Step 2:** Wire them into `player.tsx`; switch to `nativeControls={false}`.
- [ ] **Step 3:** `npx tsc --noEmit` → clean; `npm test` → unchanged (no new tests this task).
- [ ] **Step 4: Commit**

```bash
git add src/components/player src/app/player.tsx
git commit -m "feat(player): custom control overlay (play/pause, seekbar, speed, auto-hide)"
```

**Device checklist:** tap shows/hides controls; controls auto-hide while playing; play/pause works; dragging the seekbar scrubs and the time labels update; speed chip changes playback speed audibly.

---

### Task 5: Next/prev, tracks, rotate + route wiring

Adds the group sequence, the tracks menu, the rotate button, and the resume snackbar.

**Files:**
- Modify: `src/app/group.tsx` — pass `groupKey` + `mode` into the player route.
- Modify: `src/app/player.tsx` — accept optional `{ groupKey?, mode? }`; derive prev/next; add rotate + tracks + snackbar.
- Create: `src/components/player/tracks-sheet.tsx` — lists `availableSubtitleTracks` (+ an "Off" row) and `availableAudioTracks`; selecting sets `player.subtitleTrack` / `player.audioTrack`.
- Create: `src/components/player/resume-snackbar.tsx` — auto-dismiss (4s) "Resumed at {time} · Restart"; Restart → `onRestart()`.

**Interfaces:**
- Consumes: `useGroups` from `@/library/use-groups`; `neighbors` from `@/player/playlist`; `formatTime`; `expo-screen-orientation` (`lockAsync`, `unlockAsync`, `OrientationLock`).
- Produces: complete Plan 3a player.

**Behavior contract:**
1. **Route wiring:** in `group.tsx`, `router.push({ pathname: '/player', params: { videoId: item.id, uri: item.uri, title: item.filename, groupKey: key, mode } })`. (`index.tsx` single-item open stays as-is → no `groupKey` → next/prev hidden.)
2. **Next/prev:** when `groupKey` present, `const { groups } = useGroups(mode === 'folder' ? 'folder' : 'name')`; find the group by `key`; `const { prev, next } = neighbors(group.items, videoId)`. Switching: flush progress for the current video, then `player.replace({ uri: target.uri })` and `router.setParams({ videoId, uri, title })` (or navigate replace) so resume/progress track the new id. Hide prev/next buttons when null.
3. **Rotate:** on focus `await ScreenOrientation.unlockAsync()` (follow sensor); rotate button toggles `lockAsync(LANDSCAPE)` ↔ `lockAsync(PORTRAIT_UP)`; on blur/unmount `lockAsync(PORTRAIT_UP)` to restore the rest of the app. **Verify exact `OrientationLock` enum names in the installed `.d.ts`.**
4. **Tracks:** tracks button in `top-bar` opens `tracks-sheet`; selections set `player.subtitleTrack` / `player.audioTrack` (null = off).
5. **Snackbar:** when Task 3's resume fires, show `resume-snackbar` with `formatTime(savedPositionSec)`; Restart sets `player.currentTime = 0`.

- [ ] **Step 1:** Wire `group.tsx` params.
- [ ] **Step 2:** Add next/prev derivation + switching in `player.tsx`; render prev/next in `center-controls`.
- [ ] **Step 3:** Add `tracks-sheet`, the tracks button, `resume-snackbar`, and the rotate button + orientation lifecycle.
- [ ] **Step 4:** `npx tsc --noEmit` → clean; `npm test` → all green. (Typed-routes `router.d.ts` may lag until `expo start` regenerates — note if `tsc` flags the new param.)
- [ ] **Step 5: Commit**

```bash
git add src/app/player.tsx src/app/group.tsx src/components/player
git commit -m "feat(player): next/prev in group, track selection, rotate, resume snackbar"
```

**Device checklist:** from a multi-item group, next/prev move between episodes and each resumes/records independently; from a single video, next/prev are absent; rotate button forces landscape/portrait and the app returns to portrait after exiting; subtitle/audio menu lists embedded tracks and switching works; the resume snackbar appears and Restart jumps to the start.

---

## Final whole-branch review

After Task 5, run a single whole-branch review (opus, terse — verdict + real issues only per the lean-token preference): `tsc` clean, full suite green, no `Co-Authored-By`/"Generated with" trailers in any commit, ms↔s conversions correct, no logic duplicated between `player.tsx` and the pure helpers. Then hand the user the build command (`npx expo run:android`) and the combined device checklist; merge to `master` after they verify.

## Self-review notes
- **Spec coverage:** playback ✓(T3) · custom overlay ✓(T4) · auto-resume+undo ✓(T3 resume, T5 snackbar) · progress writing ✓(T2 writer, T3 lifecycle) · orientation ✓(T5) · keep-awake ✓(T3) · next/prev ✓(T5) · subtitle/audio ✓(T5) · speed ✓(T4) · pure-logic tests ✓(T1,T2).
- **Deferred to 3b (not in this plan, by design):** long-press 2×, double-tap seek, swipe brightness/volume, full-screen drag-scrub, lock, volume dependency.
- **Type consistency:** `ProgressWrite` defined in T2, consumed by `upsertProgress` (T2) and `player.tsx` (T3). `neighbors` shape consistent T1→T5. `formatTime` signature consistent T1→T4→T5.
