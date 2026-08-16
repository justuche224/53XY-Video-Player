import { File } from 'expo-file-system';

import type { LoadedSubtitle } from './types';
import { decodeSubtitleBytes } from './decode-text';
import { parseSubtitle, MAX_SUBTITLE_BYTES } from './parse-subtitle';

export class SubtitleTooLargeError extends Error {
  constructor() {
    super('Subtitle file is too large');
    this.name = 'SubtitleTooLargeError';
  }
}

/**
 * Read, decode and parse a subtitle file.
 *
 * `File.bytes()` is async in SDK 56 (it returns `Promise<Uint8Array>`; the
 * synchronous variant is the separately named `bytesSync()`), so the await
 * here is required.
 */
export async function loadSubtitle(uri: string, name: string): Promise<LoadedSubtitle> {
  const file = new File(uri);
  const bytes = await file.bytes();
  if (bytes.length > MAX_SUBTITLE_BYTES) throw new SubtitleTooLargeError();
  const cues = parseSubtitle(name, decodeSubtitleBytes(bytes));
  return { uri, name, cues };
}
