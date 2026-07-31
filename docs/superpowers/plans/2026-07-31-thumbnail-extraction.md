# Thumbnail Extraction Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-1-second, full-resolution thumbnail pipeline with a native frame grabber that picks a good mid-video frame, scores it to reject black/flat frames, and stores a correctly-sized JPEG durably.

**Architecture:** A local Kotlin Expo module (`modules/frame-grabber`) wraps `MediaMetadataRetriever`. It walks a candidate ladder of positions supplied by TypeScript and stops at the first frame that scores above a threshold — mean-luma band gated, luma-std-dev scored. All policy (ladder positions, thresholds, sizes, staleness rules, sweep ordering) lives in pure TS modules that import nothing native, so they are Jest-testable; Kotlin only decodes, scores, and writes. Generation stays visible-first, with a low-priority idle sweep filling the rest of the library.

**Tech Stack:** Expo SDK 56 / React Native 0.85, Expo Modules API (Kotlin), `expo-file-system` (new `File`/`Directory`/`Paths` API), `expo-sqlite`, Jest + jest-expo.

**Spec:** [2026-07-31-thumbnail-extraction-design.md](../specs/2026-07-31-thumbnail-extraction-design.md)

## Global Constraints

- **Expo docs are versioned — read https://docs.expo.dev/versions/v56.0.0/ before writing code against any Expo API** (per `AGENTS.md`). This especially applies to `expo-file-system`, whose API changed: SDK 56 uses `import { File, Directory, Paths } from 'expo-file-system'`, *not* the legacy `FileSystem.documentDirectory` string API.
- **Pure policy modules must not import native code.** `src/media/thumb-policy.ts` and `src/media/sweep-queue.ts` are imported by Jest tests. If they import `expo-file-system` or the native module handle, tests break. IO stays in `src/media/thumbnails.ts` and the sweep hook.
- **Android API guard:** `MediaMetadataRetriever.getScaledFrameAtTime` requires API 27. Guard with `Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1` and fall back to `getFrameAtTime` + `Bitmap.createScaledBitmap`. Do not assume the project's minSdk clears 27.
- **Native module naming follows `modules/system-volume`:** package `expo.modules.framegrabber`, module `Name("FrameGrabber")`, a `.web.ts` stub alongside the TS handle, and a thin re-export in `src/native/`.
- **Verification bar:** `npx tsc --noEmit` clean and `npm test` green before every commit. Device verification over adb (the phone is usually connected) for every task that changes what is drawn.
- **A new native module requires a dev-client rebuild** (`npm run android`). Tasks 5 onward cannot be device-verified until Task 4's rebuild has happened.
- **Constants are defined once, in `thumb-policy.ts`.** No task re-declares a width, quality, threshold, or version number locally.
- **The `expo-file-system` surface this plan uses has been verified against the installed 56.0.8 typings:** `Paths.document` / `Paths.cache` (both return a `Directory`), `new Directory(...segments)` and `new File(...segments)` (a `Directory` may be the first segment), `.exists`, `.create(options?)` with `{ intermediates?: boolean }`, and `.uri` (valid for paths that do not exist yet). Use these; do not reach for the legacy `FileSystem.documentDirectory` string API.

---

## File Structure

**Create:**
- `modules/frame-grabber/expo-module.config.json` — Android-only module registration.
- `modules/frame-grabber/android/src/main/AndroidManifest.xml` — bare manifest (module needs no permissions).
- `modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameGrabberModule.kt` — decode ladder, JPEG write, module definition.
- `modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameScorer.kt` — bitmap → score. Separate file: it is the one piece with real logic worth reading on its own.
- `modules/frame-grabber/src/FrameGrabberModule.ts` — typed native handle.
- `modules/frame-grabber/src/FrameGrabberModule.web.ts` — web no-op stub (jest-expo's universal preset resolves web).
- `src/native/frame-grabber.ts` — thin re-export, mirroring `src/native/system-volume.ts`.
- `src/media/thumb-policy.ts` — pure. Constants + `candidatePositions` + `thumbFileName` + `needsThumbnail`.
- `src/media/sweep-queue.ts` — pure. `buildSweepQueue`.
- `src/media/use-thumbnail-sweep.ts` — the background sweep hook.
- `src/media/thumbnail-sweep.tsx` — null-rendering `<ThumbnailSweep />` that mounts the hook.
- `src/db/thumbs-repo.ts` — thumbnail columns only, keeping `videos-repo.ts` about videos.
- `src/media/__tests__/thumb-policy.test.ts`
- `src/media/__tests__/sweep-queue.test.ts`
- `src/db/__tests__/thumbs-repo.test.ts`

**Modify:**
- `src/db/schema.ts` — migration v7, `LATEST_VERSION = 7`.
- `src/db/__tests__/schema.test.ts` — the v6 test asserts `LATEST_VERSION` is 6; add a v7 test and move that assertion.
- `src/db/videos-repo.ts` — drop `setThumbUri` (moves to `thumbs-repo.ts`).
- `src/media/thumbnails.ts` — full rewrite.
- `src/components/video-thumbnail.tsx` — `width` prop.
- `src/components/continue-watching-hero.tsx` — request the hero width.
- `src/player/use-preview-strip.ts` — swap the extractor.
- `src/app/_layout.tsx` — mount `<ThumbnailSweep />`.
- `package.json` — explicit `expo-file-system` dependency.
- `docs/HANDOFF.md`, `docs/CHANGELOG.md` — status row + changelog bullet.

---

### Task 1: Database layer — migration v7 and thumbs-repo

Adds the three columns the engine needs and drops every existing (bad) thumbnail. No behaviour change yet: nothing reads the new columns until Task 5.

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/__tests__/schema.test.ts`
- Create: `src/db/thumbs-repo.ts`
- Create: `src/db/__tests__/thumbs-repo.test.ts`
- Modify: `src/db/videos-repo.ts:42-44` (remove `setThumbUri`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ThumbState = { uri: string | null; version: number; attempts: number; timeMs: number | null }` (exported from `src/db/thumbs-repo.ts`)
  - `getThumbState(db: SQLiteDatabase, id: string): Promise<ThumbState | undefined>`
  - `getThumbStates(db: SQLiteDatabase): Promise<Map<string, ThumbState>>`
  - `setThumbResult(db: SQLiteDatabase, id: string, uri: string, positionMs: number, version: number): Promise<void>`
  - `recordThumbFailure(db: SQLiteDatabase, id: string, version: number): Promise<void>`

- [ ] **Step 1: Write the failing schema test**

Add to `src/db/__tests__/schema.test.ts`. Also **remove** the line `expect(LATEST_VERSION).toBe(6);` from the existing `migration 6` test — it now belongs to v7.

```ts
  it('migration 7 adds thumbnail columns and drops existing thumbnails', () => {
    const m7 = MIGRATIONS.find((m) => m.version === 7);
    expect(m7).toBeDefined();
    expect(m7!.up).toContain('ALTER TABLE videos ADD COLUMN thumb_version INTEGER NOT NULL DEFAULT 0');
    expect(m7!.up).toContain('ALTER TABLE videos ADD COLUMN thumb_attempts INTEGER NOT NULL DEFAULT 0');
    expect(m7!.up).toContain('ALTER TABLE videos ADD COLUMN thumb_time_ms INTEGER');
    expect(m7!.up).toContain('UPDATE videos SET thumb_uri = NULL');
    expect(LATEST_VERSION).toBe(7);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/db/__tests__/schema.test.ts`
Expected: FAIL — `expect(m7).toBeDefined()` receives `undefined`.

- [ ] **Step 3: Add the migration**

Append to the `MIGRATIONS` array in `src/db/schema.ts`, after the v6 entry, and change the last line to `export const LATEST_VERSION = 7;`.

```ts
  {
    version: 7,
    up: `
      ALTER TABLE videos ADD COLUMN thumb_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE videos ADD COLUMN thumb_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE videos ADD COLUMN thumb_time_ms INTEGER;
      UPDATE videos SET thumb_uri = NULL;
    `,
  },
```

- [ ] **Step 4: Run the schema test**

Run: `npx jest src/db/__tests__/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing thumbs-repo test**

Create `src/db/__tests__/thumbs-repo.test.ts`. The fake-db shape mirrors `history-repo.test.ts`.

```ts
import {
  getThumbState,
  getThumbStates,
  recordThumbFailure,
  setThumbResult,
} from '../thumbs-repo';

type Call = { sql: string; params?: unknown[] };

function fakeDb(rows: unknown[] = [], first: unknown = null) {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return undefined as never;
    },
    async getAllAsync<T>(sql: string) {
      calls.push({ sql });
      return rows as T[];
    },
    async getFirstAsync<T>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return first as T;
    },
  };
  return { db: db as never, calls };
}

describe('thumbs-repo', () => {
  it('getThumbStates maps every row into a state keyed by video id', async () => {
    const { db } = fakeDb([
      { id: 'a', thumb_uri: 'file:///a.jpg', thumb_version: 1, thumb_attempts: 0, thumb_time_ms: 900_000 },
      { id: 'b', thumb_uri: null, thumb_version: 0, thumb_attempts: 2, thumb_time_ms: null },
    ]);
    const states = await getThumbStates(db);
    expect(states.get('a')).toEqual({ uri: 'file:///a.jpg', version: 1, attempts: 0, timeMs: 900_000 });
    expect(states.get('b')).toEqual({ uri: null, version: 0, attempts: 2, timeMs: null });
  });

  it('getThumbState returns undefined for a missing row', async () => {
    const { db } = fakeDb([], null);
    expect(await getThumbState(db, 'nope')).toBeUndefined();
  });

  it('getThumbState maps a found row', async () => {
    const { db, calls } = fakeDb([], {
      thumb_uri: 'file:///x.jpg',
      thumb_version: 1,
      thumb_attempts: 0,
      thumb_time_ms: 1234,
    });
    expect(await getThumbState(db, 'x')).toEqual({
      uri: 'file:///x.jpg',
      version: 1,
      attempts: 0,
      timeMs: 1234,
    });
    expect(calls[0].params).toEqual(['x']);
  });

  it('setThumbResult stores uri, position and version and clears attempts', async () => {
    const { db, calls } = fakeDb();
    await setThumbResult(db, 'a', 'file:///a.jpg', 900_000, 1);
    expect(calls[0].sql).toMatch(/UPDATE videos/);
    expect(calls[0].sql).toMatch(/thumb_attempts = 0/);
    expect(calls[0].params).toEqual(['file:///a.jpg', 900_000, 1, 'a']);
  });

  it('recordThumbFailure restarts the attempt count when the version changed', async () => {
    const { db, calls } = fakeDb();
    await recordThumbFailure(db, 'a', 2);
    expect(calls[0].sql).toMatch(/thumb_attempts = CASE WHEN thumb_version = \? THEN thumb_attempts \+ 1 ELSE 1 END/);
    expect(calls[0].params).toEqual([2, 2, 'a']);
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx jest src/db/__tests__/thumbs-repo.test.ts`
Expected: FAIL — cannot find module `../thumbs-repo`.

- [ ] **Step 7: Write thumbs-repo**

Create `src/db/thumbs-repo.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

/** Thumbnail bookkeeping for one video, as stored on the `videos` row. */
export interface ThumbState {
  uri: string | null;
  /** THUMB_VERSION this thumbnail was produced by; older means stale. */
  version: number;
  /** Consecutive failed extraction attempts at the current version. */
  attempts: number;
  /** Position the winning frame was taken from, so other sizes can match it. */
  timeMs: number | null;
}

interface ThumbDbRow {
  id: string;
  thumb_uri: string | null;
  thumb_version: number;
  thumb_attempts: number;
  thumb_time_ms: number | null;
}

const toState = (r: Omit<ThumbDbRow, 'id'>): ThumbState => ({
  uri: r.thumb_uri,
  version: r.thumb_version,
  attempts: r.thumb_attempts,
  timeMs: r.thumb_time_ms,
});

export async function getThumbStates(db: SQLiteDatabase): Promise<Map<string, ThumbState>> {
  const rows = await db.getAllAsync<ThumbDbRow>(
    'SELECT id, thumb_uri, thumb_version, thumb_attempts, thumb_time_ms FROM videos',
  );
  return new Map(rows.map((r) => [r.id, toState(r)]));
}

export async function getThumbState(
  db: SQLiteDatabase,
  id: string,
): Promise<ThumbState | undefined> {
  const row = await db.getFirstAsync<Omit<ThumbDbRow, 'id'>>(
    'SELECT thumb_uri, thumb_version, thumb_attempts, thumb_time_ms FROM videos WHERE id = ?',
    [id],
  );
  return row ? toState(row) : undefined;
}

export async function setThumbResult(
  db: SQLiteDatabase,
  id: string,
  uri: string,
  positionMs: number,
  version: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE videos
        SET thumb_uri = ?, thumb_time_ms = ?, thumb_version = ?, thumb_attempts = 0
      WHERE id = ?`,
    [uri, positionMs, version, id],
  );
}

/**
 * Counts a failed extraction. A version bump restarts the count, so a new
 * algorithm always gets a fresh set of attempts on a file that defeated the old one.
 */
export async function recordThumbFailure(
  db: SQLiteDatabase,
  id: string,
  version: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE videos
        SET thumb_attempts = CASE WHEN thumb_version = ? THEN thumb_attempts + 1 ELSE 1 END,
            thumb_version = ?
      WHERE id = ?`,
    [version, version, id],
  );
}
```

- [ ] **Step 8: Remove the superseded writer**

Delete `setThumbUri` from `src/db/videos-repo.ts` (the final function, lines 42-44). Its only caller is `src/media/thumbnails.ts`, rewritten in Task 5 — so `tsc` will flag that call until then. Leave the old call site alone for now and expect that one error.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS — all suites, including the two new/updated ones.

- [ ] **Step 10: Commit**

```bash
git add src/db/schema.ts src/db/thumbs-repo.ts src/db/videos-repo.ts src/db/__tests__/schema.test.ts src/db/__tests__/thumbs-repo.test.ts
git commit -m "feat(db): migration v7 — thumbnail version/attempts/time columns + thumbs-repo"
```

---

### Task 2: Pure policy module

Every tunable in the engine, plus the three decisions worth testing: which positions to try, what a thumbnail file is called, and whether a thumbnail needs (re)generating.

**Files:**
- Create: `src/media/thumb-policy.ts`
- Create: `src/media/__tests__/thumb-policy.test.ts`

**Interfaces:**
- Consumes: `ThumbState` from `src/db/thumbs-repo.ts` (type-only import — that file imports only `expo-sqlite` types, so it stays Jest-safe).
- Produces:
  - `THUMB_VERSION = 1`, `THUMB_WIDTH_CARD = 640`, `THUMB_WIDTH_HERO = 1280`, `THUMB_QUALITY_CARD = 0.8`, `THUMB_QUALITY_HERO = 0.85`, `THUMB_MIN_SCORE = 0.12`, `THUMB_MAX_ATTEMPTS = 3`
  - `candidatePositions(durationMs: number | null): number[]`
  - `thumbFileName(videoId: string, width: number): string`
  - `needsThumbnail(state: ThumbState | undefined, fileExists: boolean): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/media/__tests__/thumb-policy.test.ts`:

```ts
import {
  candidatePositions,
  needsThumbnail,
  thumbFileName,
  THUMB_MAX_ATTEMPTS,
  THUMB_VERSION,
} from '../thumb-policy';

describe('candidatePositions', () => {
  it('walks 25% → 45% → 12% → 65% of a feature-length video', () => {
    expect(candidatePositions(3_600_000)).toEqual([900_000, 1_620_000, 432_000, 2_340_000]);
  });

  it('falls back to a fixed position when the duration is unknown', () => {
    expect(candidatePositions(null)).toEqual([3000]);
    expect(candidatePositions(0)).toEqual([3000]);
  });

  it('collapses to a single mid-point for very short clips', () => {
    expect(candidatePositions(1500)).toEqual([750]);
  });

  it('drops candidates that would land on the same keyframe', () => {
    // 4s clip: 1000 / 1800 / 480→1000 / 2600 — only 1000 and 2600 survive the 1s spacing rule.
    expect(candidatePositions(4000)).toEqual([1000, 2600]);
  });

  it('keeps every candidate inside the video, away from both edges', () => {
    for (const duration of [2500, 9000, 61_000, 7_200_000]) {
      for (const p of candidatePositions(duration)) {
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(duration);
      }
    }
  });
});

describe('thumbFileName', () => {
  it('keys a file by video id and width', () => {
    expect(thumbFileName('1234', 640)).toBe('1234@640.jpg');
  });

  it('replaces characters that are unsafe in a filename', () => {
    expect(thumbFileName('a/b:c', 1280)).toBe('a_b_c@1280.jpg');
  });
});

describe('needsThumbnail', () => {
  const fresh = { uri: 'file:///a.jpg', version: THUMB_VERSION, attempts: 0, timeMs: 100 };

  it('is true when the video has never been processed', () => {
    expect(needsThumbnail(undefined, false)).toBe(true);
  });

  it('is false for a current thumbnail whose file is present', () => {
    expect(needsThumbnail(fresh, true)).toBe(false);
  });

  it('is true when the file has vanished from disk', () => {
    expect(needsThumbnail(fresh, false)).toBe(true);
  });

  it('is true when the thumbnail predates the current algorithm', () => {
    expect(needsThumbnail({ ...fresh, version: THUMB_VERSION - 1 }, true)).toBe(true);
  });

  it('gives up after the attempt limit at the current version', () => {
    const exhausted = { uri: null, version: THUMB_VERSION, attempts: THUMB_MAX_ATTEMPTS, timeMs: null };
    expect(needsThumbnail(exhausted, false)).toBe(false);
  });

  it('retries an exhausted video once the algorithm version moves on', () => {
    const oldExhausted = {
      uri: null,
      version: THUMB_VERSION - 1,
      attempts: THUMB_MAX_ATTEMPTS,
      timeMs: null,
    };
    expect(needsThumbnail(oldExhausted, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/media/__tests__/thumb-policy.test.ts`
Expected: FAIL — cannot find module `../thumb-policy`.

- [ ] **Step 3: Write the policy module**

Create `src/media/thumb-policy.ts`:

```ts
import type { ThumbState } from '@/db/thumbs-repo';

/**
 * Bump when the extraction algorithm changes. Every thumbnail stamped with a
 * lower version is treated as stale and regenerated — no migration required.
 */
export const THUMB_VERSION = 1;

/** Library cards, rows and collages. ~45 KB per video at this quality. */
export const THUMB_WIDTH_CARD = 640;
/** Continue-watching banner — full-bleed, so it shows every soft pixel. */
export const THUMB_WIDTH_HERO = 1280;

export const THUMB_QUALITY_CARD = 0.8;
export const THUMB_QUALITY_HERO = 0.85;

/**
 * Luma standard deviation a frame must reach to be accepted without trying the
 * next candidate. Real scenes land around 0.15–0.30; flat frames sit under 0.05.
 */
export const THUMB_MIN_SCORE = 0.12;

/** Consecutive failures before a video is left alone (corrupt/unsupported file). */
export const THUMB_MAX_ATTEMPTS = 3;

/**
 * Fractions of duration to try, in order. 25% is reliably mid-scene, past
 * cold-opens and title sequences; the rest are escape hatches for long intros,
 * long files, and dark middle acts.
 */
const CANDIDATE_FRACTIONS = [0.25, 0.45, 0.12, 0.65];

/** Used when the scan gave us no duration — better than nothing, worse than a fraction. */
const FALLBACK_POSITION_MS = 3000;

/** Never grab from the first or last second: fades and end cards live there. */
const EDGE_GUARD_MS = 1000;

/** Candidates closer than this land on the same keyframe, so the extra decode is waste. */
const DEDUPE_MS = 1000;

/**
 * The ladder of positions to try, in priority order. The native grabber walks it
 * and stops at the first frame scoring >= THUMB_MIN_SCORE.
 */
export function candidatePositions(durationMs: number | null): number[] {
  if (!durationMs || durationMs <= 0) return [FALLBACK_POSITION_MS];

  const latest = durationMs - EDGE_GUARD_MS;
  // Too short for the guard band to make sense — one frame from the middle.
  if (latest <= EDGE_GUARD_MS) return [Math.floor(durationMs / 2)];

  const positions: number[] = [];
  for (const fraction of CANDIDATE_FRACTIONS) {
    const at = Math.min(latest, Math.max(EDGE_GUARD_MS, Math.round(fraction * durationMs)));
    if (positions.every((p) => Math.abs(p - at) >= DEDUPE_MS)) positions.push(at);
  }
  return positions;
}

/** Deterministic name so a thumbnail can be found on disk without a DB round trip. */
export function thumbFileName(videoId: string, width: number): string {
  return `${videoId.replace(/[^a-zA-Z0-9_-]/g, '_')}@${width}.jpg`;
}

/**
 * Whether this video should be (re)processed. A missing file counts as missing
 * even when the DB has a uri — Android used to evict these from the cache dir,
 * and a stale row should not leave a permanent hole in the grid.
 */
export function needsThumbnail(state: ThumbState | undefined, fileExists: boolean): boolean {
  if (!state) return true;
  if (state.version < THUMB_VERSION) return true; // new algorithm: everyone gets another go
  if (state.attempts >= THUMB_MAX_ATTEMPTS) return false;
  return !state.uri || !fileExists;
}
```

- [ ] **Step 4: Run the test**

Run: `npx jest src/media/__tests__/thumb-policy.test.ts`
Expected: PASS — all 13 assertions.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit   # the Task 1 setThumbUri error in src/media/thumbnails.ts is still expected
git add src/media/thumb-policy.ts src/media/__tests__/thumb-policy.test.ts
git commit -m "feat(media): thumbnail policy — candidate ladder, naming, staleness rules"
```

---

### Task 3: Sweep queue ordering

Decides what the background sweep works on and in what order: videos you have watched recently come first, because those are the ones you will look at again.

**Files:**
- Create: `src/media/sweep-queue.ts`
- Create: `src/media/__tests__/sweep-queue.test.ts`

**Interfaces:**
- Consumes: nothing (deliberately — it takes plain ids so it never needs a DB or a `LibraryVideo`).
- Produces: `buildSweepQueue(videos: { id: string }[], pending: Set<string>, recentIds: string[]): string[]`

- [ ] **Step 1: Write the failing test**

Create `src/media/__tests__/sweep-queue.test.ts`:

```ts
import { buildSweepQueue } from '../sweep-queue';

const lib = (...ids: string[]) => ids.map((id) => ({ id }));

describe('buildSweepQueue', () => {
  it('puts recently played videos first, in recency order', () => {
    const queue = buildSweepQueue(lib('a', 'b', 'c', 'd'), new Set(['a', 'b', 'c', 'd']), ['c', 'a']);
    expect(queue).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores recently played videos that already have a thumbnail', () => {
    const queue = buildSweepQueue(lib('a', 'b', 'c'), new Set(['b']), ['c', 'a']);
    expect(queue).toEqual(['b']);
  });

  it('keeps library order for everything not recently played', () => {
    const queue = buildSweepQueue(lib('a', 'b', 'c'), new Set(['a', 'b', 'c']), []);
    expect(queue).toEqual(['a', 'b', 'c']);
  });

  it('never repeats a video that is both recent and in the library', () => {
    const queue = buildSweepQueue(lib('a', 'b'), new Set(['a', 'b']), ['a', 'a', 'b']);
    expect(queue).toEqual(['a', 'b']);
  });

  it('drops recent ids that are no longer in the library', () => {
    const queue = buildSweepQueue(lib('a'), new Set(['a', 'gone']), ['gone', 'a']);
    expect(queue).toEqual(['a']);
  });

  it('returns nothing when everything is done', () => {
    expect(buildSweepQueue(lib('a', 'b'), new Set(), ['a'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/media/__tests__/sweep-queue.test.ts`
Expected: FAIL — cannot find module `../sweep-queue`.

- [ ] **Step 3: Write the queue builder**

Create `src/media/sweep-queue.ts`:

```ts
/**
 * Order for the background thumbnail sweep: videos the user played most
 * recently first (they are the likeliest to be looked at again), then the rest
 * in library order. Only videos in `pending` are included, and never twice.
 */
export function buildSweepQueue(
  videos: { id: string }[],
  pending: Set<string>,
  recentIds: string[],
): string[] {
  const inLibrary = new Set(videos.map((v) => v.id));
  const queued = new Set<string>();
  const queue: string[] = [];

  const push = (id: string) => {
    if (!pending.has(id) || queued.has(id) || !inLibrary.has(id)) return;
    queued.add(id);
    queue.push(id);
  };

  for (const id of recentIds) push(id);
  for (const video of videos) push(video.id);

  return queue;
}
```

- [ ] **Step 4: Run the test**

Run: `npx jest src/media/__tests__/sweep-queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/media/sweep-queue.ts src/media/__tests__/sweep-queue.test.ts
git commit -m "feat(media): sweep queue ordering — recently played first"
```

---

### Task 4: Native frame-grabber module

The Kotlin half. Not unit-testable — verified by the smoke check in Step 8 and, properly, by Task 5's device run.

**Files:**
- Create: `modules/frame-grabber/expo-module.config.json`
- Create: `modules/frame-grabber/android/src/main/AndroidManifest.xml`
- Create: `modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameScorer.kt`
- Create: `modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameGrabberModule.kt`
- Create: `modules/frame-grabber/src/FrameGrabberModule.ts`
- Create: `modules/frame-grabber/src/FrameGrabberModule.web.ts`
- Create: `src/native/frame-grabber.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GrabFrameOptions = { positionsMs: number[]; targetWidth: number; minScore: number; quality: number; outPath: string }`
  - `GrabFrameResult = { uri: string; positionMs: number; score: number }`
  - `FrameGrabber.grabFrame(uri: string, options: GrabFrameOptions): Promise<GrabFrameResult | null>` — exported as `{ FrameGrabber }` from `@/native/frame-grabber`.

- [ ] **Step 1: Add expo-file-system as an explicit dependency**

It is currently only present transitively, and Task 5 imports it directly.

Run: `npx expo install expo-file-system`
Expected: `package.json` gains `"expo-file-system": "~56.0.x"`.

- [ ] **Step 2: Create the module config and manifest**

`modules/frame-grabber/expo-module.config.json`:

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["expo.modules.framegrabber.FrameGrabberModule"]
  }
}
```

`modules/frame-grabber/android/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
```

- [ ] **Step 3: Write the frame scorer**

`modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameScorer.kt`:

```kotlin
package expo.modules.framegrabber

import android.graphics.Bitmap
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Scores how usable a frame is as a poster image, in 0..1.
 *
 * Two signals, both on luma: the mean rejects black frames, fade-ins and blown
 * white flashes outright; the standard deviation is the score itself, and is
 * what separates a real scene from a studio logo on a flat background — a
 * brightness check alone happily accepts a solid grey card.
 */
object FrameScorer {
  private const val WORK_WIDTH = 160
  private const val MIN_MEAN_LUMA = 0.06
  private const val MAX_MEAN_LUMA = 0.97

  fun score(bitmap: Bitmap): Double {
    val work = downscale(bitmap)
    val width = work.width
    val height = work.height
    if (width <= 0 || height <= 0) {
      if (work !== bitmap) work.recycle()
      return 0.0
    }

    val pixels = IntArray(width * height)
    work.getPixels(pixels, 0, width, 0, 0, width, height)
    if (work !== bitmap) work.recycle()

    var sum = 0.0
    var sumOfSquares = 0.0
    for (pixel in pixels) {
      val r = (pixel shr 16) and 0xFF
      val g = (pixel shr 8) and 0xFF
      val b = pixel and 0xFF
      val luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
      sum += luma
      sumOfSquares += luma * luma
    }

    val count = pixels.size.toDouble()
    val mean = sum / count
    if (mean < MIN_MEAN_LUMA || mean > MAX_MEAN_LUMA) return 0.0

    val variance = (sumOfSquares / count) - (mean * mean)
    return sqrt(max(0.0, variance)).coerceIn(0.0, 1.0)
  }

  private fun downscale(bitmap: Bitmap): Bitmap {
    if (bitmap.width <= WORK_WIDTH) return bitmap
    val height = (bitmap.height.toFloat() * WORK_WIDTH / bitmap.width).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bitmap, WORK_WIDTH, height, true)
  }
}
```

- [ ] **Step 4: Write the module**

`modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameGrabberModule.kt`:

```kotlin
package expo.modules.framegrabber

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream

class GrabOptions : Record {
  @Field var positionsMs: List<Double> = emptyList()
  @Field var targetWidth: Int = 640
  @Field var minScore: Double = 0.0
  @Field var quality: Double = 0.8
  @Field var outPath: String = ""
}

class FrameGrabberModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FrameGrabber")

    /**
     * Walks `positionsMs` in order and stops at the first frame scoring at least
     * `minScore`, so the common case costs a single decode. If nothing clears the
     * bar, the best-scoring candidate is written anyway — a mediocre frame beats a
     * blank tile. Returns null only when no position decodes at all.
     */
    AsyncFunction("grabFrame") { sourceUri: String, options: GrabOptions ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(context, Uri.parse(sourceUri))

        var bestBitmap: Bitmap? = null
        var bestScore = -1.0
        var bestPositionMs = 0.0

        for (positionMs in options.positionsMs) {
          val bitmap = grabScaled(retriever, (positionMs * 1000).toLong(), options.targetWidth)
            ?: continue
          val score = FrameScorer.score(bitmap)
          if (score > bestScore) {
            bestBitmap?.recycle()
            bestBitmap = bitmap
            bestScore = score
            bestPositionMs = positionMs
          } else {
            bitmap.recycle()
          }
          if (score >= options.minScore) break
        }

        val winner = bestBitmap ?: return@AsyncFunction null
        val path = options.outPath.removePrefix("file://")
        writeJpeg(winner, path, options.quality)
        winner.recycle()

        mapOf(
          "uri" to "file://$path",
          "positionMs" to bestPositionMs,
          "score" to bestScore,
        )
      } finally {
        retriever.release()
      }
    }
  }

  /**
   * OPTION_CLOSEST_SYNC snaps to the nearest keyframe — sub-second precision is
   * irrelevant for a poster frame and exact seeking is dramatically slower.
   * The scale box is square so the aspect-preserving fit yields `targetWidth`
   * for landscape video and caps height for portrait.
   */
  private fun grabScaled(
    retriever: MediaMetadataRetriever,
    timeUs: Long,
    targetWidth: Int,
  ): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      return retriever.getScaledFrameAtTime(
        timeUs,
        MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
        targetWidth,
        targetWidth,
      )
    }
    val full = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
      ?: return null
    if (full.width <= targetWidth) return full
    val height = (full.height.toFloat() * targetWidth / full.width).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(full, targetWidth, height, true)
    if (scaled !== full) full.recycle()
    return scaled
  }

  private fun writeJpeg(bitmap: Bitmap, path: String, quality: Double) {
    val file = File(path)
    file.parentFile?.mkdirs()
    FileOutputStream(file).use { out ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt().coerceIn(1, 100), out)
    }
  }
}
```

- [ ] **Step 5: Write the TypeScript handle**

`modules/frame-grabber/src/FrameGrabberModule.ts`:

```ts
import { NativeModule, requireNativeModule } from 'expo';

export interface GrabFrameOptions {
  /** Positions to try, in priority order. */
  positionsMs: number[];
  /** Longest edge of the written JPEG, in pixels. */
  targetWidth: number;
  /** Stop at the first frame scoring at least this. Pass 0 to take the first decodable frame. */
  minScore: number;
  /** JPEG quality, 0..1. */
  quality: number;
  /** Absolute destination path; parent directories are created. */
  outPath: string;
}

export interface GrabFrameResult {
  /** file:// uri of the written JPEG. */
  uri: string;
  positionMs: number;
  score: number;
}

declare class FrameGrabberModule extends NativeModule<{}> {
  /** Resolves null when no candidate position decodes. */
  grabFrame(uri: string, options: GrabFrameOptions): Promise<GrabFrameResult | null>;
}

export default requireNativeModule<FrameGrabberModule>('FrameGrabber');
```

`modules/frame-grabber/src/FrameGrabberModule.web.ts`:

```ts
import { registerWebModule, NativeModule } from 'expo';

import type { GrabFrameOptions, GrabFrameResult } from './FrameGrabberModule';

// Frame extraction is Android-only; web is a no-op stub.
class FrameGrabberModule extends NativeModule<{}> {
  async grabFrame(_uri: string, _options: GrabFrameOptions): Promise<GrabFrameResult | null> {
    return null;
  }
}

export default registerWebModule(FrameGrabberModule, 'FrameGrabberModule');
```

`src/native/frame-grabber.ts`:

```ts
// Thin re-export of the local FrameGrabber Expo module (Android video frame
// extraction with black/flat-frame rejection), so app code imports via @/native.
export { default as FrameGrabber } from '../../modules/frame-grabber/src/FrameGrabberModule';
export type {
  GrabFrameOptions,
  GrabFrameResult,
} from '../../modules/frame-grabber/src/FrameGrabberModule';
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the known `setThumbUri` error in `src/media/thumbnails.ts` from Task 1. No errors in any new file.

- [ ] **Step 7: Rebuild the dev client**

Run: `npm run android`
Expected: Gradle autolinks `frame-grabber`, the build succeeds, and the app launches on the connected device.

If the module is not found at runtime, the usual cause is a stale build — `npx expo prebuild --clean -p android` then rebuild.

- [ ] **Step 8: Smoke-test the native call on device**

Temporarily add this to `src/app/(tabs)/settings.tsx` inside the component (or run it from any screen with a `useEffect`), replacing the uri with a real one from `adb shell ls /storage/emulated/0/Movies`:

```ts
useEffect(() => {
  FrameGrabber.grabFrame('file:///storage/emulated/0/Movies/<real-file>.mp4', {
    positionsMs: [900_000, 1_620_000],
    targetWidth: 640,
    minScore: 0.12,
    quality: 0.8,
    outPath: '/data/data/com.jvstuche.fiftythreexy.dev/files/thumbnails/smoke@640.jpg',
  }).then((r) => console.log('grabFrame', r));
}, []);
```

Watch: `npx expo start` logs, or `adb logcat -s ReactNativeJS`
Expected: an object with a `file://` uri, a `positionMs` matching one of the two, and a `score` above 0.12 for a normal scene.

Then pull and eyeball it: `adb shell run-as com.jvstuche.fiftythreexy.dev cat files/thumbnails/smoke@640.jpg > /tmp/smoke.jpg`

**Remove the smoke-test code before committing.**

- [ ] **Step 9: Commit**

```bash
git add modules/frame-grabber src/native/frame-grabber.ts package.json package-lock.json
git commit -m "feat(native): frame-grabber module — scored candidate-ladder frame extraction"
```

---

### Task 5: Rewrite the thumbnail pipeline

Where the black tiles actually go away. Swaps `expo-video-thumbnails` for the native grabber, moves storage out of the cache directory, and teaches `VideoThumbnail` about sizes so the hero can ask for a big frame.

**Files:**
- Modify: `src/media/thumbnails.ts` (full rewrite)
- Modify: `src/components/video-thumbnail.tsx`
- Modify: `src/components/continue-watching-hero.tsx:41`

**Interfaces:**
- Consumes: `FrameGrabber` (Task 4); `getThumbState` / `setThumbResult` / `recordThumbFailure` (Task 1); `candidatePositions` / `needsThumbnail` / `thumbFileName` / constants (Task 2).
- Produces:
  - `getOrCreateThumbnail(db: SQLiteDatabase, video: LibraryVideo, width?: number): Promise<string | null>` — `width` defaults to `THUMB_WIDTH_CARD`.
  - `hasThumbnailFile(videoId: string, width?: number): boolean` — used by the Task 6 sweep to compute what is pending.

- [ ] **Step 1: Rewrite thumbnails.ts**

Replace the whole of `src/media/thumbnails.ts`:

```ts
import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getThumbState, recordThumbFailure, setThumbResult } from '@/db/thumbs-repo';
import type { LibraryVideo } from '@/library/types';
import { pLimit } from '@/lib/p-limit';
import { FrameGrabber } from '@/native/frame-grabber';
import {
  candidatePositions,
  needsThumbnail,
  thumbFileName,
  THUMB_MIN_SCORE,
  THUMB_QUALITY_CARD,
  THUMB_QUALITY_HERO,
  THUMB_VERSION,
  THUMB_WIDTH_CARD,
} from './thumb-policy';

/**
 * Thumbnails live in the *document* directory, not the cache: Android evicts
 * cached files under storage pressure, which is how a stored uri could end up
 * pointing at nothing.
 */
const THUMB_DIR = 'thumbnails';

/** Shared with the background sweep, so total extraction concurrency stays bounded. */
const limit = pLimit(3);

function thumbFile(videoId: string, width: number): File {
  return new File(new Directory(Paths.document, THUMB_DIR), thumbFileName(videoId, width));
}

function ensureThumbDir(): void {
  const dir = new Directory(Paths.document, THUMB_DIR);
  if (!dir.exists) dir.create();
}

/** True when a thumbnail of this size is already on disk. */
export function hasThumbnailFile(videoId: string, width: number = THUMB_WIDTH_CARD): boolean {
  return thumbFile(videoId, width).exists;
}

/**
 * Returns a usable thumbnail uri, extracting one if needed.
 *
 * Non-card sizes (the hero banner) reuse the position the card frame won on, so
 * the two never show different moments, and they never write back to the videos
 * row — `thumb_uri` always means the card-sized file.
 */
export async function getOrCreateThumbnail(
  db: SQLiteDatabase,
  video: LibraryVideo,
  width: number = THUMB_WIDTH_CARD,
): Promise<string | null> {
  return limit(async () => {
    const file = thumbFile(video.id, width);
    const state = await getThumbState(db, video.id);
    const isCard = width === THUMB_WIDTH_CARD;

    if (file.exists && !needsThumbnail(state, true)) return file.uri;
    // Nothing to regenerate and nothing on disk — this video has defeated us.
    if (!needsThumbnail(state, file.exists)) return file.exists ? file.uri : null;

    ensureThumbDir();

    // The card frame already picked a good moment; match it rather than re-scoring.
    const positionsMs =
      !isCard && state?.timeMs != null ? [state.timeMs] : candidatePositions(video.durationMs);

    try {
      const result = await FrameGrabber.grabFrame(video.uri, {
        positionsMs,
        targetWidth: width,
        minScore: THUMB_MIN_SCORE,
        quality: isCard ? THUMB_QUALITY_CARD : THUMB_QUALITY_HERO,
        outPath: file.uri,
      });
      if (!result) {
        if (isCard) await recordThumbFailure(db, video.id, THUMB_VERSION);
        return null;
      }
      if (isCard) {
        await setThumbResult(db, video.id, result.uri, result.positionMs, THUMB_VERSION);
      }
      return result.uri;
    } catch {
      if (isCard) await recordThumbFailure(db, video.id, THUMB_VERSION);
      return null;
    }
  });
}
```

- [ ] **Step 2: Make VideoThumbnail size-aware**

In `src/components/video-thumbnail.tsx`: add the import, the prop, and pass the width through. The cached `video.thumbUri` is the *card* file, so it must not seed a hero-sized request.

```tsx
import { THUMB_WIDTH_CARD } from '@/media/thumb-policy';

export function VideoThumbnail({
  video,
  style,
  width = THUMB_WIDTH_CARD,
}: {
  video: LibraryVideo;
  style?: StyleProp<ViewStyle>;
  width?: number;
}) {
  const { colors, radius } = useTheme();
  // thumbUri from the library row is the card-sized file; other sizes start empty.
  const [uri, setUri] = useState<string | null>(
    width === THUMB_WIDTH_CARD ? video.thumbUri : null,
  );
  const db = useSQLiteContext();
```

Inside the existing effect, pass the width and add it to the dependency array:

```tsx
    const handle = requestIdleCallback(() => {
      getOrCreateThumbnail(db, video, width).then((u) => {
        if (!cancelled && u) setUri(u);
      });
    });
    return () => {
      cancelled = true;
      cancelIdleCallback(handle);
    };
  }, [db, video, uri, width]);
```

- [ ] **Step 3: Point the hero at the big frame**

In `src/components/continue-watching-hero.tsx`, add the import and pass the width:

```tsx
import { THUMB_WIDTH_HERO } from '@/media/thumb-policy';
```

```tsx
        <VideoThumbnail video={video} style={styles.fill} width={THUMB_WIDTH_HERO} />
```

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: both clean — the `setThumbUri` error from Task 1 is now resolved, since its last caller is gone.

- [ ] **Step 5: Device-verify against VLC**

```bash
adb shell pm clear com.jvstuche.fiftythreexy.dev   # forces migration v7 + a full regeneration
npm run android
```

Then, on the phone: open the library, let the grid fill, and compare against VLC on the same folders.

Expected:
- Shameless, Banshee and Avatar group cards show recognisable mid-scene frames, not black tiles.
- The continue-watching card's image is sharp, not upscaled mush.
- Scrolling stays smooth while thumbnails fill in.

Capture a screenshot for the record (screenshots are at 1.17× coordinate scale on this device):
`adb exec-out screencap -p > /tmp/claude-1000/-home-uche-Projects-53XY/thumbs-after.png`

If a specific show still looks bad, note *which* and at what position — that is a `THUMB_MIN_SCORE` or ladder tuning question, both of which are single-constant changes in `thumb-policy.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/media/thumbnails.ts src/components/video-thumbnail.tsx src/components/continue-watching-hero.tsx
git commit -m "feat(media): native scored thumbnails, durable storage, hero-size frames"
```

---

### Task 6: Background sweep

Fills in every video you have not scrolled past, without ever competing with scrolling or playback.

**Files:**
- Create: `src/media/use-thumbnail-sweep.ts`
- Create: `src/media/thumbnail-sweep.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `buildSweepQueue` (Task 3); `getThumbStates` (Task 1); `needsThumbnail` (Task 2); `getOrCreateThumbnail` / `hasThumbnailFile` (Task 5); `useLibraryData` from `@/library/library-provider`; `getHistory` from `@/db/history-repo`.
- Produces: `useThumbnailSweep(): void` and `<ThumbnailSweep />`.

**On the spec's "`pLimit(1)`":** the sweep awaits one `getOrCreateThumbnail` at a time in a sequential loop, which *is* concurrency 1 — no second limiter is needed. It shares `thumbnails.ts`'s `pLimit(3)` with the visible-card path, so the sweep can occupy at most one of the three slots and on-screen cards always have room. Do not add a separate limiter.

- [ ] **Step 1: Write the sweep hook**

Create `src/media/use-thumbnail-sweep.ts`:

```ts
import { usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getHistory } from '@/db/history-repo';
import { getThumbStates } from '@/db/thumbs-repo';
import { useLibraryData } from '@/library/library-provider';
import { buildSweepQueue } from './sweep-queue';
import { getOrCreateThumbnail, hasThumbnailFile } from './thumbnails';
import { needsThumbnail } from './thumb-policy';

/** Gap between extractions — this is a chore, not a job. */
const SWEEP_GAP_MS = 300;
/** How long to wait before re-checking whether the sweep may resume. */
const PAUSE_POLL_MS = 2000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Works through every video still missing a thumbnail, one at a time, so a
 * library you have never scrolled through still ends up fully illustrated.
 *
 * Pauses while the app is backgrounded and while the player is on screen —
 * frame extraction and video playback want the same hardware decoder, and the
 * user is looking at the playback.
 */
export function useThumbnailSweep(): void {
  const db = useSQLiteContext();
  const { videos, status } = useLibraryData();
  const pathname = usePathname();

  const foregrounded = useRef(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      foregrounded.current = next === 'active';
    });
    return () => sub.remove();
  }, []);

  const playerOpen = useRef(false);
  playerOpen.current = pathname === '/player';

  useEffect(() => {
    if (status !== 'ready' || videos.length === 0) return;
    let cancelled = false;

    (async () => {
      const [states, history] = await Promise.all([getThumbStates(db), getHistory(db)]);
      if (cancelled) return;

      const pending = new Set(
        videos
          .filter((v) => needsThumbnail(states.get(v.id), hasThumbnailFile(v.id)))
          .map((v) => v.id),
      );
      const queue = buildSweepQueue(videos, pending, history.map((h) => h.videoId));
      const byId = new Map(videos.map((v) => [v.id, v]));

      for (const id of queue) {
        while (!cancelled && (!foregrounded.current || playerOpen.current)) {
          await delay(PAUSE_POLL_MS);
        }
        if (cancelled) return;

        const video = byId.get(id);
        if (!video) continue;
        await getOrCreateThumbnail(db, video);
        if (cancelled) return;
        await delay(SWEEP_GAP_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
    // A rescan produces a new `videos` array and restarts the sweep. That is
    // cheap and correct: state is re-read, and finished videos are skipped.
  }, [db, status, videos]);
}
```

- [ ] **Step 2: Wrap it in a mountable component**

Create `src/media/thumbnail-sweep.tsx`:

```tsx
import { useThumbnailSweep } from './use-thumbnail-sweep';

/**
 * Renders nothing; exists so the sweep can be mounted once at the app root
 * without the library provider having to know about thumbnails or routing.
 */
export function ThumbnailSweep() {
  useThumbnailSweep();
  return null;
}
```

- [ ] **Step 3: Mount it at the root**

In `src/app/_layout.tsx`, add the import and render it next to `<ThemedStatusBar />` — inside `LibraryProvider` (it needs the library) and inside the router tree (it needs `usePathname`):

```tsx
import { ThumbnailSweep } from '@/media/thumbnail-sweep';
```

```tsx
              <ThemeProvider>
                <ThemedStatusBar />
                <ThumbnailSweep />
                <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
```

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: both clean.

- [ ] **Step 5: Device-verify the sweep**

```bash
adb shell pm clear com.jvstuche.fiftythreexy.dev
npm run android
```

Expected, in order:
1. Open the app and stay on the home screen without scrolling. Thumbnails keep appearing for groups further down the list — visible when you then scroll.
2. Open a video. Playback is smooth from the first second; no stutter from background extraction.
3. Press home, wait, return. The app has not been extracting in the background (no battery-eating loop) and resumes filling on return.
4. `adb shell run-as com.jvstuche.fiftythreexy.dev ls files/thumbnails | wc -l` climbs toward the library size while the app sits idle on the home screen.

- [ ] **Step 6: Commit**

```bash
git add src/media/use-thumbnail-sweep.ts src/media/thumbnail-sweep.tsx src/app/_layout.tsx
git commit -m "feat(media): background thumbnail sweep, paused during playback and in background"
```

---

### Task 7: Move the scrub-preview strip onto the grabber

The player's preview strip pulls **full-resolution** frames at `quality: 0.3` — the worst of both. Same extractor, no scoring (strip frames must land at their exact slot), and paths we own.

**Files:**
- Modify: `src/player/use-preview-strip.ts`

**Interfaces:**
- Consumes: `FrameGrabber` (Task 4).
- Produces: no new exports. `PreviewStrip` and the `preview_frames` schema are unchanged.

- [ ] **Step 1: Swap the extractor**

In `src/player/use-preview-strip.ts`, replace the `expo-video-thumbnails` import:

```ts
import { Directory, File, Paths } from 'expo-file-system';

import { FrameGrabber } from '@/native/frame-grabber';
```

Replace the `FRAME_QUALITY` constant with:

```ts
const FRAME_QUALITY = 0.5;
/** Wide enough for the scrub bubble at 2× DPR, small enough to be nearly free. */
const FRAME_WIDTH = 320;
/** Strip frames must land on their slot, so any decodable frame is accepted. */
const FRAME_MIN_SCORE = 0;

const PREVIEW_DIR = 'previews';

function previewFile(videoId: string, idx: number): File {
  const dir = new Directory(Paths.cache, PREVIEW_DIR, videoId);
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${idx}.jpg`);
}
```

Then replace the extraction call inside the generation loop:

```ts
        try {
          const result = await FrameGrabber.grabFrame(uri, {
            positionsMs: [timeMs],
            targetWidth: FRAME_WIDTH,
            minScore: FRAME_MIN_SCORE,
            quality: FRAME_QUALITY,
            outPath: previewFile(videoId, idx).uri,
          });
          if (!result) continue;
          if (cancelled) return;
          await insertPreviewFrame(db, videoId, idx, timeMs, result.uri);
          completed.set(idx, result.uri);
          setFrames(new Map(completed));
        } catch {
          // Extraction can fail on odd codecs/positions — skip the slot.
        }
```

Note the `continue` on a null result skips the `GENERATION_GAP_MS` sleep; move the `await new Promise(...)` gap line above the `try` block so every slot, successful or not, is followed by a pause.

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: both clean. `src/player/__tests__/preview-strip.test.ts` covers the pure slot math and is untouched by this change.

- [ ] **Step 3: Device-verify scrubbing**

Play a video, let the strip generate for ~30 seconds, then drag the seekbar and drag-scrub horizontally.

Expected:
- Bubble frames appear and are visibly sharper than before.
- Frames match the timestamp shown (no off-by-one slot).
- Frames still fill in progressively; a slot with no frame yet shows the timestamp only, never a spinner.
- `adb shell run-as com.jvstuche.fiftythreexy.dev ls cache/previews/` lists a directory per played video.

- [ ] **Step 4: Commit**

```bash
git add src/player/use-preview-strip.ts
git commit -m "perf(player): scrub-preview frames via frame-grabber at 320px instead of full-res"
```

---

### Task 8: Retire expo-video-thumbnails and update the docs

**Files:**
- Modify: `package.json`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Confirm nothing imports the old library**

Run: `grep -rn "expo-video-thumbnails" src modules`
Expected: no matches. If there are any, they belong to Task 5 or Task 7 and must be finished first.

- [ ] **Step 2: Remove the dependency**

Run: `npm uninstall expo-video-thumbnails`

- [ ] **Step 3: Rebuild and re-verify**

Run: `npm run android`
Expected: the app builds and launches; thumbnails and scrub previews both still work. (Removing a native dependency changes the autolinked set, so this rebuild is not optional.)

- [ ] **Step 4: Update the status table**

In `docs/HANDOFF.md` §2, add a row after the scrub-previews row:

```markdown
| Thumbnail extraction engine | Native `frame-grabber` module (candidate ladder + luma/std-dev scoring), durable document-dir storage, migration v7, background sweep, hero-size frames; scrub strip moved onto the same extractor | ✅ merged, device-verified (phone) |
```

Also update the §7 Changelog with one bullet:

```markdown
- **Thumbnail extraction engine** — native `frame-grabber` module picks a scored mid-video frame instead of a fixed 1s grab (the black-tile bug), writes correctly-sized JPEGs to the document dir, and a background sweep fills the library. Spec/plan: [thumbnail-design](./superpowers/specs/2026-07-31-thumbnail-extraction-design.md), [thumbnail-plan](./superpowers/plans/2026-07-31-thumbnail-extraction.md).
```

- [ ] **Step 5: Final verification**

Run: `npx tsc --noEmit && npm test`
Expected: clean, green. Record the test count — it should be the previous total plus the ~25 assertions added in Tasks 1-3.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json docs/HANDOFF.md docs/CHANGELOG.md
git commit -m "chore: drop expo-video-thumbnails; document the thumbnail engine"
```

---

## Tuning notes (after device verification)

Everything worth tuning is a constant in `src/media/thumb-policy.ts`, and changing any of them means bumping `THUMB_VERSION` so existing thumbnails regenerate:

- **Still too many dark frames** → raise `THUMB_MIN_SCORE` (0.12 → 0.18). Costs more decodes per video.
- **Frames land on recaps or credits** → reorder `CANDIDATE_FRACTIONS`.
- **Files too large** → drop `THUMB_QUALITY_CARD` to 0.7 before touching the width; JPEG quality is the cheaper lever.

Deliberately out of scope, per the spec: letterbox bar trimming and animated hover previews.
