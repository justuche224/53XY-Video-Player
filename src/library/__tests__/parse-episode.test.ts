// src/library/__tests__/parse-episode.test.ts
import { parseEpisode } from '../parse-episode';

describe('parseEpisode', () => {
  it('parses SxxExx', () => {
    expect(parseEpisode('Banshee S01E01 GalaxyTV.mkv')).toEqual({ season: 1, episode: 1 });
    expect(parseEpisode('La.casa.S03E06.mkv')).toEqual({ season: 3, episode: 6 });
  });

  it('parses NxNN', () => {
    expect(parseEpisode('Some.Show.1x05.mp4')).toEqual({ season: 1, episode: 5 });
  });

  it('parses SxxxExx (x-separated hybrid)', () => {
    expect(parseEpisode('Boston Legal S04xE01 - Beauty.avi')).toEqual({ season: 4, episode: 1 });
    expect(parseEpisode('Boston Legal S04xE12 - Something.avi')).toEqual({ season: 4, episode: 12 });
  });

  it('parses season-only', () => {
    expect(parseEpisode('Citadel S01.mkv')).toEqual({ season: 1, episode: null });
  });

  it('parses spelled-out "Season N Episode N"', () => {
    expect(parseEpisode('_Succession_Season_1_Episode_10_720p_@Tv_Series_ETY_.Mkv')).toEqual({
      season: 1,
      episode: 10,
    });
    expect(parseEpisode('Succession Season 2 - Episode 3.mkv')).toEqual({ season: 2, episode: 3 });
    expect(parseEpisode('Show Season 1 Ep 4.mkv')).toEqual({ season: 1, episode: 4 });
  });

  it('parses spelled-out season-only and episode-only', () => {
    expect(parseEpisode('Show Season 3 Finale.mkv')).toEqual({ season: 3, episode: null });
    expect(parseEpisode('Show Episode 7.mkv')).toEqual({ season: null, episode: 7 });
  });

  it('returns nulls when no marker and ignores years', () => {
    expect(parseEpisode('The Best Man Holiday 2013.mp4')).toEqual({ season: null, episode: null });
    expect(parseEpisode('random clip.mp4')).toEqual({ season: null, episode: null });
  });
});
