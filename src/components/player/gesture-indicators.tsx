// src/components/player/gesture-indicators.tsx
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const FADE_DURATION_MS = 150;
const HOLD_DURATION_MS = 600;

type SeekFlash =
  | { kind: 'left' | 'right'; nonce: number }
  | { kind: 'center'; glyph: '▶' | '⏸'; nonce: number };

interface GestureIndicatorsProps {
  boostActive: boolean;
  seekFlash: SeekFlash | null;
}

export function GestureIndicators({ boostActive, seekFlash }: GestureIndicatorsProps) {
  const boostOpacity = useSharedValue(0);
  const seekOpacity = useSharedValue(0);

  // Boost pill: fade in when active, fade out when not
  useEffect(() => {
    if (boostActive) {
      boostOpacity.value = withTiming(1, { duration: FADE_DURATION_MS });
    } else {
      boostOpacity.value = withTiming(0, { duration: FADE_DURATION_MS });
    }
  }, [boostActive, boostOpacity]);

  // Seek pill: flash and auto-fade on each nonce change
  useEffect(() => {
    if (seekFlash === null) return;
    seekOpacity.value = withSequence(
      withTiming(1, { duration: FADE_DURATION_MS }),
      withTiming(1, { duration: HOLD_DURATION_MS }),
      withTiming(0, { duration: FADE_DURATION_MS }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekFlash?.nonce]);

  const boostAnimStyle = useAnimatedStyle(() => ({ opacity: boostOpacity.value }));
  const seekAnimStyle = useAnimatedStyle(() => ({ opacity: seekOpacity.value }));

  const kind = seekFlash?.kind ?? 'left';
  const justify =
    kind === 'left' ? 'flex-start' : kind === 'right' ? 'flex-end' : 'center';
  const isCenter = kind === 'center';
  const label =
    kind === 'left'
      ? '« 10s'
      : kind === 'right'
        ? '10s »'
        : seekFlash && seekFlash.kind === 'center'
          ? seekFlash.glyph
          : '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 2× boost pill — top-center */}
      <Animated.View style={[styles.boostPill, boostAnimStyle]}>
        <Text style={styles.pillText}>{'2× ►►'}</Text>
      </Animated.View>

      {/* Flash — seek pill (left/right thirds) or play/pause glyph (center third) */}
      <View style={[styles.flashRow, { justifyContent: justify }]} pointerEvents="none">
        <Animated.View style={[isCenter ? styles.centerPill : styles.seekPill, seekAnimStyle]}>
          <Text style={isCenter ? styles.glyphText : styles.pillText}>{label}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boostPill: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  // Full-screen row; justifyContent positions the pill left/center/right.
  flashRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '12%',
  },
  seekPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  centerPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  glyphText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
});
