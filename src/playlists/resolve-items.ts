import type { LibraryVideo } from '@/library/types';
import type { PlaylistItemRow } from '@/db/playlists-repo';

/**
 * Join playlist item rows against the library video cache.
 * Drops items whose video no longer exists. Preserves sort order.
 */
export function resolvePlaylistItems(
  items: PlaylistItemRow[],
  videosById: Map<string, LibraryVideo>,
): LibraryVideo[] {
  const result: LibraryVideo[] = [];
  for (const item of items) {
    const video = videosById.get(item.videoId);
    if (video) result.push(video);
  }
  return result;
}
