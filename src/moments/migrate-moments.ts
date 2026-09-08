import { framePath } from './moments-dir';
import type { Moment } from './types';

export interface MomentMove {
  id: string;
  fromUri: string;
  toUri: string;
}

/**
 * Which frames need moving into `toDir`. Pure: the caller does the file I/O and
 * the database rewrite, so the decision is testable without a filesystem.
 *
 * The destination is always `framePath(toDir, id)` rather than the old
 * basename, so a frame whose stored path drifted from the id convention lands
 * where every other part of the feature expects to find it.
 */
export function planMomentMigration(moments: Moment[], toDir: string): MomentMove[] {
  const moves: MomentMove[] = [];
  for (const moment of moments) {
    if (!moment.frameUri) continue;
    const toUri = framePath(toDir, moment.id);
    if (moment.frameUri === toUri) continue;
    moves.push({ id: moment.id, fromUri: moment.frameUri, toUri });
  }
  return moves;
}
