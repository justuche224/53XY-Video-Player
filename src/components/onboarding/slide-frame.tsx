import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Onboarding runs a larger ramp than the rest of the app: a first impression
 * wants a headline, not a settings-row title. These override the `display` /
 * `body` variants locally rather than widening the global ramp, which every
 * other screen is tuned against.
 */
const HERO_HEADLINE = { fontSize: 34, lineHeight: 40, letterSpacing: -0.8 } as const;
const HERO_BODY = { fontSize: 16, lineHeight: 24 } as const;

/**
 * The shared composition every slide uses: a tinted hero slab that absorbs the
 * flex and carries the mockup, then headline + body stacked directly above the
 * footer. The slab is `primaryContainer` — the wallpaper tint — so the panel
 * itself is the visual, and a mockup sitting on it reads as content on a
 * surface rather than a small card lost on a white page.
 */
export function SlideFrame({
  headline,
  body,
  mockup,
}: {
  headline: string;
  body: string;
  mockup: ReactNode;
}) {
  const { colors, spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  // Purpose: preventing a jarring cut. The slab settles in behind the mockup
  // so each slide arrives as one piece instead of a card popping onto a panel.
  const settle = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    settle.set(withTiming(1, { duration: 260, easing: EASE }));
  }, [reduced, settle]);

  const slab = useAnimatedStyle(() => ({
    opacity: 0.6 + settle.get() * 0.4,
    transform: [{ scale: 0.96 + settle.get() * 0.04 }],
  }));

  return (
    <View style={[styles.root, { paddingHorizontal: spacing.lg }]}>
      <Animated.View
        style={[
          slab,
          styles.slab,
          {
            backgroundColor: colors.primaryContainer ?? colors.surfaceContainer ?? colors.surfaceVariant,
            borderRadius: radius.xl,
            padding: spacing.xl,
          },
        ]}
      >
        <View style={styles.mockup}>{mockup}</View>
      </Animated.View>

      <View style={{ gap: spacing.sm, paddingTop: spacing.xl, paddingHorizontal: spacing.sm }}>
        <AppText variant="display" style={HERO_HEADLINE}>
          {headline}
        </AppText>
        <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface} style={HERO_BODY}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slab: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Cap the mockup so a tablet does not stretch a phone-sized composition.
  mockup: { width: '100%', maxWidth: 360, alignItems: 'center' },
});
