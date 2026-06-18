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

interface GestureIndicatorsProps {
  boostActive: boolean;
  seekFlash: { side: 'left' | 'right'; nonce: number } | null;
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

  const seekSide = seekFlash?.side ?? 'left';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 2× boost pill — top-center */}
      <Animated.View style={[styles.boostPill, boostAnimStyle]}>
        <Text style={styles.pillText}>{'2× ►►'}</Text>
      </Animated.View>

      {/* Seek flash pill — centered in the tapped half */}
      <Animated.View
        style={[
          styles.seekPill,
          seekSide === 'left' ? styles.seekLeft : styles.seekRight,
          seekAnimStyle,
        ]}>
        <Text style={styles.pillText}>
          {seekSide === 'left' ? '« 10s' : '10s »'}
        </Text>
      </Animated.View>
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
  seekPill: {
    position: 'absolute',
    top: '45%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  seekLeft: {
    left: '12%',
  },
  seekRight: {
    right: '12%',
  },
  pillText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
