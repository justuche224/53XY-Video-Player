import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { FolderIgnoreList, type FolderEntry } from '@/components/folder-ignore-list';
import { Screen } from '@/components/screen';
import { useFilterSettings } from '@/library/filter-settings';
import { groupByFolder } from '@/library/group-videos';
import { useLibraryData } from '@/library/library-provider';
import { useTheme } from '@/theme/theme-provider';

export default function HiddenFoldersScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { filter, toggleFolder } = useFilterSettings();
  const { videos: allVideos, manualGroups } = useLibraryData();
  const folderEntries = useMemo<FolderEntry[]>(
    () =>
      groupByFolder(allVideos, manualGroups)
        .map((g) => ({ path: g.key, name: g.title, count: g.count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allVideos, manualGroups],
  );

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Hidden folders" variant="detail" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} bounces overScrollMode="always">
        <FolderIgnoreList folders={folderEntries} ignoredFolders={filter.ignoredFolders} onToggle={toggleFolder} />
      </ScrollView>
    </Screen>
  );
}
