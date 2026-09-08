# Moments Phase 1 — Capture & Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the exact on-screen frame, position, cleaned-up title and subtitle-seeded note as a durable "moment" from the player, persisted to SQLite and to shared storage that survives uninstall.

**Architecture:** A `moments` table with no foreign key to `videos` (so a deleted file cannot cascade a moment away) holding a frozen snapshot of everything a card needs. Frames are written straight into `/storage/emulated/0/53XY/Moments/` behind a `.nomedia`, alongside a `moments.json` manifest that makes the folder the durable truth and SQLite the fast index. The capture orchestrator takes its collaborators as injected dependencies so the whole pipeline is Jest-testable without a device.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-sqlite, expo-file-system (new `Directory`/`File` API), the local `modules/frame-grabber` Expo module (Kotlin), Jest + jest-expo.

**Spec:** [docs/superpowers/specs/2026-09-08-moments-design.md](../specs/2026-09-08-moments-design.md)

## Global Constraints

- **Expo has changed.** Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify against `node_modules/<pkg>/build/types/*.d.ts` when the docs are thin. (`AGENTS.md`)
- **Package manager is `bun`.** `npx expo install` for Expo deps, `bun add` for others. Checks: `npm test` and `npx tsc --noEmit`.
- **Android-only.** No iOS or web branches.
- **Device verification is the user's**, on their own build. Do all code, tests, `tsc` and commits, then hand over the checklist at the end of this plan.
- **Task 1 changes native Kotlin**, so everything from Task 1 onward needs `npx expo run:android` before it can be exercised on a device. The user has explicitly accepted this.
- **Capture constants** (`src/moments/moment-policy.ts`): `MOMENT_WIDTH = 1280`, `MOMENT_QUALITY = 0.9`, `SNACKBAR_MS = 5000`, `RELINK_DURATION_TOLERANCE_MS = 1000`.
- **Shared storage path** is exactly `file:///storage/emulated/0/53XY/Moments`.
- **No `Co-Authored-By` or "Generated with" trailers** in commits unless the session harness requires them; plain conventional commits otherwise.
- **Work on branch `feat/moments-capture`**, never on `main` directly.

---

### Task 0: Create the feature branch

**Files:** none

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/moments-capture
git status --short
```

Expected: a clean tree on `feat/moments-capture`.

---

### Task 1: Native exact-position frame grabbing

`MediaMetadataRetriever.OPTION_CLOSEST_SYNC` snaps to the nearest keyframe. For a poster frame that is the right trade (it is dramatically faster); for a bookmark it is wrong, because at a typical 5–10 second GOP the saved image can show a completely different shot from the one the user stopped on. This task adds an opt-in `exact` flag; every existing caller keeps today's behaviour by passing nothing.

**Files:**
- Modify: `modules/frame-grabber/android/src/main/java/expo/modules/framegrabber/FrameGrabberModule.kt`
- Modify: `modules/frame-grabber/src/FrameGrabberModule.ts`
- Modify: `modules/frame-grabber/src/FrameGrabberModule.web.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `GrabFrameOptions.exact?: boolean` — when true the native side seeks to the exact frame rather than the nearest keyframe. Consumed by Task 7.

**No Jest coverage.** Kotlin is not reachable from jest-expo, and there is no device in this session. Verification is `npx tsc --noEmit` plus the device checklist item at the end of this plan. Do not fabricate a test that only asserts the TypeScript type exists.

- [ ] **Step 1: Add the `exact` field to the Kotlin options record**

In `FrameGrabberModule.kt`, extend `GrabOptions`:

```kotlin
class GrabOptions : Record {
  @Field var positionsMs: List<Double> = emptyList()
  @Field var targetWidth: Int = 640
  @Field var minScore: Double = 0.0
  @Field var quality: Double = 0.8
  @Field var outPath: String = ""
  /**
   * Seek to the exact frame instead of the nearest keyframe. Costs a decode
   * forward from the preceding keyframe, so it is opt-in: poster frames and
   * scrub previews do not care which frame in the neighbourhood they get, and
   * a saved moment cares about nothing else.
   */
  @Field var exact: Boolean = false
}
```

- [ ] **Step 2: Thread it through the call site**

Still in `FrameGrabberModule.kt`, the loop inside `AsyncFunction("grabFrame")` currently reads:

```kotlin
        for (positionMs in options.positionsMs) {
          val bitmap = grabScaled(retriever, (positionMs * 1000).toLong(), options.targetWidth)
            ?: continue
```

Change it to pass the flag:

```kotlin
        for (positionMs in options.positionsMs) {
          val bitmap =
            grabScaled(retriever, (positionMs * 1000).toLong(), options.targetWidth, options.exact)
              ?: continue
```

- [ ] **Step 3: Honour the flag in `grabScaled`**

Replace the whole `grabScaled` function (its doc comment included — the existing comment asserts the opposite of the new behaviour and must not survive):

```kotlin
  /**
   * `exact = false` uses OPTION_CLOSEST_SYNC, which snaps to the nearest
   * keyframe — sub-second precision is irrelevant for a poster frame and exact
   * seeking is dramatically slower. `exact = true` uses OPTION_CLOSEST and pays
   * that cost, which is what a saved moment needs: at a 5-10s GOP the keyframe
   * next to the user's position can be an entirely different shot.
   *
   * The scale box is square so the aspect-preserving fit yields `targetWidth`
   * for landscape video and caps height for portrait.
   */
  private fun grabScaled(
    retriever: MediaMetadataRetriever,
    timeUs: Long,
    targetWidth: Int,
    exact: Boolean,
  ): Bitmap? {
    val option =
      if (exact) MediaMetadataRetriever.OPTION_CLOSEST
      else MediaMetadataRetriever.OPTION_CLOSEST_SYNC
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      return retriever.getScaledFrameAtTime(timeUs, option, targetWidth, targetWidth)
    }
    val full = retriever.getFrameAtTime(timeUs, option) ?: return null
    // Fit inside a targetWidth x targetWidth box on the longer edge, matching the
    // API >= O_MR1 path above. Scaling by width alone overshoots for portrait video:
    // a 1080x1920 source at targetWidth=640 would come out 640x1137 (longest edge
    // 1137, ~3.2x the intended pixel area) instead of 360x640.
    val longerEdge = max(full.width, full.height)
    if (longerEdge <= targetWidth) return full
    val scale = targetWidth.toFloat() / longerEdge
    val width = (full.width * scale).toInt().coerceAtLeast(1)
    val height = (full.height * scale).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(full, width, height, true)
    if (scaled !== full) full.recycle()
    return scaled
  }
```

- [ ] **Step 4: Add the TypeScript option**

In `modules/frame-grabber/src/FrameGrabberModule.ts`, add to `GrabFrameOptions`, after `outPath`:

```ts
  /**
   * Seek to the exact frame rather than the nearest keyframe. Slower, and only
   * worth it when the caller asked for one specific frame (a saved moment).
   * Defaults to false, which is what thumbnails and scrub previews want.
   */
  exact?: boolean;
```

- [ ] **Step 5: Leave the web stub alone**

No edit needed, and this step exists so you don't make one. `FrameGrabberModule.web.ts` imports `GrabFrameOptions` from `./FrameGrabberModule` rather than redeclaring it, so it picks up `exact` automatically, and its `grabFrame` already returns `null` unconditionally. Confirm by reading the file; it should be 12 lines and mention no option names.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add modules/frame-grabber
git commit -m "feat(frame-grabber): add exact-position seek option

OPTION_CLOSEST_SYNC snaps to the nearest keyframe, which is right for
poster frames and wrong for a saved moment: at a 5-10s GOP the frame
written can be a different shot from the one on screen. Opt-in, so
thumbnails and scrub previews keep the fast path."
```

---

### Task 2: Moment types, policy constants, and display naming

**Files:**
- Create: `src/moments/types.ts`
- Create: `src/moments/moment-policy.ts`
- Create: `src/moments/moment-title.ts`
- Test: `src/moments/__tests__/moment-title.test.ts`

**Interfaces:**
- Consumes: `normalizeTitle` (`@/library/normalize-title`), `parseEpisode` (`@/library/parse-episode`), `formatEpisodeLabel` (`@/library/episode-label`).
- Produces:
  - `interface Moment` — the record shape used by every later task.
  - `momentDisplay(filename: string): { title: string; episodeLabel: string | null }`
  - Constants `MOMENT_WIDTH`, `MOMENT_QUALITY`, `SNACKBAR_MS`, `RELINK_DURATION_TOLERANCE_MS`, `MOMENTS_DIR_NAME`, `MANIFEST_FILENAME`, `SHARED_MOMENTS_DIR`.

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/moment-title.test.ts`:

```ts
import { momentDisplay } from '../moment-title';

describe('momentDisplay', () => {
  it('splits a series filename into a clean title and an episode label', () => {
    expect(momentDisplay('Boston.Legal.S02E14.1080p.WEB-DL.x265.mkv')).toEqual({
      title: 'Boston Legal',
      episodeLabel: 'S02E14',
    });
  });

  it('gives a movie a null episode label and strips release junk', () => {
    expect(momentDisplay('Inception.2010.1080p.BluRay.x264.mkv')).toEqual({
      title: 'Inception',
      episodeLabel: null,
    });
  });

  it('falls back to the filename when normalization leaves nothing', () => {
    // The episode marker is at index 0, so normalizeTitle cuts everything.
    // A card must never render an empty title.
    expect(momentDisplay('S01E01.mkv')).toEqual({
      title: 'S01E01.mkv',
      episodeLabel: 'S01E01',
    });
  });

  it('handles a filename with no episode information at all', () => {
    expect(momentDisplay('holiday clip.mp4')).toEqual({
      title: 'holiday clip',
      episodeLabel: null,
    });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/moments/__tests__/moment-title.test.ts`
Expected: FAIL — cannot find module `../moment-title`.

- [ ] **Step 3: Write the types**

Create `src/moments/types.ts`:

```ts
/**
 * A captured scene. Deliberately self-contained: every field needed to render
 * a moment card is snapshotted here at capture time, so a moment survives its
 * source video being deleted from the library (see the spec's §2).
 */
export interface Moment {
  id: string;
  /** MediaStore id at capture time. A relink hint, not an ownership edge. */
  videoId: string | null;
  positionMs: number;
  createdAt: number;
  /** file:// uri of the saved JPEG; null when the frame grab failed. */
  frameUri: string | null;
  /** Seeded from the on-screen subtitle line, then user-editable. */
  note: string | null;
  // ── snapshot: written once, never refreshed ──
  title: string;
  episodeLabel: string | null;
  filename: string;
  folder: string | null;
  videoUri: string | null;
  durationMs: number | null;
}
```

- [ ] **Step 4: Write the policy constants**

Create `src/moments/moment-policy.ts`:

```ts
/** Longest edge of a saved frame, in pixels. Big enough to show someone. */
export const MOMENT_WIDTH = 1280;
/** JPEG quality for a saved frame, 0..1. Higher than a thumbnail's: this one is looked at. */
export const MOMENT_QUALITY = 0.9;
/** How long the capture confirmation stays on screen. */
export const SNACKBAR_MS = 5000;
/**
 * Container-reported durations drift slightly between scans, so a relink match
 * on duration needs tolerance. Used in Phase 2.
 */
export const RELINK_DURATION_TOLERANCE_MS = 1000;

/** Folder name under the app document directory, used only in the fallback case. */
export const MOMENTS_DIR_NAME = 'moments';
export const MANIFEST_FILENAME = 'moments.json';
/**
 * Primary home for frames. Shared storage, so it survives uninstall and Clear
 * Data; a `.nomedia` in it keeps the gallery and media scanner out.
 */
export const SHARED_MOMENTS_DIR = 'file:///storage/emulated/0/53XY/Moments';
```

- [ ] **Step 5: Write the minimal implementation**

Create `src/moments/moment-title.ts`:

```ts
import { formatEpisodeLabel } from '@/library/episode-label';
import { normalizeTitle } from '@/library/normalize-title';
import { parseEpisode } from '@/library/parse-episode';

export interface MomentDisplay {
  title: string;
  episodeLabel: string | null;
}

/**
 * The name a moment is remembered by, derived exactly the way the group screen
 * derives a group title — no second naming scheme to keep in sync.
 *
 * Falls back to the raw filename when normalization leaves nothing, which
 * happens when the episode marker is the whole name ("S01E01.mkv"): a moment
 * card with a blank title would be unrecognizable.
 */
export function momentDisplay(filename: string): MomentDisplay {
  const { season, episode } = parseEpisode(filename);
  const label = formatEpisodeLabel(season, episode);
  const title = normalizeTitle(filename);
  return {
    title: title || filename,
    episodeLabel: label || null,
  };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx jest src/moments`
Expected: PASS, 4 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments
git commit -m "feat(moments): add moment types, policy constants and display naming"
```

---

### Task 3: Migration v11 — the `moments` table

**Files:**
- Modify: `src/db/schema.ts`
- Test: `src/db/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `Migration` from `@/db/migrate`.
- Produces: table `moments` with columns `id, video_id, position_ms, created_at, frame_uri, note, title, episode_label, filename, folder, video_uri, duration_ms`, plus indexes `idx_moments_created` and `idx_moments_video`. `LATEST_VERSION` becomes 11.

- [ ] **Step 1: Write the failing test**

Append to the `describe('schema migrations', ...)` block in `src/db/__tests__/schema.test.ts`:

```ts
  it('migration 11 creates moments with no foreign key to videos', () => {
    const m11 = MIGRATIONS.find((m) => m.version === 11);
    expect(m11).toBeDefined();
    expect(m11!.up).toContain('CREATE TABLE IF NOT EXISTS moments');
    // \s+ rather than the literal run of spaces: the migration aligns its
    // column types for readability, and a test that breaks when someone
    // re-aligns them is testing whitespace, not schema.
    expect(m11!.up).toMatch(/position_ms\s+INTEGER NOT NULL/);
    expect(m11!.up).toMatch(/title\s+TEXT NOT NULL/);
    // The whole point of the feature: a scan removing the video row must not
    // cascade the user's saved moments away.
    expect(m11!.up).not.toMatch(/REFERENCES\s+videos/i);
    expect(m11!.up).not.toMatch(/ON DELETE CASCADE/i);
  });

  it('migration 11 indexes moments for the tab and for per-video lookup', () => {
    const m11 = MIGRATIONS.find((m) => m.version === 11);
    expect(m11!.up).toContain('CREATE INDEX IF NOT EXISTS idx_moments_created');
    expect(m11!.up).toContain('CREATE INDEX IF NOT EXISTS idx_moments_video');
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/db/__tests__/schema.test.ts`
Expected: FAIL — `m11` is undefined, and the `LATEST_VERSION` test still passes at 10.

- [ ] **Step 3: Write the migration**

In `src/db/schema.ts`, append to the `MIGRATIONS` array after the version 10 entry, and bump the exported constant:

```ts
  {
    version: 11,
    // No FOREIGN KEY to videos, and that omission is load-bearing. A scan that
    // finds a file gone calls deleteVideosByIds; playlist_items and
    // manual_groups cascade off videos and lose their rows, which is correct
    // for them. A moment must outlive its file — that is the whole feature —
    // so it carries its own snapshot of everything a card renders instead.
    up: `
      CREATE TABLE IF NOT EXISTS moments (
        id            TEXT PRIMARY KEY NOT NULL,
        video_id      TEXT,
        position_ms   INTEGER NOT NULL,
        created_at    INTEGER NOT NULL,
        frame_uri     TEXT,
        note          TEXT,
        title         TEXT NOT NULL,
        episode_label TEXT,
        filename      TEXT NOT NULL,
        folder        TEXT,
        video_uri     TEXT,
        duration_ms   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_moments_created ON moments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moments_video ON moments(video_id, position_ms);
    `,
  },
];

export const LATEST_VERSION = 11;
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/db`
Expected: PASS — including the pre-existing `LATEST_VERSION matches the highest migration version` test, now at 11.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): add moments table in migration v11

No foreign key to videos on purpose: deleteVideosByIds runs whenever a
scan finds a file gone, and a moment has to outlive its file."
```

---

### Task 4: `moments-repo`

**Files:**
- Create: `src/db/moments-repo.ts`
- Test: `src/db/__tests__/moments-repo.test.ts`

**Interfaces:**
- Consumes: `Moment` from `@/moments/types`.
- Produces:
  - `insertMoment(db: SQLiteDatabase, moment: Moment): Promise<void>`
  - `getMoments(db: SQLiteDatabase): Promise<Moment[]>` — newest first
  - `getMomentsForVideo(db: SQLiteDatabase, videoId: string): Promise<Moment[]>` — ascending by position
  - `updateMomentNote(db: SQLiteDatabase, id: string, note: string | null): Promise<void>`
  - `deleteMoment(db: SQLiteDatabase, id: string): Promise<void>`
  - `replaceAllMoments(db: SQLiteDatabase, moments: Moment[]): Promise<void>` — used by Phase 3's restore

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/moments-repo.test.ts`. The `fakeDb` helper mirrors `thumbs-repo.test.ts` so the two read the same way:

```ts
import {
  deleteMoment,
  getMoments,
  getMomentsForVideo,
  insertMoment,
  replaceAllMoments,
  updateMomentNote,
} from '../moments-repo';
import type { Moment } from '@/moments/types';

type Call = { sql: string; params?: unknown[] };

function fakeDb(rows: unknown[] = []) {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return undefined as never;
    },
    async getAllAsync<T>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return rows as T[];
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      await fn();
    },
  };
  return { db: db as never, calls };
}

const sample: Moment = {
  id: 'm1',
  videoId: 'v1',
  positionMs: 2_472_000,
  createdAt: 1_757_000_000_000,
  frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
  note: 'Denny gets the case',
  title: 'Boston Legal',
  episodeLabel: 'S02E14',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies/Boston Legal',
  videoUri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  durationMs: 2_580_000,
};

const dbRow = {
  id: 'm1',
  video_id: 'v1',
  position_ms: 2_472_000,
  created_at: 1_757_000_000_000,
  frame_uri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
  note: 'Denny gets the case',
  title: 'Boston Legal',
  episode_label: 'S02E14',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies/Boston Legal',
  video_uri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  duration_ms: 2_580_000,
};

describe('moments-repo', () => {
  it('insertMoment writes every snapshot column', async () => {
    const { db, calls } = fakeDb();
    await insertMoment(db, sample);
    expect(calls[0].sql).toContain('INSERT INTO moments');
    expect(calls[0].params).toEqual([
      'm1',
      'v1',
      2_472_000,
      1_757_000_000_000,
      'file:///storage/emulated/0/53XY/Moments/m1.jpg',
      'Denny gets the case',
      'Boston Legal',
      'S02E14',
      'Boston.Legal.S02E14.mkv',
      'Movies/Boston Legal',
      'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
      2_580_000,
    ]);
  });

  it('getMoments maps rows back and orders newest first', async () => {
    const { db, calls } = fakeDb([dbRow]);
    const moments = await getMoments(db);
    expect(moments).toEqual([sample]);
    expect(calls[0].sql).toContain('ORDER BY created_at DESC');
  });

  it('maps a frameless moment without inventing a uri', async () => {
    const { db } = fakeDb([{ ...dbRow, frame_uri: null, note: null, episode_label: null }]);
    const [moment] = await getMoments(db);
    expect(moment.frameUri).toBeNull();
    expect(moment.note).toBeNull();
    expect(moment.episodeLabel).toBeNull();
  });

  it('getMomentsForVideo filters by video and orders by position', async () => {
    const { db, calls } = fakeDb([dbRow]);
    await getMomentsForVideo(db, 'v1');
    expect(calls[0].sql).toContain('WHERE video_id = ?');
    expect(calls[0].sql).toContain('ORDER BY position_ms');
    expect(calls[0].params).toEqual(['v1']);
  });

  it('updateMomentNote writes the note for one id', async () => {
    const { db, calls } = fakeDb();
    await updateMomentNote(db, 'm1', 'new note');
    expect(calls[0].sql).toContain('UPDATE moments');
    expect(calls[0].params).toEqual(['new note', 'm1']);
  });

  it('deleteMoment removes one row', async () => {
    const { db, calls } = fakeDb();
    await deleteMoment(db, 'm1');
    expect(calls[0].sql).toContain('DELETE FROM moments WHERE id = ?');
    expect(calls[0].params).toEqual(['m1']);
  });

  it('replaceAllMoments clears the table before inserting', async () => {
    const { db, calls } = fakeDb();
    await replaceAllMoments(db, [sample]);
    expect(calls[0].sql).toContain('DELETE FROM moments');
    expect(calls[1].sql).toContain('INSERT INTO moments');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/db/__tests__/moments-repo.test.ts`
Expected: FAIL — cannot find module `../moments-repo`.

- [ ] **Step 3: Write the implementation**

Create `src/db/moments-repo.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Moment } from '@/moments/types';

interface MomentDbRow {
  id: string;
  video_id: string | null;
  position_ms: number;
  created_at: number;
  frame_uri: string | null;
  note: string | null;
  title: string;
  episode_label: string | null;
  filename: string;
  folder: string | null;
  video_uri: string | null;
  duration_ms: number | null;
}

const COLUMNS = `id, video_id, position_ms, created_at, frame_uri, note,
                 title, episode_label, filename, folder, video_uri, duration_ms`;

function fromRow(r: MomentDbRow): Moment {
  return {
    id: r.id,
    videoId: r.video_id,
    positionMs: r.position_ms,
    createdAt: r.created_at,
    frameUri: r.frame_uri,
    note: r.note,
    title: r.title,
    episodeLabel: r.episode_label,
    filename: r.filename,
    folder: r.folder,
    videoUri: r.video_uri,
    durationMs: r.duration_ms,
  };
}

function toParams(m: Moment): unknown[] {
  return [
    m.id,
    m.videoId,
    m.positionMs,
    m.createdAt,
    m.frameUri,
    m.note,
    m.title,
    m.episodeLabel,
    m.filename,
    m.folder,
    m.videoUri,
    m.durationMs,
  ];
}

const INSERT_SQL = `INSERT INTO moments (${COLUMNS})
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function insertMoment(db: SQLiteDatabase, moment: Moment): Promise<void> {
  await db.runAsync(INSERT_SQL, toParams(moment));
}

/** Newest first — the order the Moments tab renders. */
export async function getMoments(db: SQLiteDatabase): Promise<Moment[]> {
  const rows = await db.getAllAsync<MomentDbRow>(
    `SELECT ${COLUMNS} FROM moments ORDER BY created_at DESC`,
  );
  return rows.map(fromRow);
}

/** Ascending by position — the order the seekbar draws its ticks. */
export async function getMomentsForVideo(
  db: SQLiteDatabase,
  videoId: string,
): Promise<Moment[]> {
  const rows = await db.getAllAsync<MomentDbRow>(
    `SELECT ${COLUMNS} FROM moments WHERE video_id = ? ORDER BY position_ms`,
    [videoId],
  );
  return rows.map(fromRow);
}

export async function updateMomentNote(
  db: SQLiteDatabase,
  id: string,
  note: string | null,
): Promise<void> {
  await db.runAsync('UPDATE moments SET note = ? WHERE id = ?', [note, id]);
}

export async function deleteMoment(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM moments WHERE id = ?', [id]);
}

/**
 * Swap the whole table for a restored set. Used by the Phase 3 restore flow,
 * which only ever runs against an empty table, but clearing first keeps it
 * idempotent if a restore is ever offered twice.
 */
export async function replaceAllMoments(
  db: SQLiteDatabase,
  moments: Moment[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM moments');
    for (const moment of moments) {
      await db.runAsync(INSERT_SQL, toParams(moment));
    }
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/db/__tests__/moments-repo.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/db/moments-repo.ts src/db/__tests__/moments-repo.test.ts
git commit -m "feat(db): add moments-repo"
```

---

### Task 5: The manifest

`moments.json` is what makes the folder — not the database — the durable truth. Parsing must be tolerant: a manifest written by a future version, or half-corrupted on disk, has to yield as many usable moments as it can rather than throwing away the lot.

**Files:**
- Create: `src/moments/manifest.ts`
- Test: `src/moments/__tests__/manifest.test.ts`

**Interfaces:**
- Consumes: `Moment` from `./types`.
- Produces:
  - `MANIFEST_VERSION: number`
  - `toManifestJson(moments: Moment[]): string`
  - `fromManifestJson(json: string): Moment[]`

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/manifest.test.ts`:

```ts
import { fromManifestJson, toManifestJson } from '../manifest';
import type { Moment } from '../types';

const sample: Moment = {
  id: 'm1',
  videoId: 'v1',
  positionMs: 2_472_000,
  createdAt: 1_757_000_000_000,
  frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
  note: 'Denny gets the case',
  title: 'Boston Legal',
  episodeLabel: 'S02E14',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies/Boston Legal',
  videoUri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  durationMs: 2_580_000,
};

describe('manifest', () => {
  it('round-trips a moment unchanged', () => {
    expect(fromManifestJson(toManifestJson([sample]))).toEqual([sample]);
  });

  it('writes a version so a future reader can tell what it is holding', () => {
    expect(JSON.parse(toManifestJson([sample])).version).toBe(1);
  });

  it('returns nothing for unparseable json rather than throwing', () => {
    expect(fromManifestJson('{ not json')).toEqual([]);
    expect(fromManifestJson('')).toEqual([]);
  });

  it('returns nothing when moments is missing or not an array', () => {
    expect(fromManifestJson('{"version":1}')).toEqual([]);
    expect(fromManifestJson('{"version":1,"moments":"nope"}')).toEqual([]);
  });

  it('skips entries missing a required field and keeps the rest', () => {
    const json = JSON.stringify({
      version: 1,
      moments: [{ ...sample, id: undefined }, sample, { ...sample, title: 42 }],
    });
    expect(fromManifestJson(json)).toEqual([sample]);
  });

  it('ignores unknown fields from a newer writer', () => {
    const json = JSON.stringify({
      version: 99,
      moments: [{ ...sample, somethingNew: 'ignored' }],
    });
    expect(fromManifestJson(json)).toEqual([sample]);
  });

  it('defaults absent optional fields to null', () => {
    const json = JSON.stringify({
      version: 1,
      moments: [
        {
          id: 'm2',
          positionMs: 1000,
          createdAt: 5,
          title: 'Clip',
          filename: 'clip.mp4',
        },
      ],
    });
    expect(fromManifestJson(json)).toEqual([
      {
        id: 'm2',
        videoId: null,
        positionMs: 1000,
        createdAt: 5,
        frameUri: null,
        note: null,
        title: 'Clip',
        episodeLabel: null,
        filename: 'clip.mp4',
        folder: null,
        videoUri: null,
        durationMs: null,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/moments/__tests__/manifest.test.ts`
Expected: FAIL — cannot find module `../manifest`.

- [ ] **Step 3: Write the implementation**

Create `src/moments/manifest.ts`:

```ts
import type { Moment } from './types';

export const MANIFEST_VERSION = 1;

export function toManifestJson(moments: Moment[]): string {
  return JSON.stringify({ version: MANIFEST_VERSION, moments }, null, 2);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * One entry, or null if it is unusable. Required fields are the ones a card
 * cannot render without; everything else falls back to null, which every
 * consumer already handles (a frameless moment shows a placeholder).
 */
function parseMoment(raw: unknown): Moment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const id = str(r.id);
  const title = str(r.title);
  const filename = str(r.filename);
  const positionMs = num(r.positionMs);
  const createdAt = num(r.createdAt);
  if (id === null || title === null || filename === null) return null;
  if (positionMs === null || createdAt === null) return null;

  return {
    id,
    videoId: str(r.videoId),
    positionMs,
    createdAt,
    frameUri: str(r.frameUri),
    note: str(r.note),
    title,
    episodeLabel: str(r.episodeLabel),
    filename,
    folder: str(r.folder),
    videoUri: str(r.videoUri),
    durationMs: num(r.durationMs),
  };
}

/**
 * Tolerant by design. This file is the durable copy of the user's moments and
 * is read on a fresh install, so a single bad entry — or a manifest from a
 * newer version of the app — must never cost them the rest.
 */
export function fromManifestJson(json: string): Moment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const { moments } = parsed as { moments?: unknown };
  if (!Array.isArray(moments)) return [];
  return moments.map(parseMoment).filter((m): m is Moment => m !== null);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments`
Expected: PASS — the 4 `moment-title` tests plus 7 manifest tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments/manifest.ts src/moments/__tests__/manifest.test.ts
git commit -m "feat(moments): add tolerant moments.json manifest"
```

---

### Task 6: Storage — directory choice and file I/O

**Files:**
- Create: `src/moments/moments-dir.ts`
- Create: `src/moments/storage.ts`
- Test: `src/moments/__tests__/moments-dir.test.ts`

**Interfaces:**
- Consumes: `SHARED_MOMENTS_DIR`, `MOMENTS_DIR_NAME`, `MANIFEST_FILENAME` from `./moment-policy`; `fromManifestJson`, `toManifestJson` from `./manifest`; `Moment` from `./types`.
- Produces:
  - `pickMomentsDir(externalWritable: boolean, documentDir: string): string` (pure)
  - `frameFileName(id: string): string` (pure)
  - `framePath(dir: string, id: string): string` (pure)
  - `ensureMomentsDir(): string` — creates the directory and its `.nomedia`, returns the resolved dir uri
  - `writeManifest(dir: string, moments: Moment[]): void`
  - `readManifest(dir: string): Moment[]`
  - `deleteFrame(frameUri: string | null): void`

The pure decisions live in `moments-dir.ts` and are tested; the file-system calls live in `storage.ts` and are verified on device, matching how `thumb-policy.ts` and `thumbnails.ts` are split.

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/moments-dir.test.ts`:

```ts
import { framePath, frameFileName, pickMomentsDir } from '../moments-dir';
import { SHARED_MOMENTS_DIR } from '../moment-policy';

describe('pickMomentsDir', () => {
  it('prefers shared storage, so moments survive uninstall', () => {
    expect(pickMomentsDir(true, 'file:///data/user/0/app/files/')).toBe(SHARED_MOMENTS_DIR);
  });

  it('falls back to the document directory when shared storage is unwritable', () => {
    expect(pickMomentsDir(false, 'file:///data/user/0/app/files/')).toBe(
      'file:///data/user/0/app/files/moments',
    );
  });

  it('does not double the separator when the document dir lacks a trailing slash', () => {
    expect(pickMomentsDir(false, 'file:///data/user/0/app/files')).toBe(
      'file:///data/user/0/app/files/moments',
    );
  });
});

describe('frame paths', () => {
  it('names a frame after its moment id', () => {
    expect(frameFileName('m1')).toBe('m1.jpg');
  });

  it('joins a dir and an id into one path with a single separator', () => {
    expect(framePath(SHARED_MOMENTS_DIR, 'm1')).toBe(
      'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    );
    expect(framePath('file:///a/b/', 'm1')).toBe('file:///a/b/m1.jpg');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/moments/__tests__/moments-dir.test.ts`
Expected: FAIL — cannot find module `../moments-dir`.

- [ ] **Step 3: Write the pure module**

Create `src/moments/moments-dir.ts`:

```ts
import { MOMENTS_DIR_NAME, SHARED_MOMENTS_DIR } from './moment-policy';

function join(base: string, segment: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}/${segment}`;
}

/**
 * Where frames go. Shared storage is strongly preferred: it is what makes a
 * moment survive uninstall and Clear Data. The app document directory is the
 * fallback — not the cache directory, which Android evicts under storage
 * pressure, the exact failure `thumbnails.ts` documents.
 */
export function pickMomentsDir(externalWritable: boolean, documentDir: string): string {
  return externalWritable ? SHARED_MOMENTS_DIR : join(documentDir, MOMENTS_DIR_NAME);
}

export function frameFileName(id: string): string {
  return `${id}.jpg`;
}

export function framePath(dir: string, id: string): string {
  return join(dir, frameFileName(id));
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments/__tests__/moments-dir.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the I/O module**

Before writing, confirm against `node_modules/expo-file-system/build/` that `Directory` accepts an absolute `file://` uri outside the app sandbox and exposes `.exists`, `.create()`, and that `File` exposes `.exists`, `.create()`, `.write()`, `.text()`, `.delete()`. Adjust the calls below to match the installed typings if they differ, keeping the exported signatures identical.

Create `src/moments/storage.ts`:

```ts
import { Directory, File, Paths } from 'expo-file-system';

import { fromManifestJson, toManifestJson } from './manifest';
import { MANIFEST_FILENAME } from './moment-policy';
import { pickMomentsDir } from './moments-dir';
import type { Moment } from './types';

/**
 * Resolved once per app run. The probe below touches the filesystem, and the
 * answer cannot change while the process lives.
 */
let cachedDir: string | null = null;

/**
 * True when the shared 53XY/Moments directory exists or can be created.
 * MANAGE_EXTERNAL_STORAGE is already granted for subtitle reading, so this
 * normally succeeds; it can still fail on an unusual device or if the user
 * revoked the permission, which is what the fallback is for.
 */
function sharedStorageWritable(dir: string): boolean {
  try {
    const directory = new Directory(dir);
    if (!directory.exists) directory.create({ intermediates: true });
    return directory.exists;
  } catch {
    return false;
  }
}

/**
 * Creates the moments directory and its `.nomedia`, and returns the directory
 * uri. `.nomedia` is what keeps saved frames out of the gallery and away from
 * the screenshots folder — the entire reason this feature exists.
 */
export function ensureMomentsDir(): string {
  if (cachedDir) return cachedDir;

  const shared = pickMomentsDir(true, Paths.document.uri);
  const dir = sharedStorageWritable(shared)
    ? shared
    : pickMomentsDir(false, Paths.document.uri);

  const directory = new Directory(dir);
  if (!directory.exists) directory.create({ intermediates: true });

  const nomedia = new File(directory, '.nomedia');
  if (!nomedia.exists) nomedia.create();

  cachedDir = dir;
  return dir;
}

export function writeManifest(dir: string, moments: Moment[]): void {
  const file = new File(new Directory(dir), MANIFEST_FILENAME);
  if (!file.exists) file.create();
  file.write(toManifestJson(moments));
}

/** Empty when the manifest is absent, unreadable, or unparseable. */
export function readManifest(dir: string): Moment[] {
  try {
    const file = new File(new Directory(dir), MANIFEST_FILENAME);
    if (!file.exists) return [];
    return fromManifestJson(file.text());
  } catch {
    return [];
  }
}

/** Best-effort: a frame that is already gone is not an error. */
export function deleteFrame(frameUri: string | null): void {
  if (!frameUri) return;
  try {
    const file = new File(frameUri);
    if (file.exists) file.delete();
  } catch {
    // A frame we cannot delete is a leaked file, not a failed user action.
  }
}
```

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
npx jest src/moments
git add src/moments
git commit -m "feat(moments): add shared-storage directory resolution and manifest I/O

Frames go to /storage/emulated/0/53XY/Moments behind a .nomedia so they
survive uninstall without ever reaching the gallery; the app document
directory is the fallback."
```

---

### Task 7: The capture pipeline

The orchestrator takes its collaborators as arguments, which is what makes the whole capture path testable in Jest with no device, no native module, and no filesystem.

**Files:**
- Create: `src/moments/capture.ts`
- Test: `src/moments/__tests__/capture.test.ts`

**Interfaces:**
- Consumes: `momentDisplay` (Task 2), `framePath` (Task 6), `MOMENT_QUALITY`/`MOMENT_WIDTH` (Task 2), `GrabFrameOptions`/`GrabFrameResult` (Task 1), `Moment` (Task 2).
- Produces:
  - `interface CaptureInput { video: CaptureVideo; positionMs: number; note: string }`
  - `interface CaptureVideo { id: string; uri: string; filename: string; folder: string | null; durationMs: number | null }`
  - `interface CaptureDeps { grabFrame; insert; syncManifest; momentsDir; now; newId }`
  - `captureMoment(input: CaptureInput, deps: CaptureDeps): Promise<Moment>`

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/capture.test.ts`:

```ts
import { captureMoment, type CaptureDeps, type CaptureInput } from '../capture';
import type { GrabFrameOptions } from '../../../modules/frame-grabber/src/FrameGrabberModule';
import type { Moment } from '../types';

const video = {
  id: 'v1',
  uri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies',
  durationMs: 2_580_000,
};

const input: CaptureInput = { video, positionMs: 2_472_000, note: 'Denny gets the case' };

function deps(overrides: Partial<CaptureDeps> = {}) {
  const inserted: Moment[] = [];
  const base: CaptureDeps = {
    // `opts` must be annotated: the repo typechecks tests, and an inferred
    // parameter here trips noImplicitAny.
    grabFrame: jest.fn(async (_uri: string, opts: GrabFrameOptions) => ({
      uri: opts.outPath,
      positionMs: 2_472_000,
      score: 0.5,
    })),
    insert: jest.fn(async (m: Moment) => {
      inserted.push(m);
    }),
    syncManifest: jest.fn(async () => {}),
    momentsDir: 'file:///storage/emulated/0/53XY/Moments',
    now: () => 1_757_000_000_000,
    newId: () => 'm1',
    ...overrides,
  };
  return { deps: base, inserted };
}

describe('captureMoment', () => {
  it('builds a full snapshot from the video and the grabbed frame', async () => {
    const { deps: d, inserted } = deps();
    const moment = await captureMoment(input, d);

    expect(moment).toEqual({
      id: 'm1',
      videoId: 'v1',
      positionMs: 2_472_000,
      createdAt: 1_757_000_000_000,
      frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
      note: 'Denny gets the case',
      title: 'Boston Legal',
      episodeLabel: 'S02E14',
      filename: 'Boston.Legal.S02E14.mkv',
      folder: 'Movies',
      videoUri: video.uri,
      durationMs: 2_580_000,
    });
    expect(inserted).toEqual([moment]);
  });

  it('asks for exactly this frame, not a nearby keyframe', async () => {
    const { deps: d } = deps();
    await captureMoment(input, d);

    expect(d.grabFrame).toHaveBeenCalledWith(video.uri, {
      positionsMs: [2_472_000],
      targetWidth: 1280,
      minScore: 0,
      quality: 0.9,
      exact: true,
      outPath: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    });
  });

  it('still saves the moment when the frame grab finds nothing', async () => {
    const { deps: d, inserted } = deps({ grabFrame: jest.fn(async () => null) });
    const moment = await captureMoment(input, d);

    expect(moment.frameUri).toBeNull();
    expect(moment.positionMs).toBe(2_472_000);
    expect(inserted).toHaveLength(1);
  });

  it('still saves the moment when the frame grab throws', async () => {
    const { deps: d, inserted } = deps({
      grabFrame: jest.fn(async () => {
        throw new Error('decoder gone');
      }),
    });
    const moment = await captureMoment(input, d);

    expect(moment.frameUri).toBeNull();
    expect(inserted).toHaveLength(1);
  });

  it('survives a failed manifest write, since the row is already saved', async () => {
    const { deps: d } = deps({
      syncManifest: jest.fn(async () => {
        throw new Error('read-only fs');
      }),
    });
    await expect(captureMoment(input, d)).resolves.toMatchObject({ id: 'm1' });
  });

  it('stores an empty subtitle line as no note rather than an empty string', async () => {
    const { deps: d } = deps();
    const moment = await captureMoment({ ...input, note: '   ' }, d);
    expect(moment.note).toBeNull();
  });

  it('propagates a failed insert, because nothing was saved', async () => {
    const { deps: d } = deps({
      insert: jest.fn(async () => {
        throw new Error('db locked');
      }),
    });
    await expect(captureMoment(input, d)).rejects.toThrow('db locked');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/moments/__tests__/capture.test.ts`
Expected: FAIL — cannot find module `../capture`.

- [ ] **Step 3: Write the implementation**

Create `src/moments/capture.ts`:

```ts
import type {
  GrabFrameOptions,
  GrabFrameResult,
} from '../../modules/frame-grabber/src/FrameGrabberModule';
import { momentDisplay } from './moment-title';
import { MOMENT_QUALITY, MOMENT_WIDTH } from './moment-policy';
import { framePath } from './moments-dir';
import type { Moment } from './types';

/** The subset of a library video a capture needs. */
export interface CaptureVideo {
  id: string;
  uri: string;
  filename: string;
  folder: string | null;
  durationMs: number | null;
}

export interface CaptureInput {
  video: CaptureVideo;
  positionMs: number;
  /** The on-screen subtitle line, or '' when none is showing. */
  note: string;
}

/**
 * Collaborators are injected rather than imported so the whole pipeline is
 * testable without a device: the native grabber, the database and the
 * filesystem all arrive as plain functions.
 */
export interface CaptureDeps {
  grabFrame: (uri: string, options: GrabFrameOptions) => Promise<GrabFrameResult | null>;
  insert: (moment: Moment) => Promise<void>;
  /** Rewrites moments.json from the current table. */
  syncManifest: () => Promise<void>;
  momentsDir: string;
  now: () => number;
  newId: () => string;
}

export async function captureMoment(
  { video, positionMs, note }: CaptureInput,
  deps: CaptureDeps,
): Promise<Moment> {
  const id = deps.newId();
  const outPath = framePath(deps.momentsDir, id);
  const { title, episodeLabel } = momentDisplay(video.filename);

  // A missing frame is a degraded moment, not a failed one: the position, the
  // title and the note are what make it findable again.
  let frameUri: string | null = null;
  try {
    const result = await deps.grabFrame(video.uri, {
      positionsMs: [positionMs],
      targetWidth: MOMENT_WIDTH,
      // 0 disables the black/flat-frame rejection that poster selection wants.
      // The user pointed at this frame; second-guessing it is the bug.
      minScore: 0,
      quality: MOMENT_QUALITY,
      exact: true,
      outPath,
    });
    frameUri = result?.uri ?? null;
  } catch {
    frameUri = null;
  }

  const moment: Moment = {
    id,
    videoId: video.id,
    positionMs,
    createdAt: deps.now(),
    frameUri,
    note: note.trim() || null,
    title,
    episodeLabel,
    filename: video.filename,
    folder: video.folder,
    videoUri: video.uri,
    durationMs: video.durationMs,
  };

  await deps.insert(moment);

  // The row is already durable in SQLite, so a manifest failure must not turn
  // a successful capture into an error the user sees. The next capture or note
  // edit rewrites it.
  try {
    await deps.syncManifest();
  } catch {
    // intentionally swallowed
  }

  return moment;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments`
Expected: PASS — 7 capture tests plus the 16 from Tasks 2, 5 and 6.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments/capture.ts src/moments/__tests__/capture.test.ts
git commit -m "feat(moments): add capture pipeline

Collaborators are injected so the grab/insert/manifest path is fully
tested without a device. A failed frame grab or manifest write degrades
the moment rather than losing it."
```

---

### Task 8: The capture hook

Wires the injected pipeline to the real database, native module and filesystem, so the player screen stays declarative.

**Files:**
- Create: `src/moments/use-capture-moment.ts`

**Interfaces:**
- Consumes: `captureMoment`, `CaptureInput` (Task 7); `ensureMomentsDir`, `writeManifest` (Task 6); `insertMoment`, `getMoments`, `updateMomentNote` (Task 4); `FrameGrabber` (`@/native/frame-grabber`).
- Produces:
  - `useCaptureMoment(): (input: CaptureInput) => Promise<Moment>`
  - `useUpdateMomentNote(): (id: string, note: string) => Promise<void>`

**No Jest coverage.** These are thin `useCallback` wrappers over already-tested units, and the project has no React-hook test setup (every existing test file is a plain `.ts` over pure logic). Verification is `npx tsc --noEmit` plus the device checklist.

- [ ] **Step 1: Write the hook**

Create `src/moments/use-capture-moment.ts`:

```ts
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { getMoments, insertMoment, updateMomentNote } from '@/db/moments-repo';
import { FrameGrabber } from '@/native/frame-grabber';
import { captureMoment, type CaptureInput } from './capture';
import { ensureMomentsDir, writeManifest } from './storage';
import type { Moment } from './types';

function newMomentId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Captures the current frame and persists it. Throws only if the DB write fails. */
export function useCaptureMoment(): (input: CaptureInput) => Promise<Moment> {
  const db = useSQLiteContext();

  return useCallback(
    (input: CaptureInput) => {
      const dir = ensureMomentsDir();
      return captureMoment(input, {
        grabFrame: (uri, options) => FrameGrabber.grabFrame(uri, options),
        insert: (moment) => insertMoment(db, moment),
        syncManifest: async () => writeManifest(dir, await getMoments(db)),
        momentsDir: dir,
        now: Date.now,
        newId: newMomentId,
      });
    },
    [db],
  );
}

/** Saves an edited note and keeps the manifest in step. */
export function useUpdateMomentNote(): (id: string, note: string) => Promise<void> {
  const db = useSQLiteContext();

  return useCallback(
    async (id: string, note: string) => {
      await updateMomentNote(db, id, note.trim() || null);
      try {
        writeManifest(ensureMomentsDir(), await getMoments(db));
      } catch {
        // Same reasoning as capture: the row is saved; the mirror can lag.
      }
    },
    [db],
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments/use-capture-moment.ts
git commit -m "feat(moments): add capture and note-edit hooks"
```

---

### Task 9: Capture confirmation snackbar and note sheet

**Files:**
- Create: `src/components/player/moment-snackbar.tsx`
- Create: `src/components/player/moment-note-sheet.tsx`

**Interfaces:**
- Consumes: `SNACKBAR_MS` (Task 2), `formatTime` (`@/player/format-time`), `useTheme` (`@/theme/theme-provider`), `PlayerPressableScale`, `PressableScale`.
- Produces:
  - `<MomentSnackbar positionSec={number} onEdit={() => void} onDismiss={() => void} />`
  - `<MomentNoteSheet initialNote={string} onSave={(note: string) => void} onClose={() => void} />`

**No Jest coverage.** The project has no `.tsx` test files and no React Native Testing Library setup in use; all logic these components could get wrong (the timer pattern) is copied verbatim from `ResumeSnackbar`, which the same device checklist already covers. Verification is `npx tsc --noEmit` plus the device checklist.

- [ ] **Step 1: Write the snackbar**

Create `src/components/player/moment-snackbar.tsx`. The callback-ref timer is not optional: the player re-renders roughly once a second from `timeUpdate`, and a plain `useEffect([onDismiss])` would re-arm the timer on every one of those renders and never fire.

```tsx
// src/components/player/moment-snackbar.tsx
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/player/format-time';
import { SNACKBAR_MS } from '@/moments/moment-policy';
import { useTheme } from '@/theme/theme-provider';
import { PlayerPressableScale } from './player-pressable-scale';

interface MomentSnackbarProps {
  /** Position the moment was captured at. */
  positionSec: number;
  onEdit: () => void;
  onDismiss: () => void;
}

export function MomentSnackbar({ positionSec, onEdit, onDismiss }: MomentSnackbarProps) {
  const { colors, spacing, radius } = useTheme();

  // Auto-dismiss once, SNACKBAR_MS after mount. A callback ref keeps the latest
  // onDismiss without re-arming the timer on every parent re-render (the player
  // re-renders ~1x/s from timeUpdate, which otherwise resets it). Same pattern
  // as ResumeSnackbar.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inverseSurface ?? 'rgba(30,30,30,0.92)',
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
      ]}>
      <Text style={[styles.label, { color: colors.inverseOnSurface ?? '#fff' }]}>
        Moment saved · {formatTime(positionSec)}
      </Text>
      <Text style={[styles.dot, { color: colors.inverseOnSurface ?? '#fff' }]}>{'·'}</Text>
      <PlayerPressableScale onPress={onEdit} style={styles.editButton}>
        <Text style={[styles.editLabel, { color: colors.inversePrimary ?? '#90caf9' }]}>Edit</Text>
      </PlayerPressableScale>
    </View>
  );
}

// Copied field-for-field from ResumeSnackbar so the two snackbars are
// indistinguishable — same gap, same weights, same inversePrimary fallback.
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  dot: {
    fontSize: 14,
  },
  editButton: {
    paddingHorizontal: 4,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Write the note sheet**

Create `src/components/player/moment-note-sheet.tsx`, following `SleepSheet`'s modal structure:

```tsx
// src/components/player/moment-note-sheet.tsx
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

interface MomentNoteSheetProps {
  /** Seeded from the subtitle line showing at capture; may be ''. */
  initialNote: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

export function MomentNoteSheet({ initialNote, onSave, onClose }: MomentNoteSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const [note, setNote] = useState(initialNote);

  function save() {
    onSave(note);
    onClose();
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1e1e1e',
              borderRadius: radius.xl,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              paddingHorizontal: spacing.lg,
              marginHorizontal: spacing.md,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.outline ?? '#555' }]} />
          <Text style={[styles.header, { color: colors.onSurface }]}>Note</Text>

          <TextInput
            value={note}
            onChangeText={setNote}
            autoFocus
            multiline
            placeholder="What happens here?"
            placeholderTextColor={colors.onSurfaceVariant ?? '#999'}
            style={[
              styles.input,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceVariant ?? 'rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: spacing.md,
                marginTop: spacing.sm,
              },
            ]}
          />

          <View style={[styles.actions, { marginTop: spacing.lg }]}>
            <PressableScale onPress={onClose}>
              <Text style={[styles.action, { color: colors.onSurfaceVariant ?? '#999' }]}>
                Cancel
              </Text>
            </PressableScale>
            <PressableScale onPress={save}>
              <Text style={[styles.action, { color: colors.primary, marginLeft: 24 }]}>Save</Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    marginBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    minHeight: 96,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  action: {
    fontSize: 15,
    fontWeight: '700',
  },
});
```

The `backdrop`, `sheet`, `handle` and `header` styles above are copied from `SleepSheet` verbatim, so the two sheets are indistinguishable. Don't "improve" them.

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/player/moment-snackbar.tsx src/components/player/moment-note-sheet.tsx
git commit -m "feat(moments): add capture snackbar and note sheet"
```

---

### Task 10: Wire capture into the player

**Files:**
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `useCaptureMoment`, `useUpdateMomentNote` (Task 8); `MomentSnackbar`, `MomentNoteSheet` (Task 9); `Moment` (Task 2).
- Produces: nothing consumed by a later Phase 1 task.

**No Jest coverage** — screen wiring, verified by `npx tsc --noEmit` and the device checklist.

- [ ] **Step 1: Add the imports**

Alongside the other player imports in `src/app/player.tsx`:

```ts
import { MomentNoteSheet } from '@/components/player/moment-note-sheet';
import { MomentSnackbar } from '@/components/player/moment-snackbar';
import { useCaptureMoment, useUpdateMomentNote } from '@/moments/use-capture-moment';
import type { Moment } from '@/moments/types';
```

- [ ] **Step 2: Add state and the capture handler**

Near the other `useState` declarations (beside `const [toast, setToast] = useState<string | null>(null);` around line 273):

```ts
  const [savedMoment, setSavedMoment] = useState<Moment | null>(null);
  const [noteSheetFor, setNoteSheetFor] = useState<Moment | null>(null);
```

Then, after the `showToast` definition (around line 449) so `showToast` is already in scope:

```ts
  const captureMoment = useCaptureMoment();
  const updateMomentNote = useUpdateMomentNote();

  // Position comes from the cached ref, never player.currentTime: expo-video
  // can have released the shared object, and reading through it throws.
  const handleCaptureMoment = useCallback(async () => {
    const video = videosRef.current.find((v) => v.id === videoId);
    if (!video) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const moment = await captureMoment({
        video: {
          id: video.id,
          uri: video.uri,
          filename: video.filename,
          folder: video.folder,
          durationMs: video.durationMs,
        },
        positionMs: Math.round(lastPositionSecRef.current * 1000),
        note: subtitles.activeText,
      });
      setSavedMoment(moment);
    } catch {
      showToast('Could not save moment');
    }
  }, [captureMoment, videoId, subtitles.activeText, showToast]);

  const handleSaveNote = useCallback(
    (note: string) => {
      if (!noteSheetFor) return;
      const { id } = noteSheetFor;
      void updateMomentNote(id, note).catch(() => showToast('Could not save note'));
    },
    [noteSheetFor, updateMomentNote, showToast],
  );
```

`Haptics` is already imported at `src/app/player.tsx:6` for the long-press-to-2× feedback, and `useCallback`/`useRef`/`useState` at line 12. No import changes are needed beyond Step 1's.

- [ ] **Step 3: Add the bookmark button to the top bar**

In the `topBarRight` JSX (around line 945), add a `ChromeButton` as the **first** child, before the sleep button:

```tsx
      <ChromeButton onPress={() => void handleCaptureMoment()}>
        <MaterialIcons name="bookmark-add" size={22} color="#fff" />
      </ChromeButton>
```

`bookmark-add` is present in the installed MaterialIcons glyph map (verified against `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json`), so no fallback is needed.

- [ ] **Step 4: Render the snackbar outside the controls overlay**

The confirmation must survive chrome auto-hide — otherwise the **Edit** button disappears a few seconds after capture, which is exactly when the user reaches for it. Place it beside the `AutoplayCard` block (around line 1094): inside `PlayerGestures` so its button wins the gesture arena, but outside `ControlsOverlay` so auto-hide does not take it.

```tsx
            {savedMoment && (
              <View style={styles.snackbarContainer} pointerEvents="box-none">
                <MomentSnackbar
                  positionSec={savedMoment.positionMs / 1000}
                  onEdit={() => {
                    setNoteSheetFor(savedMoment);
                    setSavedMoment(null);
                  }}
                  onDismiss={() => setSavedMoment(null)}
                />
              </View>
            )}
```

- [ ] **Step 5: Render the note sheet**

Beside the `SleepSheet` block (around line 1137):

```tsx
          {noteSheetFor && (
            <MomentNoteSheet
              initialNote={noteSheetFor.note ?? ''}
              onSave={handleSaveNote}
              onClose={() => setNoteSheetFor(null)}
            />
          )}
```

- [ ] **Step 6: Pause playback while the note sheet is open**

Typing a note while the film runs on underneath loses the user their place. Add near the other effects:

```ts
  // Typing a note while the video plays means missing the next scene. Pause on
  // open and resume on close, but only if it was actually playing — reopening
  // the sheet on a paused video must not start playback.
  //
  // `playing` is read through a ref and NOT listed as a dependency, which is
  // load-bearing. player.pause() flips `playing` to false; if it were a
  // dependency, that flip would re-run the effect, fire the cleanup, and call
  // player.play() again — resuming the video underneath the open sheet.
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const resumeAfterNoteRef = useRef(false);
  useEffect(() => {
    if (!noteSheetFor) return;
    resumeAfterNoteRef.current = playingRef.current;
    player.pause();
    return () => {
      if (resumeAfterNoteRef.current) player.play();
    };
  }, [noteSheetFor, player]);
```

- [ ] **Step 7: Typecheck, test, commit**

```bash
npx tsc --noEmit
npm test
git add src/app/player.tsx
git commit -m "feat(player): capture a moment from the top bar

Bookmark button grabs the exact frame, position and on-screen subtitle
line. The confirmation renders outside ControlsOverlay so chrome
auto-hide cannot take the Edit button away."
```

---

### Task 11: Full check and documentation

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Run everything**

```bash
npm test
npx tsc --noEmit
git status --short
```

Expected: all tests pass, typecheck clean, working tree clean.

- [ ] **Step 2: Update the handoff**

In `docs/HANDOFF.md`:
- Add Moments to **Current capabilities**: capture the exact on-screen frame with position, cleaned-up title and subtitle-seeded note; stored in `moments` (v11) with frames in `/storage/emulated/0/53XY/Moments` behind a `.nomedia`.
- Add a **Key fact**: the `moments` table has no FK to `videos` on purpose — `deleteVideosByIds` runs on every scan that finds a file gone, and a moment must outlive its file.
- Add a **Key fact**: `FrameGrabber.grabFrame` takes `exact` — `OPTION_CLOSEST` instead of `OPTION_CLOSEST_SYNC`. Slower, and required for anything that must show one specific frame.
- Update **What's next** to point at Phase 2 (browse & play) of the Moments spec.

- [ ] **Step 3: Update the changelog**

Add a Moments Phase 1 entry to `docs/CHANGELOG.md` matching the file's existing format.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: record Moments phase 1"
```

---

## Device verification checklist (for the user)

Phase 1 touches Kotlin, so this needs a full rebuild, not a JS reload:

```bash
npx expo run:android
```

Then check:

1. **Capture works.** Play a video, tap the bookmark icon in the top bar. A "Moment saved · MM:SS" snackbar appears with an **Edit** action; playback does not stop.
2. **The frame is the right one.** Capture during a fast-cut scene — a chase, a rapid dialogue cut. The saved JPEG in `/storage/emulated/0/53XY/Moments/` must show the frame that was on screen, not one from a second or two away. This is the whole point of the native change; if it is off, `exact` is not reaching the Kotlin side.
3. **The snackbar outlives the chrome.** Capture, then wait for the controls to auto-hide. The snackbar and its **Edit** button must still be there until they time out on their own.
4. **The note seeds from subtitles.** With an external subtitle loaded, capture while a line is on screen, tap **Edit** — the line should be pre-filled. Save an edit and reopen to confirm it persisted.
5. **Nothing reaches the gallery.** Open the gallery/photos app and confirm no captured frames appear. Confirm `/storage/emulated/0/53XY/Moments/.nomedia` exists.
6. **The manifest is written.** Confirm `/storage/emulated/0/53XY/Moments/moments.json` exists and lists the moments you captured, with correct titles and episode labels.
7. **Series naming is clean.** Capture from a TV episode file and confirm `moments.json` shows a cleaned title plus an `episodeLabel` like `S02E14`, not the raw release filename.
8. **A frameless capture still saves.** Optional: capture from a file whose thumbnails have never generated. The moment should still land in `moments.json` with `frameUri: null`.

Report which of these hold; anything that fails feeds a fix before Phase 2 starts.
