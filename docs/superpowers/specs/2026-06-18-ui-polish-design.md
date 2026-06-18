# UI Polish & Icon Upgrade (v2)

## Motivation
The app's foundation and features are solid, but the current UI feels somewhat stiff and relies on placeholder text, emojis, and basic default headers. We need a targeted polish pass to elevate the feel of the app, focusing on consistent icons, seamless headers, and smoother scrolling experiences.

## Core Adjustments

### 1. Unified Expo Vector Icons
Replace all text-based placeholders and emojis with `@expo/vector-icons/MaterialIcons` (to match the Material You theme).
- **Home Screen (`index.tsx`)**:
  - Replace the text "Settings" link with a clean `settings` gear icon.
  - Ensure the `LayoutToggle` and `SortButton` use crisp Material icons.
- **Player Chrome (`player.tsx` & `lock-overlay.tsx`)**:
  - Replace the emoji `🔒` with `lock` / `lock-open`.
  - Replace the white placeholder square with `screen-rotation`.
  - Replace the `+` placeholder with `subtitles` (or `audiotrack`) for the tracks button.
  - Use proper `arrow-back` for the exit button.
  - Polish the Play/Pause and Seek icons to ensure they lack any weird default background artifacts.

### 2. Seamless Settings Header
The `settings.tsx` currently falls back to a default `Stack.Screen` header which renders with a stark white background in dark mode, breaking the immersive feel.
- Customize the `Stack.Screen` options to match the app theme:
  ```tsx
  <Stack.Screen
    options={{
      headerShown: true,
      title: 'Settings',
      headerStyle: { backgroundColor: colors.background }, // Or surface
      headerTintColor: colors.onSurface,
      headerShadowVisible: false, // Removes the stiff border line
    }}
  />
  ```

### 3. Scroll Fluidity ("Stiffness")
Currently, scrolling to the edges of lists and screens feels abrupt. 
- Ensure `bounces={true}` and `overScrollMode="always"` are explicitly set on all `ScrollView` and `FlashList` instances (Home, Group Detail, and Settings). This ensures the Android 12+ stretch overscroll (or iOS bounce) always triggers properly, avoiding a rigid stop.
- Verify `contentContainerStyle` has generous `paddingBottom` (e.g., `spacing.xl` or safe area insets) so content doesn't crash into the bottom screen edge.

## Implementation Plan
We will execute this in a single PR to update the related UI files:
1. `src/app/index.tsx` (Icons & Scroll)
2. `src/app/settings.tsx` (Header, Icons, Scroll)
3. `src/app/group.tsx` (Scroll)
4. `src/app/player.tsx` & `src/components/player/lock-overlay.tsx` (Player Icons)

## Unresolved Questions
- Should we apply `bounces={true}` everywhere, or stick strictly to Android's default overscroll behavior by just ensuring the lists have `overScrollMode="always"`? (We will apply both for maximum fluidity).
