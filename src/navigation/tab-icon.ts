// Pure mapping from a tab route name to its Ionicons names (filled active /
// outline inactive). Kept pure so the floating tab bar stays presentational.
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type TabIcon = { active: IoniconName; inactive: IoniconName };

export function tabLabelFor(routeName: string): string {
  switch (routeName) {
    case 'index':
      return 'Home';
    case 'playlists':
      return 'Playlists';
    case 'history':
      return 'History';
    case 'settings':
      return 'Settings';
    default:
      return routeName;
  }
}

export function tabIconFor(routeName: string): TabIcon {
  switch (routeName) {
    case 'index':
      return { active: 'home', inactive: 'home-outline' };
    case 'playlists':
      return { active: 'list', inactive: 'list-outline' };
    case 'history':
      return { active: 'time', inactive: 'time-outline' };
    case 'settings':
      return { active: 'settings', inactive: 'settings-outline' };
    default:
      return { active: 'ellipse', inactive: 'ellipse-outline' };
  }
}
