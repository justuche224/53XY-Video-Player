import type { Cue, SubtitleFormat } from './types';
import { parseSrt } from './parse-srt';
import { parseVtt } from './parse-vtt';
import { parseAss } from './parse-ass';

export const SUBTITLE_EXTENSIONS = ['srt', 'vtt', 'ass', 'ssa'] as const;

/**
 * Refuse absurd files. ASS with an embedded [Fonts] section can run to
 * megabytes, and no legitimate dialogue track is this big. Enforced by
 * load-subtitle, which is where the byte count is known.
 */
export const MAX_SUBTITLE_BYTES = 10 * 1024 * 1024;

export function subtitleFormatOf(name: string): SubtitleFormat | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === 'srt') return 'srt';
  if (ext === 'vtt') return 'vtt';
  if (ext === 'ass' || ext === 'ssa') return 'ass';
  return null;
}

/**
 * Identify a subtitle format from its content rather than its filename.
 *
 * Needed because some SAF content providers (notably Android's Downloads
 * provider, `content://com.android.providers.downloads.documents/...`) hand
 * back an opaque document id with no extension in place of a real filename,
 * so `subtitleFormatOf` has nothing to go on. Order matters: a VTT file
 * always opens with a `WEBVTT` header, so that is checked first; ASS/SSA
 * declares itself with a `[Script Info]` or `[Events]` section header; SRT
 * has no header at all, so it is identified last, by its comma-millisecond
 * timecode arrow (which also rules out VTT's dot-millisecond arrows).
 */
export function sniffSubtitleFormat(text: string): SubtitleFormat | null {
  const head = text.replace(/^\uFEFF/, '').trimStart();
  if (/^WEBVTT/.test(head)) return 'vtt';
  if (/^\s*\[(Script Info|Events)\]/im.test(text)) return 'ass';
  if (/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(text)) return 'srt';
  return null;
}

export function parseSubtitle(name: string, text: string): Cue[] {
  const format = subtitleFormatOf(name) ?? sniffSubtitleFormat(text);
  switch (format) {
    case 'srt':
      return parseSrt(text);
    case 'vtt':
      return parseVtt(text);
    case 'ass':
      return parseAss(text);
    default:
      return [];
  }
}
