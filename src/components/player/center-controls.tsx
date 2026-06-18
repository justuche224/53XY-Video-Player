// src/components/player/center-controls.tsx
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

interface CenterControlsProps {
  playing: boolean;
  onToggle: () => void;
  /** Prev/next — optional; absent in Task 4, wired in Task 5 */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function CenterControls({
  playing,
  onToggle,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: CenterControlsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {/* Prev button — hidden when slot not filled */}
      {onPrev !== undefined ? (
        <PressableScale
          onPress={onPrev}
          style={[styles.sideButton, !hasPrev && styles.disabled]}>
          <Text style={[styles.sideIcon, { color: colors.onSurface }]}>{'⏮'}</Text>
        </PressableScale>
      ) : (
        <View style={styles.sideButton} />
      )}

      {/* Play / Pause */}
      <PressableScale onPress={onToggle} style={styles.playButton}>
        <Text style={[styles.playIcon, { color: colors.onSurface }]}>
          {playing ? '⏸' : '▶'}
        </Text>
      </PressableScale>

      {/* Next button — hidden when slot not filled */}
      {onNext !== undefined ? (
        <PressableScale
          onPress={onNext}
          style={[styles.sideButton, !hasNext && styles.disabled]}>
          <Text style={[styles.sideIcon, { color: colors.onSurface }]}>{'⏭'}</Text>
        </PressableScale>
      ) : (
        <View style={styles.sideButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 28,
  },
  sideButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIcon: {
    fontSize: 22,
  },
  disabled: {
    opacity: 0.3,
  },
});
