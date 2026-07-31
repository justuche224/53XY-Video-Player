import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ChromeButton } from './chrome-button';

const PLAY_SIZE = 72;
const SIDE_SIZE = 52;

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
        <ChromeButton onPress={onPrev} size={SIDE_SIZE} style={!hasPrev ? styles.disabled : undefined}>
          <MaterialIcons name="skip-previous" size={32} color="#fff" />
        </ChromeButton>
      ) : (
        <View style={styles.sideSpacer} pointerEvents="none" />
      )}

      {/* Play / Pause */}
      <ChromeButton onPress={onToggle} size={PLAY_SIZE}>
        <MaterialIcons name={playing ? 'pause' : isEnded ? 'replay' : 'play-arrow'} size={44} color="#fff" />
      </ChromeButton>

      {/* Next button — hidden when slot not filled */}
      {onNext !== undefined ? (
        <ChromeButton onPress={onNext} size={SIDE_SIZE} style={!hasNext ? styles.disabled : undefined}>
          <MaterialIcons name="skip-next" size={32} color="#fff" />
        </ChromeButton>
      ) : (
        <View style={styles.sideSpacer} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  sideSpacer: {
    width: SIDE_SIZE,
    height: SIDE_SIZE,
  },
  disabled: {
    opacity: 0.3,
  },
});
