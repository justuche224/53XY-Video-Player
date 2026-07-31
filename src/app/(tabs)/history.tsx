import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBar } from '@/components/app-bar';
import { HistoryRow } from '@/components/history-row';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { clearHistory, getHistory, removeHistory, type HistoryRow as HistoryRowData } from '@/db/history-repo';
import { assembleHistory, filterHistory } from '@/history/assemble-history';
import type { HistoryItem } from '@/history/types';
import { useLibraryData } from '@/library/library-provider';
import { useTheme } from '@/theme/theme-provider';

export default function HistoryScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { videos } = useLibraryData();
  const [rows, setRows] = useState<HistoryRowData[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    getHistory(db).then(setRows);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(
    () => filterHistory(assembleHistory(rows, videos, Date.now()), query),
    [rows, videos, query],
  );

  const onRemove = useCallback(
    (videoId: string) => {
      setRows((prev) => prev.filter((r) => r.videoId !== videoId));
      removeHistory(db, videoId);
    },
    [db],
  );

  const onClearAll = useCallback(() => {
    if (rows.length === 0) return;
    Alert.alert('Clear watch history', 'Remove every video from your history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          setRows([]);
          clearHistory(db);
        },
      },
    ]);
  }, [db, rows.length]);

  const openVideo = useCallback(
    (item: HistoryItem) => {
      const v = item.video;
      router.push({ pathname: '/player', params: { videoId: v.id, uri: v.uri, title: v.filename } });
    },
    [router],
  );

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar
        title="History"
        right={
          <IconButton name="trash-outline" onPress={onClearAll} accessibilityLabel="Clear history" />
        }
      />

      <View style={{ marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.video.id}
        renderItem={({ item }) => (
          <HistoryRow
            video={item.video}
            percent={item.percent}
            onPress={() => openVideo(item)}
            onRemove={() => onRemove(item.video.id)}
          />
        )}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="time-outline" size={64} color={colors.onSurfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No watch history yet
            </Text>
            <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8 }}>
              Videos you play will show up here.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl + TAB_BAR_CLEARANCE }}
        bounces
        overScrollMode="always"
      />
    </Screen>
  );
}
