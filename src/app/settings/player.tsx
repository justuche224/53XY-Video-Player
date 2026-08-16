import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import { SettingSwitch } from '@/components/setting-switch';
import type { SubtitleSize } from '@/components/player/subtitle-overlay';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { useAutoplayNext } from '@/player/use-autoplay-next';
import { useSubtitleSize } from '@/player/use-subtitle-size';
import { useTheme } from '@/theme/theme-provider';

const SIZES: SubtitleSize[] = ['s', 'm', 'l', 'xl'];

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { backgroundPlay, setBackgroundPlay } = useBackgroundPlay();
  const { pictureInPicture, setPictureInPicture } = usePictureInPicture();
  const { autoplayNext, setAutoplayNext } = useAutoplayNext();
  const { subtitleSize, setSubtitleSize } = useSubtitleSize();
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Player" variant="detail" onBack={() => router.back()} />
      <View style={{ gap: spacing.lg }}>
        <SettingsGroup insetDividers={false}>
          <SettingSwitch label="Play video in background" value={backgroundPlay} onValueChange={setBackgroundPlay} />
          <SettingSwitch label="Picture in Picture" value={pictureInPicture} onValueChange={setPictureInPicture} />
          <SettingSwitch label="Autoplay next episode" value={autoplayNext} onValueChange={setAutoplayNext} />
        </SettingsGroup>

        <SettingsGroup insetDividers={false}>
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <AppText variant="body" style={{ color: colors.onSurface }}>
              Subtitle text size
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {SIZES.map((key) => {
                const active = key === subtitleSize;
                return (
                  <Pressable
                    key={key}
                    onPress={() => void setSubtitleSize(key)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.pill,
                      backgroundColor: active
                        ? (colors.primary ?? '#90caf9')
                        : (colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222'),
                    }}>
                    <AppText
                      variant="label"
                      style={{
                        color: active
                          ? (colors.onPrimary ?? '#000')
                          : (colors.onSurfaceVariant ?? '#aaa'),
                      }}>
                      {key.toUpperCase()}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SettingsGroup>
      </View>
    </Screen>
  );
}
