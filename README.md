# 53XY

**A local video player for Android, built with React Native and Expo.** It takes the parts of VLC and MX Player I like, fixes what they get wrong, and wraps it in a Material You interface.

[**Download v1.0.0 →**](https://github.com/justuche224/53XY-Video-Player/releases/tag/v1.0.0) (APK: `arm64-v8a` for most modern phones, or `universal` if you're not sure)

53XY is side-loaded, not on the Play Store. I use it every day to watch everything.

## Features

**Library**
- Scans the device and groups episodes automatically. It parses titles, seasons and episode numbers from messy filenames (`S01E02`, `Season 1 Episode 2`, anime `- 12` style, and more).
- Videos and Folders views, search, and sorting by name, length or date.
- Filters to hide short clips, filename patterns or whole folders.
- Thumbnails from a native frame extractor that skips black and washed-out frames.
- Watch history, a continue-watching hero, playlists, and long-press multi-select (share, delete, mark watched, move to a group).

**Player**
- Gestures: long-press for 2× speed, double-tap to seek or pause, swipe for brightness and system volume, drag to scrub, and a lock screen.
- Pinch to zoom, with snap points and Fit / Crop / Stretch / 100% modes saved per video.
- Scrub previews: thumbnail frames above the seekbar as you drag.
- Autoplay-next countdown, a sleep timer, background audio, and picture-in-picture.
- Subtitles: embedded tracks plus external `.srt`, `.vtt` and `.ass` files. Matching subtitle files are found automatically, with a live delay adjustment.

**Moments**
- One tap captures the exact frame on screen, along with its timestamp, episode and the subtitle line as a note.
- Browse moments in their own tab, jump back to that point, share a frame or save it to your gallery.
- Moments are backed up to shared storage and restore after a reinstall.

## Under the hood

- **Expo SDK 56, React Native 0.85** (new architecture), Expo Router, Reanimated 4, Gesture Handler, FlashList, SQLite with versioned migrations.
- **Three hand-written native Expo modules in Kotlin** ([`modules/`](./modules)):
  - `frame-grabber`: thumbnail and exact-frame extraction. It tries candidate positions and scores them by brightness so you don't get black thumbnails.
  - `system-volume`: native system volume control for the swipe gesture.
  - `share-media`: multi-file sharing with `ACTION_SEND_MULTIPLE`, up to 50 videos at once.
- **A subtitle engine written from scratch:** SRT and WebVTT parsers on a shared block scanner, an ASS/SSA parser, encoding detection with a CP1252 fallback, and delay-aware binary-search cue lookup.
- **A patched `expo-video`** ([`patches/`](./patches)):
  - A 64 KB read-ahead buffer around ExoPlayer's data source. Some 10-bit HEVC `.mkv` files took 7–12 seconds to start because the Matroska extractor made hundreds of thousands of 1–4 byte reads. With the buffer they start in under a second, and seeking still works.
  - A `subtitleCueChange` event, so embedded subtitle tracks can seed Moment notes.
- **Release pipeline:** per-ABI and universal APKs from one local EAS build, with R8 minification ([docs/releasing.md](./docs/releasing.md)).
- **527 tests.** The grouping engine, filters, sorting, subtitle parsing and history logic are pure and unit-tested.

## Running it locally

```bash
bun install
npx expo run:android   # development build (expo-dev-client)
```

Run the tests and type check with `npx jest` and `npx tsc --noEmit`.

The design notes, plans and changelog are in [`docs/`](./docs). Start with [`docs/HANDOFF.md`](./docs/HANDOFF.md).

---

Built by [Donald Amoke](https://www.donaldamoke.com).
