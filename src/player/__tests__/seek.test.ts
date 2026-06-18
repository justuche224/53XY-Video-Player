import { seekTarget, tapSide } from '../seek';

describe('seekTarget', () => {
  it('adds the delta within bounds', () => {
    expect(seekTarget(30, 10, 120)).toBe(40);
    expect(seekTarget(30, -10, 120)).toBe(20);
  });
  it('clamps to the start', () => {
    expect(seekTarget(5, -10, 120)).toBe(0);
  });
  it('clamps to the duration', () => {
    expect(seekTarget(118, 10, 120)).toBe(120);
  });
  it('clamps only the lower bound when duration is unknown', () => {
    expect(seekTarget(5, -10, 0)).toBe(0);
    expect(seekTarget(5, 10, 0)).toBe(15);
  });
});

describe('tapSide', () => {
  it('returns left in the left half', () => {
    expect(tapSide(10, 100)).toBe('left');
  });
  it('returns right at or past the midpoint', () => {
    expect(tapSide(50, 100)).toBe('right');
    expect(tapSide(90, 100)).toBe('right');
  });
});
