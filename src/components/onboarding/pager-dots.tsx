import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export function PagerDots({ count, index }: { count: number; index: number }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${count}`}
      style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 6,
            // The active dot stretches rather than growing a second hue —
            // one accent, and shape carries the state.
            width: i === index ? 20 : 6,
            borderRadius: radius.pill,
            backgroundColor:
              i === index ? colors.primary : colors.surfaceContainerHighest ?? colors.surfaceVariant,
          }}
        />
      ))}
    </View>
  );
}
