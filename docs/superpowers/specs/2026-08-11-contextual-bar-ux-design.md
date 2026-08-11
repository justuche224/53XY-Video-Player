# Contextual App Bar — UX Fixes (Design)

**Date:** 2026-08-11 · **Status:** approved, ready to plan

## Problem

The just-shipped media-management feature (`8d015f3`, fixed up in `07cfd99`) has four concrete UX bugs, found by reading the code (not yet device-verified):

1. **Bar overflow.** `ContextualAppBar` renders up to 9 fixed-width (40dp) icon buttons in a single non-scrolling flex row with no `flexShrink`: Close, count, Play, Mark Played, Mark Unplayed, Add to Playlist, Ungroup, Info (conditional), Share, Delete. On a ~360dp-wide phone (the project's own test device, an S22) that's 370dp+ of buttons alone before gaps/padding — it will overflow or clip.
2. **Home's "Play" doesn't play.** `handlePlay` in `(tabs)/index.tsx` calls `openGroup(firstGroup)`, which for any group with more than one item just navigates to the Group Detail screen. The play-outline icon promises playback; it delivers a screen transition.
3. **Mark Played / Mark Unplayed always both shown**, regardless of the selection's actual watch state — forces the user to figure out which one applies instead of the UI just knowing.
4. **No real sequential "play all"** despite the icon implying it, in either screen — each just opens one video and discards the rest of the selection.

## Approach

**Primary actions + overflow menu**, the standard Material contextual-app-bar pattern (cap visible icons, push the rest behind a menu) — chosen over a horizontal-scroll icon strip because scroll hides actions with no visual affordance that more exist, which is worse for actions users expect to just be there (Share, Delete).

## Bar structure

`ContextualAppBar` renders a fixed 6-element row that always fits: **Close, count, Play, Share, Delete, ⋮ (overflow)**. `Play` stays optional per caller (Home may omit it — see below); `Share`/`Delete` are unconditional as today. The bar's props change from one-callback-per-action to:

```ts
{
  selectedCount: number;
  onClearSelection: () => void;
  onPlay?: () => void;      // omitted = icon hidden, same as today
  onShare: () => void;
  onDelete: () => void;
  overflowActions: OverflowAction[];
}
```

## Overflow menu — `src/components/overflow-menu-sheet.tsx` (new)

Same visual/interaction pattern as the existing `EditGroupSheet`/`AddToPlaylistSheet`: `Modal` + backdrop `Pressable` (dismiss) + sheet `Pressable` (absorb taps), sliding up from the bottom. Content is a list of rows (icon + label), each row's `onPress` fires the action and closes the sheet.

```ts
type OverflowAction = {
  icon: React.ComponentProps<typeof Ionicons>['name']; // matches IconButton's existing `name` prop type
  label: string;
  onPress: () => void;
};
```

Each screen builds its own array so the two callers can differ:

- **Group Detail:** Info (only when `selectedCount === 1`), Mark toggle, Add to Playlist, Move to Group.
- **Home:** Mark toggle, Add to Playlist, Move to Group. (No Info — group-level metadata doesn't map to a single-file info sheet.)

## Mark Played/Unplayed → one smart toggle

New pure helper, alongside the other pure `src/library`/`src/player` helpers, Jest-tested:

```ts
// src/library/watch-toggle.ts
function resolveWatchToggle(
  selectedIds: string[],
  progress: ProgressMap,
): { label: 'Mark as played' | 'Mark as unplayed'; markPlayed: boolean }
```

- All selected items already fully played → `{ label: 'Mark as unplayed', markPlayed: false }`.
- Otherwise (none played, or a mix) → `{ label: 'Mark as played', markPlayed: true }`. A mixed selection defaults to finishing the batch off rather than resetting it — the more common real-world case (cleaning up a partially-watched batch).

Replaces the bar's two `onMarkPlayed`/`onMarkUnplayed` props with one overflow row whose label and action both come from `resolveWatchToggle`.

## Play semantics

- **Group Detail (`group.tsx`):** already opens the tapped video with `groupKey`/`mode` route params, so the existing next/prev + autoplay-next ("Binge pack") machinery carries playback through the rest of the group for free — no new queueing code needed. Change: when multiple videos are selected, open the **earliest item in the group's own order** (`group.items` order), not whichever was tapped first (Set-insertion order), so Play reliably starts from the front of the selection.
- **Home (`(tabs)/index.tsx`):** `handlePlay` stops calling `openGroup()` and instead pushes directly to `/player` with `videoId`/`uri`/`title`/`groupKey`/`mode` from the first item (group order) of the selected group — identical routing to what Group Detail already does, so the same autoplay-through-the-group behavior applies. **Play is hidden when more than one group is selected** (`onPlay` prop omitted), matching the existing pattern for Info at `count > 1` — "play" only has one unambiguous meaning for a single selected group.

## Components touched

- `src/components/contextual-app-bar.tsx` — prop surface change (above).
- `src/components/overflow-menu-sheet.tsx` — new.
- `src/library/watch-toggle.ts` — new, pure, Jest-tested.
- `src/app/(tabs)/index.tsx`, `src/app/group.tsx` — wire the new bar props + overflow arrays + Play fix.

No DB/schema changes. No new native dependency. JS-only — reload, no `expo run:android`.

## Testing

- `resolveWatchToggle`: Jest — all-played, all-unplayed, mixed, empty selection.
- Existing `ContextualAppBar`/screen wiring has no unit tests today (component-level, not pure logic) — manual verification only, consistent with how the rest of the UI layer is tested in this project.

## Manual verification

- Select enough items that the old bar would have overflowed (5+ on Home, or use Info+Ungroup together on Group Detail) — confirm the bar now fits on one row with room to spare.
- Home: select a single multi-episode group, tap Play — confirm it opens the player (not the group screen) and starts at the earliest episode.
- Home: select two groups — confirm Play icon is absent.
- Group Detail: select 3 episodes out of order (tap ep3, then ep1, then ep2) — confirm Play opens ep1, not ep3.
- Select a mix of played/unwatched items, open overflow — confirm the row reads "Mark as played"; select only already-played items — confirm it reads "Mark as unplayed"; tap each and confirm the resulting watch state.
- Overflow menu: Add to Playlist, Move to Group, Info (Group Detail, count===1) all still work as before, now from the sheet instead of a bar icon.
