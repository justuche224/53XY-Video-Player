import { formatEpisodeLabel } from '../episode-label';

describe('formatEpisodeLabel', () => {
  it('formats season+episode zero-padded', () => {
    expect(formatEpisodeLabel(1, 2)).toBe('S01E02');
    expect(formatEpisodeLabel(12, 134)).toBe('S12E134');
  });
  it('formats season-only', () => {
    expect(formatEpisodeLabel(1, null)).toBe('S01');
  });
  it('returns empty when season is null', () => {
    expect(formatEpisodeLabel(null, null)).toBe('');
    expect(formatEpisodeLabel(null, 5)).toBe('');
  });
});
