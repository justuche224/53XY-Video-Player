# Library Phase A — Data & Grouping Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan every video on the device, normalize/parse their filenames, group them into shows (and folders), and persist them to SQLite — proven by extensive pure-logic unit tests and an on-device debug list, ready for Plan 2B to render beautifully.

**Architecture:** All filename intelligence (folder derivation, title normalization, episode parsing, grouping) lives in pure, dependency-free TypeScript modules under `src/library/` and `src/media/`, covered by real Jest tests. The native scan (`expo-media-library` `Query`/`Asset` class API) and the SQLite repo are thin device-verified shells over those pure functions. A `useLibrary` hook orchestrates scan → upsert → read → group; a temporary debug render on the Library screen proves grouping works against the real device library (Plan 2B replaces that render with the real UI).

**Tech Stack:** Expo SDK 56, expo-media-library (class API), expo-sqlite (existing Foundation DB), React 19, TypeScript, Jest.

## Global Constraints

- **Read docs first:** per `AGENTS.md`, consult https://docs.expo.dev/versions/v56.0.0/ before writing code against any SDK module. The `expo-media-library` API for this plan was verified against the installed `build/types/*.d.ts` (v56.0.7).
- **expo-media-library API (verified):** import classes/enums from `'expo-media-library'`. Enumerate with `new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).orderBy(AssetField.CREATION_TIME).exe()` → `Promise<Asset[]>`. `Asset` exposes `id: string` (sync) and async getters; use `await asset.getInfo()` → `{ id, filename, uri, mediaType, width, height, duration, creationTime, modificationTime, isFavorite }`. **`duration` is in milliseconds (or `null`).** `uri` is a `file:///storage/...` path. Permissions: `requestPermissionsAsync(false, ['video'])` / `usePermissions({ granularPermissions: ['video'] })`. The legacy `getAssetsAsync` is deprecated/throws — do NOT use it.
- **Platform:** Android-only. Folder = parent directory of the asset's file URI.
- **Path alias:** `@/*` → `./src/*`.
- **Pure-logic test rule:** modules under `src/library/` and `src/media/derive-folder.ts` MUST NOT import native/Expo modules, so Jest runs them in plain Node. The scanner and repo are device-verified.
- **DB:** existing Foundation DB `p53xy.db`, tables `videos`/`watch_progress`/`settings` (schema v1). Duration stored as `duration_ms`. The `videos.folder` column stores the folder path.
- **Commit-message rule (user override):** commit messages MUST NOT contain any `Co-Authored-By:` trailer or "Generated with / Claude Code" line.
- **Shared types (defined in Task 2, imported elsewhere):**
  - `interface LibraryVideo { id: string; uri: string; filename: string; durationMs: number | null; width: number | null; height: number | null; folder: string; createdAt: number | null; modifiedAt: number | null }`
  - `interface Group { key: string; title: string; kind: 'name' | 'folder'; items: LibraryVideo[]; count: number }`
  - `interface EpisodeInfo { season: number | null; episode: number | null }`

---

### Task 1: Folder derivation (pure, TDD)

Derive a folder path + display name from an asset's file URI. First pure module of the library.

**Files:**
- Create: `src/media/derive-folder.ts`
- Test: `src/media/__tests__/derive-folder.test.ts`

**Interfaces:**
- Consumes: nothing native.
- Produces:
  - `interface FolderInfo { path: string; name: string }`
  - `function deriveFolder(uri: string): FolderInfo` — `path` is the parent directory (decoded, no trailing slash, no scheme), `name` is the last segment of `path`. Returns `{ path: '', name: '' }` for an empty/garbage uri.

- [ ] **Step 1: Write the failing test**

```ts
// src/media/__tests__/derive-folder.test.ts
import { deriveFolder } from '../derive-folder';

describe('deriveFolder', () => {
  it('extracts parent dir and name from a file:// uri', () => {
    expect(deriveFolder('file:///storage/emulated/0/Movies/Banshee/ep1.mkv')).toEqual({
      path: '/storage/emulated/0/Movies/Banshee',
      name: 'Banshee',
    });
  });

  it('handles a path with no scheme', () => {
    expect(deriveFolder('/storage/emulated/0/DCIM/Camera/VID_001.mp4')).toEqual({
      path: '/storage/emulated/0/DCIM/Camera',
      name: 'Camera',
    });
  });

  it('decodes percent-encoded segments', () => {
    expect(deriveFolder('file:///storage/emulated/0/My%20Shows/Boston%20Legal/e1.avi')).toEqual({
      path: '/storage/emulated/0/My Shows/Boston Legal',
      name: 'Boston Legal',
    });
  });

  it('returns empty info for empty or file-only input', () => {
    expect(deriveFolder('')).toEqual({ path: '', name: '' });
    expect(deriveFolder('movie.mp4')).toEqual({ path: '', name: '' });
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- derive-folder`
Expected: FAIL — cannot find module `../derive-folder`.

- [ ] **Step 3: Write the implementation**

```ts
// src/media/derive-folder.ts
export interface FolderInfo {
  path: string;
  name: string;
}

export function deriveFolder(uri: string): FolderInfo {
  if (!uri) return { path: '', name: '' };
  // Strip scheme (file://) and decode %20 etc.
  let p = uri.replace(/^[a-z]+:\/\//i, '/');
  try {
    p = decodeURIComponent(p);
  } catch {
    // leave as-is if it is not valid percent-encoding
  }
  const lastSlash = p.lastIndexOf('/');
  if (lastSlash <= 0) return { path: '', name: '' };
  const path = p.slice(0, lastSlash).replace(/\/+$/, '');
  const name = path.slice(path.lastIndexOf('/') + 1);
  return { path, name };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- derive-folder`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/media/derive-folder.ts src/media/__tests__/derive-folder.test.ts
git commit -m "feat: derive folder path and name from asset uri"
```

---

### Task 2: Library types + title normalization (pure, TDD)

Define the shared library types and the heart of the grouping engine: turning a messy release filename into a clean show title. Test fixtures come from the user's real library.

**Files:**
- Create: `src/library/types.ts`
- Create: `src/library/normalize-title.ts`
- Test: `src/library/__tests__/normalize-title.test.ts`

**Interfaces:**
- Consumes: nothing native.
- Produces:
  - `src/library/types.ts`: `LibraryVideo`, `Group`, `EpisodeInfo` (exact shapes in Global Constraints).
  - `src/library/normalize-title.ts`: `function normalizeTitle(filename: string): string` — strips extension, bracketed content, season/episode markers and everything after them, standalone years, quality/release tags, and promo junk (`@handle`, `JOIN ...`); collapses separators to spaces and trims.

- [ ] **Step 1: Write the shared types**

```ts
// src/library/types.ts
export interface LibraryVideo {
  id: string;
  uri: string;
  filename: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  createdAt: number | null;
  modifiedAt: number | null;
}

export interface EpisodeInfo {
  season: number | null;
  episode: number | null;
}

export interface Group {
  key: string;
  title: string;
  kind: 'name' | 'folder';
  items: LibraryVideo[];
  count: number;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/library/__tests__/normalize-title.test.ts
import { normalizeTitle } from '../normalize-title';

describe('normalizeTitle', () => {
  it.each([
    ['Banshee S01E01 GalaxyTV.mkv', 'Banshee'],
    ['Banshee S02E03 GalaxyTV.mkv', 'Banshee'],
    ['Boston Legal s01e05.avi', 'Boston Legal'],
    ['Citadel S01E03.mp4', 'Citadel'],
    ['Shifting Gears S01E10.mkv', 'Shifting Gears'],
    ['Steal S01E06.mp4', 'Steal'],
    ['La.casa.de.papel.A.K.A.Money.Heist.S03E06.mkv', 'La casa de papel A K A Money Heist'],
    ['Saved by the Bell S02E10.mkv', 'Saved by the Bell'],
    ['His and Hers 2026 S01E03.mkv', 'His and Hers'],
    ['Citadel S01.mkv', 'Citadel'],
    ['Some.Show.1x05.mp4', 'Some Show'],
  ])('strips episode markers: %s -> %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it.each([
    ['The Best Man Holiday 2013 1080p BluRay.mp4', 'The Best Man Holiday'],
    ['Ballerina 2025 JOIN @maxenta.mp4', 'Ballerina'],
    ['Inception (2010) [1080p].mkv', 'Inception'],
  ])('cleans movie titles: %s -> %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeTitle('  Weird___Name...mkv')).toBe('Weird Name');
  });
});
```

- [ ] **Step 3: Run test — verify it fails**

Run: `npm test -- normalize-title`
Expected: FAIL — cannot find module `../normalize-title`.

- [ ] **Step 4: Write the implementation**

```ts
// src/library/normalize-title.ts

// Matches the first season/episode marker; the show name is everything before it.
const EPISODE_MARKER = /\b(s\d{1,2}(e\d{1,3})?|\d{1,2}x\d{1,3}|season\s*\d+|episode\s*\d+)\b/i;
// Promo junk that signals the title has ended (handles, "JOIN ...", urls).
const PROMO_MARKER = /(@\w+|\bjoin\b|\bwww\.|https?:\/\/)/i;
// Quality / release-group tokens to drop from movie titles.
const QUALITY_TAGS =
  /\b(480p|720p|1080p|2160p|4k|x264|x265|h\.?264|h\.?265|hevc|bluray|brrip|bdrip|webrip|web-?dl|hdrip|dvdrip|aac|ac3|dts|hdr|10bit|remux|proper|repack|hq|english)\b/gi;
const YEAR = /\b(19|20)\d{2}\b/g;
const BRACKETED = /[[({][^\])}]*[\])}]/g;

export function normalizeTitle(filename: string): string {
  // 1. strip extension
  let s = filename.replace(/\.[a-z0-9]{2,4}$/i, '');
  // 2. normalize separators
  s = s.replace(/[._]+/g, ' ');
  // 3. remove bracketed content e.g. (2010), [1080p]
  s = s.replace(BRACKETED, ' ');
  // 4. cut at the first episode/season marker, if any
  const ep = s.match(EPISODE_MARKER);
  if (ep && ep.index !== undefined) {
    s = s.slice(0, ep.index);
  } else {
    // movie: cut at promo junk, then drop quality tags
    const promo = s.match(PROMO_MARKER);
    if (promo && promo.index !== undefined) s = s.slice(0, promo.index);
    s = s.replace(QUALITY_TAGS, ' ');
  }
  // 5. drop standalone years and collapse whitespace
  s = s.replace(YEAR, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `npm test -- normalize-title`
Expected: PASS, 15 tests (11 + 3 `it.each` rows + the collapse test).

- [ ] **Step 6: Commit**

```bash
git add src/library/types.ts src/library/normalize-title.ts src/library/__tests__/normalize-title.test.ts
git commit -m "feat: library types and filename title normalization"
```

---

### Task 3: Episode parsing (pure, TDD)

Extract season/episode numbers for sorting episodes within a show.

**Files:**
- Create: `src/library/parse-episode.ts`
- Test: `src/library/__tests__/parse-episode.test.ts`

**Interfaces:**
- Consumes: `EpisodeInfo` from `@/library/types`.
- Produces: `function parseEpisode(filename: string): EpisodeInfo` — returns `{ season, episode }`, each `null` when absent. Recognizes `S01E02`, `1x05`, and season-only `S01`. A bare year (e.g. `2013`) must NOT be parsed as season/episode.

- [ ] **Step 1: Write the failing test**

```ts
// src/library/__tests__/parse-episode.test.ts
import { parseEpisode } from '../parse-episode';

describe('parseEpisode', () => {
  it('parses SxxExx', () => {
    expect(parseEpisode('Banshee S01E01 GalaxyTV.mkv')).toEqual({ season: 1, episode: 1 });
    expect(parseEpisode('La.casa.S03E06.mkv')).toEqual({ season: 3, episode: 6 });
  });

  it('parses NxNN', () => {
    expect(parseEpisode('Some.Show.1x05.mp4')).toEqual({ season: 1, episode: 5 });
  });

  it('parses season-only', () => {
    expect(parseEpisode('Citadel S01.mkv')).toEqual({ season: 1, episode: null });
  });

  it('returns nulls when no marker and ignores years', () => {
    expect(parseEpisode('The Best Man Holiday 2013.mp4')).toEqual({ season: null, episode: null });
    expect(parseEpisode('random clip.mp4')).toEqual({ season: null, episode: null });
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- parse-episode`
Expected: FAIL — cannot find module `../parse-episode`.

- [ ] **Step 3: Write the implementation**

```ts
// src/library/parse-episode.ts
import type { EpisodeInfo } from './types';

const SXXEXX = /\bs(\d{1,2})(?:e(\d{1,3}))?\b/i;
const NXNN = /\b(\d{1,2})x(\d{1,3})\b/i;

export function parseEpisode(filename: string): EpisodeInfo {
  const s = filename.replace(/[._]+/g, ' ');
  const sxx = s.match(SXXEXX);
  if (sxx) {
    return {
      season: Number(sxx[1]),
      episode: sxx[2] !== undefined ? Number(sxx[2]) : null,
    };
  }
  const nx = s.match(NXNN);
  if (nx) {
    return { season: Number(nx[1]), episode: Number(nx[2]) };
  }
  return { season: null, episode: null };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- parse-episode`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/library/parse-episode.ts src/library/__tests__/parse-episode.test.ts
git commit -m "feat: parse season/episode numbers from filename"
```

---

### Task 4: Grouping engine (pure, TDD)

Cluster videos into groups by show name and by folder — the feature the user loves about VLC.

**Files:**
- Create: `src/library/group-videos.ts`
- Test: `src/library/__tests__/group-videos.test.ts`

**Interfaces:**
- Consumes: `LibraryVideo`, `Group` from `@/library/types`; `normalizeTitle` (Task 2); `parseEpisode` (Task 3); `deriveFolder` (Task 1).
- Produces:
  - `function groupByName(videos: LibraryVideo[]): Group[]` — groups by case-insensitive normalized title; `key` = lowercased normalized title; `title` = the normalized title of the first item; items sorted by `(season ?? ∞, episode ?? ∞, filename)`; groups sorted by `title` (case-insensitive). `kind: 'name'`.
  - `function groupByFolder(videos: LibraryVideo[]): Group[]` — groups by `folder`; `key` = folder path; `title` = folder name via `deriveFolder` (falls back to the path, or `'Unknown'` when empty); items sorted by `filename`; groups sorted by `title`. `kind: 'folder'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/library/__tests__/group-videos.test.ts
import { groupByName, groupByFolder } from '../group-videos';
import type { LibraryVideo } from '../types';

function v(partial: Partial<LibraryVideo> & { id: string; filename: string }): LibraryVideo {
  return {
    uri: `file:///storage/emulated/0/Movies/${partial.filename}`,
    durationMs: 1000,
    width: 1280,
    height: 720,
    folder: '/storage/emulated/0/Movies',
    createdAt: 0,
    modifiedAt: 0,
    ...partial,
  };
}

describe('groupByName', () => {
  it('clusters episodes of the same show and sorts by season/episode', () => {
    const videos = [
      v({ id: '2', filename: 'Banshee S02E01 GalaxyTV.mkv' }),
      v({ id: '1', filename: 'Banshee S01E02 GalaxyTV.mkv' }),
      v({ id: '0', filename: 'Banshee S01E01 GalaxyTV.mkv' }),
      v({ id: '9', filename: 'Citadel S01E03.mp4' }),
    ];
    const groups = groupByName(videos);
    expect(groups.map((g) => g.title)).toEqual(['Banshee', 'Citadel']);
    const banshee = groups.find((g) => g.title === 'Banshee')!;
    expect(banshee.count).toBe(3);
    expect(banshee.items.map((i) => i.id)).toEqual(['0', '1', '2']);
  });

  it('keeps a standalone movie as its own group of one', () => {
    const groups = groupByName([v({ id: 'm', filename: 'The Best Man Holiday 2013 1080p.mp4' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('The Best Man Holiday');
    expect(groups[0].count).toBe(1);
  });
});

describe('groupByFolder', () => {
  it('groups by folder path with the folder name as title', () => {
    const videos = [
      v({ id: 'a', filename: 'e2.mkv', folder: '/storage/emulated/0/Movies/Banshee' }),
      v({ id: 'b', filename: 'e1.mkv', folder: '/storage/emulated/0/Movies/Banshee' }),
      v({ id: 'c', filename: 'clip.mp4', folder: '/storage/emulated/0/DCIM/Camera' }),
    ];
    const groups = groupByFolder(videos);
    expect(groups.map((g) => g.title)).toEqual(['Banshee', 'Camera']);
    const banshee = groups.find((g) => g.title === 'Banshee')!;
    expect(banshee.key).toBe('/storage/emulated/0/Movies/Banshee');
    expect(banshee.items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- group-videos`
Expected: FAIL — cannot find module `../group-videos`.

- [ ] **Step 3: Write the implementation**

```ts
// src/library/group-videos.ts
import { deriveFolder } from '@/media/derive-folder';
import { normalizeTitle } from './normalize-title';
import { parseEpisode } from './parse-episode';
import type { Group, LibraryVideo } from './types';

const INF = Number.MAX_SAFE_INTEGER;

function byTitle(a: Group, b: Group): number {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
}

export function groupByName(videos: LibraryVideo[]): Group[] {
  const map = new Map<string, Group>();
  for (const video of videos) {
    const title = normalizeTitle(video.filename);
    const key = title.toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = { key, title, kind: 'name', items: [], count: 0 };
      map.set(key, group);
    }
    group.items.push(video);
  }
  for (const group of map.values()) {
    group.items.sort((a, b) => {
      const ea = parseEpisode(a.filename);
      const eb = parseEpisode(b.filename);
      return (
        (ea.season ?? INF) - (eb.season ?? INF) ||
        (ea.episode ?? INF) - (eb.episode ?? INF) ||
        a.filename.localeCompare(b.filename)
      );
    });
    group.count = group.items.length;
  }
  return [...map.values()].sort(byTitle);
}

export function groupByFolder(videos: LibraryVideo[]): Group[] {
  const map = new Map<string, Group>();
  for (const video of videos) {
    const key = video.folder || '';
    let group = map.get(key);
    if (!group) {
      const name = deriveFolder(video.uri).name || key || 'Unknown';
      group = { key, title: name, kind: 'folder', items: [], count: 0 };
      map.set(key, group);
    }
    group.items.push(video);
  }
  for (const group of map.values()) {
    group.items.sort((a, b) => a.filename.localeCompare(b.filename));
    group.count = group.items.length;
  }
  return [...map.values()].sort(byTitle);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- group-videos`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/library/group-videos.ts src/library/__tests__/group-videos.test.ts
git commit -m "feat: group videos by show name and by folder"
```

---

### Task 5: Media scanner (native, device-verified)

Enumerate every video on the device via the `expo-media-library` class API and map each to a `LibraryVideo` (deriving folder from the uri). Native — verified on device.

**Files:**
- Create: `src/media/media-scanner.ts`

**Interfaces:**
- Consumes: `LibraryVideo` from `@/library/types`; `deriveFolder` (Task 1); `Query`, `Asset`, `AssetField`, `MediaType` from `expo-media-library`.
- Produces:
  - `async function scanVideos(): Promise<LibraryVideo[]>` — assumes media permission already granted; queries all video assets, calls `getInfo()` per asset, maps to `LibraryVideo` (durationMs from `info.duration`, folder from `deriveFolder(info.uri).path`). Skips assets whose `getInfo()` throws.

- [ ] **Step 1: Docs check** — confirm against the installed types (`node_modules/expo-media-library/build/types/Query.d.ts`, `Asset.d.ts`) that `new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).orderBy(AssetField.CREATION_TIME).exe()` and `asset.getInfo()` match this code before writing.

- [ ] **Step 2: Write the scanner**

```ts
// src/media/media-scanner.ts
import { AssetField, MediaType, Query } from 'expo-media-library';

import type { LibraryVideo } from '@/library/types';
import { deriveFolder } from './derive-folder';

/**
 * Enumerates all video assets on the device. Caller must ensure media
 * permission (granular 'video') is granted first. One `getInfo()` call per
 * asset fetches all metadata in a single native round-trip.
 */
export async function scanVideos(): Promise<LibraryVideo[]> {
  const assets = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.VIDEO)
    .orderBy(AssetField.CREATION_TIME)
    .exe();

  const videos: LibraryVideo[] = [];
  for (const asset of assets) {
    try {
      const info = await asset.getInfo();
      videos.push({
        id: info.id,
        uri: info.uri,
        filename: info.filename,
        durationMs: info.duration ?? null,
        width: info.width ?? null,
        height: info.height ?? null,
        folder: deriveFolder(info.uri).path,
        createdAt: info.creationTime ?? null,
        modifiedAt: info.modificationTime ?? null,
      });
    } catch {
      // Asset disappeared or is unreadable since the query — skip it.
    }
  }
  return videos;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: DEVICE VERIFICATION** (deferred to native build)

This needs a device with videos + granted permission; it is exercised end-to-end in Task 7's debug render. No standalone device step here — proceed.

- [ ] **Step 5: Commit**

```bash
git add src/media/media-scanner.ts
git commit -m "feat: scan device videos via expo-media-library class API"
```

---

### Task 6: Videos repo + DB hardening (integration, device-verified)

Persist scanned videos and read them back, wrapping writes/migrations in transactions and adding an error boundary so a DB failure shows a message instead of a blank screen (Foundation review carry-forwards). The pure row-mapping is unit-tested.

**Files:**
- Create: `src/db/video-row.ts`
- Create: `src/db/videos-repo.ts`
- Create: `src/components/error-boundary.tsx`
- Modify: `src/app/_layout.tsx` (wrap migrations in a transaction; wrap tree in the error boundary)
- Test: `src/db/__tests__/video-row.test.ts`

**Interfaces:**
- Consumes: `LibraryVideo` from `@/library/types`; `useTheme` (Foundation); `runMigrations`/`MIGRATIONS` (Foundation); `SQLiteDatabase` from `expo-sqlite`.
- Produces:
  - `src/db/video-row.ts`: `interface VideoRow { id: string; uri: string; filename: string; duration_ms: number | null; size_bytes: number | null; width: number | null; height: number | null; folder: string; modified_at: number | null; created_at: number | null }`; `function toVideoRow(v: LibraryVideo): VideoRow`; `function fromVideoRow(r: VideoRow): LibraryVideo`.
  - `src/db/videos-repo.ts`: `async function upsertVideos(db: SQLiteDatabase, videos: LibraryVideo[]): Promise<void>` (single transaction; `INSERT ... ON CONFLICT(id) DO UPDATE`); `async function getAllVideos(db: SQLiteDatabase): Promise<LibraryVideo[]>`.
  - `src/components/error-boundary.tsx`: `class ErrorBoundary extends React.Component` rendering a themed fallback with the error message.

- [ ] **Step 1: Write the failing row-mapping test**

```ts
// src/db/__tests__/video-row.test.ts
import { toVideoRow, fromVideoRow } from '../video-row';
import type { LibraryVideo } from '@/library/types';

const sample: LibraryVideo = {
  id: 'content://media/external/video/media/42',
  uri: 'file:///storage/emulated/0/Movies/Banshee/e1.mkv',
  filename: 'Banshee S01E01 GalaxyTV.mkv',
  durationMs: 3540000,
  width: 1280,
  height: 720,
  folder: '/storage/emulated/0/Movies/Banshee',
  createdAt: 111,
  modifiedAt: 222,
};

describe('video-row mapping', () => {
  it('maps LibraryVideo to a snake_case row', () => {
    const row = toVideoRow(sample);
    expect(row).toEqual({
      id: sample.id,
      uri: sample.uri,
      filename: sample.filename,
      duration_ms: 3540000,
      size_bytes: null,
      width: 1280,
      height: 720,
      folder: sample.folder,
      modified_at: 222,
      created_at: 111,
    });
  });

  it('round-trips back to LibraryVideo', () => {
    expect(fromVideoRow(toVideoRow(sample))).toEqual(sample);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- video-row`
Expected: FAIL — cannot find module `../video-row`.

- [ ] **Step 3: Write the row mapping**

```ts
// src/db/video-row.ts
import type { LibraryVideo } from '@/library/types';

export interface VideoRow {
  id: string;
  uri: string;
  filename: string;
  duration_ms: number | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  modified_at: number | null;
  created_at: number | null;
}

export function toVideoRow(v: LibraryVideo): VideoRow {
  return {
    id: v.id,
    uri: v.uri,
    filename: v.filename,
    duration_ms: v.durationMs,
    size_bytes: null,
    width: v.width,
    height: v.height,
    folder: v.folder,
    modified_at: v.modifiedAt,
    created_at: v.createdAt,
  };
}

export function fromVideoRow(r: VideoRow): LibraryVideo {
  return {
    id: r.id,
    uri: r.uri,
    filename: r.filename,
    durationMs: r.duration_ms,
    width: r.width,
    height: r.height,
    folder: r.folder,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- video-row`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the repo**

```ts
// src/db/videos-repo.ts
import type { SQLiteDatabase } from 'expo-sqlite';

import type { LibraryVideo } from '@/library/types';
import { fromVideoRow, toVideoRow, type VideoRow } from './video-row';

export async function upsertVideos(db: SQLiteDatabase, videos: LibraryVideo[]): Promise<void> {
  if (videos.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const video of videos) {
      const r = toVideoRow(video);
      await db.runAsync(
        `INSERT INTO videos
           (id, uri, filename, duration_ms, size_bytes, width, height, folder, modified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           uri = excluded.uri,
           filename = excluded.filename,
           duration_ms = excluded.duration_ms,
           width = excluded.width,
           height = excluded.height,
           folder = excluded.folder,
           modified_at = excluded.modified_at,
           created_at = excluded.created_at`,
        [r.id, r.uri, r.filename, r.duration_ms, r.size_bytes, r.width, r.height, r.folder, r.modified_at, r.created_at],
      );
    }
  });
}

export async function getAllVideos(db: SQLiteDatabase): Promise<LibraryVideo[]> {
  const rows = await db.getAllAsync<VideoRow>('SELECT * FROM videos');
  return rows.map(fromVideoRow);
}
```

- [ ] **Step 6: Write the error boundary**

```tsx
// src/components/error-boundary.tsx
import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  message: { color: '#bbb', textAlign: 'center' },
});
```

- [ ] **Step 7: Harden the root layout**

In `src/app/_layout.tsx`, wrap the migration call in a transaction and wrap the provider tree in `ErrorBoundary`. Replace the existing `onDbInit` and the `GestureHandlerRootView` subtree:

```tsx
// src/app/_layout.tsx  — updated onDbInit and root tree (imports: add ErrorBoundary)
import { ErrorBoundary } from '@/components/error-boundary';
// ...existing imports unchanged...

async function onDbInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.withTransactionAsync(async () => {
    await runMigrations(db, MIGRATIONS);
  });
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
          <ThemeProvider>
            <ThemedStatusBar />
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </SQLiteProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 8: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites pass (Foundation 10 + derive-folder 4 + normalize-title + parse-episode 4 + group-videos 3 + video-row 2).

- [ ] **Step 9: Commit**

```bash
git add src/db/video-row.ts src/db/videos-repo.ts src/components/error-boundary.tsx src/app/_layout.tsx src/db/__tests__/video-row.test.ts
git commit -m "feat: videos repo with transactional upsert; migration transaction + error boundary"
```

---

### Task 7: useLibrary hook + on-device debug list (integration, device-verified)

Wire scan → upsert → read → group behind a hook, request permission, and render a temporary plain-text grouped list so we can verify grouping against the real device library. Plan 2B replaces the render.

**Files:**
- Create: `src/library/use-library.ts`
- Modify: `src/app/index.tsx` (temporary debug render)

**Interfaces:**
- Consumes: `scanVideos` (Task 5); `upsertVideos`/`getAllVideos` (Task 6); `groupByName`/`groupByFolder` (Task 4); `Group` (Task 2); `usePermissions` from `expo-media-library`; `useSQLiteContext` from `expo-sqlite`; `useTheme` (Foundation).
- Produces:
  - `interface LibraryState { status: 'idle' | 'loading' | 'denied' | 'ready' | 'error'; groups: Group[]; error?: string }`
  - `function useLibrary(mode: 'name' | 'folder'): LibraryState` — requests video permission; on grant, scans, upserts, reads, and groups by `mode`; recomputes groups when `mode` changes without rescanning.

- [ ] **Step 1: Docs check** — confirm `useSQLiteContext()` returns the `SQLiteDatabase` and `usePermissions({ granularPermissions: ['video'] })` returns `[response, request]` per `node_modules/expo-media-library/build/index.d.ts` and the expo-sqlite docs.

- [ ] **Step 2: Write the hook**

```ts
// src/library/use-library.ts
import { usePermissions } from 'expo-media-library';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { scanVideos } from '@/media/media-scanner';
import { getAllVideos, upsertVideos } from '@/db/videos-repo';
import { groupByFolder, groupByName } from './group-videos';
import type { Group, LibraryVideo } from './types';

export interface LibraryState {
  status: 'idle' | 'loading' | 'denied' | 'ready' | 'error';
  groups: Group[];
  error?: string;
}

export function useLibrary(mode: 'name' | 'folder'): LibraryState {
  const db = useSQLiteContext();
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [status, setStatus] = useState<LibraryState['status']>('idle');
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!permission) return; // still resolving
      if (!permission.granted) {
        if (permission.canAskAgain) {
          await requestPermission();
          return;
        }
        setStatus('denied');
        return;
      }
      setStatus('loading');
      try {
        const scanned = await scanVideos();
        await upsertVideos(db, scanned);
        const all = await getAllVideos(db);
        if (cancelled) return;
        setVideos(all);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [permission, requestPermission, db]);

  const groups = useMemo(
    () => (mode === 'name' ? groupByName(videos) : groupByFolder(videos)),
    [videos, mode],
  );

  return { status, groups, error };
}
```

- [ ] **Step 3: Temporary debug render on the Library screen**

```tsx
// src/app/index.tsx — temporary debug list (Plan 2B replaces this)
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useLibrary } from '@/library/use-library';
import { useTheme } from '@/theme/theme-provider';

export default function LibraryScreen() {
  const { colors, spacing } = useTheme();
  const { status, groups, error } = useLibrary('name');
  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
        <Link href="/settings" style={[styles.link, { color: colors.primary }]}>
          Settings
        </Link>
      </View>
      <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, marginBottom: spacing.sm }}>
        status: {status} · {groups.length} groups {error ? `· ${error}` : ''}
      </Text>
      <ScrollView>
        {groups.map((g) => (
          <Text key={g.key} style={{ color: colors.onSurface, paddingVertical: 4 }}>
            {g.title} — {g.count} video{g.count === 1 ? '' : 's'}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites green.

- [ ] **Step 5: DEVICE VERIFICATION** (deferred to native build)

Rebuild/reload on device. Manual checklist:
- [ ] On first launch the app prompts for video/media permission; granting it shows `status: ready`.
- [ ] The grouped list matches the device library — e.g. "Banshee — 30 videos", "Boston Legal — 16 videos", "Citadel — 13 videos" (per the user's library), and standalone movies appear as 1-video groups with cleaned titles (no `S01E01`, year, or quality tags).
- [ ] Denying permanently shows `status: denied` (no crash).

- [ ] **Step 6: Commit**

```bash
git add src/library/use-library.ts src/app/index.tsx
git commit -m "feat: useLibrary hook (scan, persist, group) with debug list"
```

---

## Definition of Done (Library Phase A)
- `npm test` green across all suites: Foundation 10 + derive-folder 4 + normalize-title (15) + parse-episode 4 + group-videos 3 + video-row 2.
- `npx tsc --noEmit` clean.
- On device: permission flow works; the real library scans, persists to `videos`, and groups correctly by show name (verified against the user's actual files).
- Migrations run inside a transaction; a DB/render error shows the error boundary, not a blank screen.

## Notes for Plan 2B (Library UI)
- Consume `useLibrary(mode)` for data; it already handles permission, scan, persistence, and grouping.
- `Group` / `LibraryVideo` types are in `@/library/types`; `parseEpisode` is available for episode labels.
- Replace the debug render in `src/app/index.tsx` with the adaptive grid/list, Videos/Folders segmented tabs (drive `mode`), search, and a `/group/[id]` detail route.
- Thumbnails (Plan 2B): `expo-video-thumbnails` `getThumbnailAsync(uri, { time, quality })` on the `file://` `uri`; cache the generated uri (add a `thumb_uri` column via migration v2) and display with `expo-image` (`recyclingKey={video.id}`, `cachePolicy="memory-disk"`).
- Resume badges (Plan 2B): join `watch_progress` (written by the Player plan) and use `computeProgressPercent` for the bar.
- Possible scan perf tuning for very large libraries: page the `Query` with `.limit/.offset` and/or parallelize `getInfo()` — fine to defer.
