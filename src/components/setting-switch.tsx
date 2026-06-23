import { Switch, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function SettingSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, { paddingVertical: spacing.sm }]}>
      <Text style={[styles.label, { color: colors.onSurface }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.surfaceVariant }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
});
