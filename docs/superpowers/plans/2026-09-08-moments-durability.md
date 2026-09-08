# Moments Phase 3 — Durability & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the durability loop — let a reinstalled app recover its moments from the manifest on disk, let the user put a frame in their gallery deliberately, mark saved moments on the scrub bar, and give Settings real control over the whole store.

**Architecture:** Every decision stays pure and Jest-tested (`restorableMoments`, `markerFractions`, `formatBytes`); the I/O and screens follow the patterns Phases 1–2 established. Nothing here touches native code, so this phase ships on a JS reload.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-sqlite, expo-file-system, expo-media-library (class-based `Asset`/`Album` API), Reanimated (existing `Seekbar`).

**Spec:** [2026-09-08-moments-design.md](../specs/2026-09-08-moments-design.md) — §5 restore, §6 seekbar ticks and save-to-gallery, §9 Phasing.

## Global Constraints

- Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify against installed `node_modules/<pkg>/build/**/*.d.ts` when docs are thin (`AGENTS.md`).
- Package manager is `bun`. Tests `npm test`, typecheck `npx tsc --noEmit`.
- Android-only.
- Commits are plain conventional commits with **no** `Co-Authored-By:` trailer, no `Claude-Session:` line, no "Generated with Claude Code" text.
- Branch `feat/moments-durability`, off `main` (Phases 1, 1.5 and 2 are all merged).
- Screens, components and hooks get **no Jest coverage** — this repo has no `.tsx` test files and no React Native Testing Library setup in use. Adding a component test or testing dependency is a defect, not an improvement. Pure modules are fully tested.
- Every swallowing `catch` gets a `console.warn`, per the convention across `src/moments/`.
- Destructive actions confirm first via `Alert`, following `deleteVideos` in `src/library/media-actions.ts`.

### Already built — reuse, do not reimplement

Phases 1–2 deliberately laid this groundwork:

- `src/moments/storage.ts` → `ensureMomentsDir()`, `readManifest(dir)`, `writeManifest(dir, moments)`, `deleteFrame(uri)`, `momentsDirIsShared()`, `invalidateMomentsDir()` — all synchronous
- `src/db/moments-repo.ts` → `getMoments`, `getMomentsForVideo(db, videoId)` (ascending by position, built for the ticks), `deleteMoments`, `replaceAllMoments(db, moments)` (built for restore)
- `src/app/settings/player.tsx` already has a Moments storage-location row with an All-files-access action
- `src/components/player/seekbar.tsx` — the track is `overflow: 'hidden'` with `marginHorizontal: THUMB_SIZE / 2`, so ticks drawn inside the track clip correctly to it

### SDK facts already verified — do not re-derive

- `MediaLibrary.Asset.create(filePath: string, album?: Album): Promise<Asset>` — the class-based way to save. The legacy `createAssetAsync`/`saveToLibraryAsync` live in `legacyWarnings.d.ts` and **throw at runtime** in SDK 56.
- `MediaLibrary.Album.get(title: string): Promise<Album | null>` and `Album.create(name, assetsRefs, moveAssets?): Promise<Album>`
- `MediaLibrary.requestPermissionsAsync(writeOnly?: boolean)` — pass `true`; saving needs write access only.
- `src/library/media-actions.ts` already uses the class API (`MediaLibrary.Asset.delete`) — match its idiom.

### One deliberate deviation from the spec

§5 says the restore offer appears **"on launch"**. This plan puts it in the **Moments tab's empty state** plus an explicit Settings action instead. A modal on cold start interrupts before the user has any context and fires for someone who may simply have no moments yet; an empty Moments tab is exactly where a reinstalled user looks for their missing moments, and Settings is where they go deliberately. This still satisfies the spec's real requirements — the restore is *offered, never automatic*, declining does not delete the manifest, and the offer persists rather than being one-shot. Flagged here so the reviewer does not treat it as a miss.

---

### Task 1: Decide what can be restored, and format sizes

**Files:**
- Create: `src/moments/restore-moments.ts`
- Test: `src/moments/__tests__/restore-moments.test.ts`

**Interfaces:**
- Consumes: `Moment` (`./types`).
- Produces:
  - `restorableMoments(manifest: Moment[], frameExists: (uri: string) => boolean): Moment[]`
  - `formatBytes(bytes: number): string`

Both are pure; `frameExists` is injected so the filter is testable without a filesystem.

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/restore-moments.test.ts`:

```ts
import { formatBytes, restorableMoments } from '../restore-moments';
import type { Moment } from '../types';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: null,
    durationMs: 2000,
    ...over,
  };
}

describe('restorableMoments', () => {
  const present = () => true;
  const absent = () => false;

  it('restores a moment whose frame is still on disk', () => {
    expect(restorableMoments([moment()], present)).toEqual([moment()]);
  });

  it('drops a moment whose frame file is gone', () => {
    // The row would restore pointing at nothing, rendering permanently broken.
    expect(restorableMoments([moment()], absent)).toEqual([]);
  });

  it('keeps a frameless moment, which never had a file to lose', () => {
    const frameless = moment({ frameUri: null });
    expect(restorableMoments([frameless], absent)).toEqual([frameless]);
  });

  it('checks each frame individually', () => {
    const a = moment({ id: 'a', frameUri: 'file:///a.jpg' });
    const b = moment({ id: 'b', frameUri: 'file:///b.jpg' });
    const only = (uri: string) => uri === 'file:///a.jpg';
    expect(restorableMoments([a, b], only).map((m) => m.id)).toEqual(['a']);
  });

  it('returns nothing for an empty manifest', () => {
    expect(restorableMoments([], present)).toEqual([]);
  });
});

describe('formatBytes', () => {
  it('shows plain bytes below a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
  });

  it('scales to KB and MB with one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(Math.round(1024 * 1024 * 3.5))).toBe('3.5 MB');
  });

  it('never renders a negative or non-finite size', () => {
    // A stat() failure must not put "NaN MB" in front of the user.
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/moments/__tests__/restore-moments.test.ts`
Expected: FAIL — cannot find module `../restore-moments`.

- [ ] **Step 3: Write the implementation**

Create `src/moments/restore-moments.ts`:

```ts
import type { Moment } from './types';

/**
 * The manifest entries worth putting back into the database.
 *
 * A moment whose JPEG is missing would restore into a card that can never
 * render its frame, so it is dropped — the manifest is the durable copy, but
 * only as far as the files beside it survived. A moment that never had a
 * frame (the grab failed at capture) keeps its position, title and note, which
 * are the load-bearing parts, so it restores.
 *
 * `frameExists` is injected to keep this decision testable without a
 * filesystem.
 */
export function restorableMoments(
  manifest: Moment[],
  frameExists: (uri: string) => boolean,
): Moment[] {
  return manifest.filter((m) => m.frameUri === null || frameExists(m.frameUri));
}

const KB = 1024;
const MB = KB * 1024;

/** Human-readable size for the Settings row. Never renders NaN or a negative. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments`
Expected: PASS — 8 new tests plus the existing moments suite.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments/restore-moments.ts src/moments/__tests__/restore-moments.test.ts
git commit -m "feat(moments): decide what a restore can recover, and format sizes"
```

---

### Task 2: Seekbar tick positions

**Files:**
- Create: `src/player/moment-markers.ts`
- Test: `src/player/__tests__/moment-markers.test.ts`

**Interfaces:**
- Produces: `markerFractions(positionsMs: number[], durationMs: number): number[]`

Pure: turns moment positions into 0–1 fractions the seekbar can lay out, dropping anything that cannot be placed.

- [ ] **Step 1: Write the failing test**

Create `src/player/__tests__/moment-markers.test.ts`:

```ts
import { markerFractions } from '../moment-markers';

describe('markerFractions', () => {
  it('maps positions onto 0-1 of the duration', () => {
    expect(markerFractions([0, 30_000, 60_000], 60_000)).toEqual([0, 0.5, 1]);
  });

  it('returns nothing when the duration is unknown', () => {
    // Duration arrives asynchronously; before it does there is nowhere to draw.
    expect(markerFractions([1000], 0)).toEqual([]);
    expect(markerFractions([1000], -1)).toEqual([]);
  });

  it('returns nothing for no positions', () => {
    expect(markerFractions([], 60_000)).toEqual([]);
  });

  it('drops a position beyond the duration rather than drawing off the bar', () => {
    // A relinked file can be a slightly different cut, so a stored position
    // can sit past the end.
    expect(markerFractions([90_000], 60_000)).toEqual([]);
  });

  it('drops a negative position', () => {
    expect(markerFractions([-5], 60_000)).toEqual([]);
  });

  it('keeps the order it was given', () => {
    expect(markerFractions([45_000, 15_000], 60_000)).toEqual([0.75, 0.25]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/player/__tests__/moment-markers.test.ts`
Expected: FAIL — cannot find module `../moment-markers`.

- [ ] **Step 3: Write the implementation**

Create `src/player/moment-markers.ts`:

```ts
/**
 * Where to draw a tick for each saved moment, as a 0-1 fraction of the bar.
 *
 * Positions outside the video are dropped rather than clamped: a moment can
 * outlive an exact file and be relinked to a slightly different cut, and a tick
 * pinned to the very end would claim a scene is there when it is not.
 */
export function markerFractions(positionsMs: number[], durationMs: number): number[] {
  if (durationMs <= 0) return [];
  const out: number[] = [];
  for (const ms of positionsMs) {
    if (ms < 0 || ms > durationMs) continue;
    out.push(ms / durationMs);
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/player`
Expected: PASS — 6 new tests plus the existing player suite.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/player/moment-markers.ts src/player/__tests__/moment-markers.test.ts
git commit -m "feat(player): compute seekbar tick positions for saved moments"
```

---

### Task 3: Draw the ticks

**Files:**
- Modify: `src/components/player/seekbar.tsx`
- Modify: `src/components/player/bottom-bar.tsx`
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `markerFractions` (Task 2), `getMomentsForVideo` (`@/db/moments-repo`).
- Produces: `Seekbar` and `BottomBar` both gain an optional `markers?: number[]` prop (0–1 fractions).

**No Jest coverage** — presentational. Verification is `npx tsc --noEmit`.

- [ ] **Step 1: Add the prop to `Seekbar`**

Read `src/components/player/seekbar.tsx` first. Add to `SeekbarProps`:

```ts
  /** 0-1 fractions marking saved moments. Presentational only — not interactive. */
  markers?: number[];
```

Render them **inside** the existing track `View`, after the filled portion, so the track's `overflow: 'hidden'` clips them to the bar:

```tsx
          {markers?.map((fraction, i) => (
            <View
              key={`${fraction}-${i}`}
              pointerEvents="none"
              style={[styles.marker, { left: `${fraction * 100}%` }]}
            />
          ))}
```

and add to the stylesheet:

```ts
  marker: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
```

The ticks must not intercept touches — the whole bar is a pan gesture — hence `pointerEvents="none"`.

- [ ] **Step 2: Thread it through `BottomBar`**

Read `src/components/player/bottom-bar.tsx`, add `markers?: number[]` to its props, and pass it straight to `<Seekbar markers={markers} />`. Change nothing else.

- [ ] **Step 3: Load this video's moments in the player**

In `src/app/player.tsx`, near the other data effects, load the current video's moments and convert them once duration is known:

```ts
  const [momentPositionsMs, setMomentPositionsMs] = useState<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    getMomentsForVideo(db, videoId)
      .then((rows) => {
        if (!cancelled) setMomentPositionsMs(rows.map((m) => m.positionMs));
      })
      .catch((e) => console.warn('[moments] failed to load seekbar markers:', e));
    return () => {
      cancelled = true;
    };
  }, [db, videoId]);

  const seekbarMarkers = useMemo(
    () => markerFractions(momentPositionsMs, durationSec * 1000),
    [momentPositionsMs, durationSec],
  );
```

Pass `markers={seekbarMarkers}` to `<BottomBar />`. Add the imports for `getMomentsForVideo` and `markerFractions`.

The `cancelled` guard matches the convention in `src/library/use-all-videos.ts`. Note this deliberately does not refresh when a moment is captured mid-playback; a tick appearing under the thumb as you capture is not worth an extra query on every capture, and the marks are correct on the next open.

- [ ] **Step 4: Typecheck, test, commit**

```bash
npx tsc --noEmit
npm test
git add src/components/player src/app/player.tsx
git commit -m "feat(player): mark saved moments on the seekbar"
```

---

### Task 4: Save a frame to the gallery

**Files:**
- Create: `src/moments/save-to-gallery.ts`
- Modify: `src/app/moment.tsx`

**Interfaces:**
- Produces: `saveFrameToGallery(frameUri: string): Promise<'saved' | 'denied' | 'failed'>`

**No Jest coverage** — it is a thin wrapper over a native module with no logic worth isolating. Verification is `npx tsc --noEmit` plus the device checklist.

- [ ] **Step 1: Write the module**

Create `src/moments/save-to-gallery.ts`:

```ts
import * as MediaLibrary from 'expo-media-library';

/** Gallery album saved frames are grouped into, so they are easy to find and to delete. */
const ALBUM = '53XY';

/**
 * Copy a saved frame into the user's photo library, deliberately.
 *
 * Moments live behind a `.nomedia` precisely so they never clutter the
 * gallery; this is the one path that opts a single frame in, so it asks for
 * permission at the moment of use rather than up front. Write-only access is
 * all that is needed — the app never reads the user's photos.
 */
export async function saveFrameToGallery(
  frameUri: string,
): Promise<'saved' | 'denied' | 'failed'> {
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) return 'denied';

    const asset = await MediaLibrary.Asset.create(frameUri);
    // Grouping is a nicety, not the point — a frame that lands in the gallery
    // but not in the album is still saved, so an album failure is swallowed.
    try {
      const album = await MediaLibrary.Album.get(ALBUM);
      if (album) await album.add([asset]);
      else await MediaLibrary.Album.create(ALBUM, [asset], false);
    } catch (e) {
      console.warn('[moments] saved the frame but could not file it under the album:', e);
    }
    return 'saved';
  } catch (e) {
    console.warn('[moments] failed to save frame to the gallery:', e);
    return 'failed';
  }
}
```

**Verify against the installed typings** before relying on the album calls: `node_modules/expo-media-library/build/types/Album.d.ts` for whether an `add` instance method exists and its exact signature, and `.../types/Asset.d.ts` for `Asset.create`. `Asset.create(filePath, album?)` takes an optional album, so if there is no usable `add`, get-or-create the album first and pass it to `Asset.create` instead. Adapt to what the SDK provides while keeping the exported signature above. The legacy `createAssetAsync`/`saveToLibraryAsync` **throw at runtime** in SDK 56 — do not use them.

- [ ] **Step 2: Add the action to the detail screen**

In `src/app/moment.tsx`, add a `ListItem` to the existing actions group, between "Share frame" and "Delete moment". `ListItem` takes `title`, optional `subtitle`, and optional `onPress` (omitting `onPress` is how a row reads as unavailable):

```tsx
            <ListItem
              title="Save frame to gallery"
              subtitle={moment.frameUri ? undefined : 'This moment has no saved frame'}
              onPress={moment.frameUri ? onSaveToGallery : undefined}
            />
```

with the handler beside the others:

```ts
  const onSaveToGallery = useCallback(async () => {
    if (!moment?.frameUri) return;
    const result = await saveFrameToGallery(moment.frameUri);
    if (result === 'saved') ToastAndroid.show('Saved to gallery', ToastAndroid.SHORT);
    else if (result === 'denied') {
      Alert.alert('Permission needed', 'Allow photo access to save this frame to your gallery.');
    } else {
      Alert.alert('Could not save', 'Something went wrong saving the frame.');
    }
  }, [moment]);
```

`ToastAndroid` is used elsewhere in this project (`src/library/media-actions.ts`); import it from `react-native` alongside `Alert`.

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npm test
git add src/moments/save-to-gallery.ts src/app/moment.tsx
git commit -m "feat(moments): save a frame to the gallery on demand"
```

---

### Task 5: Store statistics and destructive actions

**Files:**
- Modify: `src/moments/storage.ts`
- Create: `src/moments/moments-store.ts`

**Interfaces:**
- Consumes: `restorableMoments` (Task 1), `readManifest`, `ensureMomentsDir`, `writeManifest`, `deleteFrame` (`./storage`), `replaceAllMoments`, `getMoments`, `deleteMoments` (`@/db/moments-repo`).
- Produces:
  - `frameBytes(moments: Moment[]): number` in `storage.ts` — total size of the frames on disk
  - `restoreMomentsFromManifest(db): Promise<number>` in `moments-store.ts` — returns how many were restored
  - `clearAllMoments(db): Promise<void>` in `moments-store.ts`
  - `pendingRestoreCount(db): Promise<number>` in `moments-store.ts` — how many the manifest could restore when the table is empty; `0` when the table already has rows

**No Jest coverage** for these — they are filesystem and database I/O over already-tested pure decisions.

- [ ] **Step 1: Add the size helper to `storage.ts`**

Read `src/moments/storage.ts` first. Note `clearAllMoments` below empties the manifest with `writeManifest(dir, [])` rather than deleting the file, so the folder keeps a valid (empty) manifest and a later capture has nothing to repair.

```ts
/** Total bytes the saved frames occupy. Unreadable files count as zero. */
export function frameBytes(moments: Moment[]): number {
  let total = 0;
  for (const moment of moments) {
    if (!moment.frameUri) continue;
    try {
      const file = new File(moment.frameUri);
      if (file.exists) total += file.size ?? 0;
    } catch (e) {
      console.warn('[moments] could not size frame:', moment.frameUri, e);
    }
  }
  return total;
}
```

**Verify `File.size`** against `node_modules/expo-file-system/build/File.d.ts` — check the property name, its type, and whether it is synchronous. This project has twice been bitten by assuming a file-system member was synchronous when it was not, so check rather than assume, and adapt while keeping the signature above.

- [ ] **Step 2: Write the store operations**

Create `src/moments/moments-store.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';

import { deleteMoments, getMoments, replaceAllMoments } from '@/db/moments-repo';
import { restorableMoments } from './restore-moments';
import { deleteFrame, ensureMomentsDir, readManifest, writeManifest } from './storage';

function frameExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * How many moments the manifest on disk could put back.
 *
 * Zero once the table has any rows: the manifest is a recovery copy, and
 * offering to "restore" over live data would be a way to lose the newer of the
 * two. This is what the Moments tab's empty state asks before offering.
 */
export async function pendingRestoreCount(db: SQLiteDatabase): Promise<number> {
  try {
    const existing = await getMoments(db);
    if (existing.length > 0) return 0;
    return restorableMoments(readManifest(ensureMomentsDir()), frameExists).length;
  } catch (e) {
    console.warn('[moments] could not check for a restorable manifest:', e);
    return 0;
  }
}

/** Puts the manifest's usable moments back. Returns how many were restored. */
export async function restoreMomentsFromManifest(db: SQLiteDatabase): Promise<number> {
  const recovered = restorableMoments(readManifest(ensureMomentsDir()), frameExists);
  if (recovered.length === 0) return 0;
  await replaceAllMoments(db, recovered);
  // Rewrite from what actually landed, so the manifest stops advertising
  // entries whose frames were missing.
  try {
    writeManifest(ensureMomentsDir(), recovered);
  } catch (e) {
    console.warn('[moments] restored but could not rewrite the manifest:', e);
  }
  return recovered.length;
}

/**
 * Delete every moment: rows first, then frames, then the manifest — the same
 * order the per-moment deletes use, so a failure leaves leaked files rather
 * than rows pointing at deleted ones.
 */
export async function clearAllMoments(db: SQLiteDatabase): Promise<void> {
  const all = await getMoments(db);
  await deleteMoments(db, all.map((m) => m.id));
  for (const moment of all) deleteFrame(moment.frameUri);
  try {
    writeManifest(ensureMomentsDir(), []);
  } catch (e) {
    console.warn('[moments] cleared moments but could not rewrite the manifest:', e);
  }
}
```

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npm test
git add src/moments/storage.ts src/moments/moments-store.ts
git commit -m "feat(moments): add store statistics, restore and clear-all"
```

---

### Task 6: The Settings group and the restore offer

**Files:**
- Modify: `src/app/settings/player.tsx`
- Modify: `src/app/(tabs)/moments.tsx`

**Interfaces:**
- Consumes: `pendingRestoreCount`, `restoreMomentsFromManifest`, `clearAllMoments` (Task 5); `frameBytes` (Task 5); `formatBytes` (Task 1); `getMoments` (`@/db/moments-repo`); `momentsDirIsShared` (`@/moments/storage`).

**No Jest coverage** — screen wiring.

- [ ] **Step 1: Extend the Settings Moments group**

`src/app/settings/player.tsx` already has a Moments row showing the storage location, filled in by a focus effect. Keep that row and its All-files-access action exactly as they are. Add state and a loader beside them:

```ts
  const [stats, setStats] = useState({ count: 0, bytes: 0, restorable: 0 });

  const loadStats = useCallback(async () => {
    try {
      const all = await getMoments(db);
      setStats({
        count: all.length,
        bytes: frameBytes(all),
        restorable: await pendingRestoreCount(db),
      });
    } catch (e) {
      console.warn('[moments] could not load store statistics:', e);
    }
  }, [db]);
```

Call `void loadStats();` from the existing focus effect, alongside the storage-location probe. `db` comes from `useSQLiteContext()` — add it if the screen does not already have it.

Then the handlers:

```ts
  const onRestore = useCallback(() => {
    restoreMomentsFromManifest(db)
      .then((n) => {
        ToastAndroid.show(
          n === 1 ? 'Restored 1 moment' : `Restored ${n} moments`,
          ToastAndroid.SHORT,
        );
        void loadStats();
      })
      .catch((e) => {
        console.warn('[moments] restore failed:', e);
        Alert.alert('Restore failed', 'Could not read the moments backup folder.');
      });
  }, [db, loadStats]);

  const onClearAll = useCallback(() => {
    if (stats.count === 0) return;
    Alert.alert(
      'Delete all moments',
      `Delete all ${stats.count} moment${stats.count === 1 ? '' : 's'}? The saved frames go too. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            clearAllMoments(db)
              .then(() => loadStats())
              .catch((e) => {
                console.warn('[moments] clear-all failed:', e);
                Alert.alert('Delete failed', 'Could not delete every moment.');
              });
          },
        },
      ],
    );
  }, [db, loadStats, stats.count]);
```

And three rows in the existing Moments `SettingsGroup`, beneath the storage-location row. `ListItem` takes `title`, optional `subtitle` and optional `onPress`; omitting `onPress` is how a row reads as unavailable:

```tsx
          <ListItem
            title="Saved moments"
            subtitle={`${stats.count} saved · ${formatBytes(stats.bytes)}`}
          />
          <ListItem
            title="Restore from backup"
            subtitle={
              stats.restorable > 0
                ? `${stats.restorable} found in the moments folder`
                : 'Nothing to restore'
            }
            onPress={stats.restorable > 0 ? onRestore : undefined}
          />
          <ListItem
            title="Delete all moments"
            subtitle="Removes every moment and its saved frame"
            onPress={stats.count > 0 ? onClearAll : undefined}
          />
```

Import `ToastAndroid` and `Alert` from `react-native` if the screen does not already have them.

- [ ] **Step 2: Offer restore from the empty Moments tab**

In `src/app/(tabs)/moments.tsx`, add the count beside the existing list state and load it in the existing `useFocusEffect` alongside `load()`:

```ts
  const [restorable, setRestorable] = useState(0);
```

```ts
      pendingRestoreCount(db)
        .then(setRestorable)
        .catch((e) => console.warn('[moments] could not check for a backup:', e));
```

Then, inside the existing `ListEmptyComponent`, keep the current icon and "No moments yet" heading, and swap the trailing hint for the restore offer when there is something to restore:

```tsx
            {restorable > 0 ? (
              <>
                <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8, textAlign: 'center' }}>
                  {restorable === 1
                    ? '1 moment was found in your backup folder.'
                    : `${restorable} moments were found in your backup folder.`}
                </Text>
                <PressableScale
                  onPress={() => {
                    restoreMomentsFromManifest(db)
                      .then(() => {
                        load();
                        setRestorable(0);
                      })
                      .catch((e) => {
                        console.warn('[moments] restore failed:', e);
                        Alert.alert('Restore failed', 'Could not read the moments backup folder.');
                      });
                  }}
                  style={{ marginTop: spacing.lg }}>
                  <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>
                    Restore them
                  </Text>
                </PressableScale>
              </>
            ) : (
              <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8, textAlign: 'center' }}>
                Tap the bookmark button while watching to save a scene.
              </Text>
            )}
```

`PressableScale` is already the button treatment used elsewhere in this project — do not introduce a new button component. Read the current `ListEmptyComponent` before editing and keep its existing wrapper and icon.

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npm test
git add src/app/settings/player.tsx 'src/app/(tabs)/moments.tsx'
git commit -m "feat(moments): add the Settings group and the restore offer"
```

---

### Task 7: Documentation

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-09-08-moments-design.md`

- [ ] **Step 1: Run everything**

```bash
npm test
npx tsc --noEmit
git status --short
```

Expected: all green, tree clean.

- [ ] **Step 2: Update the docs**

`docs/HANDOFF.md`: add a Moments Phase 3 status-table row (**not** device-verified — nobody has run it on a device), extend the Moments capabilities bullet with restore, save-to-gallery, seekbar ticks and the Settings group, and update **What's next** — Moments is feature-complete against its spec after this phase, so point at the remaining backlog instead.

`docs/CHANGELOG.md`: add a Phase 3 entry in the file's existing format.

`docs/superpowers/specs/2026-09-08-moments-design.md`: its header still reads **"Status: approved design, not yet planned"**, which has been wrong since Phase 1. Update it to reflect that all three phases are built, and record the §5 "on launch" deviation described in this plan's Global Constraints so the spec and the code agree.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: record Moments phase 3"
```

---

## Device verification checklist (for the user)

JS-only — a reload is enough, no rebuild:

1. **Seekbar ticks.** Open a video you have moments in. Small marks appear on the scrub bar at each saved position, and dragging the bar still works normally — the ticks must not swallow touches.
2. **Ticks stay put.** Rotate and re-enter the video; marks land in the same places.
3. **A video with no moments** shows a clean bar with no marks.
4. **Save to gallery.** From a moment's detail screen, save the frame. Grant the permission when asked, then check your gallery — the frame appears, in a **53XY** album.
5. **The rest stays hidden.** Confirm the gallery still shows *only* the frame you deliberately saved, not the whole `53XY/Moments` folder.
6. **Settings shows the truth.** Settings → Player → the Moments rows show a count and size matching what you actually have.
7. **Delete all** asks for confirmation naming the count, and afterwards the tab is empty, the folder's JPEGs are gone, and `moments.json` is an empty list.
8. **Restore.** After the clear-all above there is nothing to restore, which is correct. To test recovery properly: capture two or three moments, copy `/storage/emulated/0/53XY/Moments/` somewhere safe, clear the app's data (Settings → Apps → 53XY (Dev) → Storage → Clear data), copy the folder back, then open the app. The Moments tab's empty state should offer to restore them, and Settings should offer the same.
9. **Restore does not clobber.** With moments already present, confirm the restore offer does not appear — it must never overwrite live data with an older backup.
