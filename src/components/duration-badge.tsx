import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { formatTime } from '@/player/format-time';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export function DurationBadge({ ms }: { ms: number | null | undefined }) {
  const { radius } = useTheme();
  if (!ms || ms <= 0) return null;
  return (
    // M3 badges are corner.full. This was the last hardcoded radius in the app
    // (a flat 6), which HANDOFF §3 logged as a follow-up.
    <View style={[styles.badge, { borderRadius: radius.pill }]}>
      <AppText variant="meta" color={ON_ARTWORK.primary} style={styles.text}>
        {formatTime(ms / 1000)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: { lineHeight: 14 },
});
