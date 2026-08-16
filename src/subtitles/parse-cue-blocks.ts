import type { Cue } from './types';
import { parseTimecode } from './timestamp';
import { stripInlineTags } from './strip-tags';

/**
 * The shared SRT/VTT block scanner. It looks only for lines containing
 * '-->', so sequence numbers and VTT cue identifiers are skipped for free.
 */
export function parseCueBlocks(text: string): Cue[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: Cue[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].includes('-->')) {
      i += 1;
      continue;
    }
    const [rawStart, rawRest] = lines[i].split('-->');
    const startMs = parseTimecode(rawStart);
    // VTT cue settings (align:start line:90%) trail the end timestamp.
    const endMs = parseTimecode((rawRest ?? '').trim().split(/\s+/)[0] ?? '');
    i += 1;

    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
      textLines.push(lines[i]);
      i += 1;
    }
    // A missing blank line before the next cue leaves that cue's sequence
    // number stuck on the end of this one's text. Drop it.
    if (
      i < lines.length &&
      lines[i].includes('-->') &&
      textLines.length > 0 &&
      /^\d+$/.test(textLines[textLines.length - 1].trim())
    ) {
      textLines.pop();
    }

    if (startMs === null || endMs === null || endMs <= startMs) continue;
    const body = stripInlineTags(textLines.join('\n')).trim();
    if (body) cues.push({ startMs, endMs, text: body });
  }

  return cues.sort((a, b) => a.startMs - b.startMs);
}
