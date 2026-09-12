// Purpose: delight — the finish, and the one place in the app the wordmark is
// allowed to be the whole picture. `53` in `onSurface`, `XY` in the accent, the
// same split the Home header uses, so the mark is wallpaper-driven here too.
// Rises in once and rests; no phone frame — the real one is a tap away.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/theme/typography';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

type IoniconName = keyof typeof Ionicons.glyphMap;
/** The three things the tour just showed, as a quiet strip under the mark. */
const GLYPHS: IoniconName[] = ['albums-outline', 'play-circle-outline', 'bookmark-outline'];

export function MockupDone() {
  const { colors, spacing, icon } = useTheme();
  const reduced = useReducedMotion();
  const rise = useSharedValue(reduced ? 1 : 0);
  const strip = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    rise.set(withDelay(120, withTiming(1, { duration: 280, easing: EASE })));
    strip.set(withDelay(320, withTiming(1, { duration: 240, easing: EASE })));
  }, [reduced, rise, strip]);

  const mark = useAnimatedStyle(() => ({
    opacity: rise.get(),
    transform: [{ translateY: (1 - rise.get()) * 16 }],
  }));
  const glyphs = useAnimatedStyle(() => ({ opacity: strip.get() * 0.7 }));

  // Neutral `onSurface` for `53`, not `onPrimaryContainer`: in a dark scheme
  // that token and `primary` are adjacent tones of the same hue and the
  // two-tone mark collapses into one colour. Same split as the Home header.
  const base = colors.onSurface;
  const accent = colors.primary ?? base;

  return (
    <View style={{ alignItems: 'center', gap: spacing.xl }}>
      <Animated.View
        style={[styles.row, mark]}
        accessibilityRole="header"
        accessibilityLabel="53XY"
      >
        <Animated.Text style={[styles.mark, { color: base }]}>53</Animated.Text>
        <Animated.Text style={[styles.mark, { color: accent }]}>XY</Animated.Text>
      </Animated.View>

      <Animated.View style={[{ flexDirection: 'row', gap: spacing.xl }, glyphs]}>
        {GLYPHS.map((name) => (
          <Ionicons key={name} name={name} size={icon.lg} color={base} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // Same face as the header wordmark, scaled to a hero. Tighter tracking than
  // the ramp's display size because at 72px the default gap reads as a hole.
  mark: { fontFamily: FONTS.displayBold, fontSize: 72, lineHeight: 80, letterSpacing: -3 },
});
