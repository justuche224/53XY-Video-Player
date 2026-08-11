import { resolveWatchToggle } from '../watch-toggle';
import type { ProgressMap } from '@/db/progress-repo';

function progressMap(entries: Array<[string, number]>): ProgressMap {
  const map: ProgressMap = new Map();
  for (const [id, percent] of entries) map.set(id, { positionMs: 0, percent });
  return map;
}

describe('resolveWatchToggle', () => {
  it('reads "Mark as played" when nothing in the selection has progress', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });

  it('reads "Mark as unplayed" when every selected item is fully played', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([['a', 1], ['b', 1]]));
    expect(result).toEqual({ label: 'Mark as unplayed', markPlayed: false });
  });

  it('reads "Mark as played" for a mixed selection (finishes the batch off)', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([['a', 1], ['b', 0.4]]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });

  it('treats percent >= 0.99 as fully played, matching the rest of the app\'s convention', () => {
    const result = resolveWatchToggle(['a'], progressMap([['a', 0.995]]));
    expect(result).toEqual({ label: 'Mark as unplayed', markPlayed: false });
  });

  it('defaults to "Mark as played" for an empty selection', () => {
    const result = resolveWatchToggle([], progressMap([]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });
});
