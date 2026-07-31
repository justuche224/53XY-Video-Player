import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { ListItem } from '@/components/list-item';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { useTheme } from '@/theme/theme-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Settings" />
      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl + TAB_BAR_CLEARANCE }}
        bounces
        overScrollMode="always"
      >
        <SettingsGroup>
          <ListItem icon="play-circle-outline" title="Player" subtitle="Background play, Picture in Picture" onPress={() => router.push('/settings/player' as any)} />
          <ListItem icon="funnel-outline" title="Library filters" subtitle="Hide videos by length or name" onPress={() => router.push('/settings/library-filters' as any)} />
          <ListItem icon="folder-outline" title="Hidden folders" subtitle="Choose which folders appear" onPress={() => router.push('/settings/hidden-folders' as any)} />
        </SettingsGroup>
        <SettingsGroup>
          <ListItem icon="information-circle-outline" title="About" subtitle="Version & info" onPress={() => router.push('/settings/about' as any)} />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
