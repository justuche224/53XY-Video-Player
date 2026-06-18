import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatLengthShort } from '@/library/filter-videos';
import { useTheme } from '@/theme/theme-provider';

export interface LengthPreset {
  label: string;
  ms: number;
}

export function FilterChips({
  presets,
  value,
  onSelect,
  onCustom,
}: {
  presets: LengthPreset[];
  value: number | null; // active ms; null = "Off"
  onSelect: (ms: number | null) => void;
  onCustom: () => void;
}) {
  const { colors, radius } = useTheme();
  const isPreset = value != null && presets.some((p) => p.ms === value);
  const customActive = value != null && !isPreset;

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: active ? colors.primary : colors.surfaceVariant ?? '#222',
        },
      ]}>
      <Text style={{ color: active ? colors.onPrimary ?? '#fff' : colors.onSurface, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {chip('off', 'Off', value == null, () => onSelect(null))}
      {presets.map((p) => chip(p.label, p.label, value === p.ms, () => onSelect(p.ms)))}
      {chip('custom', customActive ? formatLengthShort(value) : 'Custom…', customActive, onCustom)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8 },
});
