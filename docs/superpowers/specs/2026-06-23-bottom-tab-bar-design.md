# Bottom Tab Bar — Design (minimal)

**Date:** 2026-06-23 · **Status:** approved, implementing inline

## Goal
Replace the cluttered top icon row with a 4-tab bottom navigation: **Home / Playlists / History / Settings**. Custom floating pill bar in Material You colors, icon-only, active icon lifts into a `primary` circle. JS-only (no native rebuild).

## Navigation
Introduce an Expo Router `(tabs)` group (group folders don't change URLs, so existing `Link`/`router.push` paths stay valid).

```
src/app/
  _layout.tsx          root Stack: (tabs) + detail screens
  (tabs)/
    _layout.tsx        <Tabs tabBar={<FloatingTabBar/>}>   (NEW)
    index.tsx          Home/Library   (moved)
    playlists.tsx      (moved)
    history.tsx        (moved)
    settings.tsx       (moved)
  group.tsx            detail — full-screen, no tab bar
  player.tsx           detail
  playlist.tsx         detail
  add-to-playlist.tsx  detail
```

## Floating tab bar — `src/components/floating-tab-bar.tsx`
Custom `tabBar` (BottomTabBarProps). Rounded pill, `surfaceVariant` bg, floats above bottom safe-area inset with horizontal margin + elevation. Active icon lifts into a `primary`-filled circle overshooting the bar's top edge; Reanimated shared value driven by `state.index` springs lift + horizontal position. Active tint `onPrimary`, inactive `onSurfaceVariant`. Ionicons icon-only: Home `home`, Playlists `list`, History `time`, Settings `settings` (filled active / `-outline` inactive). Light haptic on tab change.

## Touch-ups
- Home header: drop the 3 nav icons, keep Sort + Layout only.
- Playlists/History/Settings: remove any back arrow (now tab roots).
- Export `TAB_BAR_CLEARANCE`; each tab list adds `paddingBottom` to clear the bar.
- Resume FAB stays on Home, bottom offset raised by clearance.

## Testing & build
- Pure `tabIconFor(routeName)` → `{ active, inactive }`, Jest-tested.
- JS-only → `npx expo start` reload; no `expo run:android`.
