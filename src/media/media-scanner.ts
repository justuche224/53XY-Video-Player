import { AssetField, MediaType, Query } from 'expo-media-library';

import type { LibraryVideo } from '@/library/types';
import { deriveFolder } from './derive-folder';

/**
 * Enumerates all video assets on the device. Caller must ensure media
 * permission (granular 'video') is granted first. One `getInfo()` call per
 * asset fetches all metadata in a single native round-trip.
 */
export async function scanVideos(): Promise<LibraryVideo[]> {
  const assets = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.VIDEO)
    .orderBy(AssetField.CREATION_TIME)
    .exe();

  const videos: LibraryVideo[] = [];
  for (const asset of assets) {
    try {
      const info = await asset.getInfo();
      videos.push({
        id: info.id,
        uri: info.uri,
        filename: info.filename,
        durationMs: info.duration ?? null,
        width: info.width ?? null,
        height: info.height ?? null,
        folder: deriveFolder(info.uri).path,
        createdAt: info.creationTime ?? null,
        modifiedAt: info.modificationTime ?? null,
      });
    } catch {
      // Asset disappeared or is unreadable since the query — skip it.
    }
  }
  return videos;
}
