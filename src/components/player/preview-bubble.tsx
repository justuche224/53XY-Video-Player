// src/components/player/preview-bubble.tsx
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { formatTime } from '@/player/format-time';

export const BUBBLE_WIDTH = 148;

interface PreviewBubbleProps {
  targetSec: number;
  /** Frame to show; null → timestamp-only bubble (never a misleading frame). */
  frameUri: string | null;
}

/** Frame + timestamp bubble shown above the seekbar thumb while dragging. */
export function PreviewBubble({ targetSec, frameUri }: PreviewBubbleProps) {
  return (
    <View style={styles.bubble}>
      {frameUri && (
        <Image source={{ uri: frameUri }} style={styles.frame} contentFit="cover" />
      )}
      <Text style={styles.time}>{formatTime(targetSec)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: BUBBLE_WIDTH,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 10,
    padding: 4,
    alignItems: 'center',
    gap: 2,
  },
  frame: {
    width: BUBBLE_WIDTH - 8,
    height: (BUBBLE_WIDTH - 8) * (9 / 16),
    borderRadius: 7,
    backgroundColor: '#111',
  },
  time: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
