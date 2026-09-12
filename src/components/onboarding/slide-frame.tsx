import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Onboarding runs a larger ramp than the rest of the app: a first impression
 * wants a headline, not a settings-row title. These override the `display` /
 * `body` variants locally rather than widening the global ramp, which every
 * other screen is tuned against.
 */
const HERO_HEADLINE = { fontSize: 32, lineHeight: 38, letterSpacing: -0.8 } as const;
const HERO_BODY = { fontSize: 16, lineHeight: 24 } as const;

/**
 * How a slide's mockup sits on the stage. `phone` is a portrait screen anchored
 * to the stage's bottom edge and cropped by it; `wide` is a landscape frame
 * centred with side margins; `free` is a composition with no device at all.
 */
export type MockupFrame = 'phone' | 'wide' | 'free';

/**
 * What the copy and footer need below the stage: headline (two lines), body
 * (up to five — slide 5 is the longest), the footer row and the paddings around
 * them. The stage takes everything else, capped so a tablet does not turn it
 * into a page with a small phone floating in it.
 */
const COPY_AND_FOOTER = 372;
export function stageHeight(windowHeight: number): number {
  return Math.max(280, Math.min(Math.round(windowHeight * 0.62), windowHeight - COPY_AND_FOOTER));
}

/**
 * The composition every slide shares: a full-bleed tinted stage across the top
 * half carrying the mockup, then headline + body above the footer.
 *
 * The stage is the constant. It is the same tint on every slide and is never
 * keyed, so only the mockup and the copy cross-fade between slides — the panel
 * itself does not flicker in and out with them. It is `primaryContainer`, the
 * wallpaper tint, so a screen sitting on it reads as the product on a surface.
 */
export function SlideFrame({
  slideKey,
  headline,
  body,
  mockup,
  frame,
}: {
  slideKey: string;
  headline: string;
  body: string;
  mockup: ReactNode;
  frame: MockupFrame;
}) {
  const { colors, spacing, radius } = useTheme();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  // Purpose: spatial continuity. A phone rises into place from just below its
  // rest; a wide or free composition simply settles in. Copy fades.
  const enterMockup = reduced
    ? undefined
    : frame === 'phone'
      ? FadeInUp.duration(320).easing(EASE)
      : FadeIn.duration(260).easing(EASE);

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.stage,
          frame === 'phone' ? styles.stagePhone : styles.stageCentered,
          {
            height: stageHeight(height),
            backgroundColor: colors.primaryContainer ?? colors.surfaceContainer ?? colors.surfaceVariant,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
            paddingHorizontal: frame === 'phone' ? 0 : spacing.lg,
          },
        ]}
      >
        <Animated.View
          key={slideKey}
          style={frame === 'phone' ? styles.mockupPhone : styles.mockupCentered}
          entering={enterMockup}
          exiting={reduced ? undefined : FadeOut.duration(140)}
        >
          {mockup}
        </Animated.View>
      </View>

      <Animated.View
        key={`${slideKey}-copy`}
        style={{ gap: spacing.sm, paddingTop: spacing.xl, paddingHorizontal: spacing.xl }}
        entering={reduced ? undefined : FadeIn.duration(220).delay(60)}
        exiting={reduced ? undefined : FadeOut.duration(120)}
      >
        <AppText variant="display" style={HERO_HEADLINE}>
          {headline}
        </AppText>
        <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface} style={HERO_BODY}>
          {body}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { overflow: 'hidden', borderCurve: 'continuous', alignItems: 'center' },
  stagePhone: {},
  stageCentered: { justifyContent: 'center' },
  // Pinned to the top (below the Skip control the screen lays over the stage)
  // and left to run past the bottom edge, where the stage clips it — so it is
  // always the *top* of the screen that shows, whatever the window height.
  mockupPhone: { position: 'absolute', top: 56, left: 0, right: 0, alignItems: 'center' },
  // Cap the composition so a tablet does not stretch a phone-sized frame.
  mockupCentered: { width: '100%', maxWidth: 440, alignItems: 'center' },
});
