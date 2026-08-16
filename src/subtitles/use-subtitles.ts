import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Directory, File } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import type { VideoPlayer } from 'expo-video';

import { getSubtitlePrefs, setSubtitlePrefs } from '@/db/progress-repo';

import type { Cue, SubtitleCandidate } from './types';
import { activeCues, cueTextOf } from './active-cue';
import { findSubtitleCandidates, pickAutoLoad, SUBS_FOLDER_NAMES } from './find-sibling';
import type { DirectoryEntry, SubsFolder } from './find-sibling';
import { loadSubtitle, SubtitleTooLargeError } from './load-subtitle';
import { subtitleFormatOf } from './parse-subtitle';
import { canReadFolder, openAllFilesAccessSettings } from './storage-access';

/** How often the cue clock ticks. 1s (the player's timeUpdate interval) would
 *  land lines up to a second late; 150ms is imperceptible and cheap. */
const TICK_MS = 150;

export interface UseSubtitles {
  /** Text to display right now; '' when nothing is active. */
  activeText: string;
  candidates: SubtitleCandidate[];
  active: { uri: string; name: string } | null;
  delayMs: number;
  /** True when auto-detect could not read the folder. */
  needsPermission: boolean;
  /** Transient message for the player's toast. */
  error: string | null;
  setDelayMs: (ms: number) => void;
  selectCandidate: (candidate: SubtitleCandidate) => Promise<void>;
  clearSubtitle: () => void;
  pickFromFile: () => Promise<void>;
  requestAccess: () => Promise<void>;
}

function joinUri(folderUri: string, relativePath: string): string {
  const base = folderUri.endsWith('/') ? folderUri.slice(0, -1) : folderUri;
  return `${base}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Best-effort two-letter device language for auto-pick's tie-break.
 *
 * `NativeModules.I18nManager?.localeIdentifier` (the brief's original guess)
 * is legacy-bridge internals that RN's own `I18nManager` wrapper
 * (Libraries/ReactNative/I18nManager.js) does not even re-export on its
 * public default object — only `isRTL`/`doLeftAndRightSwapInRTL` survive
 * there. This app also runs with the new architecture on
 * (android/gradle.properties: newArchEnabled=true), so reaching into
 * `NativeModules.I18nManager` directly means going through the turbo-module
 * interop layer for a module whose public JS surface never promised that
 * constant. `Intl.DateTimeFormat().resolvedOptions().locale` is a standard
 * ECMA-402 API that Hermes ships with (ICU data bundled by default, no extra
 * gradle flag needed), works identically on old and new architecture, and
 * needs no new dependency. 'en' remains the final fallback if it ever throws.
 */
function deviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.replace('_', '-').split('-')[0].toLowerCase();
  } catch {
    return 'en';
  }
}

export function useSubtitles({
  player,
  videoId,
  videoUri,
  embeddedActive,
}: {
  player: VideoPlayer;
  videoId: string | undefined;
  videoUri: string | undefined;
  /** True when an embedded track is currently displayed — external subtitles
   *  stand down so two sets never stack on screen. */
  embeddedActive: boolean;
}): UseSubtitles {
  const db = useSQLiteContext();

  const [cues, setCues] = useState<Cue[] | null>(null);
  const [active, setActive] = useState<{ uri: string; name: string } | null>(null);
  const [candidates, setCandidates] = useState<SubtitleCandidate[]>([]);
  const [delayMs, setDelayMsState] = useState(0);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeText, setActiveText] = useState('');

  // Read by the ticker without re-creating the interval on every change.
  const delayRef = useRef(0);
  delayRef.current = delayMs;
  const cuesRef = useRef<Cue[] | null>(null);
  cuesRef.current = cues;
  const shownRef = useRef('');

  const folderUri = useMemo(() => {
    if (!videoUri) return null;
    const slash = videoUri.lastIndexOf('/');
    return slash > 0 ? videoUri.slice(0, slash) : null;
  }, [videoUri]);

  const videoName = useMemo(() => {
    if (!videoUri) return '';
    const raw = videoUri.slice(videoUri.lastIndexOf('/') + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [videoUri]);

  // ── Scan the folder for candidates ────────────────────────────────────
  const scan = useCallback((): SubtitleCandidate[] => {
    if (!folderUri) return [];
    if (!canReadFolder(folderUri)) {
      setNeedsPermission(true);
      return [];
    }
    setNeedsPermission(false);
    try {
      const listing = new Directory(folderUri).list();
      const entries: DirectoryEntry[] = listing.map((item) => ({
        name: item.name,
        isDirectory: item instanceof Directory,
      }));

      let subsFolder: SubsFolder | null = null;
      const subsDir = listing.find(
        (item) => item instanceof Directory && SUBS_FOLDER_NAMES.includes(item.name.toLowerCase()),
      );
      if (subsDir instanceof Directory) {
        subsFolder = {
          name: subsDir.name,
          entries: subsDir.list().map((item) => ({
            name: item.name,
            isDirectory: item instanceof Directory,
          })),
        };
      }
      return findSubtitleCandidates(videoName, entries, subsFolder);
    } catch {
      return [];
    }
  }, [folderUri, videoName]);

  const applyLoad = useCallback(
    async (uri: string, name: string, persist: boolean) => {
      try {
        const loaded = await loadSubtitle(uri, name);
        if (loaded.cues.length === 0) {
          setError(`No subtitles found in ${name}`);
          return;
        }
        setCues(loaded.cues);
        setActive({ uri: loaded.uri, name: loaded.name });
        // Mutually exclusive with embedded tracks.
        player.subtitleTrack = null;
        if (persist && videoId) {
          await setSubtitlePrefs(db, videoId, uri, delayRef.current, Date.now());
        }
      } catch (e) {
        setError(
          e instanceof SubtitleTooLargeError ? 'Subtitle file is too large' : `Could not read ${name}`,
        );
      }
    },
    [db, player, videoId],
  );

  // ── On video change: reset, restore prefs, then auto-detect ───────────
  useEffect(() => {
    let cancelled = false;
    setCues(null);
    setActive(null);
    setActiveText('');
    shownRef.current = '';
    setCandidates([]);
    setDelayMsState(0);
    delayRef.current = 0;
    if (!videoId || !videoUri) return;

    (async () => {
      const prefs = await getSubtitlePrefs(db, videoId);
      if (cancelled) return;
      setDelayMsState(prefs.delayMs);
      delayRef.current = prefs.delayMs;

      const found = scan();
      if (cancelled) return;
      setCandidates(found);

      // A remembered file wins, as long as it still exists.
      if (prefs.uri) {
        const name = decodeURIComponent(prefs.uri.slice(prefs.uri.lastIndexOf('/') + 1));
        try {
          if (new File(prefs.uri).exists) {
            await applyLoad(prefs.uri, name, false);
            return;
          }
        } catch {
          // fall through to auto-detect
        }
      }

      // Do not auto-load over an embedded track that is already showing.
      if (embeddedActive || !folderUri) return;
      const pick = pickAutoLoad(found, deviceLanguage());
      if (pick) await applyLoad(joinUri(folderUri, pick.relativePath), pick.name, false);
    })();

    return () => {
      cancelled = true;
    };
    // embeddedActive is deliberately excluded: this effect is the per-video
    // reset, and re-running it when the user toggles an embedded track would
    // wipe their external selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, videoId, videoUri, folderUri, scan, applyLoad]);

  // ── The cue clock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!cues || cues.length === 0) {
      setActiveText('');
      shownRef.current = '';
      return;
    }
    const id = setInterval(() => {
      // Runs while paused too, so seeking or scrubbing with the video
      // stopped still updates the visible line.
      const timeMs = player.currentTime * 1000;
      const text = cueTextOf(activeCues(cuesRef.current ?? [], timeMs, delayRef.current));
      // Only touch state when the visible text actually changes, so the
      // steady-state cost of the ticker is a comparison.
      if (text !== shownRef.current) {
        shownRef.current = text;
        setActiveText(text);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [cues, player]);

  // ── Re-probe when returning from the system settings screen ───────────
  useEffect(() => {
    if (!needsPermission) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !folderUri) return;
      if (!canReadFolder(folderUri)) return;
      setNeedsPermission(false);
      const found = scan();
      setCandidates(found);
      if (!active && !embeddedActive) {
        const pick = pickAutoLoad(found, deviceLanguage());
        if (pick) void applyLoad(joinUri(folderUri, pick.relativePath), pick.name, false);
      }
    });
    return () => sub.remove();
  }, [needsPermission, folderUri, scan, active, embeddedActive, applyLoad]);

  // ── Actions ───────────────────────────────────────────────────────────
  const setDelayMs = useCallback(
    (ms: number) => {
      setDelayMsState(ms);
      delayRef.current = ms;
      // Force an immediate re-evaluation so dragging feels live rather than
      // waiting up to a tick.
      const text = cueTextOf(activeCues(cuesRef.current ?? [], player.currentTime * 1000, ms));
      if (text !== shownRef.current) {
        shownRef.current = text;
        setActiveText(text);
      }
      if (videoId) void setSubtitlePrefs(db, videoId, active?.uri ?? null, ms, Date.now());
    },
    [db, player, videoId, active],
  );

  const selectCandidate = useCallback(
    async (candidate: SubtitleCandidate) => {
      if (!folderUri) return;
      await applyLoad(joinUri(folderUri, candidate.relativePath), candidate.name, true);
    },
    [folderUri, applyLoad],
  );

  const clearSubtitle = useCallback(() => {
    setCues(null);
    setActive(null);
    setActiveText('');
    shownRef.current = '';
    if (videoId) void setSubtitlePrefs(db, videoId, null, delayRef.current, Date.now());
  }, [db, videoId]);

  const pickFromFile = useCallback(async () => {
    try {
      // SAF picker — needs no permission at all, so this keeps working even
      // when all-files access was declined.
      //
      // Without `multipleFiles: true` this resolves the single-file overload:
      // `{ result: File; canceled: false } | { result: null; canceled: true }`
      // (confirmed against node_modules/expo-file-system/build/File.types.d.ts
      // and the v56 docs — never an array here).
      const { result, canceled } = await File.pickFileAsync({ mimeTypes: ['*/*'] });
      if (canceled || !result) return;
      const name = result.name;
      if (!subtitleFormatOf(name)) {
        setError('Not a supported subtitle file');
        return;
      }
      await applyLoad(result.uri, name, true);
    } catch {
      // Native-side failure; pickFileAsync itself resolves (rather than
      // throws) with { canceled: true } when the user backs out of the
      // picker, so this only guards against something going genuinely wrong.
    }
  }, [applyLoad]);

  const requestAccess = useCallback(async () => {
    await openAllFilesAccessSettings();
  }, []);

  // Clear a toast message once it has been shown.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(id);
  }, [error]);

  return {
    activeText,
    candidates,
    active,
    delayMs,
    needsPermission,
    error,
    setDelayMs,
    selectCandidate,
    clearSubtitle,
    pickFromFile,
    requestAccess,
  };
}
