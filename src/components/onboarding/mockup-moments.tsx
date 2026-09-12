// Purpose: explanation. The Moments tab with real-looking captures — frame,
// timestamp, episode, the subtitle line as the note — and the newest one
// landing in the grid, which is what a capture feels like from the player.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PhoneScreen } from '@/components/onboarding/device-frame';
import { FauxStatusBar } from '@/components/onboarding/faux-home';
import { STILLS, type StillKey } from '@/components/onboarding/stills';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

interface FauxMoment {
  key: string;
  still: StillKey;
  time: string;
  episode: string;
  note?: string;
}

const MOMENTS: FauxMoment[] = [
  { key: 'a', still: 'neon', time: '24:11', episode: 'Show · S01E02', note: '“You were never supposed to find that.”' },
  { key: 'b', still: 'sunset', time: '03:45', episode: 'Show · S01E01', note: 'Opening titles' },
  { key: 'c', still: 'desert', time: '12:08', episode: 'Trip 2025 · Day 3', note: 'The view from the ridge' },
  { key: 'd', still: 'steel', time: '41:02', episode: 'Lecture 04', note: 'Key theorem — rewatch' },
  { key: 'e', still: 'forest', time: '08:51', episode: 'Trip 2025 · Day 1', note: 'Where we parked' },
  { key: 'f', still: 'night', time: '01:20', episode: 'Product demo v2', note: '“And this is the part everyone asks about.”' },
];

export function MockupMoments() {
  const { colors, spacing } = useTheme();
  const reduced = useReducedMotion();
  const land = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    land.set(withDelay(450, withTiming(1, { duration: 320, easing: EASE })));
  }, [reduced, land]);

  const newest = useAnimatedStyle(() => ({
    opacity: land.get(),
    transform: [{ scale: 0.9 + land.get() * 0.1 }, { translateY: (1 - land.get()) * -12 }],
  }));

  return (
    <PhoneScreen>
      <FauxStatusBar tone="surface" />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <AppText variant="display">Moments</AppText>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Animated.View style={[{ flex: 1 }, newest]}>
            <MomentTile moment={MOMENTS[0]} />
          </Animated.View>
          <MomentTile moment={MOMENTS[1]} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MomentTile moment={MOMENTS[2]} />
          <MomentTile moment={MOMENTS[3]} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MomentTile moment={MOMENTS[4]} />
          <MomentTile moment={MOMENTS[5]} />
        </View>
      </View>
      {/* Reserve a hairline of page below so the crop never lands on a tile edge. */}
      <View style={{ height: spacing.xl, backgroundColor: colors.background }} />
    </PhoneScreen>
  );
}

/** `MomentCard`, with a still for the captured frame. */
function MomentTile({ moment }: { moment: FauxMoment }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.frame, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        <Image source={STILLS[moment.still]} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[styles.badge, { borderRadius: radius.sm }]}>
          <AppText variant="meta" color="#fff" style={styles.badgeText}>
            {moment.time}
          </AppText>
        </View>
      </View>
      <AppText variant="label" numberOfLines={1} style={{ marginTop: spacing.xs }}>
        {moment.episode}
      </AppText>
      {moment.note ? (
        <AppText variant="meta" numberOfLines={2} color={colors.onSurfaceVariant ?? colors.onSurface} style={{ marginTop: 2 }}>
          {moment.note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, overflow: 'hidden', borderCurve: 'continuous' },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
