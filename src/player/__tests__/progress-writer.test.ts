import { buildProgress, shouldWrite } from '../progress-writer';
describe('buildProgress', () => {
  it('computes percent and completion from position/duration', () => {
    expect(buildProgress(30_000, 120_000, 111)).toEqual({
      positionMs: 30_000, percent: 0.25, completed: false, lastPlayedAt: 111,
    });
  });
  it('marks completed past the 95% threshold', () => {
    expect(buildProgress(98_000, 100_000, 5).completed).toBe(true);
  });
  it('yields percent 0 when duration is unknown', () => {
    expect(buildProgress(30_000, null, 5).percent).toBe(0);
  });
});
describe('shouldWrite', () => {
  it('throttles writes to the interval', () => {
    expect(shouldWrite(0, 4_999)).toBe(false);
    expect(shouldWrite(0, 5_000)).toBe(true);
  });
});
