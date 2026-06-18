# Library Sort Options — Design (v2)

_Status: approved 2026-06-18._

## Goal
Let the user choose how library groups are ordered on the home screen — by name,
total length, date added, or date modified — in either direction. The choice
applies to both the Videos (name) and Folders modes and persists across restarts,
like the existing `mode`/`layout` settings.

JS-only — no native module touched. Fast Refresh applies; no `run:android` rebuild.

## Sort model
Four sort keys, each with a direction (`asc` | `desc`):

| Key | Group value | asc | desc |
|---|---|---|---|
| `name` | group `title`, case-insensitive | A→Z | Z→A |
| `length` | total duration = Σ item `durationMs` (null→0) | shortest first | longest first |
| `dateAdded` | the group's **newest item's** `createdAt` | oldest first | newest first |
| `dateModified` | the group's newest item's `modifiedAt` | oldest first | newest first |

- **Group date = newest item's date** (max over items) for both date keys.
- **Default sort: `name` `asc`** (matches today's A→Z behaviour).
- When the user selects a *different* key, it adopts a sensible default direction:
  `name` → `asc`; `length`, `dateAdded`, `dateModified` → `desc` (largest/newest
  first). Tapping the *currently active* key flips its direction.
- **Unknown values sort last:** a group with null length or null date always sorts
  to the bottom, in both directions.
- **Tie-break:** equal sort values break by `title` A→Z, so ordering is
  deterministic.

Persisted in the existing `settings-repo` key/value store:
- `sort.key` ∈ `{ name, length, dateAdded, dateModified }` (absent → `name`).
- `sort.dir` ∈ `{ asc, desc }` (absent → `asc`).

## Pure logic — `src/library/sort-groups.ts` (Jest-tested)
```ts
export type SortKey = 'name' | 'length' | 'dateAdded' | 'dateModified';
export type SortDir = 'asc' | 'desc';
export interface SortSpec { key: SortKey; dir: SortDir }

/** Total duration of a group in ms (item.durationMs ?? 0, summed). */
export function groupLengthMs(group: Group): number;

/** The newest item's date for the given field, or null if no item has one. */
export function groupDate(group: Group, field: 'createdAt' | 'modifiedAt'): number | null;

/** Return a NEW array of groups ordered by the spec. Nulls last; title tie-break. */
export function sortGroups(groups: Group[], spec: SortSpec): Group[];
```

Behaviour:
- `name`: compare `title.toLowerCase()` via `localeCompare`; `desc` reverses.
- `length`: compare `groupLengthMs`; every group has a number (null durations count
  as 0), so there are no "unknowns" here, but a zero-length group naturally sinks
  for `desc`.
- `dateAdded`/`dateModified`: compare `groupDate(...)`. A `null` group date is
  treated as "unknown" and always ordered after groups with a known date,
  regardless of `dir`.
- Tie-break: when the primary comparison is `0`, compare `title` A→Z.
- `sortGroups` returns a new array (does not mutate the input). The default
  `{ key: 'name', dir: 'asc' }` yields the same order the screen shows today.

## Wiring
In `src/app/index.tsx`, the current `visible` memo is:
```ts
const visible = useMemo(() => filterGroups(groups, query), [groups, query]);
```
It becomes a filter-then-sort:
```ts
const visible = useMemo(
  () => sortGroups(filterGroups(groups, query), { key: sortKey, dir: sortDir }),
  [groups, query, sortKey, sortDir],
);
```
The `byTitle` sort baked into `group-videos.ts` stays — it provides a stable,
deterministic input order that the tie-break preserves; `sortGroups` reorders on
top of it.

## State & persistence
`sortKey`/`sortDir` live in `index.tsx` alongside `mode`/`layout`:
- Loaded on mount via `getSetting(db, 'sort.key')` / `getSetting(db, 'sort.dir')`
  (validated against the allowed values; anything else falls back to the default).
- An `onSort(key, dir)` handler updates state and writes both keys through
  `setSetting`, mirroring the existing `onMode`/`onLayout` pattern.

## UI
- **`SortButton`** (`src/components/sort-button.tsx`): a compact pressable in the
  header row next to `LayoutToggle`, showing the active key's label + a direction
  arrow (`↑` for asc, `↓` for desc) — e.g. `Name ↑`, `Length ↓`. Tapping opens the
  sheet.
- **`SortSheet`** (`src/components/sort-sheet.tsx`): a slide-up `Modal` (same
  backdrop-dismiss pattern as `CustomLengthDialog`) listing the four keys with
  human labels (`Name`, `Length`, `Date added`, `Date modified`). The active key is
  highlighted and shows its arrow. Tapping the active key flips its direction;
  tapping another key selects it with that key's default direction; backdrop tap
  closes. Each selection calls `onSort(key, dir)` and closes the sheet.
- Arrow semantics shown to the user: `name` asc = A→Z (`↑`) / desc = Z→A (`↓`);
  `length`/dates asc = smallest/oldest (`↑`) / desc = largest/newest (`↓`).
- Material You styling via `useTheme` tokens, reusing the chip/row patterns from
  `segmented-tabs.tsx` / `custom-length-dialog.tsx`.

## Edge cases
- Empty library or a single group: sort is a no-op.
- All groups have null length/date: they retain title order (tie-break) at the
  bottom — i.e. effectively title order.
- Sort applies identically in `name` and `folder` modes; folder groups still have
  items to total/date.
- One shared sort setting across both tabs (not remembered per-tab).

## Testing
- **Jest** (`sort-groups.ts`): `groupLengthMs` (sum, null→0, empty group),
  `groupDate` (newest item, null when none), `sortGroups` for each key × both
  directions, nulls-last for date, and the title tie-break.
- **Device-verified by the user:** the Sort button label, the sheet (select +
  flip), persistence across restart, and correct ordering in both tabs.

## Files
- New: `src/library/sort-groups.ts` (+ test), `src/components/sort-button.tsx`,
  `src/components/sort-sheet.tsx`.
- Changed: `src/app/index.tsx` (sort state + persistence, apply `sortGroups`,
  render the button + sheet).

## Out of scope
- Sorting within a group's episode list (stays as-is, by season/episode/filename).
- Per-tab separate sort memory.
