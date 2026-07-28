import {
  badgeMinutes,
  clampCustomMinutes,
  fadeVolume,
  minutesTimer,
  remainingSec,
  FADE_WINDOW_SEC,
  CUSTOM_MIN_MINUTES,
  CUSTOM_MAX_MINUTES,
} from '../sleep-timer';

describe('minutesTimer / remainingSec', () => {
  it('ends N minutes from now', () => {
    const t = minutesTimer(15, 1_000_000);
    expect(t).toEqual({ kind: 'minutes', endAtMs: 1_000_000 + 15 * 60_000 });
  });
  it('counts whole seconds, never negative', () => {
    expect(remainingSec(10_000, 0)).toBe(10);
    expect(remainingSec(10_500, 0)).toBe(11);
    expect(remainingSec(10_000, 20_000)).toBe(0);
  });
});

describe('badgeMinutes', () => {
  it('rounds up and never shows 0', () => {
    expect(badgeMinutes(61)).toBe(2);
    expect(badgeMinutes(60)).toBe(1);
    expect(badgeMinutes(5)).toBe(1);
  });
});

describe('fadeVolume', () => {
  it('is full outside the fade window', () => {
    expect(fadeVolume(FADE_WINDOW_SEC)).toBe(1);
    expect(fadeVolume(600)).toBe(1);
  });
  it('ramps linearly to 0 inside the window', () => {
    expect(fadeVolume(5)).toBeCloseTo(0.5, 5);
    expect(fadeVolume(1)).toBeCloseTo(0.1, 5);
    expect(fadeVolume(0)).toBe(0);
  });
});

describe('clampCustomMinutes', () => {
  it('clamps to the allowed range', () => {
    expect(clampCustomMinutes(0)).toBe(CUSTOM_MIN_MINUTES);
    expect(clampCustomMinutes(999)).toBe(CUSTOM_MAX_MINUTES);
    expect(clampCustomMinutes(45)).toBe(45);
  });
});
