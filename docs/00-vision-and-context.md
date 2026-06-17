# 53XY — Vision & Context

> This is the founding document. It captures the original intent in the user's own
> words plus the key decisions made while brainstorming, so anyone (human or AI)
> can pick the project back up even with zero chat history.

Project codename: **53XY** (Expo 56 / React Native app, Android-first video player).

---

## The original ask (verbatim)

> hey, I have a dream. I've been going through video players on android. VLC is
> having weird frame drops in video playbacks, but I like how it auto groups files
> by different methods like name so like "game of thrones season ....." are all
> grouped, i like how it remembers each videos and where you stopped them and shows
> a progress bar, but it lacks a good long press to 2x while you hold it down like
> youtube and tiktok does. mx player has a long press to 2x and it's perfect but
> it's double tap to skip by 10s or above is broken, and lacks most things of vlc
> like how it lists videos in a folder view and no grouping of videos. then there
> are things i want like advance list filters like making it ignore videos of a
> certain length, or with certain names, and the rest of filters the rest have like
> folders, only showing from a folder and more. in all, i want to make a very very
> good video player. with all the goods from across all of them. Oh, I want it to
> have a nice UI, beautiful even, material you theming support if possible, good
> animations and satisfying, and others you might want to come up with. how do we
> achieve this?

## The dream, distilled

Build **the best Android video player** by assembling the best parts of the ones
that exist today, and fixing what they each get wrong.

### What to borrow (and improve)
- **From VLC:** auto-grouping of files by name (e.g. all "Game of Thrones S0x"
  episodes under one group), folder view, remembering each video's stop position
  with a progress bar.
- **From MX Player:** long-press-to-2× while held (like YouTube/TikTok) — but done
  *right*.

### What everyone gets wrong (our chance to win)
- VLC: weird **frame drops** during playback.
- MX Player: **double-tap-to-skip is broken**; no folder view; no grouping.
- Nobody has great **advanced list filters**.

### Net-new wants
- Advanced library filters: ignore videos under/over a certain length, ignore by
  name pattern, folder-only views, etc.
- A **beautiful** UI — Material You theming, good and satisfying animations.

---

## Key insight that shapes everything

The wishlist splits cleanly into two halves:

1. **The library half** — grouping, folder view, resume/progress, filters. This is
   *our* logic (filename parsing, a local DB, smart UI). Fully in our control and
   where we can genuinely beat the competition.
2. **The playback engine half** — actual frame decoding. Root cause of VLC's frame
   drops. We don't write this; we *pick* an engine. VLC stutters because it leans
   on **software (CPU) decoding**; smooth players (MX) use the phone's **hardware
   decoder** chip. "Smooth" and "plays every obscure codec" are slightly in tension.

---

## Decisions locked during brainstorming (2026-06-17)

| Decision | Choice | Reasoning |
|---|---|---|
| **Platforms** | **Android only** | Best file/folder access; matches all reference apps |
| **Playback engine** | **Hardware-first: ExoPlayer via `expo-video`** | Buttery smooth via HW decode (fixes frame drops); full custom gesture/UI control; ~95%+ codec coverage. libVLC fallback deferred to v2. |
| **Build scope** | **v1 beautiful core first**, v2 power-user layer | Fastest path to a daily-usable app; avoids stall |
| **Library layout** | **Adaptive grid⇄list toggle**, remembered (default grid) | Power-user flexibility, "best of all worlds" spirit |
| **Theming** | **Material You dynamic colors, follow system light/dark** | Modern, native Android feel, wallpaper-driven |

### Scope split
- **v1 (the solid, beautiful core):** auto-scan + smart grouping, folder view,
  custom player (long-press 2×, double-tap seek, swipe brightness/volume), resume +
  progress bars, Material You theming + animations.
- **v2 (power-user layer):** advanced filters (ignore by length/name, folder-only,
  filter presets), libVLC fallback for exotic codecs, playlists, subtitle/audio
  tuning.

---

## How we work in this repo
- `docs/` is the living source of truth. Update it as the project evolves so the
  project is resumable from docs alone.
- Per `AGENTS.md`: this is **Expo, and Expo HAS CHANGED** — read the exact versioned
  docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.
