// src/components/player/controls-overlay.tsx
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const HIDE_DELAY_MS = 3000;
const ANIM_DURATION_MS = 250;

interface ControlsOverlayProps {
  playing: boolean;
  children: ReactNode;
}

export function ControlsOverlay({ playing, children }: ControlsOverlayProps) {
  const opacity = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    opacity.value = withTiming(1, { duration: ANIM_DURATION_MS });
  }, [opacity]);

  const scheduleHide = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: ANIM_DURATION_MS });
    }, HIDE_DELAY_MS);
  }, [opacity]);

  const cancelHide = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-hide while playing; stay visible while paused
  useEffect(() => {
    if (playing) {
      scheduleHide();
    } else {
      cancelHide();
      show();
    }
    return () => {
      cancelHide();
    };
  }, [playing, show, scheduleHide, cancelHide]);

  function handleTap() {
    // Toggle: if fading or hidden, show and (re)schedule; if visible, hide immediately
    if (opacity.value < 0.5) {
      show();
      if (playing) {
        scheduleHide();
      }
    } else {
      cancelHide();
      opacity.value = withTiming(0, { duration: ANIM_DURATION_MS });
    }
  }

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
  },
});
