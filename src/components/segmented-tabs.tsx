// src/components/segmented-tabs.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

const OPTIONS: { key: 'name' | 'folder'; label: string }[] = [
  { key: 'name', label: 'Videos' },
  { key: 'folder', label: 'Folders' },
];

export function SegmentedTabs({ value, onChange }: { value: 'name' | 'folder'; onChange: (v: 'name' | 'folder') => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.pill }]}>
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.pill, { borderRadius: radius.pill, backgroundColor: active ? colors.primary : 'transparent' }]}>
            <Text style={{ color: active ? (colors.onPrimary ?? '#fff') : colors.onSurface, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 3, alignSelf: 'flex-start' },
  pill: { paddingHorizontal: 16, paddingVertical: 6 },
});
