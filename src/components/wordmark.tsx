import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { ON_ARTWORK } from '@/theme/resolve-theme';
import { TYPOGRAPHY } from '@/theme/typography';
import { useTheme } from '@/theme/theme-provider';

/**
 * The 53XY logotype: `53` in the foreground colour, `XY` in the Material You
 * accent — so the mark itself is wallpaper-driven, which is the whole point of
 * the theming decision in the vision doc.
 *
 * `progress` runs 0 (sitting on video artwork) → 1 (sitting on the page). This is
 * the only element in the header that cross-fades its colour; every other header
 * control uses a fixed chip that reads correctly in both states, so exactly one
 * pair of `interpolateColor`s runs per header.
 *
 * The two halves are siblings in a row rather than a nested `<Text>`: on Android a
 * nested Text compiles to a virtual text node with no view of its own, which
 * Reanimated cannot reliably drive. Same font and size means `alignItems: center`
 * lines the baselines up exactly.
 */
export function Wordmark({ progress }: { progress: SharedValue<number> }) {
  const { colors, isDark } = useTheme();

  // Tone 80 of the Material You palette in whichever scheme is active: a light
  // pastel of the wallpaper hue, so the accent survives a dark scrim without
  // being hardcoded. In a dark scheme that is `primary`; in a light scheme
  // `primary` is a saturated mid-tone and `inversePrimary` is the tone-80 one.
  const accentOnArtwork = (isDark ? colors.primary : colors.inversePrimary) ?? ON_ARTWORK.primary;
  const accentOnSurface = colors.primary ?? colors.onSurface;
  const baseOnSurface = colors.onSurface ?? '#000';

  const base = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [ON_ARTWORK.primary, baseOnSurface]),
  }));
  const accent = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [accentOnArtwork, accentOnSurface]),
  }));

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="53XY">
      <Animated.Text style={[TYPOGRAPHY.display, styles.mark, base]}>53</Animated.Text>
      <Animated.Text style={[TYPOGRAPHY.display, styles.mark, accent]}>XY</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { letterSpacing: -0.5 },
});
