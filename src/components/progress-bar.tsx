import { View } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function ProgressBar({ percent }: { percent: number }) {
  const { colors } = useTheme();
  if (percent <= 0) return null;
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceVariant ?? '#333', overflow: 'hidden' }}>
      <View style={{ height: 3, width: `${Math.min(100, percent * 100)}%`, backgroundColor: colors.primary }} />
    </View>
  );
}
