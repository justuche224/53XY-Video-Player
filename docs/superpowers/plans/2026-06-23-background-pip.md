# Background Play and PiP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Picture-in-Picture (PiP) capabilities triggered by swiping home, and an option in Settings to toggle background audio play (defaulting to false).

**Tech Stack:** Expo SDK 56 / React Native 0.85, expo-video, expo-sqlite.

## Global Constraints

- **Android-only**, Expo SDK 56. Read `https://docs.expo.dev/versions/v56.0.0/sdk/video/` if unsure.
- **Package manager is `bun`.** No new deps needed. Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **Commits are plain conventional commits — NO `Co-Authored-By` / "Generated with Claude Code" trailer.**
- **Testing convention (lean):** pure logic gets Jest tests; React/native UI is verified by `tsc` + the user's device build.
- This feature modifies `app.config.ts` (native config for PiP and background play). It WILL require the user to run `npx expo run:android` to test.

---

### Task 1: Native App Configuration

**Files:**
- Modify: `app.config.ts`

**Interfaces:**
- Add `supportsBackgroundPlayback: true` and `supportsPictureInPicture: true` to the `expo-video` plugin.

- [ ] **Step 1: Modify `app.config.ts`**
  Find the `expo-video` plugin in the `plugins` array. Modify it to be an array with configuration options:
  ```ts
    ['expo-video', { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add app.config.ts
  git commit -m "build: enable native background playback and PiP in expo-video plugin"
  ```

---

### Task 2: Player Setting Hook

**Files:**
- Create: `src/player/use-background-play.ts`

**Interfaces:**
- Consumes: `getSetting`, `setSetting` from `@/db/settings-repo`. `useSQLiteContext`.
- Produces: `useBackgroundPlay()` returning `{ backgroundPlay: boolean, setBackgroundPlay: (v: boolean) => void }`.
  - The default value is `false`.

- [ ] **Step 1: Create `src/player/use-background-play.ts`**
  Use `useState` and `useEffect` to load the `background_play` setting from the DB.
  Return the boolean and a setter that saves it to DB and updates state.
  (Since there's no central settings context, a simple hook wrapping the repo is enough).

- [ ] **Step 2: Typecheck**
  Run `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 3: Commit**
  ```bash
  git add src/player/use-background-play.ts
  git commit -m "feat(player): useBackgroundPlay hook"
  ```

---

### Task 3: Settings UI for Background Play

**Files:**
- Modify: `src/app/(tabs)/settings.tsx`
- Create: `src/components/setting-switch.tsx`

**Interfaces:**
- Consume: `useBackgroundPlay`
- Produce: A toggle row in Settings for "Play video in background".

- [ ] **Step 1: Create `src/components/setting-switch.tsx`**
  A row with a `Text` label on the left and a React Native `Switch` on the right.
  Consume `useTheme` for colors (e.g., `trackColor={{ true: colors.primary, false: colors.surfaceVariant }}`).

- [ ] **Step 2: Add to `settings.tsx`**
  Import `useBackgroundPlay` and `SettingSwitch`.
  Add a new section before the existing "Library filters" section:
  ```tsx
  <Text style={[styles.section, { color: colors.onSurface }]}>Player</Text>
  <SettingSwitch label="Play video in background" value={backgroundPlay} onValueChange={setBackgroundPlay} />
  ```

- [ ] **Step 3: Typecheck**
  Run `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 4: Commit**
  ```bash
  git add src/app/(tabs)/settings.tsx src/components/setting-switch.tsx
  git commit -m "feat(settings): background play toggle"
  ```

---

### Task 4: Player Component PiP and Background Play Wiring

**Files:**
- Modify: `src/app/player.tsx` (or the component in `src/components/player/` that renders `VideoView`).

**Interfaces:**
- Consumes: `useBackgroundPlay`, `VideoView` (from `expo-video`).
- Produces: 
  - `allowsPictureInPicture={true}` on the `VideoView`.
  - `player.staysActiveInBackground = backgroundPlay;` updated reactively.

- [ ] **Step 1: Wire properties**
  In the component rendering `VideoView`:
  Add `allowsPictureInPicture={true}` to `<VideoView>`.
  Fetch `backgroundPlay` using the `useBackgroundPlay` hook.
  Set `player.staysActiveInBackground = backgroundPlay` inside a `useEffect` depending on `[player, backgroundPlay]`.

- [ ] **Step 2: Typecheck**
  Run `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 3: Commit**
  ```bash
  git add src/app/player.tsx
  git commit -m "feat(player): enable allowsPictureInPicture and staysActiveInBackground"
  ```

---

## Final verification (whole feature)

- [ ] `npm test` — all suites pass.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `git log --oneline` shows plain commits, no `Co-Authored-By` trailer.
- [ ] **Hand to user for device verification** (`npx expo run:android` is REQUIRED for the new config):
  - Verify swiping home enters PiP.
  - Verify the Settings toggle works. When true, locking the device or switching apps keeps audio playing. When false, video pauses.
