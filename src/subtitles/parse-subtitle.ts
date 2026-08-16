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

export function parseSubtitle(name: string, text: string): Cue[] {
  switch (subtitleFormatOf(name)) {
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
