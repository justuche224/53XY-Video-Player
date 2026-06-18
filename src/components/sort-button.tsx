import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { type SortDir, type SortKey } from '@/library/sort-groups';
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
    <Pressable onPress={onPress} hitSlop={10} style={{ padding: 4 }}>
      <Ionicons name="swap-vertical" size={20} color={colors.onSurface} />
    </Pressable>
  );
}
