import type { TapZone } from './seek';

export type DoubleTapAction = 'seek' | 'toggle' | 'none';

export function doubleTapAction(zone: TapZone, controlsVisible: boolean): DoubleTapAction {
  if (zone === 'center') return controlsVisible ? 'none' : 'toggle';
  return 'seek';
}
