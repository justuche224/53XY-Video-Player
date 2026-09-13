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

  it('parses separated S/E (S01.E05, S01_E05, S01 E05)', () => {
    expect(parseEpisode('Show.S01.E05.1080p.mkv')).toEqual({ season: 1, episode: 5 });
    expect(parseEpisode('Show_S01_E05.mkv')).toEqual({ season: 1, episode: 5 });
    expect(parseEpisode('Show S02 E10.mkv')).toEqual({ season: 2, episode: 10 });
  });

  it('parses bare E01 / EP01 / Ep.01 as episode-only', () => {
    expect(parseEpisode('Show.E05.1080p.mkv')).toEqual({ season: null, episode: 5 });
    expect(parseEpisode('Show_EP12.mkv')).toEqual({ season: null, episode: 12 });
    expect(parseEpisode('Show Ep.03.mkv')).toEqual({ season: null, episode: 3 });
  });

  it('parses anime-style dash number as episode-only', () => {
    expect(parseEpisode('[SubsPlease] Show - 09 (1080p) [ABCD1234].mkv')).toEqual({
      season: null,
      episode: 9,
    });
    expect(parseEpisode('Show - 12.mkv')).toEqual({ season: null, episode: 12 });
  });

  it('parses dash-delimited 3-4 digit codes as season+episode', () => {
    expect(parseEpisode('Boston Legal - 216 - Live Big.mkv')).toEqual({ season: 2, episode: 16 });
    expect(parseEpisode('Boston Legal - 1205 - Title.mkv')).toEqual({ season: 12, episode: 5 });
  });

  it('does not read bare numbers or words starting with e as episodes', () => {
    expect(parseEpisode('127 Hours.mkv')).toEqual({ season: null, episode: null });
    expect(parseEpisode('Ex Machina 2014.mkv')).toEqual({ season: null, episode: null });
    expect(parseEpisode('Edge of Tomorrow.mkv')).toEqual({ season: null, episode: null });
    expect(parseEpisode('Boston Legal - 2013 - Title.mkv')).toEqual({ season: null, episode: null });
  });

  it('returns nulls when no marker and ignores years', () => {
    expect(parseEpisode('The Best Man Holiday 2013.mp4')).toEqual({ season: null, episode: null });
    expect(parseEpisode('random clip.mp4')).toEqual({ season: null, episode: null });
  });
});
