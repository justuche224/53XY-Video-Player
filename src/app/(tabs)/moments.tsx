import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBar } from '@/components/app-bar';
import { ContextualAppBar } from '@/components/contextual-app-bar';
import { MomentCard } from '@/components/moment-card';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SectionHeader } from '@/components/section-header';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { deleteMoments, getMoments } from '@/db/moments-repo';
import { useLibraryData } from '@/library/library-provider';
import { chunkMoments, filterMoments, groupMoments } from '@/moments/group-moments';
import { resolveMomentTarget } from '@/moments/resolve-moment-video';
import { deleteFrame, ensureMomentsDir, writeManifest } from '@/moments/storage';
import type { Moment } from '@/moments/types';
import { shareFiles } from '@/moments/share-moments';
import { useTheme } from '@/theme/theme-provider';

const PER_ROW = 2;

export default function MomentsScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { videos } = useLibraryData();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    getMoments(db)
      .then(setMoments)
      .catch((e) => console.warn('[moments] failed to load moments:', e));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(
    () =>
      filterMoments(groupMoments(moments), query).map((s) => ({
        ...s,
        data: chunkMoments(s.data, PER_ROW),
      })),
    [moments, query],
  );

  // A moment whose file is gone still renders — only playback is disabled.
  const missingIds = useMemo(() => {
    const out = new Set<string>();
    for (const m of moments) {
      if (resolveMomentTarget(m, videos).kind === 'missing') out.add(m.id);
    }
    return out;
  }, [moments, videos]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openMoment = useCallback(
    (moment: Moment) => {
      if (selected.size > 0) {
        toggleSelect(moment.id);
        return;
      }
      router.push({ pathname: '/moment', params: { momentId: moment.id } });
    },
    [router, selected.size, toggleSelect],
  );

  const onDelete = useCallback(() => {
    const ids = [...selected];
    if (ids.length === 0) return;
    Alert.alert(
      'Delete moments',
      `Delete ${ids.length} moment${ids.length === 1 ? '' : 's'}? The saved frames go too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const doomed = moments.filter((m) => selected.has(m.id));
            for (const m of doomed) deleteFrame(m.frameUri);
            await deleteMoments(db, ids);
            const remaining = await getMoments(db);
            setMoments(remaining);
            clearSelection();
            try {
              writeManifest(ensureMomentsDir(), remaining);
            } catch (e) {
              console.warn('[moments] failed to rewrite manifest after delete:', e);
            }
          },
        },
      ],
    );
  }, [clearSelection, db, moments, selected]);

  const onShare = useCallback(() => {
    const uris = moments.filter((m) => selected.has(m.id) && m.frameUri).map((m) => m.frameUri!);
    void shareFiles(uris);
    clearSelection();
  }, [clearSelection, moments, selected]);

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      {selected.size > 0 ? (
        <ContextualAppBar
          selectedCount={selected.size}
          onClearSelection={clearSelection}
          onShare={onShare}
          onDelete={onDelete}
          overflowActions={[]}
        />
      ) : (
        <AppBar title="Moments" />
      )}

      <View style={{ marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((m) => m.id).join('-')}
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            {row.map((m) => (
              <MomentCard
                key={m.id}
                moment={m}
                selected={selected.has(m.id)}
                missing={missingIds.has(m.id)}
                onPress={() => openMoment(m)}
                onLongPress={() => toggleSelect(m.id)}
              />
            ))}
            {/* Keeps a short final row's card at half width instead of stretching it. */}
            {row.length < PER_ROW &&
              Array.from({ length: PER_ROW - row.length }).map((_, i) => (
                <View key={`filler-${i}`} style={{ flex: 1 }} />
              ))}
          </View>
        )}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="bookmark-outline" size={64} color={colors.onSurfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No moments yet
            </Text>
            <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8, textAlign: 'center' }}>
              Tap the bookmark button while watching to save a scene.
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
