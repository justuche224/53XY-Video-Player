import { formatLengthShort, msToParts, partsToMs } from '../filter-videos';

describe('partsToMs', () => {
  it('converts each unit to ms', () => {
    expect(partsToMs(45, 'sec')).toBe(45_000);
    expect(partsToMs(5, 'min')).toBe(300_000);
    expect(partsToMs(2, 'hr')).toBe(7_200_000);
  });
  it('rounds fractional ms', () => {
    expect(partsToMs(1.5, 'sec')).toBe(1_500);
  });
});

describe('msToParts', () => {
  it('picks the largest whole unit', () => {
    expect(msToParts(3_600_000)).toEqual({ value: 1, unit: 'hr' });
    expect(msToParts(300_000)).toEqual({ value: 5, unit: 'min' });
    expect(msToParts(45_000)).toEqual({ value: 45, unit: 'sec' });
  });
  it('falls back to seconds for non-whole min/hr', () => {
    expect(msToParts(90_000)).toEqual({ value: 90, unit: 'sec' });
  });
});

describe('formatLengthShort', () => {
  it('formats with the unit suffix', () => {
    expect(formatLengthShort(30_000)).toBe('30s');
    expect(formatLengthShort(60_000)).toBe('1m');
    expect(formatLengthShort(3_600_000)).toBe('1h');
    expect(formatLengthShort(90_000)).toBe('90s');
  });
});
