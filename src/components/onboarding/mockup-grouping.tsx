// Purpose: explanation. Three loose filenames drop into the series card they
// become — in the grid where the card actually lives, not on a blank panel.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PhoneScreen } from '@/components/onboarding/device-frame';
import { FauxGrid, FauxHomeHeader, FauxStatusBar } from '@/components/onboarding/faux-home';
import { HOME_CARDS } from '@/components/onboarding/mockup-welcome';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const FILES = ['Show.S01E01.1080p.mkv', 'Show.S01E02.1080p.mkv', 'Show.S01E03.1080p.mkv'];

export function MockupGrouping() {
  const { colors, spacing } = useTheme();
  const reduced = useReducedMotion();
  // 0 = filenames stacked over the grid, 1 = absorbed into the first card.
  // Loops with long rests at both ends: the collapse itself is 400 ms, and a
  // one-shot would be over before the user has finished reading the headline.
  const collapse = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    collapse.set(
      withRepeat(
        withSequence(
          withDelay(1400, withTiming(1, { duration: 420, easing: EASE })),
          withDelay(1800, withTiming(0, { duration: 260, easing: EASE })),
        ),
        -1,
        false,
      ),
    );
  }, [reduced, collapse]);

  // The card takes a small breath as the files land in it.
  const landing = useAnimatedStyle(() => {
    const t = collapse.get();
    const bump = t < 0.5 ? 0 : Math.sin((t - 0.5) * 2 * Math.PI) * 0.03;
    return { transform: [{ scale: 1 + bump }] };
  });

  return (
    <PhoneScreen>
      {/* Scrolled past the hero: the pinned header is solid over the page. */}
      <View
        style={{
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.outlineVariant ?? 'transparent',
        }}
      >
        <FauxStatusBar tone="surface" />
        <FauxHomeHeader tone="surface" />
      </View>
      <View style={{ paddingTop: spacing.sm }}>
        <Animated.View style={landing}>
          <FauxGrid cards={HOME_CARDS} />
        </Animated.View>
        <View style={[styles.files, { top: spacing.sm + 6, left: spacing.lg + 6, gap: spacing.xs }]} pointerEvents="none">
          {FILES.map((name, i) => (
            <LooseFile key={name} name={name} index={i} collapse={collapse} />
          ))}
        </View>
      </View>
    </PhoneScreen>
  );
}

/**
 * A child component rather than an inline `useAnimatedStyle` inside the map —
 * hooks must not be called in a loop, even one over a fixed-length constant.
 */
function LooseFile({
  name,
  index,
  collapse,
}: {
  name: string;
  index: number;
  collapse: SharedValue<number>;
}) {
  const { colors, spacing, radius, shadow } = useTheme();
  // Each chip sinks into the card below it and fades as it lands; the lowest
  // travels least, so the stack visibly converges rather than sliding as one.
  const chip = useAnimatedStyle(() => {
    const t = collapse.get();
    return {
      opacity: 1 - Math.min(1, t * 1.25),
      transform: [{ translateY: t * (110 - index * 14) }, { scale: 1 - t * 0.2 }],
    };
  });
  return (
    <Animated.View
      style={[
        chip,
        {
          alignSelf: 'flex-start',
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          borderRadius: radius.sm,
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.md,
          boxShadow: shadow(2),
        },
      ]}
    >
      <AppText variant="meta" color={colors.onSurface}>
        {name}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  files: { position: 'absolute' },
});
