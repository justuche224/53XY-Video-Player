import { seekTarget, tapZone } from '../seek';

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

describe('tapZone', () => {
  it('returns left in the first third', () => {
    expect(tapZone(10, 300)).toBe('left');
    expect(tapZone(99, 300)).toBe('left');
  });
  it('returns center in the middle third', () => {
    expect(tapZone(100, 300)).toBe('center');
    expect(tapZone(150, 300)).toBe('center');
    expect(tapZone(199, 300)).toBe('center');
  });
  it('returns right at or past the final third', () => {
    expect(tapZone(200, 300)).toBe('right');
    expect(tapZone(290, 300)).toBe('right');
  });
});
