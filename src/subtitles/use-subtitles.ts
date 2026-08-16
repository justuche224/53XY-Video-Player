import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Directory, File } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import type { VideoPlayer } from 'expo-video';

import { getSubtitlePrefs, setSubtitleDelay, setSubtitlePrefs } from '@/db/progress-repo';
import { isReleasedObjectError } from '@/player/released-object';

import type { Cue, SubtitleCandidate } from './types';
import { activeCues, cueTextOf } from './active-cue';
import { findSubtitleCandidates, pickAutoLoad, SUBS_FOLDER_NAMES } from './find-sibling';
import type { DirectoryEntry, SubsFolder } from './find-sibling';
import { loadSubtitle, SubtitleTooLargeError } from './load-subtitle';
import { canReadFolder, openAllFilesAccessSettings } from './storage-access';

/** How often the cue clock ticks. 1s (the player's timeUpdate interval) would
 *  land lines up to a second late; 150ms is imperceptible and cheap. */
const TICK_MS = 150;

/** Trailing debounce for persisting a delay-slider drag. A slider fires many
 *  times a second; only the settled value is worth a write. */
const DELAY_PERSIST_DEBOUNCE_MS = 400;

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
 * is legacy-bridge internals, and this app runs with the new architecture on
 * (android/gradle.properties: newArchEnabled=true), so reaching into
 * `NativeModules.I18nManager` directly means going through the turbo-module
 * interop layer rather than the documented `I18nManager` JS API.
 * `Intl.DateTimeFormat().resolvedOptions().locale` is a standard ECMA-402 API
 * that Hermes ships with (ICU data bundled by default, no extra gradle flag
 * present in this repo), works identically on old and new architecture, and
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

  // delayRef lets the ticker, and setDelayMs's immediate recompute, read the
  // live delay without a delay change recreating the interval below. Every
  // path that changes `delayMs` (the reset effect and setDelayMs) also
  // writes this ref imperatively at the same time, so it needs no render-
  // phase sync of its own.
  const delayRef = useRef(0);
  // cuesRef exists so setDelayMs — a plain callback, not an effect — can
  // read the current cues without capturing a stale closure. Unlike
  // delayRef this is NOT about avoiding interval recreation: the ticker
  // effect below already depends on `cues` directly and recreates its
  // interval on every subtitle switch regardless.
  const cuesRef = useRef<Cue[] | null>(null);
  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);
  const shownRef = useRef('');

  // embeddedActive read through a ref, kept fresh via effect (never written
  // during render — a render that is interrupted or thrown away before
  // committing must not be able to leave a ref holding a value that was
  // never actually part of a committed render). Backs the per-video reset
  // effect and the AppState handler, both of which deliberately exclude
  // `embeddedActive` from their dependency arrays (see the comments at
  // each).
  const embeddedActiveRef = useRef(embeddedActive);
  useEffect(() => {
    embeddedActiveRef.current = embeddedActive;
  }, [embeddedActive]);

  // A single staleness definition shared by every applyLoad call site (the
  // reset effect's two loads, the AppState re-probe, selectCandidate and
  // pickFromFile): each bumps this immediately before calling applyLoad and
  // captures the post-bump value, then passes `() => loadSeqRef.current !==
  // seq` as applyLoad's isCancelled predicate. Whichever load bumped the
  // sequence last is the only one allowed to commit — this covers both a
  // video change arriving mid-load (an older sequence number can never
  // become current again) and two loads in flight for the *same* video (the
  // most recently requested one wins, not whichever happens to resolve
  // first). A plain per-video `videoId` comparison only caught the first
  // case.
  const loadSeqRef = useRef(0);

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

  // `isCancelled` is checked right after the read resolves, before any state
  // write: `loadSubtitle`'s await can outlive the video that requested it
  // (the screen stays mounted across next/prev/autoplay — see
  // handleNavigateTo in app/player.tsx, which updates videoId/uri via
  // router.setParams rather than unmounting), so without this a stale
  // video's subtitles — or a stale error — could land on the next one. Every
  // call site passes `() => loadSeqRef.current !== seq` (see loadSeqRef
  // above), which also closes the same-video case: two loads in flight for
  // one video resolve in whichever order they resolve, but only the one
  // that bumped the sequence last is allowed to commit.
  const applyLoad = useCallback(
    async (uri: string, name: string, persist: boolean, isCancelled: () => boolean) => {
      let loaded;
      try {
        loaded = await loadSubtitle(uri, name);
      } catch (e) {
        if (isCancelled()) return;
        setError(
          e instanceof SubtitleTooLargeError ? 'Subtitle file is too large' : `Could not read ${name}`,
        );
        return;
      }
      if (isCancelled()) return;
      if (loaded.cues.length === 0) {
        setError(`No subtitles found in ${name}`);
        return;
      }
      setCues(loaded.cues);
      setActive({ uri: loaded.uri, name: loaded.name });
      // Mutually exclusive with embedded tracks. `useVideoPlayer` releases
      // the previous player during the commit in which `uri` changes, which
      // can land while this function was parked on the `loadSubtitle` await
      // above — the isCancelled() check just above can lag that release by
      // a tick (the release can happen synchronously during commit, ahead
      // of the passive-effect cleanup that flips the cancellation flag), so
      // this assignment can still throw against an already-released player.
      // That is not a read failure and must not surface as "Could not read
      // ...", so it gets its own guard rather than falling into the outer
      // catch.
      try {
        player.subtitleTrack = null;
      } catch (err) {
        if (!isReleasedObjectError(err)) throw err;
      }
      if (persist && videoId) {
        await setSubtitlePrefs(db, videoId, uri, delayRef.current, Date.now());
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
            const seq = ++loadSeqRef.current;
            await applyLoad(prefs.uri, name, false, () => loadSeqRef.current !== seq);
            return;
          }
        } catch {
          // fall through to auto-detect
        }
      }

      // Do not auto-load over an embedded track that is already showing.
      if (embeddedActiveRef.current || !folderUri) return;
      const pick = pickAutoLoad(found, deviceLanguage());
      if (pick) {
        const seq = ++loadSeqRef.current;
        await applyLoad(joinUri(folderUri, pick.relativePath), pick.name, false, () => loadSeqRef.current !== seq);
      }
    })().catch(() => {
      // applyLoad only throws for something genuinely unexpected (a
      // non-release error touching the player, or setSubtitlePrefs
      // failing — the ordinary "couldn't read/parse this file" cases are
      // already caught inside applyLoad and turned into setError there).
      // getSubtitlePrefs/scan could in principle throw too. Without this
      // catch any of those would surface as an unhandled promise rejection
      // instead of a toast. Guarded by `cancelled` — this effect's own
      // teardown flag, still needed here (independently of loadSeqRef) to
      // guard the setDelayMsState/setCandidates writes above — so a failure
      // that resolves after the video has already changed again cannot
      // flash an error over the new video.
      if (cancelled) return;
      setError('Could not load subtitles');
    });

    return () => {
      cancelled = true;
    };
    // embeddedActive is deliberately excluded: this effect is the per-video
    // reset, and re-running it when the user toggles an embedded track would
    // wipe their external selection. Its value is instead read through
    // embeddedActiveRef (kept fresh by its own effect above), which this
    // effect can read without depending on it.
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
    // No effect-scoped cancellation flag here (round 1 added one; dropped
    // now that it would do nothing loadSeqRef doesn't already cover — this
    // effect has no other async state write that needs guarding, unlike the
    // reset effect above).
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !folderUri) return;
      if (!canReadFolder(folderUri)) return;
      setNeedsPermission(false);
      const found = scan();
      setCandidates(found);
      if (!active && !embeddedActiveRef.current) {
        const pick = pickAutoLoad(found, deviceLanguage());
        if (pick) {
          const seq = ++loadSeqRef.current;
          const isCancelled = () => loadSeqRef.current !== seq;
          void applyLoad(joinUri(folderUri, pick.relativePath), pick.name, false, isCancelled).catch(() => {
            if (isCancelled()) return;
            setError('Could not load subtitles');
          });
        }
      }
    });
    return () => sub.remove();
    // embeddedActive: see the note on the reset effect above — read through
    // embeddedActiveRef so toggling an embedded track cannot tear down and
    // restart this listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPermission, folderUri, scan, active, applyLoad]);

  // ── Actions ───────────────────────────────────────────────────────────
  const delayPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // The DB write is debounced (a slider drags dozens of times a
      // second) and goes through setSubtitleDelay, which touches only the
      // subtitle_delay_ms column — never subtitle_uri. Using setSubtitlePrefs
      // here would require passing `active?.uri`, and the per-video reset
      // effect briefly sets `active` to null while it restores prefs for a
      // freshly-selected video; a drag landing in that window would NULL
      // out a still-loading or already-remembered subtitle.
      if (!videoId) return;
      if (delayPersistTimerRef.current) clearTimeout(delayPersistTimerRef.current);
      delayPersistTimerRef.current = setTimeout(() => {
        delayPersistTimerRef.current = null;
        void setSubtitleDelay(db, videoId, delayRef.current, Date.now());
      }, DELAY_PERSIST_DEBOUNCE_MS);
    },
    [db, player, videoId],
  );

  // Flush a pending debounced delay write rather than lose the last drag
  // position — both when the video changes mid-debounce (this effect
  // re-runs, and its cleanup uses that render's own videoId/db, i.e. the
  // outgoing video's) and on true unmount.
  useEffect(() => {
    return () => {
      if (delayPersistTimerRef.current) {
        clearTimeout(delayPersistTimerRef.current);
        delayPersistTimerRef.current = null;
        if (videoId) void setSubtitleDelay(db, videoId, delayRef.current, Date.now());
      }
    };
  }, [db, videoId]);

  const selectCandidate = useCallback(
    async (candidate: SubtitleCandidate) => {
      if (!folderUri) return;
      const seq = ++loadSeqRef.current;
      await applyLoad(
        joinUri(folderUri, candidate.relativePath),
        candidate.name,
        true,
        () => loadSeqRef.current !== seq,
      );
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
      // No hard extension check here: some SAF providers (e.g. Android's
      // Downloads provider) hand back an opaque document id with no
      // extension as `name`, which would reject a perfectly good file. Let
      // loadSubtitle run — parseSubtitle falls back to content-sniffing, and
      // a genuinely unparseable file still surfaces the truthful "No
      // subtitles found in <name>" message.
      const seq = ++loadSeqRef.current;
      await applyLoad(result.uri, result.name, true, () => loadSeqRef.current !== seq);
    } catch {
      // In practice unreachable: File.pickFileAsync catches every error
      // internally and resolves with { canceled: true, result: null } (see
      // node_modules/expo-file-system/src/File.ts), so a genuine native
      // failure and a user cancelling the picker are indistinguishable at
      // this call site — both come back as a normal, non-throwing result.
      // Kept only as a last-resort guard.
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
