import { computeProgressPercent, isCompleted } from '../progress';

describe('computeProgressPercent', () => {
  it('returns the fraction watched', () => {
    expect(computeProgressPercent(30_000, 120_000)).toBeCloseTo(0.25);
  });
  it('clamps to [0,1] and handles missing duration', () => {
    expect(computeProgressPercent(-5, 100)).toBe(0);
    expect(computeProgressPercent(200, 100)).toBe(1);
    expect(computeProgressPercent(50, 0)).toBe(0);
    expect(computeProgressPercent(50, null)).toBe(0);
  });
});

describe('isCompleted', () => {
  it('is true at/above the threshold', () => {
    expect(isCompleted(0.96)).toBe(true);
    expect(isCompleted(0.5)).toBe(false);
    expect(isCompleted(0.8, 0.8)).toBe(true);
  });
});
