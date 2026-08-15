import type { Group, LibraryVideo } from '@/library/types';
import { neighbors } from './playlist';

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
 * Pick the queue that drives prev/next: the first candidate (in precedence
 * order — ad-hoc selection, then playlist, then group) that is non-empty AND
 * contains the video now playing.
 *
 * Returning null means "not in a queue at all", and that is the single source
 * of truth for hiding the prev/next chrome. Deriving the buttons' visibility
 * from the same call that produces the neighbors keeps them from disagreeing:
 * an earlier version gated the chrome on `playlistId || groupKey` separately
 * and a queue launched from Home carried neither, so the buttons disappeared
 * while autoplay-next happily advanced.
 */
export function activeQueue<T extends { id: string }>(
  candidates: (T[] | null)[],
  currentId: string,
): { prev: T | null; next: T | null } | null {
  for (const items of candidates) {
    if (!items || items.length === 0) continue;
    const { prev, next, index } = neighbors(items, currentId);
    if (index === -1) continue;
    return { prev, next };
  }
  return null;
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
