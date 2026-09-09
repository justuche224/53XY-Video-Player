import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/app-bar';
import { ContextualAppBar } from '@/components/contextual-app-bar';
import { MomentCard } from '@/components/moment-card';
import { MomentsEmptyState } from '@/components/onboarding/moments-empty-state';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SectionHeader } from '@/components/section-header';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { deleteMoments, getMoments } from '@/db/moments-repo';
import { useLibraryData } from '@/library/library-provider';
import { chunkMoments, filterMoments, groupMoments } from '@/moments/group-moments';
import { pendingRestoreCount, restoreMomentsFromManifest, syncManifest } from '@/moments/moments-store';
import { resolveMomentTarget } from '@/moments/resolve-moment-video';
import { deleteFrame } from '@/moments/storage';
import type { Moment } from '@/moments/types';
import { shareFiles } from '@/moments/share-moments';
import { useTheme } from '@/theme/theme-provider';

const PER_ROW = 2;

export default function MomentsScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { videos } = useLibraryData();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restorable, setRestorable] = useState(0);

  const load = useCallback(() => {
    getMoments(db)
      .then((loaded) => {
        setMoments(loaded);
        // A moment deleted elsewhere (e.g. the detail screen) while it was
        // part of an active selection must not linger in `selected` — that
        // would overcount the ContextualAppBar and the delete-confirmation
        // copy even though the underlying operations stay safe.
        const ids = new Set(loaded.map((m) => m.id));
        setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
      })
      .catch((e) => console.warn('[moments] failed to load moments:', e));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
      pendingRestoreCount(db)
        .then(setRestorable)
        .catch((e) => console.warn('[moments] could not check for a backup:', e));
    }, [db, load]),
  );

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
            // Rows first, then the files: if the database delete throws, the
            // frames survive and the rows still resolve to them — leaked
            // JPEGs nothing references, invisible to the user. Deleting the
            // frames first risks the opposite: rows that outlive their files
            // and render permanently broken. Do not reorder this. Mirrors
            // src/app/moment.tsx's onDelete.
            try {
              await deleteMoments(db, ids);
              for (const m of doomed) deleteFrame(m.frameUri);
              const remaining = await getMoments(db);
              setMoments(remaining);
              clearSelection();
              await syncManifest(db);
            } catch (e) {
              console.warn('[moments] failed to delete moments:', e);
              Alert.alert('Delete failed', 'Something went wrong deleting these moments. Please try again.');
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
    <Screen
      edges={['left', 'right']}
      style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.lg }}>
      <AppBar title="Moments" />
      {selected.size > 0 && (
        <ContextualAppBar
          selectedCount={selected.size}
          onClearSelection={clearSelection}
          onShare={onShare}
          onDelete={onDelete}
          overflowActions={[]}
        />
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
          <MomentsEmptyState
            restoreSlot={
              restorable > 0 ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8, textAlign: 'center' }}>
                    {restorable === 1
                      ? '1 moment was found in your backup folder.'
                      : `${restorable} moments were found in your backup folder.`}
                  </Text>
                  <PressableScale
                    onPress={() => {
                      restoreMomentsFromManifest(db)
                        .then(() => {
                          load();
                          setRestorable(0);
                        })
                        .catch((e) => {
                          console.warn('[moments] restore failed:', e);
                          Alert.alert('Restore failed', 'Could not read the moments backup folder.');
                        });
                    }}
                    style={{ marginTop: spacing.lg }}>
                    <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>
                      Restore them
                    </Text>
                  </PressableScale>
                </View>
              ) : null
            }
          />
        }
        contentContainerStyle={{ paddingBottom: spacing.xl + TAB_BAR_CLEARANCE + insets.bottom }}
        bounces
        overScrollMode="always"
      />
    </Screen>
  );
}
