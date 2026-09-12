// Purpose: explanation. Three loose filenames collapse into one series card,
// which is exactly what the grouping engine does and is impossible to convey
// in a still.
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const FILES = ['Show.S01E01.1080p.mkv', 'Show.S01E02.1080p.mkv', 'Show.S01E03.1080p.mkv'];

export function MockupGrouping() {
  const { colors, spacing, radius, shadow } = useTheme();
  const reduced = useReducedMotion();
  // 0 = loose files, 1 = collapsed into the series card.
  const collapse = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    collapse.set(withDelay(400, withTiming(1, { duration: 280, easing: EASE })));
  }, [reduced, collapse]);

  const card = useAnimatedStyle(() => ({
    opacity: collapse.get(),
    transform: [{ scale: 0.95 + collapse.get() * 0.05 }],
  }));

  return (
    // The collapsed card is absolutely positioned over the rows and is now
    // taller than they are, so the wrapper reserves its height explicitly.
    <View style={{ width: '100%', gap: spacing.sm, minHeight: 212 }}>
      {FILES.map((name, i) => (
        <LooseFileRow key={name} name={name} index={i} collapse={collapse} />
      ))}

      <Animated.View
        style={[
          card,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            gap: spacing.md,
            boxShadow: shadow(2),
          },
        ]}
      >
        {/* The collage the real group card draws: one poster per episode. */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {FILES.map((name, i) => (
            <View
              key={name}
              style={{
                flex: 1,
                aspectRatio: 2 / 3,
                borderRadius: radius.sm,
                // Step the tones so three blank posters still read as three
                // different frames rather than one grey bar.
                backgroundColor:
                  [colors.surfaceContainerHighest, colors.surfaceContainerHigh, colors.surfaceContainer][i] ??
                  colors.surfaceVariant,
              }}
            />
          ))}
        </View>
        <View style={{ gap: 2 }}>
          <AppText variant="headline">Show</AppText>
          <AppText variant="label" color={colors.primary}>
            3 episodes · S01E01–E03
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * A child component rather than an inline `useAnimatedStyle` inside the map —
 * hooks must not be called in a loop, even one over a fixed-length constant.
 */
function LooseFileRow({
  name,
  index,
  collapse,
}: {
  name: string;
  index: number;
  collapse: SharedValue<number>;
}) {
  const { colors, spacing, radius } = useTheme();
  // Each row slides down and fades as the card takes over; the last row
  // travels least, so the stack visibly converges rather than sliding as a
  // block.
  const row = useAnimatedStyle(() => ({
    opacity: 1 - collapse.get(),
    transform: [{ translateY: collapse.get() * (16 - index * 6) }],
  }));
  return (
    <Animated.View
      style={[
        row,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>
        {name}
      </AppText>
    </Animated.View>
  );
}
