# Library Length Filter — Design (v2, first filter)

_Status: approved 2026-06-18. First slice of the v2 "advanced filters" backlog._

## Goal
Let the user permanently hide videos from the library by duration. Persistent
"ignore" rules (VLC/MX-style) configured once in Settings that apply app-wide —
library, folder view, group detail, and search — until changed.

This is the first of the planned advanced filters. **Name-pattern and folder
ignore rules are explicitly out of scope** and stay on the v2 backlog.

JS-only — no native module is touched, so this Fast-Refreshes (`npx expo start`),
no `run:android` rebuild needed.

## Mental model
- **Persistent ignore rules**, not a temporary view filter. Set once, applies
  everywhere, survives restarts (stored in SQLite settings).
- Two independent, individually-toggleable thresholds:
  - **Minimum length** — hide videos shorter than X.
  - **Maximum length** — hide videos longer than Y.

## Data model
Persisted via the existing `settings-repo` key/value store:
- `filter.minDurationMs` — hide videos **shorter than** this many ms; absent/empty = disabled.
- `filter.maxDurationMs` — hide videos **longer than** this many ms; absent/empty = disabled.

Values are stored as the string form of a millisecond integer (the unit chosen in
the UI is converted to ms before persisting; the UI converts back for display).

## Pure logic — `src/library/filter-videos.ts` (Jest-tested)
```ts
export interface LengthFilter {
  minDurationMs: number | null; // null = no minimum
  maxDurationMs: number | null; // null = no maximum
}

export function applyLengthFilter(
  videos: LibraryVideo[],
  filter: LengthFilter,
): LibraryVideo[];
```

Rules for keeping a video:
- Hidden when `minDurationMs != null && durationMs < minDurationMs`.
- Hidden when `maxDurationMs != null && durationMs > maxDurationMs`.
- **Videos with `durationMs == null` (unknown length) are never hidden** — we do
  not hide what we cannot measure.
- **Strict comparison:** a video whose duration exactly equals a threshold stays
  visible (`< min` and `> max`, not `<=`/`>=`).
- Empty filter (`{ min: null, max: null }`) is a pass-through (returns all videos).

The function is pure: takes the array + filter, returns the kept array. No DB, no
React.

## Wiring — applied before grouping
In `src/library/use-library.ts`, run the scanned/cached `videos` array through
`applyLengthFilter(videos, filter)` **before** `groupByName` / `groupByFolder`.
The grouping memo keys on `[videos, mode, filter]`.

Filtering videos (not groups) means:
- A group whose every item is hidden simply disappears (no empty groups).
- A group keeps only its visible items, and `count` reflects the visible count.
- `filterGroups` search continues to work unchanged on the already-filtered groups.

## Reactive settings — `FilterSettingsProvider` / `useFilterSettings()`
A lightweight React context (`src/library/filter-settings.tsx` or similar),
mounted alongside the other providers in `src/app/_layout.tsx`, backed by
`settings-repo`:
- Loads `filter.minDurationMs` / `filter.maxDurationMs` from SQLite on mount.
- Exposes `{ filter: LengthFilter, setMin(ms|null), setMax(ms|null) }`.
- `setMin`/`setMax` write through to the DB and update in-memory state.

Both the Settings screen (writer) and `useLibrary` (reader, via the context)
consume it, so changing a filter and returning to the library reflects instantly —
no focus-refetch hack needed.

## UI — Settings screen "Library filters" section
Replaces the current `Settings coming soon.` placeholder in `src/app/settings.tsx`.

Two rows, Material You styled:
- **Minimum length:** chips `Off · 10s · 30s · 1m · 5m · Custom…`
- **Maximum length:** chips `Off · 1h · 2h · 3h · Custom…`

Behavior:
- The selected chip is highlighted; `Off` means that threshold is disabled (null).
- A preset chip sets the threshold to its ms value.
- **Custom…** opens a small Material dialog: a number text field + a unit picker
  (sec / min / hr). Confirm converts to ms and persists; cancel leaves it unchanged.
  If the current value isn't one of the presets, the `Custom…` chip shows the
  active custom value and is highlighted.
- **Footer:** a subtle line showing the live effect — **"Hiding N videos"** (or
  "No videos hidden") — computed from the current library count minus the filtered
  count.

New UI components (Material You, reuse `pressable-scale` + theme tokens):
- A `filter-chips` row component (`src/components/`).
- The custom-value dialog (`Modal`), small and self-contained.

## Edge cases
- **Unknown duration** (`durationMs == null`): always kept (see rules above).
- **Boundary equality:** kept (strict comparison).
- **min > max:** allowed (would hide everything in the gap); we don't prevent it.
  Unusual but not an error — the "Hiding N videos" footer makes the effect obvious.
- **Custom dialog invalid input** (empty / non-numeric / ≤ 0): confirm is disabled
  or treated as no-op; never persists garbage.

## Testing
- **Jest** (`src/library/filter-videos.ts`): min-only, max-only, both, null-duration
  kept, boundary-equals kept, empty filter pass-through, min > max.
- **Device-verified by the user:** settings persistence across restart, chip
  selection + custom dialog, the live "Hiding N videos" footer, and that the
  library/folders/search all reflect the rule.

## Files
- New: `src/library/filter-videos.ts` (+ test), `src/library/filter-settings.tsx`
  (context), `src/components/filter-chips.tsx` (+ custom dialog, possibly its own file).
- Changed: `src/library/use-library.ts` (apply filter before grouping),
  `src/app/_layout.tsx` (mount provider), `src/app/settings.tsx` (filters UI).

## Out of scope (stays on v2 backlog)
- Ignore by **name pattern** (substring / glob / regex).
- Ignore by **folder** (hide whole folders).
- Temporary/per-session view filters and filter presets.
