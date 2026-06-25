import { TYPOGRAPHY, FONTS } from '../typography';

describe('typography tokens', () => {
  it('defines every variant with a positive size and line height', () => {
    const variants = ['display', 'headline', 'title', 'titleSmall', 'body', 'label', 'meta', 'episode'] as const;
    for (const v of variants) {
      expect(TYPOGRAPHY[v].fontSize).toBeGreaterThan(0);
      expect(TYPOGRAPHY[v].lineHeight).toBeGreaterThanOrEqual(TYPOGRAPHY[v].fontSize);
    }
  });

  it('uses the display font family only for display + headline', () => {
    expect(TYPOGRAPHY.display.fontFamily).toBe(FONTS.displayBold);
    expect(TYPOGRAPHY.headline.fontFamily).toBe(FONTS.display);
    expect(TYPOGRAPHY.title.fontFamily).toBeUndefined();
    expect(TYPOGRAPHY.body.fontFamily).toBeUndefined();
  });

  it('keeps row-title at 16/600 (the one canonical list-title value)', () => {
    expect(TYPOGRAPHY.title.fontSize).toBe(16);
    expect(TYPOGRAPHY.title.fontWeight).toBe('600');
  });
});
