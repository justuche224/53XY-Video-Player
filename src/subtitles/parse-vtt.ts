import type { Cue } from './types';
import { parseCueBlocks } from './parse-cue-blocks';

/**
 * Strip the WEBVTT header and the NOTE/STYLE/REGION blocks, each of which
 * runs until the next blank line. What remains is SRT-shaped.
 */
export function stripVttBlocks(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^WEBVTT/.test(trimmed) || /^(NOTE|STYLE|REGION)\b/.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (trimmed === '') skipping = false;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function parseVtt(text: string): Cue[] {
  return parseCueBlocks(stripVttBlocks(text));
}
