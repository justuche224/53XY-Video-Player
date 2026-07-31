import { useThumbnailSweep } from './use-thumbnail-sweep';

/**
 * Renders nothing; exists so the sweep can be mounted once at the app root
 * without the library provider having to know about thumbnails or routing.
 */
export function ThumbnailSweep() {
  useThumbnailSweep();
  return null;
}
