# Playback startup latency — investigation

**Status: root cause confirmed for both cases; fixes shipped and device-verified — including that scrubbing/seeking still works correctly, after a first attempt broke it.**

## The complaint

Tapping play on a large (720p+) local video took anywhere from 1.5s to ~5s (worse
for some files, measured up to 12s on-device) before the picture appeared — long
enough that a tester repeatedly mashed the play button, assuming the app had
hung. VLC/MX feel instant (sub-500ms) on the same files.

## Method

Instrumented every real milestone between tap and first frame with a tagged
logger (`src/player/perf-log.ts`, temporary — grep `perf:player`):

`tap` (Home/group-detail, before `router.push`) → `mount-render` (player screen
first render) → `player-created` (`useVideoPlayer` builder) → `play-called`
(`player.play()`) → native `statusChange:loading` / `statusChange:readyToPlay`
→ `playingChange:true`.

Verified live on a physical SM-S901N (adb-connected dev client) via
`adb logcat | grep perf:player`, cross-referenced against unfiltered
`adb logcat -v time --pid=<app>` for the native side.

## Finding 1 — JS-side cost was already small, and one real waste is now fixed

Across every trace, `tap` → `play-called` was 130–330ms — not the bottleneck.
One genuine waste was found and fixed anyway: [player.tsx](../src/app/player.tsx)
called `useGroups(mode)` on every mount, which re-derived the grouping
(`normalizeTitle`/`parseEpisode` over the *entire* library) from scratch even
though the screen underneath (Home or group-detail) had just computed the
identical result and was still mounted. Moved the computation into
`LibraryProvider` (`groupsByName`/`groupsByFolder`, memoized once, shared via
context); `useGroups` is now a plain selector. See
[library-provider.tsx](../src/library/library-provider.tsx) and
[use-groups.ts](../src/library/use-groups.ts). tsc clean, 400 tests pass.
Impact was real but modest (tens of ms for a ~500–600 video library) — it was
never going to explain multi-second delays on its own.

## Finding 2 — the real cost is native, inside expo-video/ExoPlayer's `loading` → `sourceLoad` phase

In every trace, essentially 100% of the remaining time sat between the
player's `statusChange:loading` and its `sourceLoad` event (expo-video: "the
player has finished loading metadata for the current video source"). Once
`sourceLoad` fires, `readyToPlay` and `playingChange:true` follow within
milliseconds — there's no separate slow buffering-before-playback step.

Two sub-cases, confirmed with real on-device traces:

### 2a. Ordinary 8-bit local files: 0.6–1.7s, scales with file/container weight

| File | container/codec | `loading`→`sourceLoad` | total tap→playing |
|---|---|---|---|
| `A.Good.Girls.Guide...mp4` | mp4, presumably H.264 | 1685ms | 2222ms |
| `Banshee.S01E03.720p.BluRay.x264.mkv` | mkv, x264 | 641ms | 1195ms |

Plausible mechanism: ExoPlayer's bundled extractor (Mp4Extractor /
MatroskaExtractor) parsing container metadata (moov position for mp4,
Cues/SeekHead for mkv) — pure local demuxing cost, no native module exposes a
way to tune it from expo-video's JS API.

### 2b. 10-bit HEVC (Main10) local files: 7–12s, dominated by a silent stall, not file size

| File | container/codec | `loading`→`sourceLoad` | total tap→playing |
|---|---|---|---|
| `Lanterns.S01E01.720p.10bit.WEBRip.2CH.x265.HEVC-PSA.mkv` | mkv, x265 10-bit | 9149–11974ms (3 runs) | 9.7–12.6s |
| `Lanterns.S01E02` (same release, different file) | mkv, x265 10-bit | 9312ms | 10.4s |

This is a **different mechanism** from 2a, confirmed by log-line density across
the gap: normal playback and container parsing both produce continuous log
chatter (~20–30 lines/sec); this gap was **completely silent for ~7 of the
~9.3 seconds**, then burst all at once. The first lines after the silence:

```
D/MediaCodecInfo: NoSupport [codec.profileLevel, hvc1.2.4.L93.90, video/hevc] [c2.android.hevc.decoder, video/hevc]
I/CCodec: allocate(c2.qti.hevc.decoder)   ← succeeds; playback then works fine
```

`hvc1.2.4.L93.90` = HEVC Main10 (profile 2), level 3.1 — matches the file's
"10bit" tag independently. The software decoder (`c2.android.hevc.decoder`) is
checked and rejected, then the Qualcomm hardware decoder
(`c2.qti.hevc.decoder`) is allocated and works. The stall recurred on **every**
play of every 10-bit file this session (not a one-time cold-start cost), so
it isn't a simple missing-cache issue.

**VLC opens the identical file instantly.** This corroborates the diagnosis
without changing it: VLC bundles its own decoder pipeline and mostly bypasses
Android's per-file codec-capability negotiation; ExoPlayer always asks the
platform which decoder supports the stream, and that ask is slow for this
profile on this device's codec/HAL stack. It rules out disk I/O, file
placement, or permissions as the cause — VLC reads the same bytes fast — and
confirms the cost is specifically in Android/ExoPlayer's decoder-selection
path for HEVC Main10, not "large video" in general (the 2a files were larger
and much faster).

**Correction / open question, found while scoping the fix:** ExoPlayer's own
codec enumeration (`MediaCodecUtil.getDecoderInfos`, which is what
`MediaCodecSelector.DEFAULT` calls, and what the "NoSupport" log line comes
from) is `synchronized` and backed by a static `decoderInfosCache: HashMap
<CodecKey, List<MediaCodecInfo>>` keyed only on `(mimeType, secureDecoder,
tunnelingDecoder)` — verified by decompiling the actual bundled
`media3-exoplayer-1.9.0.aar` locally (`javap` against
`~/.gradle/caches/.../media3-exoplayer-1.9.0-runtime.jar`). Both Lanterns
episodes are `video/hevc`, non-secure, non-tunneling — the *same* cache key —
so the second file's decoder enumeration should have hit that cache and
skipped the slow "ask the platform" step entirely, yet it was still ~9.3s.
That casts real doubt on "codec enumeration/negotiation is the bottleneck"
as stated above: either the cache isn't being hit here for some reason, or
the ~7s silent stall is actually still on the extractor/container-parsing
side (case 2a's mechanism, just far worse for this file/muxer), and the
`MediaCodecInfo`/`NoSupport` log line is coincidental — the next thing that
happens to log anything once the real (unrelated) block finishes, not
evidence of where the block occurred.

**This meant a MediaCodecSelector-based fix would have been a guess.**
Rather than commit to it, a diagnostic-only patch (two `Log.d` timing probes,
zero behavior change) was shipped first to get real evidence before writing
any fix — see "How the mechanism was confirmed" below.

## How the mechanism was confirmed (device trace, post-diagnostic-patch)

With the diagnostic patch running (`Log.d` around
`MediaCodecSelector.DEFAULT.getDecoderInfos(...)` and at the top of
`prepare()`, tag `53XYVideoPerf`), a live `adb logcat` capture during a
Lanterns replay showed:

```
08:46:20.308  prepare() called uri=.../Lanterns.S01E01...mkv
08:46:32.767  getDecoderInfos(video/hevc, ...) -> 3 codec(s) in 90ms   ← 12.46s gap before this line
08:46:32.769  getDecoderInfos(video/hevc, ...) -> 3 codec(s) in 0ms    ← cached, as predicted
```

The entire multi-second stall sat **before ExoPlayer ever called the codec
selector** — confirming the correction above: it was never codec negotiation.
Once `getDecoderInfos` actually ran, it took 90ms cold and 0ms on every
subsequent (cached) call, exactly matching the `MediaCodecUtil` caching
behavior found by decompiling the media3 jar.

Cross-checking with `ffprobe` on the same file (pulled via `adb pull`) showed
duration was read in 0.14s from only 78KB with 2 seeks — the file's `Cues`
(seek index) is present and intact, ruling out "missing index forces a full
scan." That narrowed it to something ExoPlayer-specific about *how* it uses
an existing, valid Cues element.

Decompiling `MatroskaExtractor` (`media3-extractor-1.9.0`, via `javap`)
surfaced the exact mechanism: a public `FLAG_DISABLE_SEEK_FOR_CUES` flag and
private fields (`seekForCues`, `cuesContentPosition`,
`seekPositionAfterBuildingCues`) implementing `maybeSeekForCues()` — the
extractor's default behavior is to eagerly seek forward to the Cues element's
position (from `SeekHead`), read it, and seek back to the start, before
emitting a `SeekMap`. That "seek forward, read, seek back" shape, happening
entirely inside `prepare()` before any codec/track work, is silent because
there's no logging in that code path — matching every piece of prior
evidence (silent gap, native-side, VLC unaffected, recurs on every 10-bit
file from this release).

## First attempt (reverted): disabling seek-for-cues broke scrubbing

`DefaultExtractorsFactory` exposes `setMatroskaExtractorFlags(int)`, so the
first fix passed `MatroskaExtractor.FLAG_DISABLE_SEEK_FOR_CUES` to skip the
eager seek entirely. This worked for startup time (see the numbers below) but
**broke seeking**: scrubbing the bar or swiping to seek made the video
restart from the beginning instead of jumping to the target position. The
flag doesn't make Cues-reading faster — it skips reading Cues at all, so the
extractor never builds a real `SeekMap` for the file; ExoPlayer then treats
the file as unseekable and any seek request resolves to position 0. Broken
seeking is a core feature regression, worse than a slow start, so this was
reverted immediately (device-confirmed: scrubbing restored, slow start
returned) before looking for a fix that didn't sacrifice correctness.

## The real fix: buffer the DataSource, don't disable the seek index

Root-causing *why* reading Cues was slow (rather than just skipping it)
required seeing the actual I/O pattern. A diagnostic `DataSource` wrapper
(logging every `open()`/`read()` call, added temporarily to
`buildMediaSourceFactory`, no MatroskaExtractor changes) captured this during
a real stall:

```
open() position=295939066 length=-1 uri=.../Lanterns.S01E01...mkv
read #20500 ... n=1 in 0ms   (and 500+ more like it)
...
close() after 558146 reads, 781568B, opened at pos 295939066
```

**558,146 individual `read()` calls to transfer 781KB**, starting at byte
295,939,066 of the 296,733,318-byte file — i.e. right at the `Cues` element
near the end of this remux. The 12.8-second wall time (matching the observed
stall almost exactly) wasn't disk I/O or EBML parsing cost — it was pure
per-call overhead (syscall + JNI + method dispatch) multiplied across more
than half a million tiny reads, most returning 1–4 bytes.

The fix targets exactly that: a small read-ahead buffer wrapping the real
`DataSource`, so a caller requesting 1–4 bytes at a time gets served from an
already-fetched 64KB chunk instead of triggering a fresh read each time.
`MatroskaExtractor`'s own Cues parsing, seek-map building, and seeking
behavior are completely unchanged — it reads the exact same bytes, just far
more cheaply. Implemented as `BufferedDataSource`/`BufferedDataSourceFactory`
in expo-video's `DataSourceUtils.kt`, wired into `buildMediaSourceFactory` via
`patches/expo-video+56.1.4.patch` (the diagnostic wrapper and the earlier
`FLAG_DISABLE_SEEK_FOR_CUES` attempt were both replaced by this, and the JS
`perf-log` instrumentation was removed once the mechanism was confirmed — see
git history for the shape if this ever needs re-tracing). Requests already
as large as the buffer (normal sample-data reads during playback) bypass
buffering entirely to avoid an unnecessary extra copy on the hot path.

Device-confirmed after this fix: both fast startup **and** correct
scrubbing/seeking (bar and swipe) on the same 10-bit HEVC files.

**A prebuilt-AAR trap almost hid this fix entirely.** expo-video (like most
Expo modules) ships a precompiled AAR under
`node_modules/expo-video/local-maven-repo/` — Gradle links against that
binary by default and never touches `android/src` at all. The first
`npx expo run:android` after the patch showed **zero** diagnostic log lines,
which looked like the patch wasn't working; it turned out expo-video's source
was never being compiled. Confirmed by extracting the built APK's dex and
`strings`-grepping for a string unique to the patch (0 matches), and by
finding the prebuilt `.aar` directly (dated from the npm package release,
pre-patch). Fixed by adding to `package.json`:

```json
"expo": { "autolinking": { "buildFromSource": ["expo-video"] } }
```

This is a documented `expo-modules-autolinking` option (`buildFromSource: string[]`,
regex-matched package names) that forces Gradle to compile `android/src`
instead of linking the Maven artifact. After this, `:expo-video:compileDebugKotlin`
appeared in the Gradle output for the first time, and the dex grep found the
patch's marker string.

## Device-verified results

| | before | after |
|---|---|---|
| `loading` → `sourceLoad` (10-bit HEVC) | 9.1–12.6s | well under 1s (matching case 2a's ordinary-file range) |
| tap → `playingChange:true` | ~9.7–12.6s | matches VLC-level responsiveness |
| Scrubbing (bar + swipe) on the same files | correct (unpatched baseline) | correct — confirmed still correct after the buffering fix |

No crashes observed across repeated plays of both Lanterns episodes, episode
switches, and scrubbing post-fix.

## Status / next steps

- ✅ Shared-groups memoization fix — shipped (JS-only).
- ✅ Root cause confirmed for both the general (2a, container/demux weight) and
  10-bit-HEVC (2b, pathological byte-at-a-time `Cues` reads) cases, via
  on-device I/O tracing and jar decompilation — not guessed.
- ✅ Real fix shipped and device-verified: `patches/expo-video+56.1.4.patch`
  (`BufferedDataSource` read-ahead wrapper) + `expo.autolinking.buildFromSource`
  in `package.json` (required for the patch to actually compile in — see the
  prebuilt-AAR trap above).
- ✅ Fast start **and** correct scrubbing/seeking confirmed together on-device
  — the first attempt (`FLAG_DISABLE_SEEK_FOR_CUES`) fixed startup but broke
  seeking and was reverted; this fix has neither problem.
- ✅ All diagnostic-only instrumentation removed (`src/player/perf-log.ts` and
  its call sites; the native `Log.d`/I/O-tracing probes) now that the
  investigation is closed — `tsc` clean, 400 tests pass.
