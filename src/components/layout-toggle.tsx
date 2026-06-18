// src/components/layout-toggle.tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function LayoutToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(value === 'grid' ? 'list' : 'grid')} hitSlop={10} style={{ padding: 4 }}>
      <Ionicons name={value === 'grid' ? 'list-outline' : 'grid-outline'} size={20} color={colors.onSurface} />
    </Pressable>
  );
}
