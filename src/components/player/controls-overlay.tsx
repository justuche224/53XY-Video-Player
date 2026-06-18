// src/components/player/controls-overlay.tsx
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HIDE_DELAY_MS = 3000;
const ANIM_DURATION_MS = 250;

interface ControlsOverlayProps {
  playing: boolean;
  /** Visibility driven by parent; toggled via gesture layer's single-tap. */
  visible: boolean;
  children: ReactNode;
}

export function ControlsOverlay({ playing, visible, children }: ControlsOverlayProps) {
  const insets = useSafeAreaInsets();
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

  // Respond to parent visibility changes (driven by gesture layer's single-tap).
  // Also handles auto-hide-while-playing: when shown while playing, schedule a
  // hide; when paused, cancel any pending hide and stay visible.
  useEffect(() => {
    if (visible) {
      show();
      if (playing) {
        scheduleHide();
      } else {
        cancelHide();
      }
    } else {
      cancelHide();
      opacity.value = withTiming(0, { duration: ANIM_DURATION_MS });
    }
    return () => {
      cancelHide();
    };
  }, [visible, playing, show, scheduleHide, cancelHide, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // box-none: touch events pass through empty space to the gesture layer beneath;
    // child buttons still receive touches normally.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
          animatedStyle,
        ]}
        pointerEvents="box-none">
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
  },
});
