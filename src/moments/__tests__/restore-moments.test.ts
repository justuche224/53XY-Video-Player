import { formatBytes, mergeManifest, missingFromDb, restorableMoments } from '../restore-moments';
import type { Moment } from '../types';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: null,
    durationMs: 2000,
    ...over,
  };
}

describe('restorableMoments', () => {
  const present = () => true;
  const absent = () => false;

  it('restores a moment whose frame is still on disk', () => {
    expect(restorableMoments([moment()], present)).toEqual([moment()]);
  });

  it('drops a moment whose frame file is gone', () => {
    // The row would restore pointing at nothing, rendering permanently broken.
    expect(restorableMoments([moment()], absent)).toEqual([]);
  });

  it('keeps a frameless moment, which never had a file to lose', () => {
    const frameless = moment({ frameUri: null });
    expect(restorableMoments([frameless], absent)).toEqual([frameless]);
  });

  it('checks each frame individually', () => {
    const a = moment({ id: 'a', frameUri: 'file:///a.jpg' });
    const b = moment({ id: 'b', frameUri: 'file:///b.jpg' });
    const only = (uri: string) => uri === 'file:///a.jpg';
    expect(restorableMoments([a, b], only).map((m) => m.id)).toEqual(['a']);
  });

  it('returns nothing for an empty manifest', () => {
    expect(restorableMoments([], present)).toEqual([]);
  });
});

describe('mergeManifest', () => {
  const present = () => true;
  const absent = () => false;

  it('is a no-op when the db and manifest already agree (40 in DB, 40 in manifest)', () => {
    const rows = [moment({ id: 'a' }), moment({ id: 'b' })];
    expect(mergeManifest(rows, rows, present)).toEqual(rows);
  });

  it('adds a manifest-only moment whose frame survives (capture-before-restore: 1 in DB, 40 in manifest)', () => {
    const fresh = moment({ id: 'fresh', note: 'just captured' });
    const backedUp = moment({ id: 'old-1' });
    const result = mergeManifest([fresh], [backedUp], present);
    expect(result).toEqual(expect.arrayContaining([fresh, backedUp]));
    expect(result).toHaveLength(2);
  });

  it('prefers the db row over a manifest row with the same id — db is the live truth', () => {
    const dbRow = moment({ note: 'live edit' });
    const manifestRow = moment({ note: 'stale' });
    expect(mergeManifest([dbRow], [manifestRow], present)).toEqual([dbRow]);
  });

  it('drops a manifest-only entry whose frame file is gone — a deliberately deleted moment never resurrects', () => {
    const deleted = moment({ id: 'deleted' });
    expect(mergeManifest([], [deleted], absent)).toEqual([]);
  });

  it('drops a frameless manifest-only entry, unlike restorableMoments (deliberate asymmetry: a frameless entry with no db row cannot be told apart from a deleted one)', () => {
    const frameless = moment({ id: 'frameless', frameUri: null });
    expect(mergeManifest([], [frameless], present)).toEqual([]);
  });

  it('returns an empty manifest when everything was deleted (delete-all)', () => {
    expect(mergeManifest([], [], present)).toEqual([]);
  });
});

describe('missingFromDb', () => {
  const present = () => true;
  const absent = () => false;

  it('finds nothing when the db already has every manifest entry (40 in DB, 40 in manifest)', () => {
    const rows = [moment({ id: 'a' }), moment({ id: 'b' })];
    expect(missingFromDb(rows, rows, present)).toEqual([]);
  });

  it('returns every manifest entry on a fresh install (0 in DB, 40 in manifest)', () => {
    const backedUp = [moment({ id: 'a' }), moment({ id: 'b' })];
    expect(missingFromDb(backedUp, [], present)).toEqual(backedUp);
  });

  it('returns only what the db is missing when one was captured first (DB has 1, manifest has 41)', () => {
    const fresh = moment({ id: 'fresh' });
    const backedUp = [fresh, moment({ id: 'old-1' }), moment({ id: 'old-2' })];
    const result = missingFromDb(backedUp, [fresh], present);
    expect(result.map((m) => m.id)).toEqual(['old-1', 'old-2']);
  });

  it('excludes a manifest entry whose frame file is gone — a deleted moment is never restored', () => {
    const deleted = moment({ id: 'deleted' });
    expect(missingFromDb([deleted], [], absent)).toEqual([]);
  });

  it('excludes a frameless manifest entry with no db row', () => {
    const frameless = moment({ id: 'frameless', frameUri: null });
    expect(missingFromDb([frameless], [], present)).toEqual([]);
  });

  it('finds nothing after a delete-all (manifest is empty)', () => {
    expect(missingFromDb([], [], present)).toEqual([]);
  });
});

describe('formatBytes', () => {
  it('shows plain bytes below a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
  });

  it('scales to KB and MB with one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(Math.round(1024 * 1024 * 3.5))).toBe('3.5 MB');
  });

  it('never renders a negative or non-finite size', () => {
    // A stat() failure must not put "NaN MB" in front of the user.
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
