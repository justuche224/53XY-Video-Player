// src/app/(tabs)/settings.tsx
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CustomLengthDialog } from '@/components/custom-length-dialog';
import { FilterChips, type LengthPreset } from '@/components/filter-chips';
import { FolderIgnoreList, type FolderEntry } from '@/components/folder-ignore-list';
import { NamePatternList } from '@/components/name-pattern-list';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { getAllVideos } from '@/db/videos-repo';
import { applyFilters } from '@/library/filter-videos';
import { useFilterSettings } from '@/library/filter-settings';
import { groupByFolder } from '@/library/group-videos';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { SettingSwitch } from '@/components/setting-switch';

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
  const { backgroundPlay, setBackgroundPlay } = useBackgroundPlay();
  const { pictureInPicture, setPictureInPicture } = usePictureInPicture();
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
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Settings" />
      <ScrollView
        contentContainerStyle={{ gap: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing.xl * 2 + TAB_BAR_CLEARANCE }}
        bounces={true}
        overScrollMode="always"
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[styles.section, { color: colors.onSurface }]}>Player</Text>
          <SettingSwitch label="Play video in background" value={backgroundPlay} onValueChange={setBackgroundPlay} />
          <SettingSwitch label="Picture in Picture" value={pictureInPicture} onValueChange={setPictureInPicture} />

          <Text style={[styles.section, { color: colors.onSurface }]}>Library filters</Text>

          <View style={styles.labelRow}>
            <Ionicons name="time-outline" size={18} color={colors.onSurfaceVariant ?? '#aaa'} />
            <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hide videos shorter than</Text>
          </View>
          <FilterChips presets={MIN_PRESETS} value={filter.minDurationMs} onSelect={setMin} onCustom={() => setDialog('min')} />

          <View style={styles.labelRow}>
            <Ionicons name="hourglass-outline" size={18} color={colors.onSurfaceVariant ?? '#aaa'} />
            <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hide videos longer than</Text>
          </View>
          <FilterChips presets={MAX_PRESETS} value={filter.maxDurationMs} onSelect={setMax} onCustom={() => setDialog('max')} />

          <View style={styles.labelRow}>
            <Ionicons name="text-outline" size={18} color={colors.onSurfaceVariant ?? '#aaa'} />
            <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Ignore videos named</Text>
          </View>
          <NamePatternList patterns={filter.namePatterns} onAdd={addNamePattern} onRemove={removeNamePattern} />

          <View style={styles.labelRow}>
            <Ionicons name="folder-outline" size={18} color={colors.onSurfaceVariant ?? '#aaa'} />
            <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hidden folders</Text>
          </View>
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
  labelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  footer: { fontSize: 13, marginTop: 8 },
});
