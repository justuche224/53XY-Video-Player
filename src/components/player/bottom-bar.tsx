// src/components/player/bottom-bar.tsx
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Seekbar } from './seekbar';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

// Speed cycle: 1 → 1.5 → 2 → 0.5 → 1
const SPEED_CYCLE = [1, 1.5, 2, 0.5] as const;

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
}

export function BottomBar({
  positionSec,
  durationSec,
  rate,
  onSeek,
  onCycleRate,
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
      />
      <View style={styles.row}>
        <Text style={styles.timeText}>
          {formatTime(positionSec)}
        </Text>
        <Text style={[styles.timeText, { opacity: 0.6 }]}>
          {formatTime(durationSec)}
        </Text>
        <PressableScale
          onPress={() => onCycleRate(nextRate(rate))}
          style={[
            styles.speedChip,
            { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill },
          ]}>
          <Text style={styles.speedText}>{rateLabel}</Text>
        </PressableScale>
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
  speedChip: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  speedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
