import { tabIconFor, tabLabelFor } from '../tab-icon';

describe('tabIconFor', () => {
  it('maps each tab route to filled-active / outline-inactive icons', () => {
    expect(tabIconFor('index')).toEqual({ active: 'home', inactive: 'home-outline' });
    expect(tabIconFor('playlists')).toEqual({ active: 'list', inactive: 'list-outline' });
    expect(tabIconFor('history')).toEqual({ active: 'time', inactive: 'time-outline' });
    expect(tabIconFor('settings')).toEqual({ active: 'settings', inactive: 'settings-outline' });
  });

  it('falls back to a generic icon for unknown routes', () => {
    expect(tabIconFor('whatever')).toEqual({ active: 'ellipse', inactive: 'ellipse-outline' });
  });
});

describe('tabLabelFor', () => {
  it('maps each tab route to a human label', () => {
    expect(tabLabelFor('index')).toBe('Home');
    expect(tabLabelFor('playlists')).toBe('Playlists');
    expect(tabLabelFor('history')).toBe('History');
    expect(tabLabelFor('settings')).toBe('Settings');
  });

  it('falls back to the route name for unknown routes', () => {
    expect(tabLabelFor('whatever')).toBe('whatever');
  });
});
