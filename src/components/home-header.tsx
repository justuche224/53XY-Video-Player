import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLEAR, Gradient } from './gradient';
import { IconButton } from './icon-button';
import { SearchBar } from './search-bar';
import { SegmentedTabs } from './segmented-tabs';
import { Wordmark } from './wordmark';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export type LibraryMode = 'name' | 'folder';
export type LibraryLayout = 'grid' | 'list';

/**
 * The pinned Home header: wordmark + actions, with the Videos/Folders tabs
 * directly beneath, both floating over the hero banner.
 *
 * Two stacked backdrops cross-fade on `progress` (0 = over artwork, 1 = over the
 * page): a top-down scrim that makes white content legible on any frame, and a
 * solid `background` layer with a hairline for once the hero has scrolled away.
 * Only the wordmark changes colour between those states — every control here is a
 * fixed dark chip that reads correctly against both, which keeps the header to a
 * single colour interpolation.
 */
export function HomeHeader({
  progress,
  query,
  onQueryChange,
  mode,
  onModeChange,
  layout,
  onLayoutChange,
  onSortPress,
  refreshing,
  onHeightChange,
}: {
  progress: SharedValue<number>;
  query: string;
  onQueryChange: (v: string) => void;
  mode: LibraryMode;
  onModeChange: (v: LibraryMode) => void;
  layout: LibraryLayout;
  onLayoutChange: (v: LibraryLayout) => void;
  onSortPress: () => void;
  refreshing: boolean;
  onHeightChange: (height: number) => void;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  // Open when the user taps search, and kept open while a query is active so
  // results never show with no visible way to clear them.
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = searchOpen || query.length > 0;

  const scrimStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const solidStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View
      style={styles.pinned}
      onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}
      pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <Gradient
          style={StyleSheet.absoluteFill}
          stops={[
            { color: 'rgba(0,0,0,0.62)', at: '0%' },
            { color: 'rgba(0,0,0,0.34)', at: '55%' },
            { color: CLEAR, at: '100%' },
          ]}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          solidStyle,
          {
            backgroundColor: colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.outlineVariant ?? colors.surfaceVariant ?? 'transparent',
          },
        ]}
      />

      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }}>
        <View style={[styles.row, { gap: spacing.sm, minHeight: 48 }]}>
          {showSearch ? (
            <View style={styles.grow}>
              <SearchBar
                value={query}
                onChangeText={onQueryChange}
                tone="artwork"
                autoFocus
                onClose={() => setSearchOpen(false)}
              />
            </View>
          ) : (
            <>
              <Wordmark progress={progress} />
              {refreshing ? (
                <ActivityIndicator size="small" color={ON_ARTWORK.secondary} />
              ) : null}
              <View style={styles.grow} />
              <IconButton
                name="search"
                tone="artwork"
                onPress={() => setSearchOpen(true)}
                accessibilityLabel="Search library"
              />
              <IconButton
                name="swap-vertical"
                tone="artwork"
                onPress={onSortPress}
                accessibilityLabel="Sort library"
              />
              <IconButton
                name={layout === 'grid' ? 'list-outline' : 'grid-outline'}
                tone="artwork"
                onPress={() => onLayoutChange(layout === 'grid' ? 'list' : 'grid')}
                accessibilityLabel={layout === 'grid' ? 'Switch to list' : 'Switch to grid'}
              />
            </>
          )}
        </View>

        <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.md }}>
          <SegmentedTabs value={mode} onChange={onModeChange} tone="artwork" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
