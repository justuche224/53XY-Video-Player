// src/components/layout-toggle.tsx
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function LayoutToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(value === 'grid' ? 'list' : 'grid')} hitSlop={10}>
      <Text style={{ color: colors.onSurface, fontSize: 20 }}>{value === 'grid' ? '☰' : '▦'}</Text>
    </Pressable>
  );
}
