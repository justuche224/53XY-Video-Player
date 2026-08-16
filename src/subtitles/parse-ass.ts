import type { Cue } from './types';
import { parseTimecode } from './timestamp';
import { stripInlineTags } from './strip-tags';

/**
 * Split on `sep`, but stop after `limit` fields so the final field keeps any
 * separators it contains. ASS puts Text last precisely because it has commas.
 */
function splitLimit(source: string, sep: string, limit: number): string[] {
  const parts: string[] = [];
  let idx = 0;
  while (parts.length < limit - 1) {
    const next = source.indexOf(sep, idx);
    if (next === -1) break;
    parts.push(source.slice(idx, next));
    idx = next + 1;
  }
  parts.push(source.slice(idx));
  return parts;
}

/**
 * Parse ASS/SSA dialogue as plain text. Positioning, colours, fonts and
 * karaoke are discarded by design (see the spec): signs and typesetting come
 * out as ordinary bottom-centred lines.
 */
export function parseAss(text: string): Cue[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: Cue[] = [];
  let inEvents = false;
  let idxStart = -1;
  let idxEnd = -1;
  let idxText = -1;
  let fieldCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[')) {
      inEvents = /^\[events\]/i.test(trimmed);
      // Column indices belong to the section that declared them.
      idxStart = -1;
      idxEnd = -1;
      idxText = -1;
      continue;
    }
    if (!inEvents) continue;

    if (/^Format\s*:/i.test(trimmed)) {
      const fields = trimmed
        .slice(trimmed.indexOf(':') + 1)
        .split(',')
        .map((f) => f.trim().toLowerCase());
      idxStart = fields.indexOf('start');
      idxEnd = fields.indexOf('end');
      idxText = fields.indexOf('text');
      fieldCount = fields.length;
      continue;
    }

    if (!/^Dialogue\s*:/i.test(trimmed)) continue;
    if (idxStart < 0 || idxEnd < 0 || idxText < 0) continue;

    const parts = splitLimit(trimmed.slice(trimmed.indexOf(':') + 1), ',', fieldCount);
    const startMs = parseTimecode(parts[idxStart] ?? '');
    const endMs = parseTimecode(parts[idxEnd] ?? '');
    const raw = parts[idxText] ?? '';

    if (startMs === null || endMs === null || endMs <= startMs) continue;
    // {\p1} switches the renderer into vector-drawing mode; the "text" that
    // follows is a list of coordinates and would render as garbage.
    if (/\{[^}]*\\p[1-9]/.test(raw)) continue;

    const body = stripInlineTags(raw).trim();
    if (body) cues.push({ startMs, endMs, text: body });
  }

  return cues.sort((a, b) => a.startMs - b.startMs);
}
