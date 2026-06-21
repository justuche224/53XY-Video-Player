import { dayBucket } from '../bucket-day';

// Build local-time timestamps so they line up with local-midnight bucketing.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

describe('dayBucket', () => {
  const now = at(2026, 5, 21, 15); // Jun 21 2026, 3pm local

  it('labels the same calendar day as Today', () => {
    expect(dayBucket(at(2026, 5, 21, 1), now).label).toBe('Today');
    expect(dayBucket(at(2026, 5, 21, 23), now).label).toBe('Today');
  });

  it('labels the previous calendar day as Yesterday', () => {
    expect(dayBucket(at(2026, 5, 20, 23), now).label).toBe('Yesterday');
  });

  it('labels an older day this year as "Mon D"', () => {
    expect(dayBucket(at(2026, 5, 19, 9), now).label).toBe('Jun 19');
  });

  it('labels a day in a previous year as "Mon D, YYYY"', () => {
    expect(dayBucket(at(2025, 11, 30, 9), now).label).toBe('Dec 30, 2025');
  });

  it('gives the same key for two times on the same local day', () => {
    expect(dayBucket(at(2026, 5, 19, 1), now).key).toBe(dayBucket(at(2026, 5, 19, 22), now).key);
  });

  it('gives different keys for different days', () => {
    expect(dayBucket(at(2026, 5, 19, 1), now).key).not.toBe(dayBucket(at(2026, 5, 20, 1), now).key);
  });
});
