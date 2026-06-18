import { StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/player/format-time';

export function DurationBadge({ ms }: { ms: number | null | undefined }) {
  if (!ms || ms <= 0) return null;
  const timeStr = formatTime(ms / 1000);
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{timeStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
