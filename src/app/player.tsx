// src/app/player.tsx
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { SubtitleTrack, AudioTrack, TimeUpdateEventPayload } from 'expo-video';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { getProgressMap, upsertProgress } from '@/db/progress-repo';
import { buildProgress, shouldWrite } from '@/player/progress-writer';
import { shouldResume } from '@/player/resume';
import { neighbors } from '@/player/playlist';
import { useGroups } from '@/library/use-groups';
import { ControlsOverlay } from '@/components/player/controls-overlay';
import { TopBar } from '@/components/player/top-bar';
import { CenterControls } from '@/components/player/center-controls';
import { BottomBar } from '@/components/player/bottom-bar';
import { ResumeSnackbar } from '@/components/player/resume-snackbar';
import { TracksSheet } from '@/components/player/tracks-sheet';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

export default function PlayerScreen() {
  const { videoId, uri, title, groupKey, mode } = useLocalSearchParams<{
    videoId: string;
    uri: string;
    title: string;
    groupKey?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();

  const db = useSQLiteContext();
  useKeepAwake();

  // ── Group / playlist ────────────────────────────────────────────────────
  const groupMode = mode === 'folder' ? 'folder' : 'name';
  const { groups } = useGroups(groupMode);

  const group = groupKey
    ? groups.find((g) => g.key === groupKey) ?? null
    : null;

  const { prev, next } = group
    ? neighbors(group.items, videoId)
    : { prev: null, next: null };

  // ── Video player ─────────────────────────────────────────────────────────
  const player = useVideoPlayer({ uri }, (p) => {
    p.timeUpdateEventInterval = 1;
  });

  // ── UI state reflected from player ──────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [rate, setRate] = useState(1);

  // ── Tracks state ─────────────────────────────────────────────────────────
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleTrack | null>(null);
  const [activeAudio, setActiveAudio] = useState<AudioTrack | null>(null);
  const [tracksSheetVisible, setTracksSheetVisible] = useState(false);

  // ── Orientation state ────────────────────────────────────────────────────
  const [isLandscape, setIsLandscape] = useState(false);

  // ── Resume snackbar state ────────────────────────────────────────────────
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [resumePositionSec, setResumePositionSec] = useState(0);

  const lastWriteRef = useRef<number>(0);
  // Track current videoId for progress writes (updated on prev/next switch)
  const currentVideoIdRef = useRef<string>(videoId);

  // ── Flush progress (always for the currently active video id) ───────────
  function flushProgress() {
    if (!player) return;
    const positionMs = player.currentTime * 1000;
    const durationMs = player.duration ? player.duration * 1000 : null;
    upsertProgress(
      db,
      currentVideoIdRef.current,
      buildProgress(positionMs, durationMs, Date.now()),
    ).catch(() => {});
    lastWriteRef.current = Date.now();
  }

  // ── Resume + init playback for a given videoId ──────────────────────────
  async function initPlayback(id: string) {
    try {
      const map = await getProgressMap(db);
      const saved = map.get(id);
      if (saved && shouldResume(saved.positionMs, saved.percent)) {
        player.currentTime = saved.positionMs / 1000;
        setResumePositionSec(saved.positionMs / 1000);
        setSnackbarVisible(true);
      }
      player.play();
    } catch {
      player.play();
    }
  }

  // Mount: init playback for first video
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!cancelled) {
        await initPlayback(videoId);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // timeUpdate subscription: throttled progress writes + position sync
  useEffect(() => {
    const subscription = player.addListener(
      'timeUpdate',
      (payload: TimeUpdateEventPayload) => {
        setPositionSec(payload.currentTime);
        if (player.duration) {
          setDurationSec(player.duration);
        }

        if (!player.playing) return;
        const nowMs = Date.now();
        if (shouldWrite(lastWriteRef.current, nowMs)) {
          const positionMs = payload.currentTime * 1000;
          const durationMs = player.duration ? player.duration * 1000 : null;
          upsertProgress(
            db,
            currentVideoIdRef.current,
            buildProgress(positionMs, durationMs, nowMs),
          ).catch(() => {});
          lastWriteRef.current = nowMs;
        }
      },
    );

    return () => {
      subscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // playingChange: flush on pause + sync playing state
  useEffect(() => {
    const subscription = player.addListener('playingChange', (payload) => {
      setPlaying(payload.isPlaying);
      if (!payload.isPlaying) {
        flushProgress();
      }
    });

    return () => {
      subscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush on AppState → background
  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus) {
      if (state === 'background' || state === 'inactive') {
        flushProgress();
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      flushProgress();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Track availability events ────────────────────────────────────────────
  useEffect(() => {
    const sub1 = player.addListener('availableSubtitleTracksChange', (payload) => {
      setSubtitleTracks(payload.availableSubtitleTracks);
    });
    const sub2 = player.addListener('availableAudioTracksChange', (payload) => {
      setAudioTracks(payload.availableAudioTracks);
    });
    const sub3 = player.addListener('subtitleTrackChange', (payload) => {
      setActiveSubtitle(payload.subtitleTrack);
    });
    const sub4 = player.addListener('audioTrackChange', (payload) => {
      setActiveAudio(payload.audioTrack);
    });

    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
      sub4.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Orientation lifecycle ─────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      // Follow sensor while player is focused
      void ScreenOrientation.unlockAsync();

      return () => {
        // Restore portrait on blur/unmount
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      };
    }, []),
  );

  // ── Overlay handlers ────────────────────────────────────────────────────
  function handleTogglePlay() {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  function handleSeek(sec: number) {
    player.currentTime = sec;
    setPositionSec(sec);
  }

  function handleCycleRate(newRate: number) {
    player.playbackRate = newRate;
    setRate(newRate);
  }

  // ── Rotate handler ───────────────────────────────────────────────────────
  async function handleRotate() {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsLandscape(true);
    }
  }

  // ── Next / Prev handlers ─────────────────────────────────────────────────
  async function handleNavigateTo(target: { id: string; uri: string; filename: string }) {
    // 1. Flush progress for current video before switching
    flushProgress();

    // 2. Update the tracked video id
    currentVideoIdRef.current = target.id;

    // 3. Reset UI state for new video
    setPositionSec(0);
    setDurationSec(0);
    setSnackbarVisible(false);
    setSubtitleTracks([]);
    setAudioTracks([]);
    setActiveSubtitle(null);
    setActiveAudio(null);

    // 4. Replace the source
    player.replace({ uri: target.uri });

    // 5. Update route params so back-navigation/title is correct
    router.setParams({ videoId: target.id, uri: target.uri, title: target.filename });

    // 6. Run resume logic for the new video
    await initPlayback(target.id);
  }

  // ── Top-bar right slot: rotate + tracks buttons ──────────────────────────
  const topBarRight = (
    <View style={styles.topBarActions}>
      <PressableScale onPress={() => setTracksSheetVisible(true)} style={styles.iconButton}>
        <Text style={[styles.iconText, { color: colors.onSurface }]}>{'⊕'}</Text>
      </PressableScale>
      <PressableScale onPress={handleRotate} style={styles.iconButton}>
        <Text style={[styles.iconText, { color: colors.onSurface }]}>
          {isLandscape ? '⬛' : '⬜'}
        </Text>
      </PressableScale>
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="contain"
      />
      <ControlsOverlay playing={playing}>
        <TopBar
          title={title ?? ''}
          onBack={() => router.back()}
          right={topBarRight}
        />
        <CenterControls
          playing={playing}
          onToggle={handleTogglePlay}
          onPrev={
            group
              ? () => {
                  if (prev) void handleNavigateTo(prev);
                }
              : undefined
          }
          onNext={
            group
              ? () => {
                  if (next) void handleNavigateTo(next);
                }
              : undefined
          }
          hasPrev={prev !== null}
          hasNext={next !== null}
        />
        <BottomBar
          positionSec={positionSec}
          durationSec={durationSec}
          rate={rate}
          onSeek={handleSeek}
          onCycleRate={handleCycleRate}
        />
        {snackbarVisible && (
          <View style={styles.snackbarContainer}>
            <ResumeSnackbar
              positionSec={resumePositionSec}
              onDismiss={() => setSnackbarVisible(false)}
              onRestart={() => {
                player.currentTime = 0;
                setPositionSec(0);
              }}
            />
          </View>
        )}
      </ControlsOverlay>

      {tracksSheetVisible && (
        <TracksSheet
          player={player}
          subtitleTracks={subtitleTracks}
          audioTracks={audioTracks}
          activeSubtitle={activeSubtitle}
          activeAudio={activeAudio}
          onClose={() => setTracksSheetVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  snackbarContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
