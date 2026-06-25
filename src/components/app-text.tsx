import { Text, type TextProps } from 'react-native';

import { TYPOGRAPHY, type TypeVariant } from '@/theme/typography';
import { useTheme } from '@/theme/theme-provider';

export function AppText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; color?: string }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[TYPOGRAPHY[variant], { color: color ?? colors.onSurface }, style]} />;
}
