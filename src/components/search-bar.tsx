// src/components/search-bar.tsx
import { StyleSheet, TextInput } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function SearchBar({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const { colors, radius } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Search"
      placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
      style={[styles.input, { backgroundColor: colors.surfaceVariant ?? '#222', color: colors.onSurface, borderRadius: radius.md }]}
    />
  );
}

const styles = StyleSheet.create({
  input: { paddingHorizontal: 14, paddingVertical: 8, fontSize: 15 },
});
