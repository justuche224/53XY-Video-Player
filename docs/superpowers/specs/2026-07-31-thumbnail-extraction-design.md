# Thumbnail Extraction Engine — Design

**Date:** 2026-07-31
**Scope:** Replace the current thumbnail pipeline with a native frame grabber that picks a *good* frame, at a sane size, stored durably. First of two specs; the UI modernization pass (header, continue-watching banner, card/shape language) is brainstormed separately and depends on this one landing first.

## Problem

Library cards are overwhelmingly black tiles. VLC, on the same files, shows rich mid-scene frames.

Three independent causes, all in [`src/media/thumbnails.ts`](../../../src/media/thumbnails.ts):

1. **Fixed 1-second seek.** `getThumbnailAsync(uri, { time: 1000 })` grabs one second into the file. Episodes and films almost universally open on black, a fade-in, or a studio logo. VLC seeks to a *fraction of duration* instead ([vlc-android thumbnailer](https://code.videolan.org/videolan/vlc-android/-/commit/bf90b313dc9b7c0f21d547deb771966ab7cc80a3)) — this is the single biggest difference.
2. **Full-resolution frame at `quality: 0.5`.** We decode a 1280×720 frame, JPEG it at half quality, then render it into a ~170 px card. Soft *and* wasteful — wrong on both axes.
3. **No verification.** Whatever comes back is stored, black or not. There is no second attempt.

A fourth, latent: `expo-video-thumbnails` writes into the **cache** directory, which Android evicts under storage pressure. A stored `thumb_uri` can therefore point at a file that no longer exists, and nothing regenerates it.

## Goals

Thumbnails that read as well as VLC's on the same library — specifically on dark shows, which are the honest test. Sharp enough for a full-bleed hero banner. Non-goals: animated hover previews, user-chosen custom thumbnails, letterbox bar trimming (revisit after seeing real output).

---

## 1. Native module — `modules/frame-grabber`

A local Expo module (Kotlin), following the structure of the existing `modules/system-volume`.

```ts
grabFrame(uri: string, opts: {
  positionsMs: number[];   // candidate ladder, in priority order
  targetWidth: number;
  minScore: number;
  quality: number;         // 0..1 JPEG quality
  outPath: string;         // absolute destination path
}): Promise<{ uri: string; positionMs: number; score: number } | null>
```

Kotlin walks `positionsMs` in order and **stops at the first frame scoring ≥ `minScore`** — typically one decode, worst case `positionsMs.length`. Only the winning frame is written to disk.

**Decode:** `MediaMetadataRetriever.getScaledFrameAtTime(timeUs, OPTION_CLOSEST_SYNC, targetW, targetH)` on API ≥ 27, falling back to `getFrameAtTime` + `Bitmap.createScaledBitmap` below that. `OPTION_CLOSEST_SYNC` keeps extraction fast by snapping to keyframes; sub-second precision is irrelevant for a poster frame.

**Scoring** runs on a 160 px-wide working copy of the decoded bitmap and returns a single `score` in 0..1:

- **Mean luma** — rejects black frames, fade-ins, and blown-white flashes. Frames below or above the usable band score 0.
- **Luma standard deviation** — rejects solid-colour cards, flat-background studio logos, and single-tone gradients. This is what catches the frames a brightness check alone would pass.

The returned `score` is the std-dev term gated by the luma band, so a mid-bright detailed frame scores high and a near-black or flat frame scores near zero.

**Never blank when a frame exists.** If no candidate clears `minScore`, the module returns the **best-scoring candidate anyway** — a mediocre frame beats a placeholder. `null` is returned only when every decode fails (corrupt file, unsupported container).

**Policy stays in TypeScript.** Ladder positions, thresholds, sizes, and quality are all passed in as parameters, so they are Jest-testable and tunable without a native rebuild. Kotlin owns pixels only.

## 2. Frame selection & output

**Candidate ladder** (fractions of duration, in order): **25% → 45% → 12% → 65%**.

25% is where episodic content is reliably mid-scene, past cold-opens and title sequences. The rest are escape hatches: 45% for shows with long intros, 12% for very long files where 25% may land in a dark act, 65% as a last resort. Derived by a pure function `candidatePositions(durationMs)`, which clamps against short files (a 90-second clip collapses the ladder to fewer, closer positions rather than sampling the same keyframe four times).

**Sizes** — two, keyed into the filename:

| Use | Width | Quality | Notes |
|---|---|---|---|
| Library cards, collages, rows | 640 | 0.8 | ~45 KB/video; covers a 2× DPR grid card with headroom |
| Continue-watching hero | 1280 | 0.85 | Generated for that one video only, on demand; a full-bleed banner shows every soft pixel |

The hero-size frame reuses the *same* winning position as the card frame when one exists (read from `thumb_time_ms`, passed as a single-element ladder), so the two never disagree visually. It is generated on demand, when the continue-watching component requests width 1280 and no file is present — one video, one extra decode, refreshed only when the resume target changes.

**Storage moves to `documentDirectory/thumbnails/`** — durable, not cache. Deterministic filename `<videoId>@<width>.jpg`. Only the 640 path is stored in `videos.thumb_uri`; the hero path is derived from the same rule and existence-checked on disk, so it needs no column of its own. A missing file on disk is treated as no thumbnail and regenerates, which also fixes the pre-existing eviction hole.

## 3. Invalidation & the idle sweep

**Migration v7** (schema is at v6 — `preview_frames`):

```sql
ALTER TABLE videos ADD COLUMN thumb_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN thumb_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN thumb_time_ms INTEGER;
UPDATE videos SET thumb_uri = NULL;
```

Every existing thumbnail is a bad 1-second frame, so all are dropped. Each successful generation writes back the path, the winning `positionMs` (`thumb_time_ms`), and a `THUMB_VERSION` constant defined in TS; a row whose `thumb_version` is below the current constant is treated as stale and regenerated. Future algorithm changes bump the constant instead of shipping another migration.

`LATEST_VERSION` moves to 7.

**Visible-first generation is unchanged.** `VideoThumbnail` keeps its `requestIdleCallback` + `pLimit(3)` behaviour — scrolling always fills the screen first. Only the underlying call swaps to the new module.

**Idle sweep** — a new hook mounted at `LibraryProvider` level:

- Walks every video with no valid thumbnail, `pLimit(1)`, 300 ms gap between frames.
- **Ordering:** recently played first, then library order — the videos most likely to be looked at get warm soonest.
- **Pauses** when the app backgrounds (`AppState`) and while the player screen is active, so it never competes with playback or scrolling.
- **Gives up** on a row after 3 failed attempts (`thumb_attempts`), so a corrupt file is not retried on every launch.
- Resumable by construction: state lives in the `videos` table, so a kill mid-sweep costs nothing.

## 4. Call-site migration

- [`src/media/thumbnails.ts`](../../../src/media/thumbnails.ts) — `getOrCreateThumbnail` rewritten against the new module; signature grows a size argument. Consumers (`VideoThumbnail`, `ThumbnailCollage`) are otherwise untouched.
- [`src/player/use-preview-strip.ts:77`](../../../src/player/use-preview-strip.ts#L77) — the scrub-preview strip currently pulls **full-resolution** frames at `quality: 0.3`. Swapped onto the same module with `targetWidth: 320` and a single-element `positionsMs` (no scoring — strip frames must land at their exact slot time). Sharper and faster for a one-line change. Slot math, DB schema, and validation logic are all unchanged.

## Tests

Jest, on the pure TS policy layer:

- `candidatePositions` — ladder ordering, short-file collapse, clamping inside duration bounds.
- Staleness predicate — version below constant, missing file, null uri, attempts exhausted.
- Sweep queue ordering — recently-played priority, exclusion of exhausted and already-valid rows.
- Thumbnail path derivation — per video id and width.

Scoring itself is Kotlin and not unit-tested; it is validated on device.

**Device verification (adb, per project convention):** side-by-side against VLC on the same Shameless, Banshee, and Avatar folders. Dark shows are the real bar. Also verified: a full library sweep completes without visible scroll jank, and the sweep pauses during playback.

## Delivery

One commit series. `tsc` clean and Jest green before the UI spec starts. The dev client needs a rebuild for the native module — expected, and routine given `modules/system-volume` already exists.
