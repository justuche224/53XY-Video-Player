import { resolveTheme, SPACING, RADIUS, type Material3Theme, elevationColor, ICON } from '../resolve-theme';

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

const SCHEME = {
  surface: '#100', surfaceContainerLow: '#111', surfaceContainer: '#122',
  surfaceContainerHigh: '#133', surfaceVariant: '#199',
};
const THEME = { light: SCHEME, dark: SCHEME } as any;

describe('elevation + icon + radius tokens', () => {
  it('maps elevation levels to surface-container tones', () => {
    expect(elevationColor(SCHEME, 0)).toBe('#100');
    expect(elevationColor(SCHEME, 1)).toBe('#111');
    expect(elevationColor(SCHEME, 2)).toBe('#122');
    expect(elevationColor(SCHEME, 3)).toBe('#133');
  });

  it('falls back to surfaceVariant when a tone is absent', () => {
    expect(elevationColor({ surfaceVariant: '#199' }, 2)).toBe('#199');
  });

  it('exposes icon scale and an xl radius', () => {
    expect(ICON.md).toBe(24);
    expect(RADIUS.xl).toBe(28);
  });

  it('attaches icon + elevation to resolved tokens', () => {
    const t = resolveTheme(THEME, 'dark');
    expect(t.icon.lg).toBe(28);
    expect(t.elevation(2)).toBe('#122');
  });
});
