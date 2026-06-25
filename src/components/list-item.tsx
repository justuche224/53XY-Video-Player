import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

export function ListItem({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  icon?: IoniconName;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const { colors, spacing, radius, icon: iconSize } = useTheme();
  const showChevron = !!onPress && trailing === undefined;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.row, { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radius.md }]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222', borderRadius: radius.pill }]}>
          <Ionicons name={icon} size={iconSize.md} color={colors.onSurfaceVariant ?? colors.onSurface} />
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>{subtitle}</AppText> : null}
      </View>
      {trailing !== undefined ? trailing : null}
      {showChevron ? <Ionicons name="chevron-forward" size={iconSize.md} color={colors.onSurfaceVariant ?? colors.onSurface} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
