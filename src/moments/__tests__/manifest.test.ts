import { fromManifestJson, toManifestJson } from '../manifest';
import type { Moment } from '../types';

const sample: Moment = {
  id: 'm1',
  videoId: 'v1',
  positionMs: 2_472_000,
  createdAt: 1_757_000_000_000,
  frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
  note: 'Denny gets the case',
  title: 'Boston Legal',
  episodeLabel: 'S02E14',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies/Boston Legal',
  videoUri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  durationMs: 2_580_000,
};

describe('manifest', () => {
  it('round-trips a moment unchanged', () => {
    expect(fromManifestJson(toManifestJson([sample]))).toEqual([sample]);
  });

  it('writes a version so a future reader can tell what it is holding', () => {
    expect(JSON.parse(toManifestJson([sample])).version).toBe(1);
  });

  it('returns nothing for unparseable json rather than throwing', () => {
    expect(fromManifestJson('{ not json')).toEqual([]);
    expect(fromManifestJson('')).toEqual([]);
  });

  it('returns nothing when moments is missing or not an array', () => {
    expect(fromManifestJson('{"version":1}')).toEqual([]);
    expect(fromManifestJson('{"version":1,"moments":"nope"}')).toEqual([]);
  });

  it('skips entries missing a required field and keeps the rest', () => {
    const json = JSON.stringify({
      version: 1,
      moments: [{ ...sample, id: undefined }, sample, { ...sample, title: 42 }],
    });
    expect(fromManifestJson(json)).toEqual([sample]);
  });

  it('ignores unknown fields from a newer writer', () => {
    const json = JSON.stringify({
      version: 99,
      moments: [{ ...sample, somethingNew: 'ignored' }],
    });
    expect(fromManifestJson(json)).toEqual([sample]);
  });

  it('defaults absent optional fields to null', () => {
    const json = JSON.stringify({
      version: 1,
      moments: [
        {
          id: 'm2',
          positionMs: 1000,
          createdAt: 5,
          title: 'Clip',
          filename: 'clip.mp4',
        },
      ],
    });
    expect(fromManifestJson(json)).toEqual([
      {
        id: 'm2',
        videoId: null,
        positionMs: 1000,
        createdAt: 5,
        frameUri: null,
        note: null,
        title: 'Clip',
        episodeLabel: null,
        filename: 'clip.mp4',
        folder: null,
        videoUri: null,
        durationMs: null,
      },
    ]);
  });
});
