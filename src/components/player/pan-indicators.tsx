// src/components/player/pan-indicators.tsx
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { formatTime } from '@/player/format-time';

interface PanIndicatorsProps {
  levelHud: { kind: 'brightness' | 'volume'; level: number } | null;
  scrubHud: { targetSec: number; deltaSec: number } | null;
  /** Preview frame for the drag-scrub target (null → time-only pill). */
  scrubPreviewUri?: string | null;
  zoomHud: { kind: 'percent'; percent: number } | { kind: 'label'; label: string } | null;
}

export function PanIndicators({ levelHud, scrubHud, scrubPreviewUri, zoomHud }: PanIndicatorsProps) {
  if (!levelHud && !scrubHud && !zoomHud) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {levelHud && (
        <View style={styles.center}>
          <View style={styles.levelPill}>
            <Text style={styles.icon}>
              {levelHud.kind === 'brightness' ? '☀' : '🔊'}
            </Text>
            {/* Vertical level bar */}
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: `${Math.round(levelHud.level * 100)}%` as `${number}%` }]} />
            </View>
          </View>
        </View>
      )}

      {scrubHud && (
        <View style={styles.center}>
          <View style={styles.scrubPill}>
            {scrubPreviewUri && (
              <Image source={{ uri: scrubPreviewUri }} style={styles.scrubFrame} contentFit="cover" />
            )}
            <Text style={styles.scrubTime}>{formatTime(scrubHud.targetSec)}</Text>
            <Text style={styles.scrubDelta}>
              {scrubHud.deltaSec >= 0
                ? `+${formatTime(scrubHud.deltaSec)}`
                : `-${formatTime(-scrubHud.deltaSec)}`}
            </Text>
          </View>
        </View>
      )}

      {zoomHud && (
        <View style={styles.center}>
          <View style={styles.scrubPill}>
            <Text style={styles.scrubTime}>
              {zoomHud.kind === 'percent' ? `${zoomHud.percent}%` : zoomHud.label}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const BAR_WIDTH = 6;
const BAR_HEIGHT = 80;

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    color: '#fff',
    fontSize: 22,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: BAR_WIDTH / 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: BAR_WIDTH,
    backgroundColor: '#fff',
    borderRadius: BAR_WIDTH / 2,
  },
  scrubPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
  },
  scrubFrame: {
    width: 200,
    height: 112,
    borderRadius: 10,
    backgroundColor: '#111',
    marginBottom: 4,
  },
  scrubTime: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  scrubDelta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
});
