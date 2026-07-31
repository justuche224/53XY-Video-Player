# M3 Expressive UI pass — design

**Date:** 2026-07-31 · **Branch:** `feat/m3-expressive-ui` · **Status:** approved, implementing

Modernize the library UI. Material You dynamic theming is a founding decision
([00-vision-and-context.md](../../00-vision-and-context.md)) and stays — everything
here is inside Material You, using the **Material 3 Expressive** shape and motion
additions rather than replacing the system.

## Problems being solved

1. Header is a plain wordmark + two icon buttons in a grey rounded-rect — reads as a placeholder.
2. Continue-watching is a small 140×80 horizontal card; wanted as a Netflix-style full-bleed hero.
3. Group/video cards read as flat boxes.
4. Corners are too sharp app-wide.

## The M3 Expressive shape scale (verified, not from memory)

`m3.material.io` is a JS-rendered SPA that returns an empty document to a fetcher, so the
values below come from the generating source, `androidx/compose/material3/tokens/ShapeTokens.kt`:

| Token | dp | Token | dp |
|---|---|---|---|
| `corner.none` | 0 | `corner.largeIncreased` | 20 |
| `corner.extraSmall` | 4 | `corner.extraLarge` | 28 |
| `corner.small` | 8 | `corner.extraLargeIncreased` | 32 |
| `corner.medium` | 12 | `corner.extraExtraLarge` | 48 |
| `corner.large` | 16 | `corner.full` | circle |

The `*Increased` steps and `extraExtraLarge` are the Expressive additions.

## 1. Shape scale

`RADIUS` in `src/theme/resolve-theme.ts` becomes the full scale, each key annotated with the
M3 token it maps to:

```
none 0 · xs 4 · sm 8 · md 16 · lg 20 · xl 28 · xxl 32 · max 48 · pill 999
```

The load-bearing change is **`md: 12 → 16`** (`corner.large`). `radius.md` is 18 of the 39
radius call sites — every card, row thumbnail and poster — so one line softens the whole app
with a real token instead of a taste number. `lg`/`xl`/`pill` keep their current values.
Targeted bumps on top: posters and cards → `lg`, sheets/dialogs → `xl`, duration badge →
`pill` (hardcoded `6` today; already logged as a follow-up in HANDOFF §3).

## 2. Depth

New `shadow(level)` theme token returning React Native 0.85 native `boxShadow` strings on
M3's elevation curve. Light scheme gets real shadows; dark leans on the existing tonal
`surfaceContainer*` ramp with a much weaker shadow. Grid cards take `shadow(1)`; list rows
take tonal lift only, so the two layouts read as deliberately different densities.

## 3. Header

`AppBar` gains `overlay` and `scrolled`. On Home the pinned block is the app-bar row plus the
Videos/Folders row, floating over the hero.

- Actions become circular tonal **`IconButton`**s (40dp): `rgba(0,0,0,0.45)` chip + white glyph
  over artwork, `surfaceContainerHigh` + `onSurfaceVariant` when scrolled. Replaces the grey
  rounded-rect wrapping Sort + Layout.
- **Search moves into the header** as an icon that expands inline, so it is not buried under
  the banner.
- **Wordmark** renders `53` in `onSurface` and `XY` in `colors.primary` — the mark itself is
  wallpaper-driven. Its color is the only thing that must cross-fade white → themed on scroll;
  that is one `interpolateColor` on one `Animated.Text`. Every other header element uses a
  fixed chip and never animates color.
- Scroll state is a **boolean threshold**, not a per-frame handler: `onScroll` flips `scrolled`
  once when the hero passes, and `withTiming` drives a scrim layer out and a
  `colors.background` layer + hairline in. No per-frame JS work, no Animated-FlashList wrapper.
- Home drives `<StatusBar style>` off `scrolled`; it is always `light` over the hero.

## 4. Hero

Full-bleed banner: 1280px artwork edge to edge and under the status bar, a top scrim for the
header, and a bottom gradient whose final stop **is `colors.background`**, so the artwork melts
into the grid. Over it: `CONTINUE · S02E05` overline, title in Space Grotesk, `24 min left` +
progress, then **Continue** (filled pill) and **Episodes** (tonal, only when the video belongs
to a multi-item group).

Height is pure, tested math: `insets.top + clamp(windowHeight * 0.42, 280, 380)`.

Empty states:
- Nothing resumable → same banner on the newest video, overline `RECENTLY ADDED`, button `Play`.
- Empty library → muted `surfaceContainer` block carrying the scan/permission message.

The reduced-motion-aware entrance stays, plus a cross-fade as the hero-size frame resolves.

## 5. Cards and rows

Cards become a tonal container: `elevation(1)` tile at `radius.lg`, poster inset at `radius.md`
with a bottom-up scrim so the duration badge and progress bar read against any frame, title and
meta inside the tile, `shadow(1)`. Rows get the same tonal container without the shadow.

While here, fix the double-rounding bug logged in HANDOFF §3 properly: `VideoThumbnail` and
`ThumbnailCollage` take a `radius` prop (default `none`) so the clipping parent owns the corner,
instead of two radii being manually kept in sync.

## 6. Expressive signature: shape morph

`PressableScale` gains an optional radius morph alongside its existing 0.97 scale. Cards round
*up* on press (`lg → xl`); the Continue button flattens *down* (`pill → md`), matching M3's
button-group morph direction.

## Non-goals

- No change to Material You theming, the palette source, or the dynamic-color pipeline.
- No new native dependency. Gradients (`experimental_backgroundImage`) and `boxShadow` are
  React Native 0.85 built-ins, so this is JS-only and needs no rebuild.
- No drag-and-drop, no new library features. Presentation only.

## Testing

Jest covers the pure parts: the radius scale values, `shadowFor(isDark, level)`, and
`heroHeight(windowHeight, insetTop)`. Pixels are verified on-device by the user.

## Device-verify watchpoints

1. Whether `experimental_backgroundImage` actually renders on Android in this RN build.
   Fallback if not: a stepped-opacity view stack.
2. Whether `boxShadow` inside FlashList cells costs scroll performance.
3. Status-bar icon contrast over the hero in a light system theme.
