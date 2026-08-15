import { resolveWatchToggle } from '../watch-toggle';
import type { ProgressMap } from '@/db/progress-repo';

function progressMap(entries: Array<[string, boolean]>): ProgressMap {
  const map: ProgressMap = new Map();
  for (const [id, completed] of entries) {
    map.set(id, { positionMs: 0, percent: completed ? 1 : 0.4, completed });
  }
  return map;
}

describe('resolveWatchToggle', () => {
  it('reads "Mark as played" when nothing in the selection has progress', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });

  it('reads "Mark as unplayed" when every selected item is fully played', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([['a', true], ['b', true]]));
    expect(result).toEqual({ label: 'Mark as unplayed', markPlayed: false });
  });

  it('reads "Mark as played" for a mixed selection (finishes the batch off)', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([['a', true], ['b', false]]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });

  // The completed flag is the single definition of watched now; a partially
  // watched item is "played" only once that flag is set at write time.
  it('follows the completed flag rather than the percent', () => {
    const map: ProgressMap = new Map([['a', { positionMs: 10, percent: 0.02, completed: true }]]);
    expect(resolveWatchToggle(['a'], map)).toEqual({
      label: 'Mark as unplayed',
      markPlayed: false,
    });
  });

  it('treats a high percent without the flag as still unplayed', () => {
    const map: ProgressMap = new Map([['a', { positionMs: 10, percent: 0.995, completed: false }]]);
    expect(resolveWatchToggle(['a'], map)).toEqual({
      label: 'Mark as played',
      markPlayed: true,
    });
  });

  it('defaults to "Mark as played" for an empty selection', () => {
    const result = resolveWatchToggle([], progressMap([]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });
});
