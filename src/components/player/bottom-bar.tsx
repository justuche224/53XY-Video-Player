// src/components/player/bottom-bar.tsx
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { DisplayMode } from '@/player/zoom';

import { Seekbar } from './seekbar';
import { formatTime } from '@/player/format-time';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';
import { ChromeButton } from './chrome-button';
import { PlayerPressableScale } from './player-pressable-scale';

// Speed cycle: 1 → 1.5 → 2 → 0.5 → 1
const SPEED_CYCLE = [1, 1.5, 2, 0.5] as const;

const MODE_ICON: Record<DisplayMode, keyof typeof MaterialIcons.glyphMap> = {
  fit: 'fit-screen',
  crop: 'crop',
  stretch: 'aspect-ratio',
  pixel: 'crop-free',
};

function nextRate(current: number): number {
  const idx = SPEED_CYCLE.indexOf(current as (typeof SPEED_CYCLE)[number]);
  if (idx === -1) return 1;
  return SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
}

interface BottomBarProps {
  positionSec: number;
  durationSec: number;
  rate: number;
  onSeek: (sec: number) => void;
  onCycleRate: (newRate: number) => void;
  /** Scrub-preview lookup passed through to the seekbar. */
  previewFor?: (sec: number) => string | null;
  displayMode: DisplayMode;
  onCycleDisplayMode: () => void;
}

export function BottomBar({
  positionSec,
  durationSec,
  rate,
  onSeek,
  onCycleRate,
  previewFor,
  displayMode,
  onCycleDisplayMode,
}: BottomBarProps) {
  const { spacing, radius } = useTheme();

  const rateLabel = `${rate}×`;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingHorizontal: spacing.md, paddingBottom: spacing.lg }]}>
      <Seekbar
        positionSec={positionSec}
        durationSec={durationSec}
        onSeek={onSeek}
        previewFor={previewFor}
      />
      <View style={styles.row}>
        <Text style={styles.timeText}>
          {formatTime(positionSec)}
        </Text>
        <Text style={[styles.timeText, { opacity: 0.6 }]}>
          {formatTime(durationSec)}
        </Text>
        <View style={styles.rightControls}>
          <ChromeButton onPress={onCycleDisplayMode} size={36}>
            <MaterialIcons name={MODE_ICON[displayMode]} size={20} color="#fff" />
          </ChromeButton>
          <PlayerPressableScale
            onPress={() => onCycleRate(nextRate(rate))}
            style={[
              styles.speedChip,
              { backgroundColor: ON_ARTWORK.tonal, borderRadius: radius.pill },
            ]}>
            <Text style={styles.speedText}>{rateLabel}</Text>
          </PlayerPressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
    color: '#fff',
  },
  rightControls: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedChip: {
    height: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
