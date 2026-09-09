import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { MockupGestures } from '@/components/onboarding/mockup-gestures';
import { PillButton } from '@/components/pill-button';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

/**
 * A full-screen one-shot card, deliberately NOT an anchored spotlight with a
 * measured cutout.
 *
 * The player's touch handling is an RNGH gesture arena
 * (player-gesture-relations.ts, player-pressable-scale.tsx,
 * blocksExternalGesture) that has already produced two separate wedge bugs.
 * Laying a measuring, ref-registering overlay on top of that arena is a
 * regression risk out of proportion to the benefit. This card sits above
 * everything, owns all touches while visible, and unmounts cleanly.
 */
export function GestureCoachCard({ onDismiss }: { onDismiss: () => void }) {
  const { spacing } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      exiting={reduced ? undefined : FadeOut.duration(140)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.xl,
        zIndex: 100,
      }}
    >
      <AppText variant="headline" color={ON_ARTWORK.primary}>
        The player answers to your thumb
      </AppText>
      <View style={{ width: '100%' }}>
        <MockupGestures />
      </View>
      <PillButton label="Got it" onPress={onDismiss} tone="artwork" />
    </Animated.View>
  );
}
