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
import { AppState, PixelRatio, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { getDisplayMode, getProgressMap, setDisplayMode, upsertProgress } from '@/db/progress-repo';
import { buildProgress, shouldWrite } from '@/player/progress-writer';
import {
  cycleMode, isDisplayMode, modeLabel, restingScale, snapZoom,
  type DisplayMode, type ZoomState,
} from '@/player/zoom';
import { shouldResume } from '@/player/resume';
import { neighbors } from '@/player/playlist';
import { seekTarget, tapZone } from '@/player/seek';
import { doubleTapAction } from '@/player/double-tap';
import { panAxis, panHalf, clamp01, scrubDeltaSec } from '@/player/pan';
import { useBackgroundPlay } from '@/player/use-background-play';
import { usePictureInPicture } from '@/player/use-pip';
import { getPlaylistItems } from '@/db/playlists-repo';
import { resolvePlaylistItems } from '@/playlists/resolve-items';
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
import { PlayerPressableScale } from '@/components/player/player-pressable-scale';
import { SystemVolume } from '@/native/system-volume';

// Vertical-swipe sensitivity: a drag of ~(screen height / VERTICAL_GAIN) spans
// the full 0→1 brightness/volume range.
const VERTICAL_GAIN = 2;

export default function PlayerScreen() {
  const { videoId, uri, title, groupKey, mode, playlistId } = useLocalSearchParams<{
    videoId: string;
    uri: string;
    title: string;
    groupKey?: string;
    mode?: string;
    playlistId?: string;
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

  const playlistNeighbors =
    playlistId && playlistItems.length > 0 ? neighbors(playlistItems, videoId) : null;

  const { prev, next } =
    playlistNeighbors ??
    (group ? neighbors(group.items, videoId) : { prev: null, next: null });

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
  const zoomScale = useSharedValue(1);

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
      if (!payload.isPlaying) {
        flushProgress();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, flushProgress]);

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
    player.playbackRate = boostPrevRateRef.current;
    setBoostActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    // A pinch is a zoom, never a boost: kill a boost the long-press may have
    // started before the second finger landed.
    handleBoostEnd();
    // Stretch is non-uniform; pinching exits it to the uniform baseline first.
    setZoomState((s) =>
      s.kind === 'mode' && s.mode === 'stretch' ? { kind: 'free', scale: 1 } : s,
    );
  }, [handleBoostEnd]);

  const handlePinchUpdate = useCallback((scale: number) => {
    setZoomHud({ kind: 'percent', percent: Math.round(scale * 100) });
  }, []);

  const handlePinchEnd = useCallback(
    (scale: number) => {
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

    // Changing `uri` recreates the player (expo-video); the [player, videoId]
    // effect then runs resume + play and the subscription effects re-bind.
    router.setParams({ videoId: target.id, uri: target.uri, title: target.filename });
  }

  // ── Top-bar right slot: lock + rotate + tracks buttons ───────────────────
  const topBarRight = (
    <View style={styles.topBarActions}>
      <PlayerPressableScale onPress={() => setLocked(true)} style={styles.iconButton}>
        <MaterialIcons name="lock-open" size={24} color="#fff" />
      </PlayerPressableScale>
      <PlayerPressableScale onPress={() => setTracksSheetVisible(true)} style={styles.iconButton}>
        <MaterialIcons name="subtitles" size={24} color="#fff" />
      </PlayerPressableScale>
      <PlayerPressableScale onPress={handleRotate} style={styles.iconButton}>
        <MaterialIcons
          name={orientationLocked ? 'screen-lock-rotation' : 'screen-rotation'}
          size={24}
          color={orientationLocked ? '#9C8CFF' : '#fff'}
        />
      </PlayerPressableScale>
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
                  (playlistId || group)
                    ? () => {
                        if (prev) void handleNavigateTo(prev);
                      }
                    : undefined
                }
                onNext={
                  (playlistId || group)
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
          </PlayerGestures>

          {/* Layer 4: Gesture indicators (pointer-events none, always on top) */}
          <GestureIndicators boostActive={boostActive} seekFlash={seekFlash} />
          <PanIndicators levelHud={levelHud} scrubHud={scrubHud} zoomHud={zoomHud} />

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
    color: '#fff',
  },
  snackbarContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
