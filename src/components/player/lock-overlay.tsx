// src/components/player/lock-overlay.tsx
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

const REVEAL_MS = 3000;
const FADE_MS = 200;

interface LockOverlayProps {
  onUnlock: () => void;
}

export function LockOverlay({ onUnlock }: LockOverlayProps) {
  const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reveal() {
    setVisible(true);
    opacity.value = withTiming(1, { duration: FADE_MS });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS });
      setVisible(false);
    }, REVEAL_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pillStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // Full-screen catcher: any tap reveals the unlock pill (and re-arms the timer).
    <Pressable style={StyleSheet.absoluteFill} onPress={reveal}>
      <View style={styles.center} pointerEvents="box-none">
        {/* Pill only captures touches while visible, so a tap on the hidden
            pill area falls through to the catcher above and just reveals. */}
        <Animated.View style={pillStyle} pointerEvents={visible ? 'auto' : 'none'}>
          <Pressable onPress={onUnlock} style={styles.pill}>
            <MaterialIcons name="lock" size={18} color="#fff" />
            <Text style={styles.text}>{' Tap to unlock'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
