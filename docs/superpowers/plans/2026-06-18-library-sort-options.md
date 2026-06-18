# Library Sort Options — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sort control to the library screen — order groups by name, total length, date added, or date modified, in either direction, persisted across restarts.

**Architecture:** A pure `sortGroups(groups, spec)` runs in `src/app/index.tsx` right after `filterGroups`. The active sort (`sort.key` + `sort.dir`) persists in SQLite settings like `mode`/`layout`. A header `SortButton` shows the active sort and opens a `SortSheet` (slide-up Modal) to change it.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-sqlite, TypeScript, Jest (jest-expo), Material You theme tokens (`useTheme`).

## Global Constraints

- **Expo SDK 56 / RN 0.85.** Per `AGENTS.md`, read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify thin docs against `node_modules/<pkg>/build/types/*.d.ts`.
- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Package manager is `bun`.** Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **JS-only feature — no native module touched.** Fast Refresh applies; no `run:android` rebuild.
- **Android-only.**
- **Pure logic is Jest-tested; UI/glue (components, screen wiring) is device-verified by the user.** UI/glue agent gate: `npx tsc --noEmit` + `npm test` clean + manual checklist.
- Tests live in `__tests__/` dirs next to the code.
- **Sort semantics:** default `name`/`asc` (= today's A→Z). Unknown date sorts **last** in both directions. Ties break by `title` A→Z. `length` = Σ item `durationMs` (null→0). Group date = newest item's date. One shared sort across both tabs.

---

### Task 1: Group aggregation helpers (`groupLengthMs`, `groupDate`)

**Files:**
- Create: `src/library/sort-groups.ts`
- Test: `src/library/__tests__/sort-groups.test.ts`

**Interfaces:**
- Consumes: `Group` / `LibraryVideo` from `src/library/types.ts` (`Group { title; items: LibraryVideo[]; ... }`, `LibraryVideo { durationMs: number | null; createdAt: number | null; modifiedAt: number | null; ... }`).
- Produces:
  - `function groupLengthMs(group: Group): number`
  - `function groupDate(group: Group, field: 'createdAt' | 'modifiedAt'): number | null`

- [ ] **Step 1: Write the failing test**

Create `src/library/__tests__/sort-groups.test.ts`:

```ts
import { groupDate, groupLengthMs } from '../sort-groups';
import type { Group, LibraryVideo } from '../types';

const vid = (
  id: string,
  durationMs: number | null,
  createdAt: number | null = null,
  modifiedAt: number | null = null,
): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename: `${id}.mp4`,
  durationMs,
  width: null,
  height: null,
  folder: '/Movies',
  thumbUri: null,
  createdAt,
  modifiedAt,
});

const grp = (title: string, items: LibraryVideo[]): Group => ({
  key: title.toLowerCase(),
  title,
  kind: 'name',
  items,
  count: items.length,
});

describe('groupLengthMs', () => {
  it('sums item durations, treating null as 0', () => {
    expect(groupLengthMs(grp('A', [vid('a', 1000), vid('b', null), vid('c', 500)]))).toBe(1500);
  });
  it('is 0 for an empty group', () => {
    expect(groupLengthMs(grp('A', []))).toBe(0);
  });
});

describe('groupDate', () => {
  it('returns the newest item date for the field', () => {
    const g = grp('A', [vid('a', 0, 100, 5), vid('b', 0, 300, 9), vid('c', 0, 200, 1)]);
    expect(groupDate(g, 'createdAt')).toBe(300);
    expect(groupDate(g, 'modifiedAt')).toBe(9);
  });
  it('returns null when no item has the date', () => {
    expect(groupDate(grp('A', [vid('a', 0, null, null)]), 'createdAt')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sort-groups`
Expected: FAIL — `Cannot find module '../sort-groups'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/library/sort-groups.ts`:

```ts
import type { Group } from './types';

/** Total duration of a group in ms (item.durationMs ?? 0, summed). */
export function groupLengthMs(group: Group): number {
  return group.items.reduce((sum, v) => sum + (v.durationMs ?? 0), 0);
}

/** The newest item's value for the given date field, or null if no item has one. */
export function groupDate(group: Group, field: 'createdAt' | 'modifiedAt'): number | null {
  let max: number | null = null;
  for (const v of group.items) {
    const d = v[field];
    if (d != null && (max == null || d > max)) max = d;
  }
  return max;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sort-groups`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/library/sort-groups.ts src/library/__tests__/sort-groups.test.ts
git commit -m "feat(library): group length + date aggregation helpers"
```

---

### Task 2: `sortGroups` + sort config constants

**Files:**
- Modify: `src/library/sort-groups.ts`
- Test: `src/library/__tests__/sort-groups.test.ts`

**Interfaces:**
- Consumes: `groupLengthMs`, `groupDate` (Task 1).
- Produces:
  - `type SortKey = 'name' | 'length' | 'dateAdded' | 'dateModified'`
  - `type SortDir = 'asc' | 'desc'`
  - `interface SortSpec { key: SortKey; dir: SortDir }`
  - `const SORT_KEYS: SortKey[]` (ordered: name, length, dateAdded, dateModified)
  - `const SORT_LABELS: Record<SortKey, string>` (`Name`, `Length`, `Date added`, `Date modified`)
  - `const DEFAULT_DIR: Record<SortKey, SortDir>` (`name: 'asc'`, others `'desc'`)
  - `function sortGroups(groups: Group[], spec: SortSpec): Group[]`

- [ ] **Step 1: Write the failing test**

Append to `src/library/__tests__/sort-groups.test.ts`:

```ts
import { DEFAULT_DIR, SORT_KEYS, SORT_LABELS, sortGroups } from '../sort-groups';

const titles = (gs: Group[]) => gs.map((g) => g.title);

describe('sort config', () => {
  it('exposes the four keys, labels, and default directions', () => {
    expect(SORT_KEYS).toEqual(['name', 'length', 'dateAdded', 'dateModified']);
    expect(SORT_LABELS.dateAdded).toBe('Date added');
    expect(DEFAULT_DIR).toEqual({ name: 'asc', length: 'desc', dateAdded: 'desc', dateModified: 'desc' });
  });
});

describe('sortGroups', () => {
  const a = grp('Banshee', [vid('a', 1000, 100)]);
  const b = grp('Citadel', [vid('b', 3000, 300)]);
  const c = grp('Alpha', [vid('c', 2000, 200)]);

  it('name asc is A→Z, desc is Z→A', () => {
    expect(titles(sortGroups([a, b, c], { key: 'name', dir: 'asc' }))).toEqual(['Alpha', 'Banshee', 'Citadel']);
    expect(titles(sortGroups([a, b, c], { key: 'name', dir: 'desc' }))).toEqual(['Citadel', 'Banshee', 'Alpha']);
  });

  it('length asc is shortest first, desc is longest first', () => {
    expect(titles(sortGroups([a, b, c], { key: 'length', dir: 'asc' }))).toEqual(['Banshee', 'Alpha', 'Citadel']);
    expect(titles(sortGroups([a, b, c], { key: 'length', dir: 'desc' }))).toEqual(['Citadel', 'Alpha', 'Banshee']);
  });

  it('dateAdded desc is newest first', () => {
    expect(titles(sortGroups([a, b, c], { key: 'dateAdded', dir: 'desc' }))).toEqual(['Citadel', 'Alpha', 'Banshee']);
  });

  it('groups with no date sort last in both directions', () => {
    const noDate = grp('Zeta', [vid('z', 500, null)]);
    expect(titles(sortGroups([noDate, a], { key: 'dateAdded', dir: 'desc' }))).toEqual(['Banshee', 'Zeta']);
    expect(titles(sortGroups([noDate, a], { key: 'dateAdded', dir: 'asc' }))).toEqual(['Banshee', 'Zeta']);
  });

  it('ties break by title A→Z', () => {
    const x = grp('Xander', [vid('x', 1000, 100)]);
    const y = grp('Aria', [vid('y', 1000, 100)]);
    // equal length and date → title order regardless of dir sign on the primary key
    expect(titles(sortGroups([x, y], { key: 'length', dir: 'desc' }))).toEqual(['Aria', 'Xander']);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [b, a];
    const out = sortGroups(input, { key: 'name', dir: 'asc' });
    expect(out).not.toBe(input);
    expect(titles(input)).toEqual(['Citadel', 'Banshee']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sort-groups`
Expected: FAIL — `sortGroups is not a function` / missing exports.

- [ ] **Step 3: Write minimal implementation**

Append to `src/library/sort-groups.ts`:

```ts
export type SortKey = 'name' | 'length' | 'dateAdded' | 'dateModified';
export type SortDir = 'asc' | 'desc';
export interface SortSpec {
  key: SortKey;
  dir: SortDir;
}

export const SORT_KEYS: SortKey[] = ['name', 'length', 'dateAdded', 'dateModified'];

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  length: 'Length',
  dateAdded: 'Date added',
  dateModified: 'Date modified',
};

export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  length: 'desc',
  dateAdded: 'desc',
  dateModified: 'desc',
};

function byTitleAsc(a: Group, b: Group): number {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
}

/**
 * Return a NEW array of groups ordered by the spec. Unknown (null) dates sort
 * last in both directions; equal primary values break by title A→Z.
 */
export function sortGroups(groups: Group[], spec: SortSpec): Group[] {
  const { key, dir } = spec;
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') {
      cmp = sign * byTitleAsc(a, b);
    } else if (key === 'length') {
      cmp = sign * (groupLengthMs(a) - groupLengthMs(b));
    } else {
      const field = key === 'dateAdded' ? 'createdAt' : 'modifiedAt';
      const da = groupDate(a, field);
      const db = groupDate(b, field);
      if (da == null && db == null) cmp = 0;
      else if (da == null) return 1; // a unknown → after b
      else if (db == null) return -1; // b unknown → after a
      else cmp = sign * (da - db);
    }
    return cmp !== 0 ? cmp : byTitleAsc(a, b);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sort-groups`
Expected: PASS (all sort-groups tests). Then `npm test` — full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/library/sort-groups.ts src/library/__tests__/sort-groups.test.ts
git commit -m "feat(library): sortGroups (name/length/date, dir, nulls-last, tie-break)"
```

---

### Task 3: `SortButton` component

**Files:**
- Create: `src/components/sort-button.tsx`

**Interfaces:**
- Consumes: `useTheme`; `SortKey`, `SortDir`, `SORT_LABELS` (Task 2).
- Produces: `function SortButton(props: { sortKey: SortKey; sortDir: SortDir; onPress: () => void })`.

**Note:** Presentational UI. Verified by tsc + user on-device.

- [ ] **Step 1: Create the component**

Create `src/components/sort-button.tsx` (mirrors `layout-toggle.tsx` styling):

```tsx
import { Pressable, Text } from 'react-native';

import { SORT_LABELS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useTheme } from '@/theme/theme-provider';

export function SortButton({
  sortKey,
  sortDir,
  onPress,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '600' }}>
        {SORT_LABELS[sortKey]} {sortDir === 'asc' ? '↑' : '↓'}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/sort-button.tsx
git commit -m "feat(library): SortButton header control (active key + arrow)"
```

---

### Task 4: `SortSheet` component

**Files:**
- Create: `src/components/sort-sheet.tsx`

**Interfaces:**
- Consumes: `useTheme`; `SORT_KEYS`, `SORT_LABELS`, `DEFAULT_DIR`, `SortKey`, `SortDir` (Task 2).
- Produces: `function SortSheet(props: { visible: boolean; sortKey: SortKey; sortDir: SortDir; onSelect: (key: SortKey, dir: SortDir) => void; onClose: () => void })`.

**Note:** UI (slide-up Modal, same backdrop pattern as `custom-length-dialog.tsx`). Verified by tsc + user on-device.

- [ ] **Step 1: Create the component**

Create `src/components/sort-sheet.tsx`:

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_DIR, SORT_KEYS, SORT_LABELS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useTheme } from '@/theme/theme-provider';

export function SortSheet({
  visible,
  sortKey,
  sortDir,
  onSelect,
  onClose,
}: {
  visible: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSelect: (key: SortKey, dir: SortDir) => void;
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();

  // Tapping the active key flips direction; tapping another selects its default. Closes either way.
  const choose = (k: SortKey) => {
    const dir: SortDir = k === sortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[k];
    onSelect(k, dir);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1b1b1b',
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Sort by</Text>
          {SORT_KEYS.map((k) => {
            const active = k === sortKey;
            return (
              <Pressable key={k} onPress={() => choose(k)} style={styles.row}>
                <Text style={{ color: active ? colors.primary : colors.onSurface, fontSize: 16, fontWeight: active ? '700' : '500' }}>
                  {SORT_LABELS[k]}
                </Text>
                {active ? (
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/sort-sheet.tsx
git commit -m "feat(library): SortSheet (pick key, flip direction)"
```

---

### Task 5: Wire sort into the library screen

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `sortGroups`, `SORT_KEYS`, `SortKey`, `SortDir` (Task 2); `SortButton` (Task 3); `SortSheet` (Task 4).
- Produces: the working sort UI; `visible` is now filtered AND sorted.

**Note:** UI/glue. Verified by tsc/tests + user on-device.

- [ ] **Step 1: Add imports**

In `src/app/index.tsx`, add to the import block (next to the other `@/` imports):

```ts
import { SortButton } from '@/components/sort-button';
import { SortSheet } from '@/components/sort-sheet';
import { sortGroups, SORT_KEYS, type SortDir, type SortKey } from '@/library/sort-groups';
```

- [ ] **Step 2: Add sort state**

After the existing `const [query, setQuery] = useState('');` line, add:

```ts
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sortOpen, setSortOpen] = useState(false);
```

- [ ] **Step 3: Load persisted sort on mount**

In the existing mount `useEffect` (currently loads `mode` and `layout`), add two more loads inside the same effect body:

```ts
    getSetting(db, 'sort.key').then((v) => {
      if (v && (SORT_KEYS as string[]).includes(v)) setSortKey(v as SortKey);
    });
    getSetting(db, 'sort.dir').then((v) => v === 'desc' && setSortDir('desc'));
```

- [ ] **Step 4: Add the `onSort` handler**

After the existing `onLayout` callback, add:

```ts
  const onSort = useCallback(
    (key: SortKey, dir: SortDir) => {
      setSortKey(key);
      setSortDir(dir);
      setSetting(db, 'sort.key', key);
      setSetting(db, 'sort.dir', dir);
    },
    [db],
  );
```

- [ ] **Step 5: Apply the sort in the `visible` memo**

Replace:

```ts
  const visible = useMemo(() => filterGroups(groups, query), [groups, query]);
```

with:

```ts
  const visible = useMemo(
    () => sortGroups(filterGroups(groups, query), { key: sortKey, dir: sortDir }),
    [groups, query, sortKey, sortDir],
  );
```

- [ ] **Step 6: Render the `SortButton` in the header**

In the header's right-hand cluster, add `SortButton` before `LayoutToggle`. Replace:

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LayoutToggle value={layout} onChange={onLayout} />
          <Link href="/settings" style={{ color: colors.primary, fontWeight: '600' }}>Settings</Link>
        </View>
```

with:

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <SortButton sortKey={sortKey} sortDir={sortDir} onPress={() => setSortOpen(true)} />
          <LayoutToggle value={layout} onChange={onLayout} />
          <Link href="/settings" style={{ color: colors.primary, fontWeight: '600' }}>Settings</Link>
        </View>
```

- [ ] **Step 7: Render the `SortSheet`**

Immediately before the closing `</Screen>` tag, add:

```tsx
      <SortSheet
        visible={sortOpen}
        sortKey={sortKey}
        sortDir={sortDir}
        onSelect={onSort}
        onClose={() => setSortOpen(false)}
      />
```

- [ ] **Step 8: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

> If `tsc` complains only about the `index`/route types, that's the typed-routes regen quirk (`.expo/types/router.d.ts`, regenerated by `expo start`) — note it and proceed. Any other error is real.

- [ ] **Step 9: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat(library): sort control on the home screen (button + sheet, persisted)"
```

---

## Device verification checklist (for the user)

Run `npx expo start` (JS-only — no rebuild). Then:

- [ ] The header shows a Sort control reading e.g. `Name ↑`.
- [ ] Tapping it opens a bottom sheet with Name / Length / Date added / Date modified; the active one is highlighted with its arrow.
- [ ] Selecting **Length** reorders groups by total duration (longest first by default); selecting it again — reopen and tap — flips to shortest first.
- [ ] **Date added** / **Date modified** order by the newest video in each group; groups with no date sit at the bottom.
- [ ] **Name** flips A→Z / Z→A.
- [ ] The chosen sort applies in both the Videos and Folders tabs and **persists across an app restart**.

---

## Self-Review

**Spec coverage:**
- Four keys + directions, defaults, nulls-last, tie-break → Task 2 (+ tests). ✓
- Group length (Σ, null→0) + group date (newest item) → Task 1 (+ tests). ✓
- Persist `sort.key`/`sort.dir`, load+validate on mount → Task 5. ✓
- Apply after `filterGroups`, both tabs → Task 5. ✓
- `SortButton` (active key + arrow) → Task 3. ✓
- `SortSheet` (select + flip, backdrop close) → Task 4. ✓
- Jest on pure logic; UI device-verified → Tasks 1–2 tested, 3–5 device-verified. ✓
- Out of scope (within-group sort, per-tab memory) → absent. ✓

**Placeholder scan:** No TBD/TODO; full code in every code step. ✓

**Type consistency:** `SortKey`/`SortDir`/`SortSpec`/`sortGroups`/`SORT_KEYS`/`SORT_LABELS`/`DEFAULT_DIR` defined in Task 2 and consumed verbatim in Tasks 3, 4, 5; `groupLengthMs`/`groupDate` (Task 1) used by `sortGroups` (Task 2); `SortButton` props (Task 3) ↔ usage (Task 5); `SortSheet` props incl. `onSelect(key, dir)` (Task 4) ↔ `onSort` (Task 5). ✓
