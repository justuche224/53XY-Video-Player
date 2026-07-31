import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import { SettingSwitch } from '@/components/setting-switch';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { useAutoplayNext } from '@/player/use-autoplay-next';
import { useTheme } from '@/theme/theme-provider';

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { backgroundPlay, setBackgroundPlay } = useBackgroundPlay();
  const { pictureInPicture, setPictureInPicture } = usePictureInPicture();
  const { autoplayNext, setAutoplayNext } = useAutoplayNext();
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Player" variant="detail" onBack={() => router.back()} />
      <View style={{ gap: spacing.lg }}>
        <SettingsGroup insetDividers={false}>
          <SettingSwitch label="Play video in background" value={backgroundPlay} onValueChange={setBackgroundPlay} />
          <SettingSwitch label="Picture in Picture" value={pictureInPicture} onValueChange={setPictureInPicture} />
          <SettingSwitch label="Autoplay next episode" value={autoplayNext} onValueChange={setAutoplayNext} />
        </SettingsGroup>
      </View>
    </Screen>
  );
}
