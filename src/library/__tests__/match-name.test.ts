import { matchesNamePattern } from '../filter-videos';

describe('matchesNamePattern', () => {
  it('substring match is case-insensitive', () => {
    expect(matchesNamePattern('My.Trailer.mp4', 'trailer')).toBe(true);
    expect(matchesNamePattern('TRAILER.mp4', 'trailer')).toBe(true);
    expect(matchesNamePattern('movie.mp4', 'trailer')).toBe(false);
  });

  it('glob with * matches prefix/suffix, anchored full-string', () => {
    expect(matchesNamePattern('VID_001.mp4', 'VID_*')).toBe(true);
    expect(matchesNamePattern('vid_001.mp4', 'VID_*')).toBe(true); // case-insensitive
    expect(matchesNamePattern('my_VID_001.mp4', 'VID_*')).toBe(false); // anchored
    expect(matchesNamePattern('movie.mkv', '*.mkv')).toBe(true);
    expect(matchesNamePattern('movie.mp4', '*.mkv')).toBe(false);
  });

  it('glob with ? matches exactly one character', () => {
    expect(matchesNamePattern('AQ12.mp4', 'AQ??.mp4')).toBe(true);
    expect(matchesNamePattern('AQ123.mp4', 'AQ??.mp4')).toBe(false);
  });

  it('treats regex metacharacters in the literal part literally', () => {
    expect(matchesNamePattern('a.bcd.mp4', 'a.b*')).toBe(true);
    expect(matchesNamePattern('axbcd.mp4', 'a.b*')).toBe(false); // '.' is literal, not "any char"
  });

  it('a blank/whitespace pattern never matches', () => {
    expect(matchesNamePattern('movie.mp4', '')).toBe(false);
    expect(matchesNamePattern('movie.mp4', '   ')).toBe(false);
  });
});
