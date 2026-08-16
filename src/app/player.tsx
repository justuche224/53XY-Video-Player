// src/app/player.tsx
import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { SubtitleTrack, AudioTrack, TimeUpdateEventPayload } from 'expo-video';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PixelRatio, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { getDisplayMode, getProgressMap, setDisplayMode, upsertProgress } from '@/db/progress-repo';
import { buildProgress, shouldWrite } from '@/player/progress-writer';
import {
  cycleMode, isDisplayMode, maxPinchScale, modeLabel, restingScale, snapZoom,
  type DisplayMode, type ZoomState,
} from '@/player/zoom';
import { shouldResume } from '@/player/resume';
import { isReleasedObjectError } from '@/player/released-object';
import { seekTarget, tapZone } from '@/player/seek';
import { doubleTapAction } from '@/player/double-tap';
import { panAxis, panHalf, clamp01, scrubDeltaSec } from '@/player/pan';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { useAutoplayNext } from '@/player/use-autoplay-next';
import { usePreviewStrip } from '@/player/use-preview-strip';
import { frameIndexFor, nearestCompleted } from '@/player/preview-strip';
import { shouldAutoplayNext, AUTOPLAY_COUNTDOWN_SEC } from '@/player/autoplay-next';
import { badgeMinutes, fadeVolume, remainingSec, type SleepTimer } from '@/player/sleep-timer';
import { parseEpisode } from '@/library/parse-episode';
import { formatEpisodeLabel } from '@/library/episode-label';
import { getPlaylistItems } from '@/db/playlists-repo';
import { resolvePlaylistItems } from '@/playlists/resolve-items';
import { activeQueue, resolveQueueItems } from '@/player/queue';
import { getQueue } from '@/player/queue-store';
import { useLibraryData } from '@/library/library-provider';
import type { LibraryVideo } from '@/library/types';
import { useGroups } from '@/library/use-groups';
import { ControlsOverlay } from '@/components/player/controls-overlay';
import { PlayerGestures } from '@/components/player/player-gestures';
import { GestureIndicators } from '@/components/player/gesture-indicators';
import { PanIndicators } from '@/components/player/pan-indicators';
import { TopBar } from '@/components/player/top-bar';
import { CenterControls } from '@/components/player/center-controls';
import { BottomBar } from '@/components/player/bottom-bar';
import { ResumeSnackbar } from '@/components/player/resume-snackbar';
import { TracksSheet } from '@/components/player/tracks-sheet';
import { LockOverlay } from '@/components/player/lock-overlay';
import { AutoplayCard } from '@/components/player/autoplay-card';
import { SleepSheet } from '@/components/player/sleep-sheet';
import { PlayerToast } from '@/components/player/player-toast';
import { ChromeButton } from '@/components/player/chrome-button';
import { SystemVolume } from '@/native/system-volume';

// Vertical-swipe sensitivity: a drag of ~(screen height / VERTICAL_GAIN) spans
// the full 0→1 brightness/volume range.
const VERTICAL_GAIN = 2;

export default function PlayerScreen() {
  const { videoId, uri, title, groupKey, mode, playlistId, queueToken } = useLocalSearchParams<{
    videoId: string;
    uri: string;
    title: string;
    groupKey?: string;
    mode?: string;
    playlistId?: string;
    queueToken?: string;
  }>();
  const router = useRouter();

  const db = useSQLiteContext();
  useKeepAwake();

  // ── Group / playlist ────────────────────────────────────────────────────
  const groupMode = mode === 'folder' ? 'folder' : 'name';
  const { groups } = useGroups(groupMode);

  const group = groupKey
    ? groups.find((g) => g.key === groupKey) ?? null
    : null;

  const { videos } = useLibraryData();
  const [playlistItems, setPlaylistItems] = useState<LibraryVideo[]>([]);

  useEffect(() => {
    if (!playlistId) {
      setPlaylistItems([]);
      return;
    }
    getPlaylistItems(db, playlistId).then((rows) => {
      const byId = new Map(videos.map((v) => [v.id, v]));
      setPlaylistItems(resolvePlaylistItems(rows, byId));
    });
  }, [db, playlistId, videos]);

  // Ad-hoc queue from a contextual-bar multi-selection: play exactly those
  // items and stop, instead of letting autoplay run on through the group. The
  // ids are stashed in memory and referenced by token (see queue-store); a
  // token the store no longer knows resolves to nothing and we fall through to
  // the groupKey queue, which is the pre-queue behaviour.
  const queueItems = useMemo(() => {
    if (!queueToken) return [];
    const ids = getQueue(queueToken);
    if (!ids) return [];
    return resolveQueueItems(ids, new Map(videos.map((v) => [v.id, v])));
  }, [queueToken, videos]);

  // One resolution for both the neighbors and whether prev/next chrome shows
  // at all — null means single-video playback, anything else means a queue.
  const queue = useMemo(
    () =>
      activeQueue(
        [queueItems, playlistId ? playlistItems : null, group?.items ?? null],
        videoId,
      ),
    [queueItems, playlistId, playlistItems, group, videoId],
  );

  const { prev, next } = queue ?? { prev: null, next: null };

  // ── Video player ─────────────────────────────────────────────────────────
  // Source metadata feeds the system now-playing notification / MediaSession
  // (lock screen + quick-settings media controls). The artwork uses the
  // library's already-cached thumbnail when one exists, read via a ref and
  // frozen per uri so the source string never changes mid-playback — changing
  // it would recreate the player and reset playback (the useVideoPlayer
  // gotcha). Videos with no cached thumbnail yet fall back to no artwork.
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const source = useMemo(() => {
    const artwork = videosRef.current.find((v) => v.id === videoId)?.thumbUri ?? undefined;
    return {
      uri,
      metadata: { title: title ?? 'Video', artist: '53XY', ...(artwork ? { artwork } : {}) },
    };
    // Keyed on uri only: videoId/title change together with uri, and the cache
    // is read through a ref so a library refresh can't trigger a recreation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 1;
    // Keep voices natural at >1× speed instead of chipmunk pitch.
    p.preservesPitch = true;
    // Show the now-playing notification + MediaSession controls (foreground,
    // background, and PiP) instead of an anonymous, bugged-looking session.
    // Requires the expo-video config plugin's supportsBackgroundPlayback, which
    // is already enabled in app.config.ts.
    p.showNowPlayingNotification = true;
  });

  const { backgroundPlay } = useBackgroundPlay();
  const { pictureInPicture } = usePictureInPicture();

  useEffect(() => {
    player.staysActiveInBackground = backgroundPlay;
  }, [player, backgroundPlay]);

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

  // ── Controls visibility (lifted from ControlsOverlay) ───────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  // Ref mirror so gesture callbacks (closed over at creation) always read the
  // latest value without needing to be recreated on every visibility change.
  const controlsVisibleRef = useRef(true);

  // ── Lock state ───────────────────────────────────────────────────────────
  const [locked, setLocked] = useState(false);

  // ── Gesture indicator state ──────────────────────────────────────────────
  const [boostActive, setBoostActive] = useState(false);
  const [seekFlash, setSeekFlash] = useState<
    | { kind: 'left' | 'right'; nonce: number }
    | { kind: 'center'; glyph: '▶' | '⏸' | '↻'; nonce: number }
    | null
  >(null);

  // ── Zoom / display-mode state ────────────────────────────────────────────
  const screen = useWindowDimensions();
  const pixelRatio = PixelRatio.get();
  const [zoomState, setZoomState] = useState<ZoomState>({ kind: 'mode', mode: 'fit' });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoomHud, setZoomHud] = useState<
    { kind: 'percent'; percent: number } | { kind: 'label'; label: string } | null
  >(null);
  const zoomHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchActiveRef = useRef(false);
  // Tracks the mode previewed by the current pinch (null = free/no snap zone),
  // so we can fire a haptic tick only on ENTRY into a snap zone — not on every
  // update while already inside one, and not when leaving to free.
  const pinchSnapZoneRef = useRef<DisplayMode | null>(null);
  const zoomScale = useSharedValue(1);
  const zoomMaxScale = useSharedValue(4);

  const displayMode: DisplayMode = zoomState.kind === 'mode' ? zoomState.mode : 'fit';

  // ── Pan gesture HUD state ────────────────────────────────────────────────
  const [levelHud, setLevelHud] = useState<{ kind: 'brightness' | 'volume'; level: number } | null>(null);
  const [scrubHud, setScrubHud] = useState<{ targetSec: number; deltaSec: number } | null>(null);

  // Saved screen brightness (restored on unmount) and current brightness tracking
  const originalBrightnessRef = useRef<number>(1);
  const brightnessRef = useRef<number>(1);
  // Per-drag axis lock and starting values
  const panRef = useRef<{
    axis: 'horizontal' | 'vertical' | null;
    half: 'left' | 'right';
    brightnessStart: number;
    volumeStart: number;
    scrubBaseSec: number;
  }>({ axis: null, half: 'left', brightnessStart: 1, volumeStart: 1, scrubBaseSec: 0 });
  // Committed scrub target — updated in handlePanMove, read in handlePanEnd to avoid stale closure
  const scrubTargetRef = useRef<number>(0);

  // Saved playback rate before a boost, so we can restore it on release
  const boostPrevRateRef = useRef<number>(1);
  // Guards handleBoostEnd against firing when no boost was ever started
  const boostingRef = useRef<boolean>(false);

  // ── Orientation state ────────────────────────────────────────────────────
  // True when the user has manually locked orientation (to whatever it was);
  // false means auto-rotate (follow the sensor).
  const [orientationLocked, setOrientationLocked] = useState(false);
  // Bumped on every orientation transition (sensor rotate AND the lock button).
  // Used as a `key` to remount the gesture subtree: RNGH's recognizers wedge
  // after a setRequestedOrientation / config change — raw touches still arrive
  // (onTouchesDown fires) but no gesture ever activates. Rebuilding the
  // GestureDetector re-attaches fresh handlers so recognition resumes.
  const [gestureGen, setGestureGen] = useState(0);
  const bumpGestureGen = useCallback(() => setGestureGen((g) => g + 1), []);

  // ── Resume snackbar state ────────────────────────────────────────────────
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [resumePositionSec, setResumePositionSec] = useState(0);

  // ── Binge state: autoplay-next countdown + sleep timer + toast ──────────
  const { autoplayNext } = useAutoplayNext();
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const [sleepTimer, setSleepTimer] = useState<SleepTimer | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [sleepSheetVisible, setSleepSheetVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref mirrors so the playToEnd listener binds once per player yet always
  // reads current values (same pattern as controlsVisibleRef).
  const autoplayEnabledRef = useRef(true);
  const nextRef = useRef<LibraryVideo | null>(null);
  const sleepTimerRef = useRef<SleepTimer | null>(null);
  useEffect(() => {
    autoplayEnabledRef.current = autoplayNext;
  }, [autoplayNext]);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);
  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  }, [sleepTimer]);

  const lastWriteRef = useRef<number>(0);
  // Tracks the active video id so progress always writes under the current
  // video. Kept in sync by the resume effect below.
  const currentVideoIdRef = useRef<string>(videoId);
  // Latest position/duration (seconds), cached from timeUpdate/seek so a flush
  // never has to read the player — which may already be released on unmount.
  const lastPositionSecRef = useRef<number>(0);
  const lastDurationSecRef = useRef<number>(0);

  // ── Flush progress for the currently active video id ────────────────────
  // Reads cached values (not the player) so it is safe to call from unmount
  // cleanup after expo-video has released the shared player object.
  const flushProgress = useCallback(() => {
    const positionMs = lastPositionSecRef.current * 1000;
    const durationMs = lastDurationSecRef.current > 0 ? lastDurationSecRef.current * 1000 : null;
    upsertProgress(
      db,
      currentVideoIdRef.current,
      buildProgress(positionMs, durationMs, Date.now()),
    ).catch(() => {});
    lastWriteRef.current = Date.now();
  }, [db]);

  // ── Resume + start playback whenever the player is (re)created ──────────
  // expo-video recreates the player whenever `uri` changes (i.e. on every
  // prev/next switch), so keying on [player, videoId] re-runs resume against
  // the new player; the subscription effects below likewise re-bind to it.
  useEffect(() => {
    currentVideoIdRef.current = videoId;
    // Reset cached position/duration for the new player so a quick exit before
    // the first timeUpdate doesn't flush stale values under the new video id.
    lastPositionSecRef.current = 0;
    lastDurationSecRef.current = 0;

    // Start playback immediately — do NOT wait on the DB. Gating play() behind
    // getProgressMap (serialized on the SQLite connection) was the main cause of
    // the multi-second black screen before playback began.
    player.play();

    let cancelled = false;
    (async () => {
      try {
        const map = await getProgressMap(db);
        if (cancelled) return;
        const saved = map.get(videoId);
        if (saved && shouldResume(saved.positionMs, saved.percent)) {
          player.currentTime = saved.positionMs / 1000;
          lastPositionSecRef.current = saved.positionMs / 1000;
          setResumePositionSec(saved.positionMs / 1000);
          setSnackbarVisible(true);
        }
      } catch {
        // Progress lookup failed — playback already started; nothing to resume.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, videoId, db]);

  // Natural video size: library scan dims as fallback, corrected by sourceLoad
  // (availableVideoTracks[0].size, in px) once the container is parsed.
  useEffect(() => {
    const v = videosRef.current.find((vv) => vv.id === videoId);
    setNaturalSize(v?.width && v?.height ? { width: v.width, height: v.height } : null);
    const sub = player.addListener('sourceLoad', (payload) => {
      const size = payload.availableVideoTracks?.[0]?.size;
      if (size?.width && size?.height) {
        setNaturalSize({ width: size.width, height: size.height });
      }
    });
    return () => sub.remove();
  }, [player, videoId]);

  // Apply the persisted display mode (spec: written only when ≠ fit).
  useEffect(() => {
    let cancelled = false;
    setZoomState({ kind: 'mode', mode: 'fit' });
    getDisplayMode(db, videoId)
      .then((m) => {
        if (!cancelled && isDisplayMode(m)) setZoomState({ kind: 'mode', mode: m });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, videoId]);

  // Drive the resting scale. Re-runs on rotation and when naturalSize arrives
  // (e.g. persisted crop applied before sourceLoad). Never during a pinch.
  useEffect(() => {
    if (pinchActiveRef.current) return;
    const target = restingScale(zoomState, screen, naturalSize, pixelRatio);
    zoomScale.value = withTiming(target, { duration: 180 });
  }, [zoomState, naturalSize, screen.width, screen.height, pixelRatio, zoomScale]);

  // Pinch ceiling tracks geometry so Crop/100% stay finger-reachable.
  useEffect(() => {
    zoomMaxScale.value = maxPinchScale(screen, naturalSize, pixelRatio);
  }, [screen.width, screen.height, naturalSize, pixelRatio, zoomMaxScale]);

  // timeUpdate subscription: throttled progress writes + position sync
  useEffect(() => {
    const subscription = player.addListener(
      'timeUpdate',
      (payload: TimeUpdateEventPayload) => {
        setPositionSec(payload.currentTime);
        lastPositionSecRef.current = payload.currentTime;
        if (player.duration) {
          setDurationSec(player.duration);
          lastDurationSecRef.current = player.duration;
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
  }, [player, db]);

  // playingChange: flush on pause + sync playing state
  useEffect(() => {
    const subscription = player.addListener('playingChange', (payload) => {
      setPlaying(payload.isPlaying);
      if (payload.isPlaying) {
        // Any resume (replay tap, seek-back) invalidates a pending autoplay
        // countdown — the video is no longer "ended".
        setAutoplayCountdown(null);
      } else {
        flushProgress();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, flushProgress]);

  // ── Toast (transient one-liner in the snackbar position) ─────────────────
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // ── End of video: end-of-video sleep timer wins; else autoplay countdown ─
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (sleepTimerRef.current?.kind === 'endOfVideo') {
        // Playback already stopped at the end; just disarm and report.
        setSleepTimer(null);
        showToast('Sleep timer paused playback');
        return;
      }
      // Backgrounded ends (background-audio mode) don't auto-advance: the card
      // would be invisible and the param-navigation would happen off-screen.
      if (AppState.currentState !== 'active') return;
      if (shouldAutoplayNext(nextRef.current !== null, autoplayEnabledRef.current, false)) {
        setAutoplayCountdown(AUTOPLAY_COUNTDOWN_SEC);
      }
    });
    return () => sub.remove();
  }, [player, showToast]);

  // Tick the countdown once a second; advance when it reaches 0.
  useEffect(() => {
    if (autoplayCountdown === null) return;
    if (autoplayCountdown <= 0) {
      const target = nextRef.current;
      setAutoplayCountdown(null);
      if (target) handleNavigateTo(target);
      return;
    }
    const t = setTimeout(
      () => setAutoplayCountdown((c) => (c === null ? null : c - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [autoplayCountdown]);

  // ── Sleep timer tick: badge + last-10s fade + expiry pause ───────────────
  // A minutes timer survives next/prev switches (deps re-bind to the new
  // player and keep ticking); leaving the player screen drops it with state.
  useEffect(() => {
    if (sleepTimer?.kind !== 'minutes') {
      setSleepRemainingSec(null);
      // Undo a mid-fade cancel — fade is the only thing that touches volume.
      player.volume = 1;
      return;
    }
    const tick = () => {
      const rem = remainingSec(sleepTimer.endAtMs, Date.now());
      setSleepRemainingSec(rem);
      player.volume = fadeVolume(rem);
      if (rem <= 0) {
        player.pause();
        player.volume = 1;
        setSleepTimer(null);
        showToast('Sleep timer paused playback');
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [sleepTimer, player, showToast]);

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
  }, [flushProgress]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      flushProgress();
    };
  }, [flushProgress]);

  // ── Brightness save on mount / restore on unmount ────────────────────────
  useEffect(() => {
    Brightness.getBrightnessAsync()
      .then((b) => {
        if (b >= 0) {
          originalBrightnessRef.current = b;
          brightnessRef.current = b;
        }
      })
      .catch(() => {});
    return () => {
      Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => {});
    };
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
  }, [player]);

  // ── Orientation lifecycle ─────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      // Follow the device sensor (auto-rotate) while the player is focused.
      // unlockAsync() reverts to the app's manifest default (portrait), which
      // kills auto-rotate — so explicitly allow all orientations instead.
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);

      return () => {
        // Restore portrait on blur/unmount
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setOrientationLocked(false);
      };
    }, []),
  );

  // Rebuild the gesture subtree after every sensor-driven orientation change
  // (the lock-button case is handled in handleRotate, since locking to the same
  // orientation fires no change event).
  useEffect(() => {
    const sub = ScreenOrientation.addOrientationChangeListener(bumpGestureGen);
    return () => ScreenOrientation.removeOrientationChangeListener(sub);
  }, [bumpGestureGen]);

  // Same wedge, different trigger: a prev/next switch changes `uri`, which
  // recreates the expo-video player and attaches a FRESH native SurfaceView.
  // That new surface grabs Android's touch-delivery lock and wedges the gesture
  // recognizers exactly like an orientation change does (touches arrive, nothing
  // activates) — but nothing remounts the detector on this path, so it stayed
  // dead until backing out. Bump the gesture generation whenever the player
  // object changes to rebuild the GestureDetector. Skip the initial mount: the
  // first surface attaches cleanly, so only recreations need the remount.
  const firstPlayerRef = useRef(true);
  useEffect(() => {
    if (firstPlayerRef.current) {
      firstPlayerRef.current = false;
      return;
    }
    bumpGestureGen();
  }, [player, bumpGestureGen]);

  // Keep the ref in sync so gesture callbacks read current visibility without
  // needing to be recreated on every toggle.
  useEffect(() => {
    controlsVisibleRef.current = controlsVisible;
  }, [controlsVisible]);

  // ── Overlay handlers ────────────────────────────────────────────────────
  function handleTogglePlay() {
    if (player.playing) {
      player.pause();
    } else {
      if (lastDurationSecRef.current > 0 && lastPositionSecRef.current >= lastDurationSecRef.current - 0.5) {
        player.currentTime = 0;
        setPositionSec(0);
        lastPositionSecRef.current = 0;
      }
      player.play();
    }
  }

  function handleSeek(sec: number) {
    player.currentTime = sec;
    setPositionSec(sec);
    lastPositionSecRef.current = sec;
  }

  function handleCycleRate(newRate: number) {
    player.playbackRate = newRate;
    setRate(newRate);
  }

  // ── Gesture handlers ─────────────────────────────────────────────────────
  const handleToggleControls = useCallback(() => {
    setControlsVisible((v) => !v);
  }, []);

  const handleDoubleTap = useCallback((x: number, w: number) => {
    const zone = tapZone(x, w);
    const action = doubleTapAction(zone, controlsVisibleRef.current);
    if (action === 'none') return;

    if (action === 'toggle') {
      // Center third toggles play/pause; flash the action just taken.
      if (player.playing) {
        player.pause();
        setSeekFlash((prev) => ({ kind: 'center', glyph: '⏸', nonce: (prev?.nonce ?? 0) + 1 }));
      } else {
        const isEnded = lastDurationSecRef.current > 0 && lastPositionSecRef.current >= lastDurationSecRef.current - 0.5;
        if (isEnded) {
          player.currentTime = 0;
          setPositionSec(0);
          lastPositionSecRef.current = 0;
        }
        player.play();
        setSeekFlash((prev) => ({ kind: 'center', glyph: isEnded ? '↻' : '▶', nonce: (prev?.nonce ?? 0) + 1 }));
      }
      return;
    }
    const delta = zone === 'left' ? -10 : 10;
    const target = seekTarget(lastPositionSecRef.current, delta, lastDurationSecRef.current);
    player.currentTime = target;
    setPositionSec(target);
    lastPositionSecRef.current = target;
    setSeekFlash((prev) => ({ kind: zone === 'left' ? 'left' : 'right', nonce: (prev?.nonce ?? 0) + 1 }));
  }, [player]);

  const handleBoostStart = useCallback(() => {
    boostPrevRateRef.current = player.playbackRate;
    boostingRef.current = true;
    player.playbackRate = 2;
    setBoostActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [player]);

  const handleBoostEnd = useCallback(() => {
    if (!boostingRef.current) return;
    boostingRef.current = false;
    // Clear the UI before touching the player: the restore below can fail, and
    // a stranded 2× badge over a video playing at 1× is worse than no restore.
    setBoostActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      player.playbackRate = boostPrevRateRef.current;
    } catch (err) {
      // A long-press can still be held when the player is released — the video
      // switches (uri change) or the screen is left mid-hold, and RNGH's
      // onFinalize → scheduleOnRN hop lands the callback after the release.
      // Restoring a rate on a dead player is a no-op worth swallowing; the
      // replacement player starts at its own rate anyway.
      if (!isReleasedObjectError(err)) throw err;
    }
  }, [player]);

  const handleAutoHide = useCallback(() => setControlsVisible(false), []);

  // ── Zoom / display-mode handlers ─────────────────────────────────────────
  // A label flash auto-dismisses; live % (during a pinch) stays until replaced.
  const flashZoomLabel = useCallback((label: string) => {
    if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current);
    setZoomHud({ kind: 'label', label });
    zoomHudTimerRef.current = setTimeout(() => setZoomHud(null), 800);
  }, []);

  useEffect(() => () => {
    if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current);
  }, []);

  // Spec: NULL for fit, mode string otherwise.
  const persistDisplayMode = useCallback(
    (mode: DisplayMode) => {
      setDisplayMode(db, currentVideoIdRef.current, mode === 'fit' ? null : mode, Date.now()).catch(() => {});
    },
    [db],
  );

  const handlePinchStart = useCallback(() => {
    pinchActiveRef.current = true;
    pinchSnapZoneRef.current = null;
    // A pinch is a zoom, never a boost: kill a boost the long-press may have
    // started before the second finger landed.
    handleBoostEnd();
    // Stretch is non-uniform; pinching exits it to the uniform baseline first.
    setZoomState((s) =>
      s.kind === 'mode' && s.mode === 'stretch' ? { kind: 'free', scale: 1 } : s,
    );
  }, [handleBoostEnd]);

  const handlePinchUpdate = useCallback(
    (scale: number) => {
      // Preview exactly what release would snap to, so the HUD shows the same
      // target the user will actually land on (Crop/100%) instead of a raw
      // percentage they can't tell is inside the snap window.
      const preview = snapZoom(scale, screen, naturalSize, pixelRatio);
      const previewedMode = preview.kind === 'mode' ? preview.mode : null;
      if (previewedMode !== pinchSnapZoneRef.current && previewedMode !== null) {
        // Haptic tick on zone ENTRY only — not on every update inside the zone,
        // and not when leaving back to free.
        Haptics.selectionAsync();
      }
      pinchSnapZoneRef.current = previewedMode;

      if (preview.kind === 'mode') {
        setZoomHud({ kind: 'label', label: modeLabel(preview.mode) });
      } else {
        setZoomHud({ kind: 'percent', percent: Math.round(scale * 100) });
      }
    },
    [screen, naturalSize, pixelRatio],
  );

  const handlePinchEnd = useCallback(
    (scale: number) => {
      // onFinalize fires for failed (never-activated) pinches too — every
      // single-finger tap finalizes the pinch recognizer. Same guard pattern
      // as boostingRef for the long-press boost.
      if (!pinchActiveRef.current) return;
      pinchActiveRef.current = false;
      const snapped = snapZoom(scale, screen, naturalSize, pixelRatio);
      setZoomState(snapped);
      if (snapped.kind === 'mode') {
        flashZoomLabel(modeLabel(snapped.mode));
        persistDisplayMode(snapped.mode);
      } else {
        setZoomHud(null);
      }
      // The apply-effect animates zoomScale to the snapped target.
    },
    [screen, naturalSize, pixelRatio, flashZoomLabel, persistDisplayMode],
  );

  const handleCycleDisplayMode = useCallback(() => {
    const next = cycleMode(displayMode, naturalSize !== null);
    setZoomState({ kind: 'mode', mode: next });
    flashZoomLabel(modeLabel(next));
    persistDisplayMode(next);
  }, [displayMode, naturalSize, flashZoomLabel, persistDisplayMode]);

  // ── Pan gesture handlers ─────────────────────────────────────────────────
  const handlePanStart = useCallback(() => {
    panRef.current = {
      axis: null,
      half: 'left',
      brightnessStart: brightnessRef.current,
      volumeStart: SystemVolume.getVolume(),
      scrubBaseSec: lastPositionSecRef.current,
    };
  }, [player]);

  const handlePanMove = useCallback(
    (x: number, translationX: number, translationY: number, width: number, height: number) => {
      const st = panRef.current;

      // Axis lock: wait for 8px threshold, then decide once
      if (st.axis === null) {
        if (Math.abs(translationX) < 8 && Math.abs(translationY) < 8) return;
        st.axis = panAxis(translationX, translationY);
        if (st.axis === 'vertical') {
          // start x = current x − translation
          st.half = panHalf(x - translationX, width);
        }
      }

      if (st.axis === 'horizontal') {
        const deltaSec = scrubDeltaSec(translationX, width, 120);
        const target = seekTarget(st.scrubBaseSec, deltaSec, lastDurationSecRef.current);
        scrubTargetRef.current = target;
        setScrubHud({ targetSec: target, deltaSec });
      } else {
        // vertical — VERTICAL_GAIN makes a ~half-screen drag span the full range
        const base = st.half === 'left' ? st.brightnessStart : st.volumeStart;
        const level = clamp01(base - (translationY / height) * VERTICAL_GAIN);
        if (st.half === 'left') {
          brightnessRef.current = level;
          Brightness.setBrightnessAsync(level).catch(() => {});
          setLevelHud({ kind: 'brightness', level });
        } else {
          // System media volume (Android AudioManager) — returns the actual
          // step-quantized level so the HUD reflects the true value.
          const actual = SystemVolume.setVolume(level);
          setLevelHud({ kind: 'volume', level: actual });
        }
      }
    },
    [player],
  );

  const handlePanEnd = useCallback(() => {
    if (panRef.current.axis === 'horizontal') {
      const target = scrubTargetRef.current;
      player.currentTime = target;
      setPositionSec(target);
      lastPositionSecRef.current = target;
    }
    setScrubHud(null);
    setLevelHud(null);
  }, [player]);

  // ── Rotate handler ───────────────────────────────────────────────────────
  // Toggle between auto-rotate and locking to the CURRENT orientation (whatever
  // the device is showing right now — portrait or either landscape).
  async function handleRotate() {
    if (orientationLocked) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
      setOrientationLocked(false);
      bumpGestureGen();
      return;
    }
    const current = await ScreenOrientation.getOrientationAsync();
    const O = ScreenOrientation.Orientation;
    const L = ScreenOrientation.OrientationLock;
    const lock =
      current === O.LANDSCAPE_LEFT
        ? L.LANDSCAPE_LEFT
        : current === O.LANDSCAPE_RIGHT
          ? L.LANDSCAPE_RIGHT
          : current === O.PORTRAIT_DOWN
            ? L.PORTRAIT_DOWN
            : L.PORTRAIT_UP;
    await ScreenOrientation.lockAsync(lock);
    setOrientationLocked(true);
    bumpGestureGen();
  }

  // ── Next / Prev handlers ─────────────────────────────────────────────────
  function handleNavigateTo(target: { id: string; uri: string; filename: string }) {
    // Flush the current video's progress before switching.
    flushProgress();

    // Reset UI state; the new video's state arrives via the re-bound listeners.
    setPositionSec(0);
    setDurationSec(0);
    setSnackbarVisible(false);
    setSubtitleTracks([]);
    setAudioTracks([]);
    setActiveSubtitle(null);
    setActiveAudio(null);
    setZoomHud(null);
    setAutoplayCountdown(null);

    // Changing `uri` recreates the player (expo-video); the [player, videoId]
    // effect then runs resume + play and the subscription effects re-bind.
    router.setParams({ videoId: target.id, uri: target.uri, title: target.filename });
  }

  // ── Scrub preview strip (lazy background generation) ─────────────────────
  const previewStrip = usePreviewStrip(videoId, uri, durationSec);
  const previewFor = useCallback(
    (sec: number): string | null => {
      const { intervalSec, count, frames } = previewStrip;
      if (count <= 0 || frames.size === 0) return null;
      const idx = frameIndexFor(sec, intervalSec, count);
      const near = nearestCompleted(idx, new Set(frames.keys()), count);
      return near !== null ? frames.get(near) ?? null : null;
    },
    [previewStrip],
  );

  // Episode label for the autoplay card ("S04E05", or '' when unparseable).
  const nextEpisodeInfo = next ? parseEpisode(next.filename) : null;
  const nextEpisodeLabel = nextEpisodeInfo
    ? formatEpisodeLabel(nextEpisodeInfo.season, nextEpisodeInfo.episode)
    : '';

  // ── Top-bar right slot: sleep + lock + rotate + tracks buttons ───────────
  const topBarRight = (
    <View style={styles.topBarActions}>
      <ChromeButton onPress={() => setSleepSheetVisible(true)}>
        <MaterialIcons name="bedtime" size={22} color={sleepTimer ? '#9C8CFF' : '#fff'} />
        {sleepTimer?.kind === 'minutes' && sleepRemainingSec !== null && (
          <Text style={styles.sleepBadge}>{badgeMinutes(sleepRemainingSec)}</Text>
        )}
      </ChromeButton>
      <ChromeButton onPress={() => setLocked(true)}>
        <MaterialIcons name="lock-open" size={22} color="#fff" />
      </ChromeButton>
      <ChromeButton onPress={() => setTracksSheetVisible(true)}>
        <MaterialIcons name="subtitles" size={22} color="#fff" />
      </ChromeButton>
      <ChromeButton onPress={handleRotate}>
        <MaterialIcons
          name={orientationLocked ? 'screen-lock-rotation' : 'screen-rotation'}
          size={22}
          color={orientationLocked ? '#9C8CFF' : '#fff'}
        />
      </ChromeButton>
    </View>
  );

  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  return (
    // Screen-level gesture root, FORCED ACTIVE. expo-video's native VideoView
    // (a SurfaceView) sits behind the gesture layer; on an orientation change —
    // and intermittently — that native surface grabs the Android touch-delivery
    // lock, which permanently kills gestures handled only by the distant
    // app-root GestureHandlerRootView (video + JS keep running, hence the
    // overlay still auto-hides). A plain nested GestureHandlerRootView is a
    // no-op here: RNGestureHandlerRootView.onAttachedToWindow self-disables when
    // it finds an ancestor root (rootViewEnabled = forceActive || !hasAncestor).
    // unstable_forceActive forces this root to install its own touch helper
    // BELOW the surface boundary, so the surface re-grabbing the lock can't
    // cancel the player's gestures. (Documented RNGH workaround for native views
    // that grab the touch lock.)
    <GestureHandlerRootView style={styles.root} unstable_forceActive>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />

      {/* Layer 1: Video — always mounted so playback/progress are never broken.
          The pointerEvents="none" wrapper keeps the native video view out of
          touch dispatch entirely: expo-video's Android VideoView overrides
          onTouchEvent to consume EVERY touch and re-dispatch synthetic events
          into RN (expo/expo#35479). With native controls off and our own
          gesture layer on top, it must never be a touch target. */}
      <Animated.View style={[StyleSheet.absoluteFill, zoomAnimatedStyle]} pointerEvents="none">
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit={zoomState.kind === 'mode' && zoomState.mode === 'stretch' ? 'fill' : 'contain'}
          allowsPictureInPicture={pictureInPicture}
          startsPictureInPictureAutomatically={pictureInPicture}
        />
      </Animated.View>

      {locked ? (
        /* Locked: hide all chrome and gestures; only show the unlock overlay */
        <LockOverlay onUnlock={() => setLocked(false)} />
      ) : (
        <>
          {/* Layer 2: Full-screen gesture catcher (below chrome so buttons still work) */}
          <PlayerGestures
            key={gestureGen}
            onToggleControls={handleToggleControls}
            onDoubleTap={handleDoubleTap}
            onBoostStart={handleBoostStart}
            onBoostEnd={handleBoostEnd}
            onPanStart={handlePanStart}
            onPanMove={handlePanMove}
            onPanEnd={handlePanEnd}
            zoomScale={zoomScale}
            zoomMaxScale={zoomMaxScale}
            onPinchStart={handlePinchStart}
            onPinchUpdate={handlePinchUpdate}
            onPinchEnd={handlePinchEnd}
          >
            {/* Layer 3: Chrome overlay — box-none so empty space falls through to gesture layer */}
            <ControlsOverlay
              playing={playing}
              visible={controlsVisible}
              onAutoHide={handleAutoHide}
            >
              <TopBar
                title={title ?? ''}
                onBack={() => router.back()}
                right={topBarRight}
              />
              <CenterControls
                playing={playing}
                isEnded={!playing && durationSec > 0 && positionSec >= durationSec - 0.5}
                onToggle={handleTogglePlay}
                onPrev={
                  queue
                    ? () => {
                        if (prev) void handleNavigateTo(prev);
                      }
                    : undefined
                }
                onNext={
                  queue
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
                previewFor={previewFor}
                displayMode={displayMode}
                onCycleDisplayMode={handleCycleDisplayMode}
              />
              {snackbarVisible && (
                <View style={styles.snackbarContainer}>
                  <ResumeSnackbar
                    positionSec={resumePositionSec}
                    onDismiss={() => setSnackbarVisible(false)}
                    onRestart={() => {
                      player.currentTime = 0;
                      setPositionSec(0);
                      lastPositionSecRef.current = 0;
                    }}
                  />
                </View>
              )}
            </ControlsOverlay>

            {/* Autoplay-next card: INSIDE PlayerGestures so its buttons get the
                gesture-arena relation (blocksExternalGesture) and a tap can't
                also fire the background single-tap chrome toggle — but outside
                ControlsOverlay, so it shows regardless of chrome visibility
                (the chrome is usually auto-hidden when a video runs to its end). */}
            {autoplayCountdown !== null && next && (
              <View style={styles.snackbarContainer} pointerEvents="box-none">
                <AutoplayCard
                  title={next.filename}
                  episodeLabel={nextEpisodeLabel}
                  thumbUri={next.thumbUri}
                  countdownSec={autoplayCountdown}
                  onCancel={() => setAutoplayCountdown(null)}
                  onPlayNow={() => {
                    setAutoplayCountdown(null);
                    handleNavigateTo(next);
                  }}
                />
              </View>
            )}
          </PlayerGestures>

          {/* Layer 4: Gesture indicators (pointer-events none, always on top) */}
          <GestureIndicators boostActive={boostActive} seekFlash={seekFlash} />
          <PanIndicators
            levelHud={levelHud}
            scrubHud={scrubHud}
            scrubPreviewUri={scrubHud ? previewFor(scrubHud.targetSec) : null}
            zoomHud={zoomHud}
          />

          {sleepSheetVisible && (
            <SleepSheet
              active={sleepTimer}
              remainingSec={sleepRemainingSec}
              onSet={setSleepTimer}
              onClose={() => setSleepSheetVisible(false)}
            />
          )}

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
        </>
      )}

      {/* Toast renders above everything, locked or not (sleep expiry can fire
          while the lock overlay is up). */}
      {toast && (
        <View style={styles.snackbarContainer} pointerEvents="none">
          <PlayerToast message={toast} />
        </View>
      )}
    </GestureHandlerRootView>
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
    gap: 8,
  },
  snackbarContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sleepBadge: {
    position: 'absolute',
    bottom: 4,
    right: 3,
    fontSize: 9,
    fontWeight: '700',
    color: '#9C8CFF',
  },
});
