import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_DIR, SORT_KEYS, SORT_LABELS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useTheme } from '@/theme/theme-provider';

export function SortSheet({
  visible,
  sortKey,
  sortDir,
  onSelect,
  onClose,
}: {
  visible: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSelect: (key: SortKey, dir: SortDir) => void;
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();

  // Tapping the active key flips direction; tapping another selects its default. Closes either way.
  const choose = (k: SortKey) => {
    const dir: SortDir = k === sortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[k];
    onSelect(k, dir);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1b1b1b',
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Sort by</Text>
          {SORT_KEYS.map((k) => {
            const active = k === sortKey;
            return (
              <Pressable key={k} onPress={() => choose(k)} style={styles.row}>
                <Text style={{ color: active ? colors.primary : colors.onSurface, fontSize: 16, fontWeight: active ? '700' : '500' }}>
                  {SORT_LABELS[k]}
                </Text>
                {active ? (
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
});
