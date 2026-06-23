// src/app/(tabs)/index.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { GroupCard } from '@/components/group-card';
import { GroupRow } from '@/components/group-row';
import { LayoutToggle } from '@/components/layout-toggle';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchBar } from '@/components/search-bar';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { SortButton } from '@/components/sort-button';
import { SortSheet } from '@/components/sort-sheet';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { getHistory } from '@/db/history-repo';
import { resolveLastPlayed } from '@/player/resume-last';
import { ResumeFab } from '@/components/resume-fab';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { filterGroups } from '@/library/filter-groups';
import { sortGroups, SORT_KEYS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useLibrary } from '@/library/use-library';
import { useLibraryData } from '@/library/library-provider';
import type { Group, LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

type Mode = 'name' | 'folder';
type Layout = 'grid' | 'list';

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
  const { videos } = useLibraryData();
  const [resumeTarget, setResumeTarget] = useState<LibraryVideo | null>(null);

  useEffect(() => {
    getSetting(db, 'mode').then((v) => v === 'folder' && setMode('folder'));
    getSetting(db, 'layout').then((v) => v === 'list' && setLayout('list'));
    getSetting(db, 'sort.key').then((v) => {
      if (v && (SORT_KEYS as string[]).includes(v)) setSortKey(v as SortKey);
    });
    getSetting(db, 'sort.dir').then((v) => v === 'desc' && setSortDir('desc'));
  }, [db]);

  // On focus (e.g. returning from the player), refetch progress so resume bars
  // update, and recompute the Resume FAB target from history + the live cache.
  useFocusEffect(
    useCallback(() => {
      if (status !== 'ready') return;
      getProgressMap(db).then(setProgress);
      getHistory(db).then((rows) => {
        const byId = new Map(videos.map((v) => [v.id, v]));
        setResumeTarget(resolveLastPlayed(rows, byId));
      });
    }, [db, status, videos]),
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

  const onResume = useCallback(() => {
    if (!resumeTarget) return;
    const group = groups.find((g) => g.items.some((it) => it.id === resumeTarget.id));
    const params =
      group && group.count > 1
        ? { videoId: resumeTarget.id, uri: resumeTarget.uri, title: resumeTarget.filename, groupKey: group.key, mode }
        : { videoId: resumeTarget.id, uri: resumeTarget.uri, title: resumeTarget.filename };
    router.push({ pathname: '/player', params });
  }, [resumeTarget, groups, mode, router]);

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
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <ScreenHeader
        title="53XY"
        accessory={refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceVariant ?? '#222', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, gap: 16 }}>
            <SortButton sortKey={sortKey} sortDir={sortDir} onPress={() => setSortOpen(true)} />
            <LayoutToggle value={layout} onChange={onLayout} />
          </View>
        }
      />
      <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
        <SegmentedTabs value={mode} onChange={onMode} />
      </View>
      {status === 'denied' ? (
        <Text style={{ color: colors.onSurface }}>Media permission denied. Enable it in system settings.</Text>
      ) : (
        <FlashList
          key={layout}
          data={visible}
          keyExtractor={(g) => g.key}
          numColumns={layout === 'grid' ? 2 : 1}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
              <Ionicons name={refreshing ? 'sync-outline' : 'folder-open-outline'} size={64} color={colors.surfaceVariant ?? '#444'} />
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
                {refreshing ? 'Scanning...' : status === 'ready' ? 'No videos found' : 'Loading...'}
              </Text>
              {status === 'ready' && !refreshing && (
                <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8 }}>
                  Try adjusting your filters or search query.
                </Text>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl + TAB_BAR_CLEARANCE }}
          bounces={true}
          overScrollMode="always"
        />
      )}
      <SortSheet
        visible={sortOpen}
        sortKey={sortKey}
        sortDir={sortDir}
        onSelect={onSort}
        onClose={() => setSortOpen(false)}
      />
      {resumeTarget ? <ResumeFab onPress={onResume} bottomOffset={TAB_BAR_CLEARANCE} /> : null}
    </Screen>
  );
}
