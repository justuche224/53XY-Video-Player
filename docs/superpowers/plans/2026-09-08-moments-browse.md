# Moments Phase 2 — Browse & Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make saved moments findable and useful — a browsable Moments tab, a detail screen, and one tap back into playback at the exact captured position, including when the file has moved.

**Architecture:** All the decision logic is pure and Jest-tested (`resolveMomentTarget`, `groupMoments`, `filterMoments`, `chunkMoments`); the screens stay declarative and follow the existing History-tab and group-detail patterns. Playback re-entry is a new `startMs` route param that overrides the saved resume position. Nothing here touches native code, so this phase ships on a JS reload.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-router (typed routes), expo-sqlite, expo-sharing, `SectionList`, the existing `ContextualAppBar` multi-select.

**Spec:** [2026-09-08-moments-design.md](../specs/2026-09-08-moments-design.md) — §6 Browse and playback, §9 Phasing.

## Global Constraints

- Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify against installed `node_modules/<pkg>/build/types/*.d.ts` when docs are thin (`AGENTS.md`).
- Package manager is `bun`. Tests `npm test`, typecheck `npx tsc --noEmit`.
- Android-only.
- Commits are plain conventional commits with **no** `Co-Authored-By:` trailer, no `Claude-Session:` line, no "Generated with Claude Code" text.
- Branch `feat/moments-browse` (stacked on the unmerged `feat/moments-capture`).
- `RELINK_DURATION_TOLERANCE_MS = 1000` — already in `src/moments/moment-policy.ts`, defined in Phase 1 for exactly this phase.
- **Scope boundary — resolved from a tension inside the spec.** §6 describes "Save to gallery" among the detail actions and a "Seekbar ticks" subsection, while §9 assigns *both* to Phase 3 along with restore-on-fresh-install and the Settings group. §9 is the phasing authority, so **this plan excludes save-to-gallery and seekbar ticks**. Share *is* in Phase 2 (§9 names "multi-select delete/share"). Do not add the excluded two.
- Screens, components and hooks get **no Jest coverage** — this repo has no `.tsx` test files and no React Native Testing Library setup in use; every existing test is plain `.ts` over pure logic. Adding a component test or a testing dependency here is a defect, not an improvement. Pure modules are fully tested.
- Every swallowing `catch` gets a `console.warn`, per the convention established across `src/moments/`.

---

### Task 1: Resolve a moment back to a playable video

The heart of "one click play". A moment stores the MediaStore id it was captured from, but files move and libraries are rescanned, so the id alone is not enough.

**Files:**
- Create: `src/moments/resolve-moment-video.ts`
- Test: `src/moments/__tests__/resolve-moment-video.test.ts`

**Interfaces:**
- Consumes: `Moment` (`./types`), `LibraryVideo` (`@/library/types`), `RELINK_DURATION_TOLERANCE_MS` (`./moment-policy`).
- Produces:
  - `type MomentTarget = { kind: 'exact'; video: LibraryVideo } | { kind: 'relinked'; video: LibraryVideo } | { kind: 'missing' }`
  - `resolveMomentTarget(moment: Moment, videos: LibraryVideo[]): MomentTarget`

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/resolve-moment-video.test.ts`:

```ts
import { resolveMomentTarget } from '../resolve-moment-video';
import type { Moment } from '../types';
import type { LibraryVideo } from '@/library/types';

function video(over: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    id: 'v1',
    uri: 'file:///storage/emulated/0/Movies/Lanterns.S01E03.mkv',
    filename: 'Lanterns.S01E03.mkv',
    durationMs: 2_580_000,
    width: 1920,
    height: 1080,
    folder: 'Movies',
    thumbUri: null,
    createdAt: 1,
    modifiedAt: 1,
    ...over,
  };
}

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1_169_049,
    createdAt: 5,
    frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: 'file:///storage/emulated/0/Movies/Lanterns.S01E03.mkv',
    durationMs: 2_580_000,
    ...over,
  };
}

describe('resolveMomentTarget', () => {
  it('matches on video id when the library still has it', () => {
    const v = video();
    expect(resolveMomentTarget(moment(), [v])).toEqual({ kind: 'exact', video: v });
  });

  it('relinks a moved file by filename and duration when the id is gone', () => {
    // Same file, rescanned into a different folder, so MediaStore gave it a new id.
    const moved = video({ id: 'v99', folder: 'Movies/Shows', uri: 'file:///storage/emulated/0/Movies/Shows/Lanterns.S01E03.mkv' });
    expect(resolveMomentTarget(moment(), [moved])).toEqual({ kind: 'relinked', video: moved });
  });

  it('reports missing when nothing matches', () => {
    expect(resolveMomentTarget(moment(), [video({ id: 'v99', filename: 'Other.mkv' })])).toEqual({
      kind: 'missing',
    });
  });

  it('does not relink a same-named file of a clearly different length', () => {
    // A different cut or a different release that happens to share a basename.
    const other = video({ id: 'v99', durationMs: 2_580_000 + 60_000 });
    expect(resolveMomentTarget(moment(), [other])).toEqual({ kind: 'missing' });
  });

  it('tolerates small duration drift between scans', () => {
    // Container-reported durations wobble slightly; 1000ms is the allowed slack.
    const drifted = video({ id: 'v99', durationMs: 2_580_000 + 900 });
    expect(resolveMomentTarget(moment(), [drifted])).toEqual({ kind: 'relinked', video: drifted });
  });

  it('picks the closest duration when several files share a filename', () => {
    const near = video({ id: 'vNear', durationMs: 2_580_000 + 200, folder: 'A' });
    const far = video({ id: 'vFar', durationMs: 2_580_000 + 900, folder: 'B' });
    expect(resolveMomentTarget(moment(), [far, near])).toEqual({ kind: 'relinked', video: near });
  });

  it('relinks on filename alone when a duration is unknown on either side', () => {
    // Nothing to compare, so the filename match is the best evidence there is.
    const unknown = video({ id: 'v99', durationMs: null });
    expect(resolveMomentTarget(moment(), [unknown])).toEqual({ kind: 'relinked', video: unknown });
    expect(resolveMomentTarget(moment({ durationMs: null }), [video({ id: 'v99' })])).toEqual({
      kind: 'relinked',
      video: video({ id: 'v99' }),
    });
  });

  it('falls back to a filename match when the moment never had a video id', () => {
    const v = video({ id: 'v99' });
    expect(resolveMomentTarget(moment({ videoId: null }), [v])).toEqual({ kind: 'relinked', video: v });
  });

  it('reports missing for an empty library', () => {
    expect(resolveMomentTarget(moment(), [])).toEqual({ kind: 'missing' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/moments/__tests__/resolve-moment-video.test.ts`
Expected: FAIL — cannot find module `../resolve-moment-video`.

- [ ] **Step 3: Write the implementation**

Create `src/moments/resolve-moment-video.ts`:

```ts
import type { LibraryVideo } from '@/library/types';
import { RELINK_DURATION_TOLERANCE_MS } from './moment-policy';
import type { Moment } from './types';

export type MomentTarget =
  | { kind: 'exact'; video: LibraryVideo }
  | { kind: 'relinked'; video: LibraryVideo }
  | { kind: 'missing' };

/**
 * How far apart two durations may be and still be considered the same file.
 * `null` on either side means there is nothing to compare, so the filename
 * match stands on its own — the best evidence available.
 */
function durationsAgree(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return true;
  return Math.abs(a - b) <= RELINK_DURATION_TOLERANCE_MS;
}

/**
 * Find the video a moment should play.
 *
 * The stored `videoId` is a MediaStore id, which does not survive the file
 * being moved and rescanned — so a failed id lookup falls back to matching on
 * filename AND duration together. Filename alone would happily relink to a
 * different cut of the same episode sitting in another folder; duration is the
 * cheap second signal that rules that out. Recovering a *renamed* file would
 * need content hashing, which is not worth reading whole files for.
 */
export function resolveMomentTarget(moment: Moment, videos: LibraryVideo[]): MomentTarget {
  if (moment.videoId !== null) {
    const exact = videos.find((v) => v.id === moment.videoId);
    if (exact) return { kind: 'exact', video: exact };
  }

  const candidates = videos.filter(
    (v) => v.filename === moment.filename && durationsAgree(v.durationMs, moment.durationMs),
  );
  if (candidates.length === 0) return { kind: 'missing' };

  // Several files can share a basename across folders; the closest duration is
  // the likeliest to be the same file. An unknown duration sorts last.
  const best = candidates.reduce((a, b) => {
    const da = a.durationMs === null || moment.durationMs === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(a.durationMs - moment.durationMs);
    const db = b.durationMs === null || moment.durationMs === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(b.durationMs - moment.durationMs);
    return db < da ? b : a;
  });

  return { kind: 'relinked', video: best };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments`
Expected: PASS — 9 new tests plus the existing moments suite.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments/resolve-moment-video.ts src/moments/__tests__/resolve-moment-video.test.ts
git commit -m "feat(moments): resolve a moment back to its video, relinking moved files"
```

---

### Task 2: Section, search and lay out moments

**Files:**
- Create: `src/moments/group-moments.ts`
- Test: `src/moments/__tests__/group-moments.test.ts`

**Interfaces:**
- Consumes: `Moment` (`./types`).
- Produces:
  - `interface MomentSection { key: string; title: string; data: Moment[] }`
  - `groupMoments(moments: Moment[]): MomentSection[]`
  - `filterMoments(sections: MomentSection[], query: string): MomentSection[]`
  - `chunkMoments(moments: Moment[], perRow: number): Moment[][]`

`chunkMoments` exists because `SectionList` has no `numColumns`; the screen renders each chunk as one row of cards. Keeping it here makes the grid maths testable instead of inline in JSX.

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/group-moments.test.ts`:

```ts
import { chunkMoments, filterMoments, groupMoments } from '../group-moments';
import type { Moment } from '../types';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: null,
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

describe('groupMoments', () => {
  it('groups by title and keeps first-appearance order', () => {
    // Rows arrive newest-first from the repo, so the newest title leads.
    const sections = groupMoments([
      moment({ id: 'a', title: 'Lanterns' }),
      moment({ id: 'b', title: 'Inception' }),
      moment({ id: 'c', title: 'Lanterns' }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['Lanterns', 'Inception']);
    expect(sections[0].data.map((m) => m.id)).toEqual(['a', 'c']);
    expect(sections[1].data.map((m) => m.id)).toEqual(['b']);
  });

  it('returns nothing for no moments', () => {
    expect(groupMoments([])).toEqual([]);
  });

  it('gives each section a stable key', () => {
    const [section] = groupMoments([moment({ title: 'Lanterns' })]);
    expect(section.key).toBe('Lanterns');
  });
});

describe('filterMoments', () => {
  const sections = groupMoments([
    moment({ id: 'a', title: 'Lanterns', note: 'Happy birthday to you' }),
    moment({ id: 'b', title: 'Inception', note: null }),
  ]);

  it('returns everything for an empty query', () => {
    expect(filterMoments(sections, '   ')).toEqual(sections);
  });

  it('matches note text case-insensitively', () => {
    const out = filterMoments(sections, 'BIRTHDAY');
    expect(out.map((s) => s.title)).toEqual(['Lanterns']);
    expect(out[0].data.map((m) => m.id)).toEqual(['a']);
  });

  it('matches the title too', () => {
    expect(filterMoments(sections, 'incep').map((s) => s.title)).toEqual(['Inception']);
  });

  it('drops sections left with no matches', () => {
    expect(filterMoments(sections, 'nothing matches this')).toEqual([]);
  });

  it('does not match a null note', () => {
    // Guards against a `null.toLowerCase()` crash as much as the filtering.
    expect(filterMoments(sections, 'null')).toEqual([]);
  });
});

describe('chunkMoments', () => {
  it('splits into rows of the requested width', () => {
    const ms = [moment({ id: 'a' }), moment({ id: 'b' }), moment({ id: 'c' })];
    expect(chunkMoments(ms, 2).map((row) => row.map((m) => m.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('returns no rows for no moments', () => {
    expect(chunkMoments([], 2)).toEqual([]);
  });

  it('never loops forever on a nonsense row width', () => {
    expect(chunkMoments([moment()], 0)).toEqual([[moment()]]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/moments/__tests__/group-moments.test.ts`
Expected: FAIL — cannot find module `../group-moments`.

- [ ] **Step 3: Write the implementation**

Create `src/moments/group-moments.ts`:

```ts
import type { Moment } from './types';

export interface MomentSection {
  key: string;
  title: string;
  data: Moment[];
}

/**
 * Cluster a series' moments together while preserving the repo's
 * newest-first ordering: sections appear in the order their first moment
 * does, so the most recently captured title leads the screen.
 */
export function groupMoments(moments: Moment[]): MomentSection[] {
  const sections: MomentSection[] = [];
  const index = new Map<string, MomentSection>();

  for (const moment of moments) {
    let section = index.get(moment.title);
    if (!section) {
      section = { key: moment.title, title: moment.title, data: [] };
      index.set(moment.title, section);
      sections.push(section);
    }
    section.data.push(moment);
  }

  return sections;
}

/** Matches note text and title. Sections left empty are dropped entirely. */
export function filterMoments(sections: MomentSection[], query: string): MomentSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((s) => ({
      ...s,
      data: s.data.filter(
        (m) =>
          m.title.toLowerCase().includes(q) || (m.note?.toLowerCase().includes(q) ?? false),
      ),
    }))
    .filter((s) => s.data.length > 0);
}

/**
 * Rows of `perRow` moments. `SectionList` has no `numColumns`, so the grid is
 * built by rendering each row as one item.
 */
export function chunkMoments(moments: Moment[], perRow: number): Moment[][] {
  // A non-positive width would loop forever; one-per-row is the safe reading.
  const width = perRow > 0 ? perRow : 1;
  const rows: Moment[][] = [];
  for (let i = 0; i < moments.length; i += width) {
    rows.push(moments.slice(i, i + width));
  }
  return rows;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments`
Expected: PASS — 11 new tests plus everything from Task 1 and Phase 1.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/moments/group-moments.ts src/moments/__tests__/group-moments.test.ts
git commit -m "feat(moments): section, search and grid-chunk moments"
```

---

### Task 3: Repo support for relinking and bulk delete

**Files:**
- Modify: `src/db/moments-repo.ts`
- Test: `src/db/__tests__/moments-repo.test.ts`

**Interfaces:**
- Consumes: `Moment` (`@/moments/types`).
- Produces:
  - `updateMomentVideoLink(db: SQLiteDatabase, id: string, videoId: string, videoUri: string): Promise<void>`
  - `deleteMoments(db: SQLiteDatabase, ids: string[]): Promise<void>`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('moments-repo', ...)` block in `src/db/__tests__/moments-repo.test.ts`. It already has a `fakeDb` helper — reuse it; do not add a second one.

```ts
  it('updateMomentVideoLink heals both the id and the uri', async () => {
    const { db, calls } = fakeDb();
    await updateMomentVideoLink(db, 'm1', 'v99', 'file:///new/path.mkv');
    expect(calls[0].sql).toContain('UPDATE moments');
    expect(calls[0].sql).toContain('video_id = ?');
    expect(calls[0].sql).toContain('video_uri = ?');
    expect(calls[0].params).toEqual(['v99', 'file:///new/path.mkv', 'm1']);
  });

  it('deleteMoments removes every id in one statement', async () => {
    const { db, calls } = fakeDb();
    await deleteMoments(db, ['m1', 'm2', 'm3']);
    expect(calls[0].sql).toContain('DELETE FROM moments WHERE id IN (?,?,?)');
    expect(calls[0].params).toEqual(['m1', 'm2', 'm3']);
  });

  it('deleteMoments does nothing for an empty list', async () => {
    // An empty IN () is a SQL syntax error, so this must short-circuit.
    const { db, calls } = fakeDb();
    await deleteMoments(db, []);
    expect(calls).toEqual([]);
  });
```

Add `deleteMoments` and `updateMomentVideoLink` to the file's existing import from `../moments-repo`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/db/__tests__/moments-repo.test.ts`
Expected: FAIL — `updateMomentVideoLink is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `src/db/moments-repo.ts`:

```ts
/**
 * Point a moment at the video it was relinked to. Called after
 * `resolveMomentTarget` returns `relinked`, so the next play is an exact hit
 * rather than another filename search.
 */
export async function updateMomentVideoLink(
  db: SQLiteDatabase,
  id: string,
  videoId: string,
  videoUri: string,
): Promise<void> {
  await db.runAsync('UPDATE moments SET video_id = ?, video_uri = ? WHERE id = ?', [
    videoId,
    videoUri,
    id,
  ]);
}

export async function deleteMoments(db: SQLiteDatabase, ids: string[]): Promise<void> {
  // `IN ()` with no values is a syntax error, not an empty match.
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM moments WHERE id IN (${placeholders})`, ids);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/db`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/db/moments-repo.ts src/db/__tests__/moments-repo.test.ts
git commit -m "feat(db): add moment relink and bulk delete"
```

---

### Task 4: The moment card

**Files:**
- Create: `src/components/moment-card.tsx`

**Interfaces:**
- Consumes: `Moment` (`@/moments/types`), `formatTime` (`@/player/format-time`), `useTheme`, `PressableScale` (`@/components/pressable-scale`), `Image` from `expo-image`.
- Produces: `<MomentCard moment selected missing onPress onLongPress />` where `selected?: boolean`, `missing?: boolean`, `onLongPress?: () => void`.

**No Jest coverage** (component). Verification is `npx tsc --noEmit`.

- [ ] **Step 1: Write the component**

Read `src/components/media-card.tsx` first and follow its structure, radius tokens and `expo-image` usage. Then create `src/components/moment-card.tsx`:

```tsx
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '@/components/pressable-scale';
import type { Moment } from '@/moments/types';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

interface MomentCardProps {
  moment: Moment;
  /** Multi-select state; draws the selection ring. */
  selected?: boolean;
  /** The source file is no longer on the device — the card dims but still reads. */
  missing?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function MomentCard({ moment, selected, missing, onPress, onLongPress }: MomentCardProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} style={styles.container}>
      <View
        style={[
          styles.frame,
          {
            borderRadius: radius.md,
            backgroundColor: colors.surfaceVariant ?? 'rgba(255,255,255,0.06)',
            borderWidth: selected ? 2 : 0,
            borderColor: colors.primary,
          },
        ]}>
        {moment.frameUri ? (
          <Image
            source={{ uri: moment.frameUri }}
            style={[styles.image, { opacity: missing ? 0.45 : 1 }]}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="image-outline" size={28} color={colors.onSurfaceVariant ?? '#888'} />
          </View>
        )}

        <View style={[styles.badge, { borderRadius: radius.sm }]}>
          <Text style={styles.badgeText}>{formatTime(moment.positionMs / 1000)}</Text>
        </View>

        {missing && (
          <View style={[styles.missingBadge, { borderRadius: radius.sm }]}>
            <Ionicons name="alert-circle" size={12} color="#fff" />
          </View>
        )}
      </View>

      <Text
        numberOfLines={1}
        style={[styles.episode, { color: colors.onSurface, marginTop: spacing.xs }]}>
        {moment.episodeLabel ?? moment.title}
      </Text>
      {moment.note ? (
        <Text numberOfLines={2} style={[styles.note, { color: colors.onSurfaceVariant ?? '#888' }]}>
          {moment.note}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  frame: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  missingBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  episode: {
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 2,
  },
});
```

If `radius.sm` or `spacing.xs` do not exist in this project's theme, read `src/theme/layout.ts` and use the nearest tokens that do — do not invent new ones.

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/moment-card.tsx
git commit -m "feat(moments): add the moment card"
```

---

### Task 5: The Moments tab

**Files:**
- Create: `src/app/(tabs)/moments.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/navigation/tab-icon.ts`
- Test: `src/navigation/__tests__/tab-icon.test.ts`

**Interfaces:**
- Consumes: `groupMoments`, `filterMoments`, `chunkMoments` (Task 2); `resolveMomentTarget` (Task 1); `getMoments`, `deleteMoments` (Task 3); `MomentCard` (Task 4); `deleteFrame`, `ensureMomentsDir`, `writeManifest` (`@/moments/storage`); `useLibraryData` (`@/library/library-provider`).
- Produces: the `/moments` route. Consumed by Task 6's navigation.

- [ ] **Step 1: Write the failing tab-icon test**

Append to `src/navigation/__tests__/tab-icon.test.ts`, inside its existing describes (read the file to match its style):

```ts
  it('labels and icons the moments tab', () => {
    expect(tabLabelFor('moments')).toBe('Moments');
    expect(tabIconFor('moments')).toEqual({ active: 'bookmark', inactive: 'bookmark-outline' });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/navigation`
Expected: FAIL — `tabLabelFor('moments')` returns `'moments'` (the default branch).

- [ ] **Step 3: Add the tab cases**

In `src/navigation/tab-icon.ts`, add to both switches, before `default`:

```ts
    case 'moments':
      return 'Moments';
```

```ts
    case 'moments':
      return { active: 'bookmark', inactive: 'bookmark-outline' };
```

- [ ] **Step 4: Register the route**

In `src/app/(tabs)/_layout.tsx`, add the screen **between `history` and `settings`** so the first three tabs keep their current positions and nothing the user already has muscle memory for shifts:

```tsx
      <Tabs.Screen name="moments" />
```

`TabBar` divides its width by `state.routes.length`, so a fifth entry needs no layout change.

- [ ] **Step 5: Write the screen**

Create `src/app/(tabs)/moments.tsx`:

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBar } from '@/components/app-bar';
import { ContextualAppBar } from '@/components/contextual-app-bar';
import { MomentCard } from '@/components/moment-card';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SectionHeader } from '@/components/section-header';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { deleteMoments, getMoments } from '@/db/moments-repo';
import { useLibraryData } from '@/library/library-provider';
import { chunkMoments, filterMoments, groupMoments } from '@/moments/group-moments';
import { resolveMomentTarget } from '@/moments/resolve-moment-video';
import { deleteFrame, ensureMomentsDir, writeManifest } from '@/moments/storage';
import type { Moment } from '@/moments/types';
import { shareFiles } from '@/moments/share-moments';
import { useTheme } from '@/theme/theme-provider';

const PER_ROW = 2;

export default function MomentsScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { videos } = useLibraryData();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    getMoments(db)
      .then(setMoments)
      .catch((e) => console.warn('[moments] failed to load moments:', e));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(
    () =>
      filterMoments(groupMoments(moments), query).map((s) => ({
        ...s,
        data: chunkMoments(s.data, PER_ROW),
      })),
    [moments, query],
  );

  // A moment whose file is gone still renders — only playback is disabled.
  const missingIds = useMemo(() => {
    const out = new Set<string>();
    for (const m of moments) {
      if (resolveMomentTarget(m, videos).kind === 'missing') out.add(m.id);
    }
    return out;
  }, [moments, videos]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openMoment = useCallback(
    (moment: Moment) => {
      if (selected.size > 0) {
        toggleSelect(moment.id);
        return;
      }
      router.push({ pathname: '/moment', params: { momentId: moment.id } });
    },
    [router, selected.size, toggleSelect],
  );

  const onDelete = useCallback(() => {
    const ids = [...selected];
    if (ids.length === 0) return;
    Alert.alert(
      'Delete moments',
      `Delete ${ids.length} moment${ids.length === 1 ? '' : 's'}? The saved frames go too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const doomed = moments.filter((m) => selected.has(m.id));
            for (const m of doomed) deleteFrame(m.frameUri);
            await deleteMoments(db, ids);
            const remaining = await getMoments(db);
            setMoments(remaining);
            clearSelection();
            try {
              writeManifest(ensureMomentsDir(), remaining);
            } catch (e) {
              console.warn('[moments] failed to rewrite manifest after delete:', e);
            }
          },
        },
      ],
    );
  }, [clearSelection, db, moments, selected]);

  const onShare = useCallback(() => {
    const uris = moments.filter((m) => selected.has(m.id) && m.frameUri).map((m) => m.frameUri!);
    void shareFiles(uris);
    clearSelection();
  }, [clearSelection, moments, selected]);

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      {selected.size > 0 ? (
        <ContextualAppBar
          selectedCount={selected.size}
          onClearSelection={clearSelection}
          onShare={onShare}
          onDelete={onDelete}
          overflowActions={[]}
        />
      ) : (
        <AppBar title="Moments" />
      )}

      <View style={{ marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((m) => m.id).join('-')}
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            {row.map((m) => (
              <MomentCard
                key={m.id}
                moment={m}
                selected={selected.has(m.id)}
                missing={missingIds.has(m.id)}
                onPress={() => openMoment(m)}
                onLongPress={() => toggleSelect(m.id)}
              />
            ))}
            {/* Keeps a short final row's card at half width instead of stretching it. */}
            {row.length < PER_ROW &&
              Array.from({ length: PER_ROW - row.length }).map((_, i) => (
                <View key={`filler-${i}`} style={{ flex: 1 }} />
              ))}
          </View>
        )}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="bookmark-outline" size={64} color={colors.onSurfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No moments yet
            </Text>
            <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8, textAlign: 'center' }}>
              Tap the bookmark button while watching to save a scene.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl + TAB_BAR_CLEARANCE }}
        bounces
        overScrollMode="always"
      />
    </Screen>
  );
}
```

- [ ] **Step 6: Add the share helper**

Create `src/moments/share-moments.ts`. `expo-sharing` is already a dependency and handles `file://` through its own FileProvider; the local `ShareMedia` module must **not** be used here, because it requires MediaStore `content://` URIs and throws on `file://`.

```ts
import * as Sharing from 'expo-sharing';

/**
 * Share saved frames. expo-sharing takes one file at a time, so a
 * multi-selection shares the first frame — enough for "show someone this
 * scene", and honest about the API rather than silently dropping the rest.
 */
export async function shareFiles(uris: string[]): Promise<void> {
  const [first] = uris;
  if (!first) return;
  try {
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(first, { mimeType: 'image/jpeg' });
  } catch (e) {
    console.warn('[moments] failed to share frame:', e);
  }
}
```

Verify `Sharing.shareAsync`'s signature and `isAvailableAsync` against `node_modules/expo-sharing/build/*.d.ts` before relying on them.

- [ ] **Step 7: Run everything and commit**

```bash
npx jest src/navigation src/moments
npx tsc --noEmit
npm test
git add src/app src/navigation src/moments/share-moments.ts
git commit -m "feat(moments): add the Moments tab"
```

Note: typed routes regenerate on `expo start`, so `tsc` may complain about `/moments` or `/moment` until then. If it does, that is expected — record it in your report rather than working around it by loosening types.

---

### Task 6: The moment detail screen

**Files:**
- Create: `src/app/moment.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `getMoments`, `deleteMoments`, `updateMomentNote`, `updateMomentVideoLink` (Tasks 3 and Phase 1); `resolveMomentTarget` (Task 1); `MomentNoteSheet` (`@/components/player/moment-note-sheet`); `deleteFrame`, `ensureMomentsDir`, `writeManifest`; `shareFiles` (Task 5).
- Produces: the `/moment` route, taking a `momentId` param.

- [ ] **Step 1: Register the route**

In `src/app/_layout.tsx`, beside the other `Stack.Screen` entries:

```tsx
                  <Stack.Screen name="moment" />
```

- [ ] **Step 2: Write the screen**

Create `src/app/moment.tsx`:

```tsx
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBar } from '@/components/app-bar';
import { ListItem } from '@/components/list-item';
import { MomentNoteSheet } from '@/components/player/moment-note-sheet';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import {
  deleteMoments,
  getMoments,
  updateMomentNote,
  updateMomentVideoLink,
} from '@/db/moments-repo';
import { useLibraryData } from '@/library/library-provider';
import { resolveMomentTarget } from '@/moments/resolve-moment-video';
import { shareFiles } from '@/moments/share-moments';
import { deleteFrame, ensureMomentsDir, writeManifest } from '@/moments/storage';
import type { Moment } from '@/moments/types';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

export default function MomentScreen() {
  const { momentId } = useLocalSearchParams<{ momentId: string }>();
  const { colors, spacing, radius } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { videos } = useLibraryData();

  const [moment, setMoment] = useState<Moment | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    getMoments(db)
      .then((all) => setMoment(all.find((m) => m.id === momentId) ?? null))
      .catch((e) => console.warn('[moments] failed to load moment:', e));
  }, [db, momentId]);

  const rewriteManifest = useCallback(async () => {
    try {
      writeManifest(ensureMomentsDir(), await getMoments(db));
    } catch (e) {
      console.warn('[moments] failed to rewrite manifest:', e);
    }
  }, [db]);

  const onPlay = useCallback(() => {
    if (!moment) return;
    const target = resolveMomentTarget(moment, videos);
    if (target.kind === 'missing') return;

    // A relinked moment heals itself, so the next play is an exact hit rather
    // than another filename search.
    if (target.kind === 'relinked') {
      updateMomentVideoLink(db, moment.id, target.video.id, target.video.uri)
        .then(rewriteManifest)
        .catch((e) => console.warn('[moments] failed to relink moment:', e));
    }

    router.push({
      pathname: '/player',
      params: {
        videoId: target.video.id,
        uri: target.video.uri,
        title: target.video.filename,
        startMs: String(moment.positionMs),
      },
    });
  }, [db, moment, rewriteManifest, router, videos]);

  const onSaveNote = useCallback(
    (note: string) => {
      if (!moment) return;
      const trimmed = note.trim() || null;
      setMoment({ ...moment, note: trimmed });
      updateMomentNote(db, moment.id, trimmed)
        .then(rewriteManifest)
        .catch((e) => console.warn('[moments] failed to save note:', e));
    },
    [db, moment, rewriteManifest],
  );

  const onDelete = useCallback(() => {
    if (!moment) return;
    Alert.alert('Delete moment', 'Delete this moment and its saved frame?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deleteFrame(moment.frameUri);
          await deleteMoments(db, [moment.id]);
          await rewriteManifest();
          router.back();
        },
      },
    ]);
  }, [db, moment, rewriteManifest, router]);

  if (!moment) {
    return (
      <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <AppBar title="Moment" variant="detail" onBack={() => router.back()} />
      </Screen>
    );
  }

  const target = resolveMomentTarget(moment, videos);
  const missing = target.kind === 'missing';

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title={moment.title} variant="detail" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {moment.frameUri ? (
          <Image
            source={{ uri: moment.frameUri }}
            style={[styles.frame, { borderRadius: radius.md }]}
            contentFit="contain"
            transition={120}
          />
        ) : (
          <View
            style={[
              styles.frame,
              styles.placeholder,
              { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' },
            ]}>
            <Ionicons name="image-outline" size={40} color={colors.onSurfaceVariant ?? '#888'} />
          </View>
        )}

        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant ?? '#888', marginTop: spacing.md }]}>
          {[moment.episodeLabel, formatTime(moment.positionMs / 1000), new Date(moment.createdAt).toLocaleDateString()]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>

        {moment.note ? (
          <Text style={[styles.note, { color: colors.onSurface, marginTop: spacing.sm }]}>{moment.note}</Text>
        ) : null}

        {missing && (
          <Text style={[styles.missing, { color: colors.error ?? '#f66', marginTop: spacing.sm }]}>
            File no longer on this device
          </Text>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <SettingsGroup insetDividers={false}>
            <ListItem
              label={missing ? 'Play from here (file missing)' : 'Play from here'}
              onPress={missing ? undefined : onPlay}
            />
            <ListItem label={moment.note ? 'Edit note' : 'Add note'} onPress={() => setNoteOpen(true)} />
            <ListItem
              label="Share frame"
              onPress={moment.frameUri ? () => void shareFiles([moment.frameUri!]) : undefined}
            />
            <ListItem label="Delete moment" onPress={onDelete} />
          </SettingsGroup>
        </View>
      </ScrollView>

      {noteOpen && (
        <MomentNoteSheet
          initialNote={moment.note ?? ''}
          onSave={onSaveNote}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    fontSize: 15,
    lineHeight: 21,
  },
  missing: {
    fontSize: 13,
    fontWeight: '600',
  },
});
```

Read `src/components/list-item.tsx` first and match its real prop names — if it does not accept an optional `onPress` to render a disabled row, use whatever disabled affordance it does provide rather than inventing a prop.

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
npm test
git add src/app/moment.tsx src/app/_layout.tsx
git commit -m "feat(moments): add the moment detail screen"
```

---

### Task 7: Play from a captured position

**Files:**
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: the `startMs` param pushed by Task 6.
- Produces: nothing consumed later.

- [ ] **Step 1: Accept the param**

In `src/app/player.tsx`, add `startMs` to the destructured `useLocalSearchParams` generic and result (around line 70), alongside `videoId`, `uri`, `title`, `groupKey`, `mode`, `playlistId`, `queueToken`. It is a `string` param, since route params are strings.

- [ ] **Step 2: Honour it in the resume effect**

The resume effect currently calls `player.play()`, then asynchronously reads saved progress and seeks if `shouldResume(...)`. Add the `startMs` branch **before** that saved-progress lookup, so a captured position always wins:

```ts
    // A moment asked for one specific position. It beats the saved resume
    // point, and the resume snackbar must stay hidden — telling the user they
    // were "resumed" somewhere they did not ask for is a lie, and its Restart
    // action would throw away the position they came here for.
    const startAtMs = startMs ? Number(startMs) : NaN;
    if (Number.isFinite(startAtMs) && startAtMs > 0) {
      player.currentTime = startAtMs / 1000;
      lastPositionSecRef.current = startAtMs / 1000;
      return;
    }
```

Place it inside the effect after `player.play()` and before the `(async () => { ... })()` block that reads `getProgressMap`, and add `startMs` to the effect's dependency array. Returning early skips both the resume seek and `setSnackbarVisible(true)`.

Read the effect in full before editing — if the early return would skip other setup that must still run (subscriptions, refs), restructure so only the resume/snackbar portion is skipped, and say so in your report.

- [ ] **Step 3: Do not let a stale startMs re-apply**

`router.setParams` is how prev/next switches videos, so `startMs` would otherwise persist into the next episode and seek it to a position from a different video. After applying it, clear it:

```ts
      router.setParams({ startMs: '' });
```

Put that immediately after setting `lastPositionSecRef.current`, before the `return`. Verify `router` is already in scope in that effect (it is used elsewhere in the file); add it to the dependency array if the linter requires it.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npm test
git add src/app/player.tsx
git commit -m "feat(player): honour a startMs param from a saved moment"
```

---

### Task 8: Documentation

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Run everything**

```bash
npm test
npx tsc --noEmit
git status --short
```

Expected: all green, working tree clean.

- [ ] **Step 2: Update the docs**

In `docs/HANDOFF.md`: add a Moments Phase 2 status-table row (**not** claiming device-verified — nobody has run it on a device yet); extend the Moments capabilities bullet to mention the tab, detail screen, search, relinking and play-from-here; and update **What's next** to point at Phase 3 (restore-on-fresh-install, save-to-gallery, seekbar ticks, Settings group).

In `docs/CHANGELOG.md`: add a Moments Phase 2 entry matching the file's existing format, noting that relinking matches on filename **and** duration so a same-named different cut is not picked up.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: record Moments phase 2"
```

---

## Device verification checklist (for the user)

JS-only — a reload is enough, no rebuild:

1. **The tab is there.** A fifth "Moments" tab between History and Settings, showing your saved moments newest-first, grouped by title.
2. **Cards read correctly.** Each shows its frame, the timestamp badge, the episode label and the note.
3. **Search works** across both note text and title.
4. **Tap plays from the moment.** The video opens and starts at the captured position — **not** at your saved resume point — and no "Resumed at …" snackbar appears.
5. **Prev/next is unaffected.** After playing from a moment, skip to the next episode: it must start from its own resume point, not the moment's position.
6. **Long-press multi-select** enters the contextual bar; delete removes the moments and their frames, and the count in the tab drops.
7. **Relinking.** Move a video file to another folder, let the library rescan, then play its moment. It should still play at the right position.
8. **A missing file degrades well.** Delete a video whose moment you kept: the card stays, dimmed, with its frame and note, and Play is disabled rather than crashing.
