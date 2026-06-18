// src/components/player/controls-overlay.tsx
import { useEffect, useRef, type ReactNode } from 'react';
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
  /** Single source of truth for visibility, driven by parent. */
  visible: boolean;
  /** Called by the auto-hide timer so the parent can update its state. */
  onAutoHide: () => void;
  children: ReactNode;
}

export function ControlsOverlay({ playing, visible, onAutoHide, children }: ControlsOverlayProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(visible ? 1 : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate opacity whenever visible changes — opacity is derived purely from visible.
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: ANIM_DURATION_MS });
  }, [visible, opacity]);

  // Auto-hide timer: runs only when visible AND playing.
  // Calls onAutoHide() so the parent updates its state (which then drives opacity via above effect).
  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visible && playing) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onAutoHide();
      }, HIDE_DELAY_MS);
    }
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, playing, onAutoHide]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // When visible: box-none so only the actual buttons capture and empty space
  // falls through to the gesture layer. When hidden: none, so the (invisible)
  // buttons can't swallow taps meant for the gesture layer beneath.
  const mode = visible ? 'box-none' : 'none';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={mode}>
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
        pointerEvents={mode}>
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
