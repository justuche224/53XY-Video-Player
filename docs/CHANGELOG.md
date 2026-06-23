# 53XY — Changelog (archive)

> Append-only, newest first. One bullet per shipped feature. The most recent entries live in [HANDOFF.md §7](./HANDOFF.md#7-changelog); older ones are archived here. The status table in [HANDOFF.md §2](./HANDOFF.md#2-status-table--single-source-of-truth) is the canonical feature list.

- **Shared library cache + un-gated playback** — root `LibraryProvider` owns one cached `videos` array; player plays immediately + async resume seek (killed 3–5s black screen).
- **Player replay fix** — finished video now seeks to 0 and replays on play; dynamic replay icon (↻).
- **QOL Polish** — search clear button, premium empty states, android ripples, Settings icons, player 2x haptics.
- **UI Polish** — unified Ionicons/MaterialIcons, themed headers, scroll overscroll/bounces, duration badges on thumbnails. Spec/plan: [ui-polish-design](./superpowers/specs/2026-06-18-ui-polish-design.md), [ui-polish-plan](./superpowers/plans/2026-06-18-ui-polish.md).
- **FlashList migration** — `@shopify/flash-list` v2 for library + group-detail lists (native dep). Spec/plan: [flashlist-design](./superpowers/specs/2026-06-18-flashlist-migration-design.md), [flashlist-plan](./superpowers/plans/2026-06-18-flashlist-migration.md).
- **Library sort options** — sort by name/length/date-added/date-modified, persisted. Spec/plan: [sort-design](./superpowers/specs/2026-06-18-library-sort-options-design.md), [sort-plan](./superpowers/plans/2026-06-18-library-sort-options.md).
- **Name + folder filters** — filename pattern ignore (substring/glob) + folder ignore; composed `applyFilters`. Spec/plan: [name-folder-design](./superpowers/specs/2026-06-18-library-name-folder-filters-design.md), [name-folder-plan](./superpowers/plans/2026-06-18-library-name-folder-filters.md).
- **Length filter** — persistent min/max duration ignore; Settings chips + custom dialog + hidden-count footer. Spec/plan: [length-filter-design](./superpowers/specs/2026-06-18-library-length-filter-design.md), [length-filter-plan](./superpowers/plans/2026-06-18-library-length-filter.md).
- **Plan 3b-ii-b** — lock overlay + double-tap gated to controls-hidden.
- **Plan 3b-ii-a** — swipe brightness / system volume / drag-scrub.
- **Plan 3b-i** — long-press→2×, 3-zone double-tap.
- **Plan 3a** — core player (expo-video, overlay, resume, progress, orientation, tracks, speed). Spec/plan: [3a-design](./superpowers/specs/2026-06-18-player-core-3a-design.md), [3a-plan](./superpowers/plans/2026-06-18-player-core-3a.md).
- **Library polish** — scroll perf, cache-first rescan, conservative numeric merge, multi-thumbnail collages.
- **Library 2B** — adaptive grid/list UI, tabs, search, group detail, thumbnails.
- **Library 2A** — device scan, parsing, grouping engine, SQLite.
- **Foundation** — themed shell, Material You, SQLite + migrations, nav skeleton, Jest harness.
