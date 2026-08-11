# Media Management & Context Menu (Multi-Select)

We will introduce multi-selection and context menus across the app (Home screen groups and Detail screen videos). This will be broken down into clear milestones as requested.

## Proposed Milestones

### Milestone 1: Selection Foundation & Basic Actions (Current Scope)
- **Selection State**: Long-pressing a `GroupCard`/`GroupRow` (on Home) or `MediaRow` (in Group Detail) enters multi-select mode. Subsequent taps toggle selection instead of opening the item. Back button exits selection mode.
- **Contextual Top App Bar**: When `selectedCount > 0`, the header is replaced by a Contextual Top App Bar showing the selected count, a close button to clear selection, and action icons.
- **Actions**:
  - **Share**: Uses `expo-sharing` to share the selected videos.
  - **Delete**: Deletes the selected videos from the device using `expo-media-library` and removes them from the library DB.
  - **Info**: Shows a bottom sheet with file metadata (path, size, duration, date added/modified). Only available when exactly 1 item is selected.

### Milestone 2: Playlist & Play-State Actions
- **Add to Playlist**: Opens a sheet to select an existing playlist or create a new one, bulk-adding all selected videos.
- **Mark as Played/Unplayed**: Toggles the `watch_progress` state for all selected videos.
- **Play All**: For groups/folders, queues all items in the group into the player sequentially.

### Milestone 3: Advanced Group Management
- **Ungroup**: Allows a user to override the automatic grouping engine, forcing selected videos in a group to be split into their own individual groups. Requires DB migration to store manual grouping overrides.

---

## User Review Required

Please review the milestones above. **This plan focuses on executing Milestone 1 first** to establish the foundation before moving to the more complex database operations in Milestones 2 and 3.

## Open Questions for Milestone 1

> [!IMPORTANT]
> - Do you approve of starting with Milestone 1 and then iterating on Milestones 2 and 3 in subsequent tasks?
> - For deleting, should we show a confirmation dialog before deleting files permanently from the device? (Recommended: Yes)
> - When sharing a group (which could be gigabytes of video), do you want a limit on the number of files shared at once to avoid crashing the share sheet?

## Proposed Changes (Milestone 1)

### Dependencies
#### [MODIFY] package.json / app.config.ts
- Add `expo-sharing` to handle file sharing.
- Verify `expo-media-library` permissions for file deletion.

### UI Components
#### [NEW] src/components/contextual-app-bar.tsx
- A new animated header that slides in over the default header when `selectedCount > 0`.
- Renders icons based on the currently selected items (e.g. hides 'Info' if > 1 item).
#### [NEW] src/components/video-info-sheet.tsx
- A bottom sheet displaying metadata (Path, Size, Duration, Dimensions, etc.) for a single selected video.
#### [MODIFY] src/components/group-card.tsx & src/components/media-row.tsx
- Add `selected` boolean prop.
- Add checkmark overlay / visual selection state when `selected` is true.
- Add `onLongPress` handling to trigger selection mode.

### Screens (State Management)
#### [MODIFY] src/app/(tabs)/index.tsx (Home Screen)
- Add `selectedIds` state (Set of strings).
- If `selectedIds.size > 0`, swap `HomeHeader` for `ContextualAppBar`.
- Hijack the Android hardware back button to clear selection when active.
#### [MODIFY] src/app/group.tsx (Group Detail Screen)
- Implement identical selection state management for individual videos inside the group.

### Actions Logic
#### [NEW] src/library/media-actions.ts
- Pure functions for `shareVideos(uris)`, `deleteVideos(ids)`, and `getVideoInfo(id)`.

## Verification Plan

### Automated Tests
- Unit tests for `media-actions.ts` to ensure delete/share logic is correct.

### Manual Verification
- Long press on a group to enter selection mode.
- Tap other groups to add to selection.
- Verify Contextual Top App Bar appears with correct actions.
- Use the Info action on a single item.
- Share an item.
- Delete an item and confirm it's removed from the library.
- Press back button to cancel selection mode.
