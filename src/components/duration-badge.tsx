import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { formatTime } from '@/player/format-time';

export function DurationBadge({ ms }: { ms: number | null | undefined }) {
  if (!ms || ms <= 0) return null;
  return (
    <View style={styles.badge}>
      <AppText variant="meta" color="#fff" style={styles.text}>{formatTime(ms / 1000)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  text: { lineHeight: 14 },
});
