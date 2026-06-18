// src/components/search-bar.tsx
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/theme-provider';

export function SearchBar({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.md }]}>
      <Ionicons name="search" size={20} color={colors.onSurfaceVariant ?? '#888'} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search"
        placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
        style={[styles.input, { color: colors.onSurface }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    fontSize: 15,
  },
});
