// Purpose: spatial continuity. The frame lifting out of the video and landing
// as a card with its note attached is the mental model of the whole feature —
// a moment is a thing that leaves the video and survives on its own.
import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

export function MockupMoments() {
  const { colors, spacing, radius, icon, shadow } = useTheme();
  const reduced = useReducedMotion();
  // 0 = frame sitting in the video, 1 = lifted out as a saved card.
  const lift = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    lift.set(withDelay(400, withTiming(1, { duration: 300, easing: EASE })));
  }, [reduced, lift]);

  const card = useAnimatedStyle(() => ({
    opacity: lift.get(),
    transform: [{ translateY: (1 - lift.get()) * 24 }, { scale: 0.95 + lift.get() * 0.05 }],
  }));

  return (
    <View style={{ width: '100%', gap: spacing.md }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: '#101014',
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: shadow(2),
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.pill,
            backgroundColor: ON_ARTWORK.tonal,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="bookmark" size={icon.lg} color={ON_ARTWORK.primary} />
        </View>
      </View>

      <Animated.View
        style={[
          card,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            gap: spacing.xs,
            boxShadow: shadow(2),
          },
        ]}
      >
        <AppText variant="meta" color={colors.primary}>
          S01E02 · 24:11
        </AppText>
        <AppText variant="title">“You were never supposed to find that.”</AppText>
      </Animated.View>
    </View>
  );
}
