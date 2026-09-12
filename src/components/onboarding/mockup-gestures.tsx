// Purpose: explanation. The player, landscape, with each gesture drawn where it
// lives on the frame — the point is *where*, which a list of words cannot carry.
// Also the body of the one-shot coach card in the player, so it must read on a
// dark backdrop as well as on the onboarding stage.
import { Image } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
import { Gradient } from '@/components/gradient';
import { WideScreen } from '@/components/onboarding/device-frame';
import { STILLS } from '@/components/onboarding/stills';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

// `bezierFn`, not `bezier`: this curve is applied by hand inside a worklet.
const EASE = Easing.bezierFn(0.23, 1, 0.32, 1);
type IoniconName = keyof typeof Ionicons.glyphMap;

export function MockupGestures() {
  const { spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  // One shared clock; each callout picks its own window off it, so the four
  // arrive in reading order and then all stay — it is a labelled diagram, not
  // a loop the user has to catch.
  const clock = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    clock.set(withDelay(300, withTiming(1, { duration: 1100, easing: Easing.linear })));
  }, [reduced, clock]);

  return (
    <WideScreen>
      <Image source={STILLS.neon} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Gradient
        style={StyleSheet.absoluteFill}
        stops={[
          { color: 'rgba(0,0,0,0.55)', at: '0%' },
          { color: 'rgba(0,0,0,0.2)', at: '40%' },
          { color: 'rgba(0,0,0,0.65)', at: '100%' },
        ]}
      />

      {/* Player chrome, as the real top bar / centre controls / bottom bar draw it. */}
      <View style={[styles.row, { position: 'absolute', top: 10, left: 12, right: 12, gap: spacing.sm }]}>
        <MaterialIcons name="arrow-back" size={20} color="#fff" />
        <AppText variant="label" color={ON_ARTWORK.primary} numberOfLines={1} style={{ flex: 1 }}>
          Show · S01E02
        </AppText>
        <Ionicons name="bookmark-outline" size={18} color="#fff" />
      </View>
      {/* Only the pause chip from the centre controls: the skip glyphs would sit
          exactly where the double-tap zone needs to be drawn. */}
      <View style={styles.center}>
        <View style={[styles.chip, { width: 48, height: 48, borderRadius: radius.pill }]}>
          <MaterialIcons name="pause" size={30} color="#fff" />
        </View>
      </View>
      <View style={[styles.row, { position: 'absolute', bottom: 10, left: 12, right: 12, gap: spacing.sm }]}>
        <AppText variant="meta" color={ON_ARTWORK.primary}>
          24:11
        </AppText>
        <View style={{ flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: ON_ARTWORK.track }}>
          <View style={{ width: '58%', height: 3, borderRadius: radius.pill, backgroundColor: '#fff' }} />
        </View>
        <AppText variant="meta" color={ON_ARTWORK.secondary}>
          42:30
        </AppText>
        <MaterialIcons name="fit-screen" size={18} color="#fff" />
      </View>

      {/* The four gestures, each where it happens. */}
      <Callout clock={clock} from={0} style={{ left: 22, top: '22%', bottom: '20%' }} label="Brightness" icon="sunny-outline">
        <Rail percent={0.7} />
      </Callout>
      <Callout clock={clock} from={0.25} style={{ right: 22, top: '22%', bottom: '20%' }} label="Volume" icon="volume-high-outline">
        <Rail percent={0.45} />
      </Callout>
      <Callout clock={clock} from={0.5} style={{ right: '16%', top: '18%' }} label="Double-tap" icon="play-forward" direction="column-reverse">
        <View style={[styles.ripple, { borderRadius: radius.pill }]}>
          <AppText variant="episode" color={ON_ARTWORK.primary}>
            +10s
          </AppText>
        </View>
      </Callout>
      <Callout clock={clock} from={0.75} style={{ left: '25%', top: 34 }} label="Hold" icon="hand-left-outline" direction="row">
        <View style={[styles.chip, { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill }]}>
          <AppText variant="label" color={ON_ARTWORK.primary}>
            2×
          </AppText>
        </View>
      </Callout>
    </WideScreen>
  );
}

/** A gesture zone plus its label, arriving as one piece. */
function Callout({
  clock,
  from,
  style,
  label,
  icon,
  direction = 'column',
  children,
}: {
  clock: SharedValue<number>;
  /** Where on the shared clock (0–1) this callout begins its 0.25 window. */
  from: number;
  style: object;
  label: string;
  icon: IoniconName;
  /** Where the label goes relative to the zone: below (default), above, or beside. */
  direction?: 'column' | 'column-reverse' | 'row';
  children: ReactNode;
}) {
  const { radius } = useTheme();
  const reveal = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (clock.get() - from) / 0.25));
    const eased = EASE(t);
    return { opacity: eased, transform: [{ scale: 0.92 + eased * 0.08 }] };
  });
  return (
    <Animated.View style={[styles.callout, { flexDirection: direction }, style, reveal]} pointerEvents="none">
      {children}
      <View style={[styles.row, styles.chip, { gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }]}>
        <Ionicons name={icon} size={12} color="#fff" />
        <AppText variant="meta" color={ON_ARTWORK.primary} style={{ lineHeight: 14 }}>
          {label}
        </AppText>
      </View>
    </Animated.View>
  );
}

/** The vertical brightness / volume track the pan indicators draw. */
function Rail({ percent }: { percent: number }) {
  const { radius } = useTheme();
  return (
    <View style={[styles.rail, { borderRadius: radius.pill }]}>
      <View style={{ height: `${percent * 100}%`, backgroundColor: '#fff', borderRadius: radius.pill }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  chip: { backgroundColor: ON_ARTWORK.chip, alignItems: 'center', justifyContent: 'center' },
  callout: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rail: { flex: 1, width: 5, backgroundColor: ON_ARTWORK.track, overflow: 'hidden', justifyContent: 'flex-end' },
  ripple: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});
