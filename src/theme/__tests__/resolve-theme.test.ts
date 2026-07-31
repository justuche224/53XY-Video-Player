import {
  resolveTheme,
  SPACING,
  RADIUS,
  type Material3Theme,
  elevationColor,
  ICON,
  shadowFor,
} from '../resolve-theme';

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

  it('attaches icon + elevation + shadow to resolved tokens', () => {
    const t = resolveTheme(THEME, 'dark');
    expect(t.icon.lg).toBe(28);
    expect(t.elevation(2)).toBe('#122');
    expect(t.shadow(1)).toBe(shadowFor(true, 1));
  });
});

describe('RADIUS — Material 3 Expressive shape scale', () => {
  // Values are the M3 shape tokens; see ShapeTokens.kt. `md` is corner.large (16),
  // not corner.medium (12) — that remap is what softened the whole app.
  it('matches the M3 corner tokens', () => {
    expect(RADIUS.none).toBe(0);
    expect(RADIUS.xs).toBe(4); //  corner.extraSmall
    expect(RADIUS.sm).toBe(8); //  corner.small
    expect(RADIUS.md).toBe(16); // corner.large
    expect(RADIUS.lg).toBe(20); // corner.largeIncreased
    expect(RADIUS.xl).toBe(28); // corner.extraLarge
    expect(RADIUS.xxl).toBe(32); // corner.extraLargeIncreased
    expect(RADIUS.max).toBe(48); // corner.extraExtraLarge
  });

  it('increases monotonically so a "bump one step" edit is always rounder', () => {
    const steps = [RADIUS.none, RADIUS.xs, RADIUS.sm, RADIUS.md, RADIUS.lg, RADIUS.xl, RADIUS.xxl, RADIUS.max];
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(RADIUS.pill).toBeGreaterThan(RADIUS.max);
  });
});

describe('shadowFor', () => {
  it('draws nothing at level 0', () => {
    expect(shadowFor(false, 0)).toBe('none');
    expect(shadowFor(true, 0)).toBe('none');
  });

  it('grows blur and spread with the elevation level', () => {
    const [l1, l2, l3] = [1, 2, 3].map((l) => shadowFor(false, l as 1 | 2 | 3));
    expect(l1).toContain('0px 1px 3px 1px');
    expect(l2).toContain('0px 2px 6px 2px');
    expect(l3).toContain('0px 4px 8px 3px');
  });

  it('keeps every level a valid two-shadow boxShadow string', () => {
    for (const isDark of [false, true]) {
      for (const level of [1, 2, 3] as const) {
        const value = shadowFor(isDark, level);
        expect(value.split('rgba(').length - 1).toBe(2);
        expect(value).toMatch(/^0px 1px 2px 0px rgba\(0,0,0,[\d.]+\), 0px \d+px \d+px \d+px rgba\(0,0,0,[\d.]+\)$/);
      }
    }
  });
});
