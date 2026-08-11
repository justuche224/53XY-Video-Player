import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { useTheme } from '@/theme/theme-provider';

export function ContextualAppBar({
  selectedCount,
  onClearSelection,
  onPlay,
  onMarkPlayed,
  onMarkUnplayed,
  onAddToPlaylist,
  onUngroup,
  onShare,
  onDelete,
  onInfo,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  onPlay?: () => void;
  onMarkPlayed?: () => void;
  onMarkUnplayed?: () => void;
  onAddToPlaylist?: () => void;
  onUngroup?: () => void;
  onShare: () => void;
  onDelete: () => void;
  onInfo?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
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
        {onMarkPlayed ? (
          <IconButton name="checkmark-done-circle-outline" onPress={onMarkPlayed} accessibilityLabel="Mark as played" />
        ) : null}
        {onMarkUnplayed ? (
          <IconButton name="ellipse-outline" onPress={onMarkUnplayed} accessibilityLabel="Mark as unplayed" />
        ) : null}
        {onAddToPlaylist ? (
          <IconButton name="list-outline" onPress={onAddToPlaylist} accessibilityLabel="Add to playlist" />
        ) : null}
        {onUngroup ? (
          <IconButton name="folder-open-outline" onPress={onUngroup} accessibilityLabel="Move to group" />
        ) : null}
        {onInfo && selectedCount === 1 ? (
          <IconButton name="information-circle-outline" onPress={onInfo} accessibilityLabel="View info" />
        ) : null}
        <IconButton name="share-outline" onPress={onShare} accessibilityLabel="Share selected" />
        <IconButton name="trash-outline" onPress={onDelete} accessibilityLabel="Delete selected" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
