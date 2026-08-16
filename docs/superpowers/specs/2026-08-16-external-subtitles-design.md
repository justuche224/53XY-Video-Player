# External Subtitles — Design

**Date:** 2026-08-16
**Scope:** Load external subtitle files (`.srt`, `.vtt`, `.ass`/`.ssa`) from device storage, auto-detect the one sitting next to the video, render them ourselves, and expose a live delay slider for sync. Text size is the one appearance control.

## Goals

Close the last big gap against MX Player / VLC for local playback: a video whose subtitles live in a separate file next to it should Just Work, and when a subtitle is out of sync the user should be able to fix it while watching.

**Non-goals:** online subtitle download (deferred — see §11), ASS positioning/styling/karaoke, per-video appearance overrides, subtitle search within a file, muxing subtitles into the file.

---

## 1. Why we render subtitles ourselves

`expo-video` v56 exposes `subtitleTrack` / `availableSubtitleTracks`, but both are **read-only projections of the media source**. There is no API to attach an external file to a `VideoSource`. Embedded tracks therefore keep working exactly as they do today, and external subtitles are an entirely separate path: parse the file in JS, and render a text overlay above `VideoView` driven by `player.currentTime`.

This is not a workaround so much as a lever: because we own the cue clock, the delay slider is a single offset applied at lookup time, with no player involvement at all.

**Verify against https://docs.expo.dev/versions/v56.0.0/ before coding:** the exact `expo-file-system` v56 surface for `File.bytes()`, `File.text()`, `File.pickFileAsync`, `Directory.list()`, and whether `TextDecoder` is available in this Hermes build (§3).

## 2. Module layout

All logic lives in `src/subtitles/`. `player.tsx` is 1132 lines already and imports exactly one thing from this feature: `useSubtitles`.

| Module | Purpose | Pure? |
|---|---|---|
| `types.ts` | `Cue = { startMs, endMs, text }`, `SubtitleCandidate`, `SubtitleSource` | — |
| `decode-text.ts` | bytes → string with encoding detection | ✅ |
| `parse-srt.ts` | SRT → `Cue[]` | ✅ |
| `parse-vtt.ts` | WebVTT → `Cue[]` | ✅ |
| `parse-ass.ts` | ASS/SSA `Dialogue:` lines → `Cue[]`, override tags stripped | ✅ |
| `parse-subtitle.ts` | extension → parser dispatch, size guard | ✅ |
| `find-sibling.ts` | video path + directory listing → ranked candidates | ✅ |
| `active-cue.ts` | `(cues, timeMs, delayMs) → Cue[]` | ✅ |
| `storage-access.ts` | probe / request all-files access | native |
| `load-subtitle.ts` | read file → decode → parse | native |
| `use-subtitles.ts` | the hook `player.tsx` consumes | — |

UI: `src/components/player/subtitle-overlay.tsx`, `src/components/player/subtitle-delay-bar.tsx`, `src/components/storage-access-sheet.tsx`, plus an External section added to the existing `tracks-sheet.tsx`.

Everything marked pure is Jest-testable with no device, which is where the real correctness risk lives.

## 3. Parsing

### Cue model

`Cue = { startMs: number; endMs: number; text: string }`, sorted by `startMs`. `text` may contain `\n`. Basic inline tags (`<i>`, `<b>`, `<u>`, `{\i1}`) are **stripped, not rendered** — italics are not worth a rich-text renderer here.

### SRT and VTT

Near-identical: numbered blocks, `HH:MM:SS,mmm --> HH:MM:SS,mmm` (VTT uses `.` and may omit the hour field, and carries a `WEBVTT` header plus optional `NOTE`/`STYLE`/cue-settings blocks, all discarded). One shared timestamp parser; the two format modules differ only in separator and header handling. Tolerate: CRLF, missing trailing blank line, missing sequence numbers, blank cues (dropped), out-of-order cues (sorted on output), and `endMs <= startMs` (dropped).

### ASS / SSA

Read `[Events]`, take the `Format:` line to find the `Start`, `End`, and `Text` column indices (never assume fixed positions), then parse each `Dialogue:` row. Timestamps are `H:MM:SS.cc` (centiseconds). From the text field: strip `{...}` override blocks, convert `\N` and `\n` to newlines, drop `\h` hard spaces. Drawing commands (`{\p1}` vector shapes) produce garbage coordinates as text — cues whose text is empty after stripping, or that came from a `\p`-mode block, are dropped.

Positioning is discarded: signs and typesetting render as plain bottom-centred lines alongside dialogue and will occasionally overlap. This is inherent to the as-text decision, not a defect.

### Encoding

Real-world SRT files are frequently **not** UTF-8 (Windows-1252 for Western European, CP1251 for Cyrillic), and a naive UTF-8 read turns every accented character into replacement junk. `decode-text.ts`:

1. BOM sniff → UTF-8 / UTF-16LE / UTF-16BE, decode accordingly.
2. Otherwise attempt strict UTF-8 (`TextDecoder('utf-8', { fatal: true })` if available in this Hermes build, else a hand-rolled validating decoder).
3. On failure, fall back to **CP1252**, decoded by a hand-rolled byte→codepoint map. Do not rely on `TextDecoder` supporting non-UTF-8 labels; React Native's implementation generally does not.

CP1251 and other legacy codepages beyond CP1252 are out of scope — they decode as CP1252 mojibake rather than failing, which is the same behaviour every other player has without explicit user encoding selection.

### Size guard

`parse-subtitle.ts` rejects files over **10 MB** with a toast. ASS files with embedded `[Fonts]` sections can be large, and there is no legitimate 10 MB dialogue track.

## 4. Timing and rendering

### The ticker

`timeUpdateEventInterval` is currently `1` — one second, far too coarse; cues would land up to a second late. Lowering it globally would multiply traffic on the progress-write path for no benefit there, so instead `use-subtitles` runs its own **150 ms interval** reading the synchronous `player.currentTime` getter.

- Runs whenever cues are loaded and the screen is focused — **including while paused**, so seeking or drag-scrubbing with the video paused still updates the visible cue.
- Stops on unmount, blur, or when no subtitle is active. Zero cost when the feature is unused.
- State updates only when the active cue set actually changes (compared by cue index), so the steady-state re-render cost is nil.

### Cue lookup

`activeCues(cues, timeMs, delayMs)` binary-searches for cues where `startMs <= (timeMs - delayMs) < endMs`.

**Delay semantics:** `delayMs > 0` means subtitles appear **later** — i.e. the file is ahead of the audio and needs pushing back. Lookup time is therefore `videoTime - delay`. This must be stated in the UI too ("+1.2s" = later).

ASS commonly has overlapping cues (a sign and a line of dialogue at once), so the function returns an **array**, capped at 3, ordered by `startMs`. The overlay joins them with newlines.

### Overlay style

`subtitle-overlay.tsx`, absolutely positioned above `VideoView`, below the controls chrome in z-order:

- White text, `textShadow` (rgba(0,0,0,0.9), radius 4, offset 0/1) for readability over bright frames.
- Bottom-centred, `maxWidth: 90%`, `textAlign: center`, wraps freely (no line clamp).
- Sits above the bottom bar when controls are visible; drops to safe-area inset + fixed margin when they hide, animated with the existing chrome fade.
- **Stays visible when the screen is locked** — lock hides chrome, not content.
- `allowFontScaling={false}`: the in-app size control is the single source of truth, so system font scaling cannot distort a deliberately chosen size.
- Sizes: S 14 / M 17 / L 20 / XL 24 dp.

**Known limitation:** the overlay is a React view, not part of the video surface, so subtitles do **not** appear in PiP or in a background-playback notification. Acceptable; both are audio-oriented modes.

## 5. Storage access

### The problem

Videos arrive from `expo-media-library` as `file:///storage/emulated/0/...` paths and the app holds `READ_MEDIA_VIDEO`. On Android 13+ that grants **video files only**; a sibling `.srt` is a non-media file and is unreadable. `READ_EXTERNAL_STORAGE` (already declared) is ignored on API 33+.

### The decision

Declare `android.permission.MANAGE_EXTERNAL_STORAGE` ("All files access") in `app.config.ts`. This is what VLC and MX Player do, and 53XY ships as a side-loaded APK, so Play Store policy review is not a constraint. If that ever changes, the fallback path in this design (manual picker) is the migration route.

### Detecting the grant, without native code

There is no JS API for `Environment.isExternalStorageManager()`. Rather than extend the existing `modules/share-media` Kotlin module, **probe**: attempt `new Directory(videoFolder).list()`. A throw means not granted. This is cheap, needs no native work, and tests the exact capability we care about rather than a proxy for it.

If the probe proves flaky on some OEM build, adding an `isExternalStorageManager()` binding to the existing Kotlin module is the fallback — the probe is behind `storage-access.ts`, so that swap touches one file.

### The request flow

1. First time a subtitle action needs the filesystem, probe.
2. If denied, show `storage-access-sheet.tsx` explaining *why* in plain language: "Android treats subtitle files as non-media files, so 53XY needs All files access to read the `.srt` sitting next to your video. It is used only to read subtitle files."
3. Button → `expo-intent-launcher` (**new dependency**) fires `android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION` with `data: 'package:<applicationId>'`, landing the user directly on the toggle rather than on a generic settings screen.
4. Re-probe on `AppState` returning to `active`. On success, continue the original action (auto-detect or open picker) without making the user tap again.
5. If declined, the manual picker still works — `File.pickFileAsync` goes through SAF and needs no permission at all. Auto-detect is the only casualty, and the tracks sheet says so.

⚠️ **New permission + new native dependency ⇒ the dev client must be rebuilt** before any of this runs on device. Do this first so it never blocks verification.

## 6. Auto-detect

`find-sibling.ts` is pure: it takes the video's path and a directory listing (names only) and returns ranked candidates. The impure directory walk lives in `use-subtitles`.

**Search locations:** the video's own folder, plus a `Subs/` or `Subtitles/` **subfolder of that folder** (case-insensitive) if present.

**Extensions:** `.srt`, `.vtt`, `.ass`, `.ssa`.

**Ranking**, against video basename `B` (extension stripped, compared case-insensitively):

| Rank | Rule | Example for `Movie.mkv` |
|---|---|---|
| 0 | `N === B` | `Movie.srt` |
| 1 | `N === B.<lang>` where `<lang>` is a 2–3 letter alpha token | `Movie.en.srt`, `Movie.eng.srt` |
| 2 | `N === B.forced` / `B.<lang>.forced` / `B.sdh` / `B.<lang>.sdh` | `Movie.en.forced.srt` |
| 3 | `N` starts with `B` followed by `.`, `_`, `-`, or space | `Movie - Track 2.srt` |
| 4 | Any subtitle file in `Subs/`, **only if** the video's folder contains exactly one video file | `Subs/2_English.srt` |

Rank 4 handles the scene-release convention where `Subs/` files are named nothing like the video (`2_Eng.srt`). Gating it on a single-video folder prevents grabbing the wrong episode's subtitles out of a season folder — the listing includes video files, so the count is determinable inside the pure function.

Forced subtitles deliberately rank *below* full ones: forced tracks contain only foreign-language lines and auto-loading one over a complete track would look like broken subtitles.

**Auto-load selection:** best rank wins. Ties break by preferring no language suffix, then a token matching the device locale, then alphabetical — deterministic and testable. Every candidate, whatever its rank, is listed in the tracks sheet so a wrong guess is one tap from being corrected.

Auto-detect runs once per video load, off the critical path: playback starts immediately and subtitles appear when the scan resolves.

### Embedded vs external are mutually exclusive

Only one subtitle source is ever displayed. Selecting an external file sets `player.subtitleTrack = null`; selecting an embedded track clears the external one. Auto-detect **does not** auto-load when an embedded track is already active on load (a media file with a default-on track), which prevents two sets of subtitles stacking on screen — the detected candidates still appear in the tracks sheet for manual selection.

## 7. UI

### Tracks sheet

`tracks-sheet.tsx` gains an **External** section above the existing Embedded ones:

- Auto-detected candidates, each showing its filename, with the active one checked.
- **Load from file…** → `File.pickFileAsync` filtered to subtitle extensions.
- **Adjust delay…** → closes the sheet, opens the delay bar. Only shown when a subtitle is active.
- **Off**.

The existing "No embedded tracks available" empty state is replaced: with external subtitles the sheet always has something to offer. When all-files access is denied, the External section shows a short line offering to grant it, alongside the still-working picker.

### Delay bar

Not a modal — you must see the subtitles move to sync them. `subtitle-delay-bar.tsx` slides up over the video while playback continues:

```
  −0.5s   −0.1s   [────────●────────]   +0.1s   +0.5s     +1.20s   Reset
```

- Range **±20s**, step **50 ms**. Cues shift live as the slider is dragged.
- Auto-hides after **4 s** idle; any interaction resets the timer; never hides mid-drag.
- Persisted on rest, debounced, following the existing progress-writer discipline.

**Built on `Gesture.Pan`, following the proven `seekbar.tsx` pattern — not an `@expo/ui` native slider.** This repo has two separate commits fixing gesture-arena wedges in the player (`gesture-arena fix`, `gesture-wedge root fix`); dropping a native Host view into that arena is exactly the shape of change that caused them.

### Settings

Settings → Player gains **Subtitle text size**: S / M / L / XL segmented control, global, applied live.

## 8. Persistence

**Migration v10** (schema is at v9), on `watch_progress`, following the v5 `display_mode` precedent:

```sql
ALTER TABLE watch_progress ADD COLUMN subtitle_uri TEXT;
ALTER TABLE watch_progress ADD COLUMN subtitle_delay_ms INTEGER NOT NULL DEFAULT 0;
```

A video reopens with its subtitle and its sync offset intact.

**Critical:** these columns are written by their own targeted upserts (`setSubtitlePrefs`, mirroring `setDisplayMode`) and are **absent from `upsertProgress`'s `ON CONFLICT` SET list**. Migration v9 exists precisely because `completed` was being clobbered by `excluded.completed` on every progress write; the same trap is one careless line away here.

On load, a stored `subtitle_uri` is honoured only if the file still exists; if it has moved or been deleted, fall back to auto-detect. Marking a video unplayed deletes its `watch_progress` row and therefore its subtitle preference — consistent with how `display_mode` already behaves.

Text size is a global `settings` row: `subtitle_text_size` ∈ `s|m|l|xl`, default `m`.

## 9. Tests

Jest, on the pure modules — where the correctness risk actually lives:

- **Parsers:** well-formed SRT/VTT/ASS; CRLF; missing trailing newline; missing sequence numbers; VTT header and `NOTE`/`STYLE` blocks; out-of-order and zero-length cues; ASS `Format:` line with reordered columns; ASS override-tag and `\N` handling; drawing-command cues dropped.
- **Encoding:** UTF-8 with BOM, UTF-8 without BOM, UTF-16LE, a CP1252 fixture with accented characters that must not decode as replacement chars.
- **Matcher:** each rank in isolation; forced ranked below full; rank-4 gated on single-video folders (both directions); tie-breaking; case-insensitivity; no-match returns empty.
- **Cue lookup:** exact boundaries (`start` inclusive, `end` exclusive), gaps between cues, overlapping cues capped at 3, positive and negative delay, delay pushing lookup below zero or past the end.

Then device verification per project norm (adb, screenshots), against the rebuilt dev client: auto-detect on a real file, manual pick, delay drag while playing, persistence across reopen, permission-denied fallback path, and a gesture regression sweep (double-tap seek, brightness/volume swipe, drag-scrub, long-press boost, lock) with the delay bar open.

## 10. Risks

| Risk | Mitigation |
|---|---|
| `TextDecoder` unavailable or UTF-8-only in this Hermes build | Hand-rolled validating UTF-8 decoder + CP1252 map; verify before coding |
| Directory probe unreliable on some OEM ROM | `storage-access.ts` isolates it; swap in a Kotlin `isExternalStorageManager()` binding |
| Delay bar wedges the gesture arena | Reuse `seekbar.tsx`'s raw-gesture pattern; explicit on-device regression sweep |
| 150 ms ticker costs battery on long films | Only runs with cues loaded and screen focused; state updates only on cue change |
| Huge ASS file stalls parse | 10 MB guard with a toast |

## 11. Deferred: subtitle download

Online download (OpenSubtitles) is a **separate project with its own spec**, deliberately not folded in here. It needs a network layer, user-supplied API key handling in Settings, the OpenSubtitles moviehash (feasible — `FileHandle.readBytes` with an `offset` exists, so the filesize + first/last 64 KB hash is reachable without reading a 2 GB file), a search sheet, and quota-exhaustion error states.

An embedded API key was rejected: the quota is per-key, so all users would share and exhaust one allowance, the key is trivially extracted from an APK, and it likely violates OpenSubtitles' terms. When built, it reuses this project's parser, renderer, cache, and delay control unchanged — downloading a file is just another way to produce a `SubtitleSource`.
