# FlashList Migration (library + group detail) — Design (v2)

_Status: approved 2026-06-18._

## Goal
Replace the two `FlatList`s — the home library list and the group-detail episode
list — with Shopify **FlashList v2** to smooth thumbnail-heavy fling scrolling via
cell recycling. Pure list-engine swap: same data, same cards/rows, same
grouping/sort/filter/progress behaviour.

## Dependency note (NATIVE — needs a rebuild)
`@shopify/flash-list` is added via `npx expo install @shopify/flash-list` (so the
SDK-56-compatible version is chosen). **FlashList ships native code and autolinks**,
so seeing it on-device requires `npx expo run:android` (a full rebuild), not Fast
Refresh — the user runs the build. FlashList **v2** is the new-architecture rewrite
(RN 0.85 is new-arch only) and auto-measures items, so there is **no
`estimatedItemSize`** to set.

## Home library — `src/app/index.tsx`
Replace the `FlatList` with `FlashList`, keeping these props:
- `data={visible}`, `keyExtractor={(g) => g.key}`, `renderItem` (unchanged).
- `numColumns={layout === 'grid' ? 2 : 1}`.
- `key={layout}` — forces a clean re-layout when toggling grid↔list (FlashList, like
  FlatList, wants a fresh instance when `numColumns` changes).
- `ListEmptyComponent` (unchanged), `contentContainerStyle={{ paddingBottom: spacing.xl }}`.

**Remove the FlatList-only tuning** (FlashList's recycler replaces all of it):
`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`,
`updateCellsBatchingPeriod`, `removeClippedSubviews`, and `getItemLayout`. The
`LIST_ROW_HEIGHT` constant (used only by `getItemLayout`) is deleted.

Update the import: drop `FlatList` from the `react-native` import; add
`import { FlashList } from '@shopify/flash-list';`. (Keep `ActivityIndicator`,
`StyleSheet`, `Text`, `View` from `react-native`.)

## Group detail — `src/app/group.tsx`
Replace the single-column `FlatList` of `EpisodeRow`s with `FlashList`, keeping
`data={group?.items ?? []}`, `keyExtractor={(v) => v.id}`, `renderItem`, and any
existing `ListEmptyComponent`/`contentContainerStyle` exactly as they are. Update
the import the same way (drop `FlatList` from `react-native`, add the `FlashList`
import).

## Behaviour held constant
`groupPercent`, `openGroup`, the layout toggle, search, the Videos/Folders tabs,
sort, filters, and progress refresh are all untouched — only the list component
changes.

## Edge cases / risks
- **Grid spacing:** FlashList grid cell spacing can differ slightly from FlatList —
  a device-verify check (2 columns aligned, no clipped thumbnails, expected
  inter-item gap).
- **Layout toggle:** the existing `key={layout}` remount covers the `numColumns`
  switch.
- **Empty/loading:** still rendered via `ListEmptyComponent`.
- If `npx expo install` cannot reach the network in the agent's sandbox, the
  dependency add is handed to the user; the code edits don't depend on the package
  resolving for `tsc` of the screens (but the screens import FlashList, so `tsc`
  needs the package present — see Testing).

## Testing
- No new Jest surface: the pure-logic suite doesn't import these screens, so it is
  unaffected.
- **Agent gate:** `npx tsc --noEmit` clean (requires `@shopify/flash-list` types
  installed) and `npm test` green.
- **Device-verified by the user (after rebuild):** fling smoothness in grid and
  list, group-detail scrolling, grid column alignment, and that empty/loading
  states still show.

## Files
- Changed: `package.json` (+ `bun.lock`) — add `@shopify/flash-list`;
  `src/app/index.tsx`; `src/app/group.tsx`.

## Out of scope
- Masonry / variable-size layouts.
- FlashList for any other list or screen.
- Performance instrumentation/metrics.
