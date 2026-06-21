import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { PressableScale } from '@/components/pressable-scale';

interface CenterControlsProps {
  playing: boolean;
  onToggle: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isEnded?: boolean;
}

export function CenterControls({
  playing,
  onToggle,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  isEnded,
}: CenterControlsProps) {
  return (
    <View style={styles.row} pointerEvents="box-none">
      {/* Prev button — hidden when slot not filled */}
      {onPrev !== undefined ? (
        <PressableScale
          onPress={onPrev}
          style={[styles.sideButton, !hasPrev && styles.disabled]}>
          <MaterialIcons name="skip-previous" size={36} color="#fff" />
        </PressableScale>
      ) : (
        <View style={styles.sideButton} pointerEvents="none" />
      )}

      {/* Play / Pause */}
      <PressableScale onPress={onToggle} style={styles.playButton}>
        <MaterialIcons name={playing ? 'pause' : isEnded ? 'replay' : 'play-arrow'} size={48} color="#fff" />
      </PressableScale>

      {/* Next button — hidden when slot not filled */}
      {onNext !== undefined ? (
        <PressableScale
          onPress={onNext}
          style={[styles.sideButton, !hasNext && styles.disabled]}>
          <MaterialIcons name="skip-next" size={36} color="#fff" />
        </PressableScale>
      ) : (
        <View style={styles.sideButton} pointerEvents="none" />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 28,
    color: '#fff',
  },
  sideButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIcon: {
    fontSize: 22,
    color: '#fff',
  },
  disabled: {
    opacity: 0.3,
  },
});
