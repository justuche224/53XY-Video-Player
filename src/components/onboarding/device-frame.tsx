import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

/**
 * The logical width every facsimile screen is laid out at. Fixed so that type,
 * spacing and card proportions are the real app's — the frame then scales the
 * whole composition down to fit, instead of each screen re-deriving sizes.
 */
export const DESIGN_WIDTH = 360;
/** Taller than the stage will ever show; the stage clips the bottom edge. */
const DESIGN_HEIGHT = 760;

/**
 * A bezel-less phone screen anchored to the bottom of the stage: the top two
 * thirds of a real 53XY screen peeking out, cropped by the stage's bottom edge.
 * Children are laid out at `DESIGN_WIDTH` and scaled to fit ~70% of the window.
 *
 * Scale, not resize — a facsimile built at 360 and scaled to 0.75 keeps every
 * proportion the real screen has, which is the whole point of showing it.
 */
export function PhoneScreen({ children }: { children: ReactNode }) {
  const { colors, radius, shadow } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(Math.round(windowWidth * 0.7), 300);
  const scale = width / DESIGN_WIDTH;

  return (
    <View
      style={[
        styles.phone,
        {
          width,
          height: Math.round(DESIGN_HEIGHT * scale),
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          backgroundColor: colors.background,
          borderColor: colors.outlineVariant ?? 'transparent',
          boxShadow: shadow(3),
        },
      ]}
    >
      <View
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transformOrigin: 'top left',
          transform: [{ scale }],
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * A landscape frame for the player: the phone turned sideways would be too
 * small to read gesture zones on, so the player is drawn as a wide 16:9 card
 * instead, centred in the stage.
 */
export function WideScreen({ children }: { children: ReactNode }) {
  const { radius, shadow } = useTheme();
  return (
    <View
      style={[
        styles.wide,
        {
          borderRadius: radius.lg,
          // Player chrome is fixed white-on-black, not themed (HANDOFF §4).
          backgroundColor: '#101014',
          boxShadow: shadow(3),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderCurve: 'continuous',
  },
  wide: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
});
