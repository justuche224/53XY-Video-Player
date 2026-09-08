import { resolveMomentTarget } from '../resolve-moment-video';
import type { Moment } from '../types';
import type { LibraryVideo } from '@/library/types';

function video(over: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    id: 'v1',
    uri: 'file:///storage/emulated/0/Movies/Lanterns.S01E03.mkv',
    filename: 'Lanterns.S01E03.mkv',
    durationMs: 2_580_000,
    width: 1920,
    height: 1080,
    folder: 'Movies',
    thumbUri: null,
    createdAt: 1,
    modifiedAt: 1,
    ...over,
  };
}

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1_169_049,
    createdAt: 5,
    frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: 'file:///storage/emulated/0/Movies/Lanterns.S01E03.mkv',
    durationMs: 2_580_000,
    ...over,
  };
}

describe('resolveMomentTarget', () => {
  it('matches on video id when the library still has it', () => {
    const v = video();
    expect(resolveMomentTarget(moment(), [v])).toEqual({ kind: 'exact', video: v });
  });

  it('relinks a moved file by filename and duration when the id is gone', () => {
    // Same file, rescanned into a different folder, so MediaStore gave it a new id.
    const moved = video({ id: 'v99', folder: 'Movies/Shows', uri: 'file:///storage/emulated/0/Movies/Shows/Lanterns.S01E03.mkv' });
    expect(resolveMomentTarget(moment(), [moved])).toEqual({ kind: 'relinked', video: moved });
  });

  it('reports missing when nothing matches', () => {
    expect(resolveMomentTarget(moment(), [video({ id: 'v99', filename: 'Other.mkv' })])).toEqual({
      kind: 'missing',
    });
  });

  it('does not relink a same-named file of a clearly different length', () => {
    // A different cut or a different release that happens to share a basename.
    const other = video({ id: 'v99', durationMs: 2_580_000 + 60_000 });
    expect(resolveMomentTarget(moment(), [other])).toEqual({ kind: 'missing' });
  });

  it('tolerates small duration drift between scans', () => {
    // Container-reported durations wobble slightly; 1000ms is the allowed slack.
    const drifted = video({ id: 'v99', durationMs: 2_580_000 + 900 });
    expect(resolveMomentTarget(moment(), [drifted])).toEqual({ kind: 'relinked', video: drifted });
  });

  it('picks the closest duration when several files share a filename', () => {
    const near = video({ id: 'vNear', durationMs: 2_580_000 + 200, folder: 'A' });
    const far = video({ id: 'vFar', durationMs: 2_580_000 + 900, folder: 'B' });
    expect(resolveMomentTarget(moment(), [far, near])).toEqual({ kind: 'relinked', video: near });
  });

  it('relinks on filename alone when a duration is unknown on either side', () => {
    // Nothing to compare, so the filename match is the best evidence there is.
    const unknown = video({ id: 'v99', durationMs: null });
    expect(resolveMomentTarget(moment(), [unknown])).toEqual({ kind: 'relinked', video: unknown });
    expect(resolveMomentTarget(moment({ durationMs: null }), [video({ id: 'v99' })])).toEqual({
      kind: 'relinked',
      video: video({ id: 'v99' }),
    });
  });

  it('falls back to a filename match when the moment never had a video id', () => {
    const v = video({ id: 'v99' });
    expect(resolveMomentTarget(moment({ videoId: null }), [v])).toEqual({ kind: 'relinked', video: v });
  });

  it('reports missing for an empty library', () => {
    expect(resolveMomentTarget(moment(), [])).toEqual({ kind: 'missing' });
  });
});
