import type { Cue } from './types';
import { parseCueBlocks } from './parse-cue-blocks';

export function parseSrt(text: string): Cue[] {
  return parseCueBlocks(text);
}
