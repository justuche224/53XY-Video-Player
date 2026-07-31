// src/app/(tabs)/index.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { GroupCard } from '@/components/group-card';
import { GroupRow } from '@/components/group-row';
import { HomeHeader } from '@/components/home-header';
import { HomeHero, HomeHeroPlaceholder, type HeroKind } from '@/components/home-hero';
import { Screen } from '@/components/screen';
import { SortSheet } from '@/components/sort-sheet';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { getHistory } from '@/db/history-repo';
import { resolveLastPlayed } from '@/player/resume-last';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { filterGroups } from '@/library/filter-groups';
import { sortGroups, SORT_KEYS, type SortDir, type SortKey } from '@/library/sort-groups';
import { useLibrary } from '@/library/use-library';
import { useLibraryData } from '@/library/library-provider';
import type { Group, LibraryVideo } from '@/library/types';
import { headerSolidThreshold, heroHeight } from '@/theme/layout';
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

/** Newest thing in the library — the hero's subject when nothing is resumable. */
function newestVideo(videos: LibraryVideo[]): LibraryVideo | null {
  let best: LibraryVideo | null = null;
  for (const v of videos) {
    if (!best || (v.modifiedAt ?? 0) > (best.modifiedAt ?? 0)) best = v;
  }
  return best;
}

export default function LibraryScreen() {
  const { colors, spacing, isDark } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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

  // Tab screens stay mounted when you leave them, and expo-status-bar applies the
  // last <StatusBar> still mounted — so Home's forced-light style would follow you
  // to Settings under a light theme. Unmounting it on blur hands control back to
  // the themed root bar.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Header backdrop: 0 = floating over the hero artwork, 1 = over the page. Driven
  // by a single boolean threshold crossing rather than a per-frame scroll handler,
  // so scrolling stays free of JS work.
  const headerProgress = useSharedValue(0);
  const [headerSolid, setHeaderSolid] = useState(false);
  const solidRef = useRef(false);
  const headerHeightRef = useRef(0);
  const hero = heroHeight(windowHeight, insets.top);

  useEffect(() => {
    getSetting(db, 'mode').then((v) => v === 'folder' && setMode('folder'));
    getSetting(db, 'layout').then((v) => v === 'list' && setLayout('list'));
    getSetting(db, 'sort.key').then((v) => {
      if (v && (SORT_KEYS as string[]).includes(v)) setSortKey(v as SortKey);
    });
    getSetting(db, 'sort.dir').then((v) => v === 'desc' && setSortDir('desc'));
  }, [db]);

  // On focus (e.g. returning from the player), refetch progress so resume bars
  // update, and recompute the hero target from history + the live cache.
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

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const threshold = headerSolidThreshold(hero, headerHeightRef.current);
      const next = e.nativeEvent.contentOffset.y > threshold;
      if (next === solidRef.current) return;
      solidRef.current = next;
      headerProgress.value = withTiming(next ? 1 : 0, { duration: 180 });
      setHeaderSolid(next);
    },
    [hero, headerProgress],
  );

  // The hero shows what you were watching; failing that, the newest thing you have.
  const heroVideo = resumeTarget ?? newestVideo(videos);
  const heroKind: HeroKind = resumeTarget ? 'continue' : 'recent';

  const groupOf = useCallback(
    (video: LibraryVideo) => groups.find((g) => g.items.some((it) => it.id === video.id)),
    [groups],
  );

  // Scanning every group's items is O(library), so it must not run per render.
  const heroGroup = useMemo(
    () => (heroVideo ? groupOf(heroVideo) : undefined),
    [heroVideo, groupOf],
  );

  const openVideo = useCallback(
    (video: LibraryVideo) => {
      const group = groupOf(video);
      const params =
        group && group.count > 1
          ? { videoId: video.id, uri: video.uri, title: video.filename, groupKey: group.key, mode }
          : { videoId: video.id, uri: video.uri, title: video.filename };
      router.push({ pathname: '/player', params });
    },
    [groupOf, mode, router],
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

  // Grid cards carry their own 8dp margin, so the gutter is split between the two;
  // rows have none and take the full inset from the container.
  const gutter = layout === 'grid' ? spacing.sm : spacing.lg;

  const listHeader = (
    <View style={{ marginHorizontal: -gutter }}>
      {status === 'denied' ? (
        <HomeHeroPlaceholder
          message="Media permission denied"
          hint="Enable it in system settings to scan your library."
        />
      ) : heroVideo ? (
        <HomeHero
          video={heroVideo}
          kind={heroKind}
          percent={progress.get(heroVideo.id)?.percent ?? 0}
          onPlay={() => openVideo(heroVideo)}
          onOpenGroup={
            heroGroup && heroGroup.count > 1 ? () => openGroup(heroGroup) : undefined
          }
        />
      ) : (
        <HomeHeroPlaceholder
          message={refreshing ? 'Scanning your library…' : status === 'ready' ? 'No videos found' : 'Loading…'}
          hint={status === 'ready' && !refreshing ? 'Try adjusting your filters or search query.' : undefined}
        />
      )}
    </View>
  );

  return (
    <Screen edges={['left', 'right']}>
      {/* Always light over the hero artwork; follows the theme once the header
          picks up its solid background. */}
      {focused ? <StatusBar style={headerSolid ? (isDark ? 'light' : 'dark') : 'light'} /> : null}

      <FlashList
        key={layout}
        data={visible}
        keyExtractor={(g) => g.key}
        numColumns={layout === 'grid' ? 2 : 1}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={32}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          heroVideo ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm }}>
              <Ionicons
                name={refreshing ? 'sync-outline' : 'folder-open-outline'}
                size={56}
                color={colors.surfaceVariant ?? '#444'}
              />
              <AppText variant="headline">
                {refreshing ? 'Scanning…' : status === 'ready' ? 'No videos found' : 'Loading…'}
              </AppText>
              {status === 'ready' && !refreshing ? (
                <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface}>
                  Try adjusting your filters or search query.
                </AppText>
              ) : null}
            </View>
          ) : null
        }
        contentContainerStyle={{
          paddingHorizontal: gutter,
          // The screen drops its bottom safe-area edge so the list can scroll
          // under the tab bar, so that inset is repaid here instead.
          paddingBottom: spacing.xl + TAB_BAR_CLEARANCE + insets.bottom,
        }}
        bounces={true}
        overScrollMode="always"
      />

      <HomeHeader
        progress={headerProgress}
        query={query}
        onQueryChange={setQuery}
        mode={mode}
        onModeChange={onMode}
        layout={layout}
        onLayoutChange={onLayout}
        onSortPress={() => setSortOpen(true)}
        refreshing={refreshing}
        onHeightChange={(h) => (headerHeightRef.current = h)}
      />

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
