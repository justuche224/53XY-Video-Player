import type { Group, LibraryVideo } from '@/library/types';

/**
 * Flatten a contextual-bar group selection into an ordered queue of video ids:
 * selected groups in the order they appear on screen, each group's items in
 * their existing order. Selection keys with no matching group are ignored.
 */
export function selectionQueueIds(orderedGroups: Group[], selectedKeys: Set<string>): string[] {
  const ids: string[] = [];
  for (const group of orderedGroups) {
    if (!selectedKeys.has(group.key)) continue;
    for (const item of group.items) ids.push(item.id);
  }
  return ids;
}

/**
 * Join queue ids against the library video cache. Drops ids whose video no
 * longer exists (deleted since the queue was stashed). Preserves queue order.
 */
export function resolveQueueItems(
  ids: string[],
  videosById: Map<string, LibraryVideo>,
): LibraryVideo[] {
  const result: LibraryVideo[] = [];
  for (const id of ids) {
    const video = videosById.get(id);
    if (video) result.push(video);
  }
  return result;
}
