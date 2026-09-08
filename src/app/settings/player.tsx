import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ToastAndroid, View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { ListItem } from '@/components/list-item';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import { SettingSwitch } from '@/components/setting-switch';
import type { SubtitleSize } from '@/components/player/subtitle-overlay';
import { getMoments } from '@/db/moments-repo';
import { clearAllMoments, pendingRestoreCount, restoreMomentsFromManifest } from '@/moments/moments-store';
import { frameBytes, invalidateMomentsDir, momentsDirIsShared } from '@/moments/storage';
import { formatBytes } from '@/moments/restore-moments';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { useAutoplayNext } from '@/player/use-autoplay-next';
import { useSubtitleSize } from '@/player/use-subtitle-size';
import { openAllFilesAccessSettings } from '@/subtitles/storage-access';
import { useTheme } from '@/theme/theme-provider';

const SIZES: SubtitleSize[] = ['s', 'm', 'l', 'xl'];

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
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

  const [stats, setStats] = useState({ count: 0, bytes: 0, restorable: 0 });

  const loadStats = useCallback(async () => {
    try {
      const all = await getMoments(db);
      setStats({
        count: all.length,
        bytes: frameBytes(all),
        restorable: await pendingRestoreCount(db),
      });
    } catch (e) {
      console.warn('[moments] could not load store statistics:', e);
    }
  }, [db]);

  // Re-probe on focus: the user may have just granted All files access from
  // the system settings screen and come straight back here rather than to
  // the player, where the same re-probe also happens.
  useFocusEffect(
    useCallback(() => {
      if (!momentsDirIsShared()) invalidateMomentsDir();
      setMomentsShared(momentsDirIsShared());
      void loadStats();
    }, [loadStats]),
  );

  const onRestore = useCallback(() => {
    restoreMomentsFromManifest(db)
      .then((n) => {
        ToastAndroid.show(
          n === 1 ? 'Restored 1 moment' : `Restored ${n} moments`,
          ToastAndroid.SHORT,
        );
        void loadStats();
      })
      .catch((e) => {
        console.warn('[moments] restore failed:', e);
        Alert.alert('Restore failed', 'Could not read the moments backup folder.');
      });
  }, [db, loadStats]);

  const onClearAll = useCallback(() => {
    if (stats.count === 0) return;
    Alert.alert(
      'Delete all moments',
      `Delete all ${stats.count} moment${stats.count === 1 ? '' : 's'}? The saved frames go too. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            clearAllMoments(db)
              .then(() => loadStats())
              .catch((e) => {
                console.warn('[moments] clear-all failed:', e);
                Alert.alert('Delete failed', 'Could not delete every moment.');
              });
          },
        },
      ],
    );
  }, [db, loadStats, stats.count]);

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
          <ListItem
            title="Saved moments"
            subtitle={`${stats.count} saved · ${formatBytes(stats.bytes)}`}
          />
          <ListItem
            title="Restore from backup"
            subtitle={
              stats.restorable > 0
                ? `${stats.restorable} found in the moments folder`
                : 'Nothing to restore'
            }
            onPress={stats.restorable > 0 ? onRestore : undefined}
          />
          <ListItem
            title="Delete all moments"
            subtitle="Removes every moment and its saved frame"
            onPress={stats.count > 0 ? onClearAll : undefined}
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
