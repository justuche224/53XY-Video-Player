import { markerFractions } from '../moment-markers';

describe('markerFractions', () => {
  it('maps positions onto 0-1 of the duration', () => {
    expect(markerFractions([0, 30_000, 60_000], 60_000)).toEqual([0, 0.5, 1]);
  });

  it('returns nothing when the duration is unknown', () => {
    // Duration arrives asynchronously; before it does there is nowhere to draw.
    expect(markerFractions([1000], 0)).toEqual([]);
    expect(markerFractions([1000], -1)).toEqual([]);
  });

  it('returns nothing for no positions', () => {
    expect(markerFractions([], 60_000)).toEqual([]);
  });

  it('drops a position beyond the duration rather than drawing off the bar', () => {
    // A relinked file can be a slightly different cut, so a stored position
    // can sit past the end.
    expect(markerFractions([90_000], 60_000)).toEqual([]);
  });

  it('drops a negative position', () => {
    expect(markerFractions([-5], 60_000)).toEqual([]);
  });

  it('keeps the order it was given', () => {
    expect(markerFractions([45_000, 15_000], 60_000)).toEqual([0.75, 0.25]);
  });
});
