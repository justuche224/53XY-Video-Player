import { Pressable, Text } from 'react-native';

import { SORT_LABELS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useTheme } from '@/theme/theme-provider';

export function SortButton({
  sortKey,
  sortDir,
  onPress,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '600' }}>
        {SORT_LABELS[sortKey]} {sortDir === 'asc' ? '↑' : '↓'}
      </Text>
    </Pressable>
  );
}
