import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { PlayerPressableScale } from './player-pressable-scale';
import { ON_ARTWORK } from '@/theme/resolve-theme';

/**
 * The player-chrome variant of the app's circular tonal icon button: the same
 * dark chip the Home header floats over artwork, sized for a video surface.
 *
 * Purely visual composition. The chip styling rides PlayerPressableScale's
 * `style` prop onto the Animated.View *inside* its GestureDetector — the raw
 * Tap handler and its blocksExternalGesture arena relations (see the wedge
 * history in player-pressable-scale.tsx) are not touched in any way.
 *
 * Fixed colours on purpose: player chrome sits over arbitrary video frames and
 * is outside Material You by design (HANDOFF §4).
 */
export function ChromeButton({
  onPress,
  disabled,
  size = 40,
  style,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  /** Chip diameter in dp. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <PlayerPressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ON_ARTWORK.chip,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {children}
    </PlayerPressableScale>
  );
}
