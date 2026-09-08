import * as MediaLibrary from 'expo-media-library';

/** Gallery album saved frames are grouped into, so they are easy to find and to delete. */
const ALBUM = '53XY';

/**
 * Copy a saved frame into the user's photo library, deliberately.
 *
 * Moments live behind a `.nomedia` precisely so they never clutter the
 * gallery; this is the one path that opts a single frame in, so it asks for
 * permission at the moment of use rather than up front. Write-only access is
 * all that is needed — the app never reads the user's photos.
 */
export async function saveFrameToGallery(
  frameUri: string,
): Promise<'saved' | 'denied' | 'failed'> {
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) return 'denied';

    const asset = await MediaLibrary.Asset.create(frameUri);
    // Grouping is a nicety, not the point — a frame that lands in the gallery
    // but not in the album is still saved, so an album failure is swallowed.
    try {
      const album = await MediaLibrary.Album.get(ALBUM);
      if (album) await album.add([asset]);
      else await MediaLibrary.Album.create(ALBUM, [asset], false);
    } catch (e) {
      console.warn('[moments] saved the frame but could not file it under the album:', e);
    }
    return 'saved';
  } catch (e) {
    console.warn('[moments] failed to save frame to the gallery:', e);
    return 'failed';
  }
}
