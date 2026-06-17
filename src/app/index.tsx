// src/app/index.tsx
import { Link, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { GroupCard } from '@/components/group-card';
import { GroupRow } from '@/components/group-row';
import { LayoutToggle } from '@/components/layout-toggle';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { computeProgressPercent } from '@/db/progress';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { filterGroups } from '@/library/filter-groups';
import { useLibrary } from '@/library/use-library';
import type { Group } from '@/library/types';
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
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const { status, groups } = useLibrary(mode);

  useEffect(() => {
    getSetting(db, 'mode').then((v) => v === 'folder' && setMode('folder'));
    getSetting(db, 'layout').then((v) => v === 'list' && setLayout('list'));
  }, [db]);

  useEffect(() => {
    if (status === 'ready') getProgressMap(db).then(setProgress);
  }, [db, status]);

  const onMode = useCallback((v: Mode) => { setMode(v); setSetting(db, 'mode', v); }, [db]);
  const onLayout = useCallback((v: Layout) => { setLayout(v); setSetting(db, 'layout', v); }, [db]);

  const visible = useMemo(() => filterGroups(groups, query), [groups, query]);

  const openGroup = useCallback((group: Group) => {
    if (group.count === 1) {
      const v = group.items[0];
      router.push({ pathname: '/player', params: { videoId: v.id, uri: v.uri, title: v.filename } });
    } else {
      router.push({ pathname: '/group', params: { key: group.key, mode } });
    }
  }, [router, mode]);

  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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
          renderItem={({ item }) =>
            layout === 'grid' ? (
              <GroupCard group={item} percent={groupPercent(item, progress)} onPress={() => openGroup(item)} />
            ) : (
              <GroupRow group={item} percent={groupPercent(item, progress)} onPress={() => openGroup(item)} />
            )
          }
          ListEmptyComponent={
            <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface }}>
              {status === 'ready' ? 'No videos found.' : 'Loading…'}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
});
