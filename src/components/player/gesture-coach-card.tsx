import { useEffect } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
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
 *
 * The player is the one screen that unlocks all orientations, and content
 * here runs ~392dp tall — taller than a landscape viewport can be, and taller
 * still at a high Android font scale. A plain centered View with no scroll
 * pushes "Got it" outside the container in that case, where Android does not
 * deliver touches, leaving the card undismissable and the player unusable
 * underneath it. Wrapping the content in a ScrollView guarantees the button
 * is always reachable regardless of viewport or font scale.
 */
export function GestureCoachCard({ onDismiss }: { onDismiss: () => void }) {
  const { spacing } = useTheme();
  const reduced = useReducedMotion();

  // Second dismissal affordance: there is no backdrop-tap dismiss (the scrim
  // deliberately swallows every touch — see the background-colour comment
  // below), so back must not fall through to the player while the card is up.
  // It dismisses the card and writes the flag instead, exactly like "Got it".
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [onDismiss]);

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
        // LOAD-BEARING: this scrim is what makes the card block touches at
        // all. It has no gesture handler of its own — RNGH's orchestrator
        // walks the view tree in reverse paint order looking for a handled
        // touch target, and `shouldHandlerlessViewBecomeTouchTarget` treats an
        // opaque-enough background as one, which stops that reverse-order
        // traversal right here instead of falling through to the player's
        // gesture arena underneath. Make this transparent and the card will
        // silently stop blocking — swipes and double-taps will reach the
        // player through it. Do not "clean up" this colour.
        backgroundColor: 'rgba(0,0,0,0.82)',
        zIndex: 100,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <AppText variant="headline" color={ON_ARTWORK.primary}>
          The player answers to your thumb
        </AppText>
        <View style={{ width: '100%' }}>
          <MockupGestures />
        </View>
        <PillButton label="Got it" onPress={onDismiss} tone="artwork" />
      </ScrollView>
    </Animated.View>
  );
}
