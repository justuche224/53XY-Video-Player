import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { OverflowMenuSheet, type OverflowAction } from './overflow-menu-sheet';
import { useTheme } from '@/theme/theme-provider';

export type { OverflowAction } from './overflow-menu-sheet';

export function ContextualAppBar({
  selectedCount,
  onClearSelection,
  onPlay,
  onShare,
  onDelete,
  overflowActions,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  /** Omit to hide the Play icon — used when Play has no single unambiguous target. */
  onPlay?: () => void;
  onShare: () => void;
  onDelete: () => void;
  overflowActions: OverflowAction[];
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={[
          styles.pinned,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.sm,
            backgroundColor: colors.surfaceContainerHigh ?? colors.surfaceVariant,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.outlineVariant ?? 'transparent',
          },
        ]}>
        <View style={[styles.row, { gap: spacing.xs, minHeight: 48, paddingBottom: spacing.sm }]}>
          <IconButton
            name="close"
            onPress={onClearSelection}
            accessibilityLabel="Clear selection"
          />
          <AppText variant="title" style={{ flex: 1, paddingLeft: spacing.xs }}>
            {selectedCount}
          </AppText>
          {onPlay ? (
            <IconButton name="play-outline" onPress={onPlay} accessibilityLabel="Play selected" />
          ) : null}
          <IconButton name="share-outline" onPress={onShare} accessibilityLabel="Share selected" />
          <IconButton name="trash-outline" onPress={onDelete} accessibilityLabel="Delete selected" />
          {overflowActions.length > 0 ? (
            <IconButton
              name="ellipsis-vertical"
              onPress={() => setOverflowOpen(true)}
              accessibilityLabel="More actions"
            />
          ) : null}
        </View>
      </Animated.View>
      <OverflowMenuSheet
        visible={overflowOpen}
        actions={overflowActions}
        onClose={() => setOverflowOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
