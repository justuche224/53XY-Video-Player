import { panAxis, panHalf, clamp01, scrubDeltaSec } from '../pan';

describe('panAxis', () => {
  it('is horizontal when |dx| > |dy|', () => {
    expect(panAxis(20, 5)).toBe('horizontal');
  });
  it('is vertical when |dy| >= |dx|', () => {
    expect(panAxis(5, 20)).toBe('vertical');
    expect(panAxis(10, 10)).toBe('vertical');
  });
  it('uses magnitude, ignoring sign', () => {
    expect(panAxis(-20, 5)).toBe('horizontal');
    expect(panAxis(5, -20)).toBe('vertical');
  });
});

describe('panHalf', () => {
  it('is left in the left half, right at/after the midpoint', () => {
    expect(panHalf(10, 100)).toBe('left');
    expect(panHalf(50, 100)).toBe('right');
    expect(panHalf(80, 100)).toBe('right');
  });
});

describe('clamp01', () => {
  it('clamps to [0,1]', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe('scrubDeltaSec', () => {
  it('maps a full-width drag to ±windowSec', () => {
    expect(scrubDeltaSec(100, 100, 120)).toBe(120);
    expect(scrubDeltaSec(-50, 100, 120)).toBe(-60);
  });
  it('returns 0 for non-positive width', () => {
    expect(scrubDeltaSec(50, 0, 120)).toBe(0);
  });
});
