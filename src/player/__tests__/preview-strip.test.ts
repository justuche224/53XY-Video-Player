import {
  frameCount,
  frameIndexFor,
  frameTimeMs,
  nearestCompleted,
  previewIntervalSec,
  PREVIEW_MIN_INTERVAL_SEC,
  PREVIEW_MAX_INTERVAL_SEC,
} from '../preview-strip';

describe('previewIntervalSec', () => {
  it('targets ~60 frames with a 5s floor and 30s ceiling', () => {
    expect(previewIntervalSec(100)).toBe(PREVIEW_MIN_INTERVAL_SEC); // raw < floor
    expect(previewIntervalSec(1200)).toBe(20); // 1200/60
    expect(previewIntervalSec(7200)).toBe(PREVIEW_MAX_INTERVAL_SEC); // 120s raw → ceiling
  });
});

describe('frameCount', () => {
  it('floors slots and never returns 0 for a real video', () => {
    expect(frameCount(1000, 20)).toBe(50);
    expect(frameCount(3, 5)).toBe(1);
    expect(frameCount(0, 5)).toBe(0);
  });
});

describe('frameTimeMs', () => {
  it('captures at slot midpoints', () => {
    expect(frameTimeMs(0, 20, 1000)).toBe(10_000);
    expect(frameTimeMs(3, 20, 1000)).toBe(70_000);
  });
  it('clamps inside the video near the end', () => {
    expect(frameTimeMs(49, 20, 990)).toBe(989_500);
  });
});

describe('frameIndexFor', () => {
  it('maps positions to their slot and clamps to bounds', () => {
    expect(frameIndexFor(0, 20, 50)).toBe(0);
    expect(frameIndexFor(39.9, 20, 50)).toBe(1);
    expect(frameIndexFor(10_000, 20, 50)).toBe(49);
    expect(frameIndexFor(-5, 20, 50)).toBe(0);
  });
});

describe('nearestCompleted', () => {
  const done = new Set([0, 1, 2, 10]);
  it('prefers the exact slot', () => {
    expect(nearestCompleted(1, done, 50)).toBe(1);
  });
  it('accepts a neighbor one slot away, earlier side first', () => {
    expect(nearestCompleted(3, done, 50)).toBe(2);
    expect(nearestCompleted(9, done, 50)).toBe(10);
  });
  it('returns null beyond the distance limit — never a misleading frame', () => {
    expect(nearestCompleted(6, done, 50)).toBeNull();
    expect(nearestCompleted(30, done, 50)).toBeNull();
  });
});
