# Moments — captured scenes that outlive the file

**Status:** implemented — all three phases built. Phases 1, 1.5 and 2 are merged to `main` and device-verified; Phase 3 (durability & polish) is merged too, code-reviewed but not yet device-verified. See [HANDOFF.md](../../HANDOFF.md#2-status-table--single-source-of-truth) for current status.
**Date:** 2026-09-08

## 1. The problem

The current workaround for "I want to come back to this scene" is: reveal the
scrubber so the timestamp is visible, take a system screenshot, and hope. That
fails three ways.

1. **It gets lost.** The frame lands in `Screenshots/` among thousands of
   unrelated images with no way to filter it back out.
2. **The context evaporates.** Weeks later the image is a picture of a face with
   no title, no episode, and no reason attached.
3. **It is a dead end.** The timestamp is burned into pixels, so getting back to
   that moment in the video means reading it off the image and scrubbing by hand.

A moment fixes all three: it is a first-class record with the frame, the source
file, the exact position, a cleaned-up title, and a note — browsable on its own
screen, one tap from resuming playback at that exact spot, and durable enough to
survive the video file being deleted.

## 2. Core principle: a moment is self-contained

A moment borrows from the library when the library still has the file, and never
depends on it. Everything needed to render a moment card is copied onto the
moment row at capture time.

This is not a stylistic choice. `deleteVideosByIds` runs whenever a scan finds a
file gone, and both `playlist_items` and `manual_groups` cascade off `videos`. A
moments table with the same foreign key would silently lose the user's saved
scenes at exactly the moment they matter most — when the file is gone. So the
`moments` table has **no foreign key to `videos`**, and holds its own snapshot.

## 3. Data model

Migration **v11** (`LATEST_VERSION` → 11):

```sql
CREATE TABLE IF NOT EXISTS moments (
  id            TEXT PRIMARY KEY NOT NULL,
  video_id      TEXT,             -- MediaStore id at capture time. Intentionally no FK.
  position_ms   INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  frame_uri     TEXT,             -- saved JPEG; null only when the grab failed
  note          TEXT,             -- seeded from the on-screen subtitle line, editable
  -- snapshot, written once at capture, never refreshed:
  title         TEXT NOT NULL,    -- normalizeTitle() output, e.g. "Boston Legal"
  episode_label TEXT,             -- formatEpisodeLabel() output, e.g. "S02E14"
  filename      TEXT NOT NULL,
  folder        TEXT,
  video_uri     TEXT,
  duration_ms   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_moments_created ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_video   ON moments(video_id, position_ms);
```

`video_id` is nullable and unconstrained: it is a hint for relinking, not an
ownership edge.

The snapshot is deliberately frozen. If the user later renames a file or edits a
manual group, the moment keeps the name it was saved under — the name they will
remember it by.

### Naming reuses the grouping engine

No new title logic. `normalizeTitle(filename)` gives the show/movie name and
`parseEpisode` → `formatEpisodeLabel` gives `S02E14`, exactly as the group
screen derives them. A card reads

> **Boston Legal · S02E14 · 41:12**

rather than `Boston.Legal.S02E14.1080p.WEB-DL.x265.mkv`.

## 4. Capture

### Trigger

A bookmark icon button in the player's `TopBar` `right` slot, first in the
action row. Playback is never interrupted.

### Pipeline

`captureMoment()` runs these steps for a single tap:

1. **Position** — read from the player's cached position ref, never
   `player.currentTime`. expo-video releases the shared object before cleanup
   runs, and reading through it throws "Cannot use shared object that was
   already released".
2. **Note seed** — `useSubtitles`' `activeText`, which is the delay-adjusted
   `cueTextOf(activeCues(...))` the overlay is already rendering. If a subtitle
   is on screen its line becomes the moment's note; if none is loaded, the note
   starts empty.
3. **Frame** — `FrameGrabber.grabFrame(uri, { positionsMs: [positionMs], minScore: 0, targetWidth: MOMENT_WIDTH, quality: MOMENT_QUALITY, exact: true, outPath })`.
   `minScore: 0` disables the black/flat-frame rejection that poster selection
   wants and a bookmark must not have — the user asked for *this* frame.
   Constants live in `src/moments/moment-policy.ts`: `MOMENT_WIDTH = 1280`,
   `MOMENT_QUALITY = 0.9`, `SNACKBAR_MS = 5000`, `RELINK_DURATION_TOLERANCE_MS = 1000`.
4. **Persist** — insert the row, then write the manifest (§5).
5. **Confirm** — show the snackbar.

A failed grab (step 3 returning null, or throwing) still saves the moment with
`frame_uri = null`; the position, title, and note are the load-bearing parts. The
card renders a placeholder for a frameless moment.

### Required native change: exact-position seeking

`FrameGrabberModule.kt` currently passes `MediaMetadataRetriever.OPTION_CLOSEST_SYNC`,
with a comment stating that sub-second precision is irrelevant for a poster
frame. That is correct for poster frames and wrong for moments:
`OPTION_CLOSEST_SYNC` snaps to the nearest keyframe, and at a typical 5–10 second
GOP the saved image can show a completely different shot from the one on screen.

Add an `exact: Boolean = false` field to the module's options record. When set,
use `MediaMetadataRetriever.OPTION_CLOSEST` on both the `getScaledFrameAtTime`
(API ≥ O_MR1) and `getFrameAtTime` branches. The thumbnail and scrub-preview
callers pass nothing and keep today's fast keyframe behaviour unchanged.

Exact seeking is slower — it decodes forward from the preceding keyframe — which
is acceptable for a one-shot, user-initiated capture and is precisely why it is
opt-in rather than the default.

**This makes the capture phase a native change requiring `npx expo run:android`.**

### Confirmation snackbar

In the same slot as `ResumeSnackbar`, and built the same way:

> **Moment saved · 41:12**  ·  **Edit**

- Auto-dismisses after 5s. The timer must use the callback-ref pattern from
  `ResumeSnackbar` — the player re-renders roughly once a second from
  `timeUpdate`, which would otherwise re-arm the timer forever.
- Ignoring it is a complete interaction. The moment is already saved.
- **Edit** opens the note sheet, pre-filled with the subtitle-seeded note, and
  pauses playback while the sheet is open.

The note remains editable later from the moment detail screen, so nothing is
lost by letting the snackbar go.

## 5. Storage and durability

### Layout

Frames are written **directly** to shared storage — one file, one location, no
mirroring or copying:

```
/storage/emulated/0/53XY/Moments/
  .nomedia          # hides the folder from the gallery and the media scanner
  moments.json      # manifest of every row, rewritten on each change
  <moment-id>.jpg
```

- **`.nomedia` is what keeps moments out of the gallery** and away from the
  screenshots folder. It is written once, when the directory is created.
- `MANAGE_EXTERNAL_STORAGE` is already granted (for subtitle reading), so this
  needs no new permission and no new user-facing prompt.
- SQLite remains the fast query index; the folder is the durable truth.

### Fallback

`pickMomentsDir(externalWritable: boolean)` is a pure decision returning the
shared directory when writable and the app document directory otherwise. A
moment always saves; only uninstall-survival is lost in the fallback case. The
resolved absolute uri is stored on the row either way, so a moment saved under
one location keeps working after the other becomes available.

The app document directory is the fallback rather than the cache directory for
the same reason `thumbnails.ts` gives: Android evicts cached files under storage
pressure, which is how a stored uri ends up pointing at nothing.

### Manifest and restore

`moments.json` carries a `version` field and the full field set of every row.
Parsing is tolerant: unknown fields are ignored, and a row missing a required
field is skipped rather than failing the whole restore.

When the `moments` table is empty **and** a manifest exists with at least one
entry, the app offers to restore. Accepting re-inserts the rows, keeping only
entries whose JPEG is still present or whose frame was already null. This
single mechanism covers both uninstall/reinstall and Clear Data.

Restore is offered, never automatic, and declining does not delete the manifest —
a later launch offers it again.

**Deviation from this section as shipped (Phase 3):** this section originally
called for the offer to appear "on launch" — a cold-start modal. It shipped
instead in the **Moments tab's empty state**, plus an explicit **Restore from
backup** row in Settings → Player. A cold-start modal interrupts before the
user has any context and would fire just as readily at someone who simply has
no moments yet, whereas an empty Moments tab is exactly where a reinstalled
user looks for them. This still satisfies every real requirement above: the
offer is never automatic, declining never deletes the manifest, and the offer
persists across visits (`pendingRestoreCount` re-checks each time the tab or
the Settings screen gains focus). `restoreMomentsFromManifest` additionally
refuses to act whenever the table already has rows, even if a caller skipped
the `pendingRestoreCount` gate — the manifest is a recovery copy of unknown
age, and restoring over live data would destroy whichever of the two is
newer.

### Getting a frame out

Both actions are explicit and per-moment, so the gallery only ever holds frames
the user deliberately put there:

- **Share** — via `expo-sharing` (already a dependency). Not the local
  `ShareMedia` module: that one requires MediaStore `content://` URIs and throws
  on `file://`, which is what a moment frame is.
- **Save to gallery** — copies the JPEG into the user's photo library through
  `expo-media-library`'s class-based SDK 56 API.

## 6. Browse and playback

### Moments tab

A fifth top-level tab. `TabBar` already divides its width by `state.routes.length`,
so it accommodates a fifth entry without layout changes; `tabLabelFor` and
`tabIconFor` each gain a `moments` case (`bookmark` / `bookmark-outline`).

- Reverse-chronological, sectioned by `title` so a series' moments cluster
  together.
- Grid of frames, each with a timestamp badge and the note as a caption.
- Search matches note text and title.
- Long-press enters the existing `ContextualAppBar` multi-select for delete and
  share. `onPlay` is omitted — a multi-selection has no single play target.

### Moment detail

Full-bleed frame, `Boston Legal · S02E14`, position plus capture date, the note,
and actions: **Play from here**, **Edit note**, **Share**, **Save to gallery**,
**Delete**.

Deleting a moment removes the row, its JPEG, and its manifest entry.

### Resolving the file

`resolveMomentTarget(moment, videos)` is pure and returns one of three outcomes:

| Outcome | Condition | Behaviour |
|---|---|---|
| `exact` | `video_id` is in the library | Play it. |
| `relinked` | id gone, but a library video matches on `filename` **and** `duration_ms` within ±1000 ms | Play it, and heal `video_id`/`video_uri` on the row. |
| `missing` | no match | Card renders dimmed with "File no longer on this device". Frame, note, title, and timestamp all remain; only Play is disabled. |

Matching on filename *and* duration together avoids relinking to a different
file that happens to share a name across folders. Duration is compared with
tolerance because container-reported durations drift slightly between scans.

Relinking handles the common case of a file moved to another folder. It does not
attempt to recover a renamed file — that would need content hashing, which is
not worth reading whole files for.

### Playing from a moment

The player gains a `startMs` route param. When present it takes precedence over
the saved resume position and suppresses the resume snackbar: the user asked for
a specific position and should not be told they were "resumed" somewhere else.

### Seekbar ticks

`Seekbar` renders small marks at each of the current video's moment positions,
so a rewatch shows where scenes were flagged. Presentational only — the marks
are not interactive.

## 7. Module map

Pure and Jest-tested, following the existing convention of keeping logic out of
components:

| File | Responsibility |
|---|---|
| `src/moments/moment-title.ts` | `momentDisplay(video)` → `{ title, episodeLabel }` |
| `src/moments/resolve-moment-video.ts` | `resolveMomentTarget` — exact / relinked / missing |
| `src/moments/group-moments.ts` | sectioning and search filtering for the tab |
| `src/moments/manifest.ts` | `toManifest` / `fromManifest`, tolerant parsing |
| `src/moments/moments-dir.ts` | `pickMomentsDir` directory decision |
| `src/moments/moment-policy.ts` | capture constants (width, quality, tolerances) |

I/O and UI:

| File | Responsibility |
|---|---|
| `src/db/moments-repo.ts` | insert, list, list-by-video, update note, delete |
| `src/moments/capture.ts` | orchestrates grab → insert → manifest |
| `src/moments/storage.ts` | directory creation, `.nomedia`, manifest read/write, JPEG delete |
| `src/app/(tabs)/moments.tsx` | the tab |
| `src/app/moment.tsx` | detail screen |
| `src/components/moment-card.tsx` | grid card, including the missing-file treatment |
| `src/components/moment-note-sheet.tsx` | note editor, used from snackbar and detail |
| `src/components/player/moment-snackbar.tsx` | capture confirmation with **Edit** |

Modified: `src/db/schema.ts`, `src/navigation/tab-icon.ts`,
`src/app/(tabs)/_layout.tsx`, `src/app/player.tsx`,
`src/components/player/top-bar.tsx` (caller only), `src/components/player/seekbar.tsx`,
`modules/frame-grabber/` (native + TS types), `src/app/settings/`.

### To verify against the SDK at implementation time

Per `AGENTS.md`, these are checked against the installed typings rather than
assumed:

- the class-based `expo-media-library` call for saving an asset to the gallery;
- `expo-file-system`'s `Directory`/`File` behaviour for paths outside the app
  sandbox.

## 8. Error handling

| Failure | Behaviour |
|---|---|
| Frame grab returns null or throws | Moment saves with `frame_uri = null`; card shows a placeholder. |
| Shared storage unwritable | `pickMomentsDir` falls back to the document directory; capture succeeds. |
| Manifest write fails | Capture still succeeds — the DB row is authoritative for the running app. Logged, retried on the next write. |
| Manifest is corrupt on restore | Skip unparseable rows, restore the rest, and report the count actually restored. |
| JPEG missing at render time | Card falls back to the placeholder rather than a broken image. |
| Video file gone | `missing` outcome; everything but Play still works. |

## 9. Phasing

Three plans, three branches, matching the project's usual workflow.

**Phase 1 — Capture & store.** Native `exact` option, migration v11,
`moments-repo`, the capture pipeline, disk layout and manifest writing, player
bookmark button, confirmation snackbar, note sheet. Ends with moments being
reliably captured and persisted, browsable only via the DB.
*Requires `npx expo run:android`.*

**Phase 2 — Browse & play.** Moments tab, cards, sections, search, detail
screen, `resolveMomentTarget` relinking, the `startMs` player param, multi-select
delete/share.

**Phase 3 — Durability & polish.** Restore-on-fresh-install flow, save-to-gallery,
seekbar ticks, Settings group (storage location, moment count and size, restore,
clear all).

## 10. Decisions made, and what would reopen them

| Decision | Reasoning | Revisit if |
|---|---|---|
| No FK to `videos` | Scan-driven `deleteVideosByIds` would destroy moments for deleted files — the exact case the feature exists for. | Never; this is the feature. |
| Frames in shared storage with `.nomedia` | Survives uninstall and Clear Data without putting anything in the gallery. | The permission ever becomes unavailable. |
| Frozen snapshot, not live join | The moment keeps the name it was saved under. | Users report stale names being confusing. |
| Subtitle line as the default note | Solves "I forgot the context" for free, and stays searchable text rather than burned-in pixels. | — |
| `OPTION_CLOSEST` only when `exact` | Poster frames and scrub previews want the fast keyframe path. | — |
| Relink on filename + duration only | Content hashing means reading whole files for a rare case. | Renames turn out to be common in practice. |
| Fifth tab rather than a History segment | The feature is a headline capability and needs to be browsable, not buried. | The tab bar gets crowded by a sixth destination. |
