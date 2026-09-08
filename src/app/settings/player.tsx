import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { ListItem } from '@/components/list-item';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import { SettingSwitch } from '@/components/setting-switch';
import type { SubtitleSize } from '@/components/player/subtitle-overlay';
import { invalidateMomentsDir, momentsDirIsShared } from '@/moments/storage';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { useAutoplayNext } from '@/player/use-autoplay-next';
import { useSubtitleSize } from '@/player/use-subtitle-size';
import { openAllFilesAccessSettings } from '@/subtitles/storage-access';
import { useTheme } from '@/theme/theme-provider';

const SIZES: SubtitleSize[] = ['s', 'm', 'l', 'xl'];

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { backgroundPlay, setBackgroundPlay } = useBackgroundPlay();
  const { pictureInPicture, setPictureInPicture } = usePictureInPicture();
  const { autoplayNext, setAutoplayNext } = useAutoplayNext();
  const { subtitleSize, setSubtitleSize } = useSubtitleSize();

  // `momentsDirIsShared()` is not a pure read — through `ensureMomentsDir()`
  // it creates directories and a `.nomedia` file — so it must not run during
  // render. Start from a plain default and let the focus effect below fill
  // in the real answer.
  const [momentsShared, setMomentsShared] = useState(false);

  // Re-probe on focus: the user may have just granted All files access from
  // the system settings screen and come straight back here rather than to
  // the player, where the same re-probe also happens.
  useFocusEffect(
    useCallback(() => {
      if (!momentsDirIsShared()) invalidateMomentsDir();
      setMomentsShared(momentsDirIsShared());
    }, []),
  );

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
          <ListItem
            icon="bookmark-outline"
            title="Moments storage"
            subtitle={
              momentsShared
                ? 'Internal storage (survives uninstall)'
                : 'Inside the app (removed if you uninstall)'
            }
            onPress={momentsShared ? undefined : () => void openAllFilesAccessSettings()}
          />
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
