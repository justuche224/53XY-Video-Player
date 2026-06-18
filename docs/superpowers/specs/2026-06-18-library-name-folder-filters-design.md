# Library Name-Pattern & Folder Ignore Filters — Design (v2)

_Status: approved 2026-06-18. Second slice of the v2 "advanced filters" backlog;
builds directly on the merged length-filter infrastructure._

## Goal
Add two more persistent "ignore" rules to the library, alongside the existing
length filter:
- **Ignore by name pattern** — hide videos whose filename matches a pattern.
- **Ignore folders** — hide entire folders from the library.

Both are configured in Settings, persist in SQLite, and apply app-wide (library,
folders, search, group detail, player prev/next playlist) through the same
`FilterSettings` context and the same pre-grouping filter path already used by the
length filter.

JS-only — no native module touched. Fast Refresh applies (`npx expo start`); no
`run:android` rebuild.

## Mental model
Persistent ignore rules (VLC/MX-style), consistent with the length filter:
- **Name patterns:** a managed list. A video is hidden if its filename matches
  **any** pattern.
- **Ignored folders:** a set of folder paths. A video is hidden if it lives in an
  ignored folder.

A video is **shown** only if it passes the length rule **and** matches no name
pattern **and** is not in an ignored folder.

## Data model
The filter object extends from `{ minDurationMs, maxDurationMs }` to:

```ts
interface LibraryFilter {
  minDurationMs: number | null;
  maxDurationMs: number | null;
  namePatterns: string[];     // case-insensitive substring-or-glob patterns
  ignoredFolders: string[];   // folder paths (the LibraryVideo.folder value)
}
```

Persistence (existing `settings-repo` key/value store):
- `filter.minDurationMs` / `filter.maxDurationMs` — unchanged (string ms or empty).
- `filter.namePatterns` — JSON array of strings, e.g. `["trailer","VID_*"]`.
- `filter.ignoredFolders` — JSON array of folder-path strings.

JSON parse is defensive: a missing/empty/malformed value yields `[]` (a broken
setting must never blank the library or throw).

`EMPTY_FILTER` becomes
`{ minDurationMs: null, maxDurationMs: null, namePatterns: [], ignoredFolders: [] }`.

**Type rename:** the existing exported interface `LengthFilter` is renamed to
`LibraryFilter` (extended with the two array fields). Update its three current
referents — `filter-videos.ts` (definition + `applyLengthFilter`'s param type +
`EMPTY_FILTER`), `filter-settings.tsx` (the `LengthFilter` import and the
`useState<LengthFilter>` / context `filter` type) — to `LibraryFilter`.
`applyLengthFilter` keeps reading only `minDurationMs`/`maxDurationMs`, so widening
its parameter to `LibraryFilter` is compatible.

## Pure logic — `src/library/filter-videos.ts` (Jest-tested)
Additions (length helpers stay as-is):

```ts
/** Case-insensitive. Glob (anchored full match) if the pattern contains * or ?,
 *  otherwise substring "contains". A blank/whitespace pattern never matches. */
export function matchesNamePattern(filename: string, pattern: string): boolean;

/** Hide a video if its filename matches ANY pattern. */
export function applyNameFilter(videos: LibraryVideo[], patterns: string[]): LibraryVideo[];

/** Hide a video whose folder is in the ignored set. */
export function applyFolderFilter(videos: LibraryVideo[], ignoredFolders: string[]): LibraryVideo[];

/** Compose length + name + folder. The single entry point used by the hooks. */
export function applyFilters(videos: LibraryVideo[], filter: LibraryFilter): LibraryVideo[];
```

Matching rules for `matchesNamePattern`:
- Comparison is lower-cased on both sides.
- If `pattern` (trimmed) is empty → returns `false` (no-op safety; never hides).
- If the pattern contains `*` or `?` → glob: escape regex metacharacters, then
  `*` → `.*` and `?` → `.`, anchored `^…$` (full-filename match). Example:
  `VID_*` matches `vid_001.mp4`; `*.mkv` matches `movie.mkv`.
- Otherwise → substring: `filename.toLowerCase().includes(pattern.toLowerCase())`.

`applyFilters` order is irrelevant to the result (all are "hide if" predicates);
implement as length → name → folder for clarity. Empty filter (no min/max, empty
arrays) is a pass-through returning the same array reference.

`applyLengthFilter` remains exported and is reused inside `applyFilters`.

## Wiring
`useLibrary` and `useGroups` currently call `applyLengthFilter(videos, filter)`
before grouping. Both switch to `applyFilters(videos, filter)`. Memo deps already
include `filter`; the broader filter object flows through unchanged.

## Reactive settings — extend `FilterSettingsProvider` / `useFilterSettings`
The context (`src/library/filter-settings.tsx`) gains the two new keys and their
mutators. New context shape:

```ts
interface FilterSettings {
  filter: LibraryFilter;
  setMin: (ms: number | null) => void;
  setMax: (ms: number | null) => void;
  addNamePattern: (pattern: string) => void;    // trims; no-op on blank/duplicate
  removeNamePattern: (pattern: string) => void;
  toggleFolder: (path: string) => void;         // add if absent, remove if present
}
```

- On mount, load all four settings keys; parse JSON arrays defensively.
- Each mutator updates in-memory state and writes through to the DB
  (arrays via `JSON.stringify`).

## UI — Settings screen, "Library filters" section
The length-filter rows stay. Two subsections are added below them.

**Ignore by name:**
- A label "Ignore videos named".
- The current patterns rendered as removable rows/chips: pattern text + a ✕ that
  calls `removeNamePattern`.
- An inline add control: a `TextInput` ("Add pattern…") + an "Add" button calling
  `addNamePattern`. Blank and duplicate adds are no-ops; the field clears on a
  successful add.

**Ignore folders:**
- A label "Hidden folders".
- Every folder currently in the library, derived from the already-loaded
  `allVideos` (distinct `video.folder`), each shown as folder name (+ a small,
  truncated path and/or video count) with a `Switch`. Switch **off** = ignored
  (the path is in `ignoredFolders`); toggling calls `toggleFolder`.
- Folders are sorted by name. A folder whose path is in `ignoredFolders` but is no
  longer present in the library does not render a row (accepted; see edge cases).

**Footer:** the existing "Hiding N videos" line now computes hidden count via
`applyFilters` (length + name + folder combined), so it reflects all rules.

Reuse existing styling patterns (`useTheme` tokens, the chip style from
`filter-chips.tsx` / `segmented-tabs.tsx`). New presentational components as needed
(e.g. a `name-pattern-list.tsx` and a `folder-ignore-list.tsx`, or sections within
the settings screen) — kept small and focused.

## Edge cases
- Blank/whitespace pattern: not added.
- Duplicate pattern: not added twice (exact-string match after trim).
- Removing a pattern that isn't present: no-op.
- An ignored folder no longer in the library: its path persists in
  `ignoredFolders` (harmless — matches no current video) but shows no toggle row.
  Accepted for this pass; not surfaced as an "orphan".
- Malformed JSON in a settings value: treated as `[]`.
- Name match targets the **filename including extension**, not the group title.

## Testing
- **Jest** (`filter-videos.ts`): `matchesNamePattern` (substring hit/miss,
  case-insensitivity, glob `*`, glob `?`, `*.ext`, blank pattern → false),
  `applyNameFilter` (any-match, empty patterns pass-through), `applyFolderFilter`
  (in-set hidden, empty pass-through), `applyFilters` (all three composed, empty
  filter same-ref pass-through).
- **Device-verified by the user:** adding/removing name patterns, folder toggles,
  persistence across restart, the combined "Hiding N videos" footer, and that
  library/folders/search/group-detail/player all reflect the rules.

## Files
- Changed: `src/library/filter-videos.ts` (new matchers + `applyFilters`, extend
  `LibraryFilter`/`EMPTY_FILTER`), `src/library/filter-settings.tsx` (new keys +
  mutators), `src/library/use-library.ts` + `src/library/use-groups.ts` (call
  `applyFilters`), `src/app/settings.tsx` (two new subsections + footer via
  `applyFilters`).
- New: small Settings sub-components for the name-pattern list and folder-ignore
  list (exact split decided in the plan).

## Out of scope (stays on backlog)
- Long-press-to-hide a folder from the Folders tab (chose Settings-list management).
- Regex patterns; per-folder length overrides; pattern matching on group title.
