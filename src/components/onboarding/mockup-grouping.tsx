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
  const { colors, spacing, radius } = useTheme();
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
    <View style={{ width: '100%', gap: spacing.sm }}>
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
            backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
            borderRadius: radius.md,
            padding: spacing.lg,
            gap: spacing.xs,
          },
        ]}
      >
        <AppText variant="title">Show</AppText>
        <AppText variant="meta" color={colors.primary}>
          3 episodes · S01E01–E03
        </AppText>
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
          backgroundColor: colors.surfaceContainerLow ?? colors.surfaceVariant,
          borderRadius: radius.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
        {name}
      </AppText>
    </Animated.View>
  );
}
