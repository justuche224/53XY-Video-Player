import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ON_ARTWORK } from '@/theme/resolve-theme';

/**
 * "You've seen this" mark, pinned top-right of a thumbnail.
 *
 * Top-right is the only free corner: the duration badge owns bottom-right, the
 * resume bar owns the bottom edge, and the selection check sits dead centre
 * under its own scrim. Same 62%-black chip treatment as DurationBadge so the
 * two read as one family over any artwork.
 */
export function WatchedBadge() {
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={16} color={ON_ARTWORK.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    padding: 2,
  },
});
