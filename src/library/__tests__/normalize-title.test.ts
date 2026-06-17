import { normalizeTitle } from '../normalize-title';

describe('normalizeTitle', () => {
  it.each([
    ['Banshee S01E01 GalaxyTV.mkv', 'Banshee'],
    ['Banshee S02E03 GalaxyTV.mkv', 'Banshee'],
    ['Boston Legal s01e05.avi', 'Boston Legal'],
    ['Citadel S01E03.mp4', 'Citadel'],
    ['Shifting Gears S01E10.mkv', 'Shifting Gears'],
    ['Steal S01E06.mp4', 'Steal'],
    ['La.casa.de.papel.A.K.A.Money.Heist.S03E06.mkv', 'La casa de papel A K A Money Heist'],
    ['Saved by the Bell S02E10.mkv', 'Saved by the Bell'],
    ['His and Hers 2026 S01E03.mkv', 'His and Hers'],
    ['Citadel S01.mkv', 'Citadel'],
    ['Some.Show.1x05.mp4', 'Some Show'],
  ])('strips episode markers: %s -> %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it.each([
    ['The Best Man Holiday 2013 1080p BluRay.mp4', 'The Best Man Holiday'],
    ['Ballerina 2025 JOIN @maxenta.mp4', 'Ballerina'],
    ['Inception (2010) [1080p].mkv', 'Inception'],
  ])('cleans movie titles: %s -> %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeTitle('  Weird___Name...mkv')).toBe('Weird Name');
  });
});
