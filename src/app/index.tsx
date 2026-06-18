// src/app/index.tsx
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { GroupCard } from '@/components/group-card';
import { GroupRow } from '@/components/group-row';
import { LayoutToggle } from '@/components/layout-toggle';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { SortButton } from '@/components/sort-button';
import { SortSheet } from '@/components/sort-sheet';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { filterGroups } from '@/library/filter-groups';
import { sortGroups, SORT_KEYS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useLibrary } from '@/library/use-library';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

type Mode = 'name' | 'folder';
type Layout = 'grid' | 'list';

// List rows are fixed height (60px thumb + 8px vertical padding each side),
// so getItemLayout can skip measurement — the biggest list-scroll win.
const LIST_ROW_HEIGHT = 76;

function groupPercent(group: Group, progress: ProgressMap): number {
  // Show the most-recently-watched item's progress on the group.
  let best = 0;
  for (const item of group.items) {
    const p = progress.get(item.id);
    if (p && p.percent > 0 && p.percent < 0.99) best = Math.max(best, p.percent);
  }
  return best;
}

export default function LibraryScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('name');
  const [layout, setLayout] = useState<Layout>('grid');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const { status, refreshing, groups } = useLibrary(mode);

  useEffect(() => {
    getSetting(db, 'mode').then((v) => v === 'folder' && setMode('folder'));
    getSetting(db, 'layout').then((v) => v === 'list' && setLayout('list'));
    getSetting(db, 'sort.key').then((v) => {
      if (v && (SORT_KEYS as string[]).includes(v)) setSortKey(v as SortKey);
    });
    getSetting(db, 'sort.dir').then((v) => v === 'desc' && setSortDir('desc'));
  }, [db]);

  // Refetch progress every time the screen regains focus (e.g. returning from
  // the player), so resume bars update without an app reload.
  useFocusEffect(
    useCallback(() => {
      if (status === 'ready') getProgressMap(db).then(setProgress);
    }, [db, status]),
  );

  const onMode = useCallback((v: Mode) => { setMode(v); setSetting(db, 'mode', v); }, [db]);
  const onLayout = useCallback((v: Layout) => { setLayout(v); setSetting(db, 'layout', v); }, [db]);

  const onSort = useCallback(
    (key: SortKey, dir: SortDir) => {
      setSortKey(key);
      setSortDir(dir);
      setSetting(db, 'sort.key', key);
      setSetting(db, 'sort.dir', dir);
    },
    [db],
  );

  const visible = useMemo(
    () => sortGroups(filterGroups(groups, query), { key: sortKey, dir: sortDir }),
    [groups, query, sortKey, sortDir],
  );

  const openGroup = useCallback((group: Group) => {
    if (group.count === 1) {
      const v = group.items[0];
      router.push({ pathname: '/player', params: { videoId: v.id, uri: v.uri, title: v.filename } });
    } else {
      router.push({ pathname: '/group', params: { key: group.key, mode } });
    }
  }, [router, mode]);

  const renderItem = useCallback(
    ({ item }: { item: Group }) =>
      layout === 'grid' ? (
        <GroupCard group={item} percent={groupPercent(item, progress)} onPress={() => openGroup(item)} />
      ) : (
        <GroupRow group={item} percent={groupPercent(item, progress)} onPress={() => openGroup(item)} />
      ),
    [layout, progress, openGroup],
  );

  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <SortButton sortKey={sortKey} sortDir={sortDir} onPress={() => setSortOpen(true)} />
          <LayoutToggle value={layout} onChange={onLayout} />
          <Link href="/settings" style={{ color: colors.primary, fontWeight: '600' }}>Settings</Link>
        </View>
      </View>
      <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
        <SegmentedTabs value={mode} onChange={onMode} />
      </View>
      {status === 'denied' ? (
        <Text style={{ color: colors.onSurface }}>Media permission denied. Enable it in system settings.</Text>
      ) : (
        <FlatList
          key={layout}
          data={visible}
          keyExtractor={(g) => g.key}
          numColumns={layout === 'grid' ? 2 : 1}
          renderItem={renderItem}
          initialNumToRender={layout === 'grid' ? 8 : 10}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          getItemLayout={
            layout === 'list'
              ? (_, index) => ({ length: LIST_ROW_HEIGHT, offset: LIST_ROW_HEIGHT * index, index })
              : undefined
          }
          ListEmptyComponent={
            <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface }}>
              {refreshing ? 'Scanning…' : status === 'ready' ? 'No videos found.' : 'Loading…'}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
      <SortSheet
        visible={sortOpen}
        sortKey={sortKey}
        sortDir={sortDir}
        onSelect={onSort}
        onClose={() => setSortOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
});
