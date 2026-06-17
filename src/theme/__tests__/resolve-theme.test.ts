import { resolveTheme, SPACING, RADIUS, type Material3Theme } from '../resolve-theme';

const fake: Material3Theme = {
  light: { primary: '#ffffff', background: '#ffffff', onSurface: '#000000' },
  dark: { primary: '#000000', background: '#000000', onSurface: '#ffffff' },
};

describe('resolveTheme', () => {
  it('selects the dark palette when scheme is dark', () => {
    const t = resolveTheme(fake, 'dark');
    expect(t.isDark).toBe(true);
    expect(t.colors).toBe(fake.dark);
  });

  it('selects the light palette for light or null scheme', () => {
    expect(resolveTheme(fake, 'light').colors).toBe(fake.light);
    expect(resolveTheme(fake, null).isDark).toBe(false);
    expect(resolveTheme(fake, undefined).colors).toBe(fake.light);
  });

  it('exposes the spacing and radius scales', () => {
    const t = resolveTheme(fake, 'light');
    expect(t.spacing).toBe(SPACING);
    expect(t.radius).toBe(RADIUS);
  });
});
