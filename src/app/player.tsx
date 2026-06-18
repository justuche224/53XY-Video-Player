// src/app/player.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { TimeUpdateEventPayload } from 'expo-video';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { getProgressMap, upsertProgress } from '@/db/progress-repo';
import { buildProgress, shouldWrite } from '@/player/progress-writer';
import { shouldResume } from '@/player/resume';
import { ControlsOverlay } from '@/components/player/controls-overlay';
import { TopBar } from '@/components/player/top-bar';
import { CenterControls } from '@/components/player/center-controls';
import { BottomBar } from '@/components/player/bottom-bar';

export default function PlayerScreen() {
  const { videoId, uri, title } = useLocalSearchParams<{
    videoId: string;
    uri: string;
    title: string;
  }>();
  const router = useRouter();

  const db = useSQLiteContext();
  useKeepAwake();

  const player = useVideoPlayer({ uri }, (p) => {
    p.timeUpdateEventInterval = 1;
  });

  // ── UI state reflected from player ──────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [rate, setRate] = useState(1);

  const lastWriteRef = useRef<number>(0);

  // Flush progress unconditionally (unthrottled)
  function flushProgress() {
    if (!player) return;
    const positionMs = player.currentTime * 1000;
    const durationMs = player.duration ? player.duration * 1000 : null;
    upsertProgress(
      db,
      videoId,
      buildProgress(positionMs, durationMs, Date.now()),
    ).catch(() => {});
    lastWriteRef.current = Date.now();
  }

  // Mount: load saved progress, seek if needed, then play
  useEffect(() => {
    let cancelled = false;

    async function initPlayback() {
      try {
        const map = await getProgressMap(db);
        const saved = map.get(videoId);
        if (!cancelled) {
          if (saved && shouldResume(saved.positionMs, saved.percent)) {
            player.currentTime = saved.positionMs / 1000;
          }
          player.play();
        }
      } catch {
        if (!cancelled) {
          player.play();
        }
      }
    }

    void initPlayback();

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
            videoId,
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
        />
        <CenterControls
          playing={playing}
          onToggle={handleTogglePlay}
        />
        <BottomBar
          positionSec={positionSec}
          durationSec={durationSec}
          rate={rate}
          onSeek={handleSeek}
          onCycleRate={handleCycleRate}
        />
      </ControlsOverlay>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
