import { headerSolidThreshold, heroHeight } from '../layout';

describe('heroHeight', () => {
  it('scales with the window on ordinary phones', () => {
    // 800dp tall * 0.42 = 336, inside the clamp.
    expect(heroHeight(800, 0)).toBe(336);
  });

  it('adds the status-bar inset on top of the content band, not out of it', () => {
    expect(heroHeight(800, 40) - heroHeight(800, 0)).toBe(40);
  });

  it('clamps short windows up so the title, progress and buttons still fit', () => {
    expect(heroHeight(500, 0)).toBe(280);
    expect(heroHeight(100, 0)).toBe(280);
  });

  it('clamps tall windows down so the banner stays a header, not a page', () => {
    expect(heroHeight(1600, 0)).toBe(380);
  });

  it('never lets a negative inset shrink the banner', () => {
    expect(heroHeight(800, -50)).toBe(336);
  });

  it('always returns a whole number of dp', () => {
    for (const h of [640, 731, 812, 915, 1080]) {
      expect(Number.isInteger(heroHeight(h, 33))).toBe(true);
    }
  });
});

describe('headerSolidThreshold', () => {
  it('fires before the artwork fully clears the header', () => {
    expect(headerSolidThreshold(376, 136)).toBe(216);
  });

  it('never returns a negative offset when the header is taller than the hero', () => {
    expect(headerSolidThreshold(100, 136)).toBe(0);
  });
});
