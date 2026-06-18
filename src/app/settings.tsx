// src/app/settings.tsx
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomLengthDialog } from '@/components/custom-length-dialog';
import { FilterChips, type LengthPreset } from '@/components/filter-chips';
import { FolderIgnoreList, type FolderEntry } from '@/components/folder-ignore-list';
import { NamePatternList } from '@/components/name-pattern-list';
import { Screen } from '@/components/screen';
import { getAllVideos } from '@/db/videos-repo';
import { applyFilters } from '@/library/filter-videos';
import { useFilterSettings } from '@/library/filter-settings';
import { groupByFolder } from '@/library/group-videos';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

const MIN_PRESETS: LengthPreset[] = [
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
];

const MAX_PRESETS: LengthPreset[] = [
  { label: '1h', ms: 3_600_000 },
  { label: '2h', ms: 7_200_000 },
  { label: '3h', ms: 10_800_000 },
];

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const { filter, setMin, setMax, addNamePattern, removeNamePattern, toggleFolder } = useFilterSettings();
  const [dialog, setDialog] = useState<'min' | 'max' | null>(null);
  const [allVideos, setAllVideos] = useState<LibraryVideo[]>([]);

  // Load the full library once for the folder list + live "Hiding N videos" footer.
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((all) => {
        if (!cancelled) setAllVideos(all);
      })
      .catch(() => {
        // Non-essential; ignore read failures.
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const folderEntries = useMemo<FolderEntry[]>(
    () =>
      groupByFolder(allVideos)
        .map((g) => ({ path: g.key, name: g.title, count: g.count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allVideos],
  );

  const hidden = allVideos.length - applyFilters(allVideos, filter).length;

  return (
    <Screen style={{ paddingHorizontal: spacing.lg }}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Settings',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.onSurface,
          headerShadowVisible: false
        }} 
      />
      <ScrollView 
        contentContainerStyle={{ gap: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing.xl * 2 }}
        bounces={true}
        overScrollMode="always"
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[styles.section, { color: colors.onSurface }]}>Library filters</Text>

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hide videos shorter than</Text>
          <FilterChips presets={MIN_PRESETS} value={filter.minDurationMs} onSelect={setMin} onCustom={() => setDialog('min')} />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hide videos longer than</Text>
          <FilterChips presets={MAX_PRESETS} value={filter.maxDurationMs} onSelect={setMax} onCustom={() => setDialog('max')} />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Ignore videos named</Text>
          <NamePatternList patterns={filter.namePatterns} onAdd={addNamePattern} onRemove={removeNamePattern} />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hidden folders</Text>
          <FolderIgnoreList folders={folderEntries} ignoredFolders={filter.ignoredFolders} onToggle={toggleFolder} />

          <Text style={[styles.footer, { color: colors.onSurfaceVariant ?? '#888' }]}>
            {hidden > 0 ? `Hiding ${hidden} video${hidden === 1 ? '' : 's'}` : 'No videos hidden'}
          </Text>
        </View>
      </ScrollView>

      <CustomLengthDialog
        visible={dialog !== null}
        initialMs={dialog === 'min' ? filter.minDurationMs : dialog === 'max' ? filter.maxDurationMs : null}
        onCancel={() => setDialog(null)}
        onConfirm={(ms) => {
          if (dialog === 'min') setMin(ms);
          else if (dialog === 'max') setMax(ms);
          setDialog(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  footer: { fontSize: 13, marginTop: 8 },
});
