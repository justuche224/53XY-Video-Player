import { File } from 'expo-file-system';

import type { LoadedSubtitle } from './types';
import { decodeSubtitleBytes } from './decode-text';
import { parseSubtitle, subtitleFormatOf, sniffSubtitleFormat, MAX_SUBTITLE_BYTES } from './parse-subtitle';

export class SubtitleTooLargeError extends Error {
  constructor() {
    super('Subtitle file is too large');
    this.name = 'SubtitleTooLargeError';
  }
}

/**
 * How much of an extensionless file to decode and sniff before committing to
 * a full read. All three format signatures (WEBVTT, [Script Info]/[Events],
 * the SRT timecode arrow) show up well within the first few hundred bytes of
 * a real subtitle file, so 64 KB is generous headroom, not a tight budget.
 */
const SNIFF_PREFIX_BYTES = 64 * 1024;

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

  if (!subtitleFormatOf(name)) {
    // No usable extension — e.g. an opaque SAF document id from the
    // Downloads provider (content://.../msf%3A123). Sniffing the whole file
    // requires decoding it first, and pickFromFile's mime filter is '*/*',
    // so a mispicked video or image would otherwise pay for a full decode
    // (a JS string/number[] proportional to file size — worth avoiding for
    // an 80+ MB file) before being rejected. Decoding just a small prefix
    // first bails out in microseconds instead. This is decoded
    // independently from the full-file decode below, not by slicing the
    // decoded string: the signatures this looks for are plain ASCII, so a
    // prefix cut mid multi-byte sequence is harmless for sniffing purposes.
    const prefix = bytes.subarray(0, Math.min(bytes.length, SNIFF_PREFIX_BYTES));
    if (!sniffSubtitleFormat(decodeSubtitleBytes(prefix))) {
      return { uri, name, cues: [] };
    }
  }

  const cues = parseSubtitle(name, decodeSubtitleBytes(bytes));
  return { uri, name, cues };
}
