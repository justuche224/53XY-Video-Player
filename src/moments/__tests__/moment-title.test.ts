import { momentDisplay } from '../moment-title';

describe('momentDisplay', () => {
  it('splits a series filename into a clean title and an episode label', () => {
    expect(momentDisplay('Boston.Legal.S02E14.1080p.WEB-DL.x265.mkv')).toEqual({
      title: 'Boston Legal',
      episodeLabel: 'S02E14',
    });
  });

  it('gives a movie a null episode label and strips release junk', () => {
    expect(momentDisplay('Inception.2010.1080p.BluRay.x264.mkv')).toEqual({
      title: 'Inception',
      episodeLabel: null,
    });
  });

  it('falls back to the filename when normalization leaves nothing', () => {
    // The episode marker is at index 0, so normalizeTitle cuts everything.
    // A card must never render an empty title.
    expect(momentDisplay('S01E01.mkv')).toEqual({
      title: 'S01E01.mkv',
      episodeLabel: 'S01E01',
    });
  });

  it('handles a filename with no episode information at all', () => {
    expect(momentDisplay('holiday clip.mp4')).toEqual({
      title: 'holiday clip',
      episodeLabel: null,
    });
  });
});
