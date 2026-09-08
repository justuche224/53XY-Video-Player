# Moments Phase 1.5 — Device-Found Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix the two defects device verification found in Moments Phase 1 — moments never reach shared storage, and the subtitle note never pre-fills.

**Spec:** [2026-09-08-moments-design.md](../specs/2026-09-08-moments-design.md) (§4 note seed, §5 storage)

## Root causes (established on-device, not inferred)

**1. Shared storage is never reached.** `MANAGE_EXTERNAL_STORAGE` is a *special access* appop. Declaring it in `app.config.ts` does not grant it; the user must enable "All files access" in system settings. On the test device:

```
MANAGE_EXTERNAL_STORAGE: default; rejectTime=+13m ago     # mode is default, not allow
/storage/emulated/0   drwxrws---  media_rw media_rw       # app uid is not media_rw
```

The rejection timestamp lines up with the capture. `ensureMomentsDir()` correctly fell back to the app document directory, and 10 moments saved there with frames, `.nomedia` and a valid manifest — so the storage code works; it is the permission that is missing. The design spec's claim that the permission was "already granted... no new user-facing prompt" was wrong, and the silent fallback hid it: the user saw "Moment saved" every time while the durability promise went unfulfilled.

**2. The subtitle note never pre-fills for embedded subtitles.** `useSubtitles`' `activeText` only holds cues our own parser loaded from an external sidecar file. The test video (`Lanterns.S01E03…mkv`) has no sidecar; its subtitles are an embedded track rendered by ExoPlayer. expo-video exposes subtitle track *selection* (`subtitleTrack`, `availableSubtitleTracks`) but **no cue-text API**, so JS has nothing to read. Confirmed in the manifest: 9 of 10 moments have `note: null`, and the only non-null note is one the user typed.

## Global Constraints

- Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify against installed `node_modules/<pkg>/build/types/*.d.ts` when docs are thin (`AGENTS.md`).
- Package manager is `bun`. Tests `npm test`, typecheck `npx tsc --noEmit`.
- Android-only.
- Commits are plain conventional commits with **no** `Co-Authored-By:` trailer, no `Claude-Session:` line, no "Generated with Claude Code" text.
- Branch `feat/moments-capture` (continues Phase 1; not yet merged).
- **`patches/expo-video+56.1.4.patch` already exists** and carries the `BufferedDataSource` HEVC startup fix in `utils/DataSourceUtils.kt`. Task 2 must **extend** that file, never replace it — losing that hunk reintroduces a 7–12s startup regression. This repo has no npm/yarn lockfile, so `npx patch-package` cannot run; patches are hand-built with `git diff --no-index` against a saved pristine copy (see `docs/HANDOFF.md`).
- `expo.autolinking.buildFromSource: ["expo-video"]` is already set in `package.json`, so patched Kotlin really is compiled. Verify a native patch landed by grepping the built dex for a marker string — a green Gradle build proves nothing about which source Gradle used.

---

### Task 1: Storage state, migration planning, and re-probing

**Files:**
- Modify: `src/moments/storage.ts`
- Create: `src/moments/migrate-moments.ts`
- Test: `src/moments/__tests__/migrate-moments.test.ts`

**Interfaces:**
- Consumes: `pickMomentsDir`, `framePath` (`./moments-dir`), `Moment` (`./types`).
- Produces:
  - `momentsDirIsShared(): boolean` — whether the resolved directory is the shared one
  - `invalidateMomentsDir(): void` — clears the module cache so the next `ensureMomentsDir()` re-probes
  - `planMomentMigration(moments: Moment[], toDir: string): MomentMove[]` (pure)
  - `type MomentMove = { id: string; fromUri: string; toUri: string }`

`ensureMomentsDir()` caches its answer for the process lifetime, which is right for a hot path and wrong after the user grants the permission mid-session. `invalidateMomentsDir()` is what lets the app notice.

- [ ] **Step 1: Write the failing test**

Create `src/moments/__tests__/migrate-moments.test.ts`:

```ts
import { planMomentMigration } from '../migrate-moments';
import type { Moment } from '../types';

const SHARED = 'file:///storage/emulated/0/53XY/Moments';
const PRIVATE = 'file:///data/user/0/com.jvstuche.fiftythreexy.dev/files/moments';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: `${PRIVATE}/m1.jpg`,
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: 'file:///storage/emulated/0/Movies/Lanterns.S01E03.mkv',
    durationMs: 2000,
    ...over,
  };
}

describe('planMomentMigration', () => {
  it('moves a frame that is not already in the target directory', () => {
    expect(planMomentMigration([moment()], SHARED)).toEqual([
      { id: 'm1', fromUri: `${PRIVATE}/m1.jpg`, toUri: `${SHARED}/m1.jpg` },
    ]);
  });

  it('skips a frame already in the target directory', () => {
    expect(planMomentMigration([moment({ frameUri: `${SHARED}/m1.jpg` })], SHARED)).toEqual([]);
  });

  it('skips a frameless moment — there is no file to move', () => {
    expect(planMomentMigration([moment({ frameUri: null })], SHARED)).toEqual([]);
  });

  it('names the destination from the moment id, not the old filename', () => {
    // A frame whose stored path drifted from the id convention must still land
    // where framePath() will look for it.
    const odd = moment({ id: 'm2', frameUri: `${PRIVATE}/legacy-name.jpg` });
    expect(planMomentMigration([odd], SHARED)).toEqual([
      { id: 'm2', fromUri: `${PRIVATE}/legacy-name.jpg`, toUri: `${SHARED}/m2.jpg` },
    ]);
  });

  it('plans every movable moment in one pass', () => {
    const plan = planMomentMigration(
      [moment({ id: 'a' }), moment({ id: 'b', frameUri: null }), moment({ id: 'c' })],
      SHARED,
    );
    expect(plan.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/moments/__tests__/migrate-moments.test.ts`
Expected: FAIL — cannot find module `../migrate-moments`.

- [ ] **Step 3: Write the pure planner**

Create `src/moments/migrate-moments.ts`:

```ts
import { framePath } from './moments-dir';
import type { Moment } from './types';

export interface MomentMove {
  id: string;
  fromUri: string;
  toUri: string;
}

/**
 * Which frames need moving into `toDir`. Pure: the caller does the file I/O and
 * the database rewrite, so the decision is testable without a filesystem.
 *
 * The destination is always `framePath(toDir, id)` rather than the old
 * basename, so a frame whose stored path drifted from the id convention lands
 * where every other part of the feature expects to find it.
 */
export function planMomentMigration(moments: Moment[], toDir: string): MomentMove[] {
  const moves: MomentMove[] = [];
  for (const moment of moments) {
    if (!moment.frameUri) continue;
    const toUri = framePath(toDir, moment.id);
    if (moment.frameUri === toUri) continue;
    moves.push({ id: moment.id, fromUri: moment.frameUri, toUri });
  }
  return moves;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/moments`
Expected: PASS — 5 new tests plus the existing moments suite.

- [ ] **Step 5: Add the storage-state helpers**

In `src/moments/storage.ts`, add alongside the existing exports. Read the file first; it keeps its resolved directory in a module-level cache.

```ts
/**
 * True when moments are being written to shared storage — i.e. when they will
 * survive an uninstall. False means the app fell back to its own document
 * directory, which is wiped with the app.
 */
export function momentsDirIsShared(): boolean {
  return ensureMomentsDir() === SHARED_MOMENTS_DIR;
}

/**
 * Drop the cached directory so the next `ensureMomentsDir()` probes again.
 * Needed because "All files access" can be granted while the app is running:
 * the user leaves for system settings, flips the toggle, and comes back to a
 * process whose cached answer is now stale.
 */
export function invalidateMomentsDir(): void {
  cachedDir = null;
}
```

Import `SHARED_MOMENTS_DIR` from `./moment-policy` if it is not already imported.

- [ ] **Step 6: Add the migration executor**

Also in `src/moments/storage.ts`:

```ts
/**
 * Move planned frames into the current directory. Returns how many moved.
 * Best-effort per file: one unmovable frame must not abandon the rest, and a
 * frame that fails to move keeps its old uri, which still resolves.
 */
export function moveMomentFrames(moves: MomentMove[]): MomentMove[] {
  const moved: MomentMove[] = [];
  for (const move of moves) {
    try {
      const source = new File(move.fromUri);
      if (!source.exists) continue;
      source.move(new File(move.toUri));
      moved.push(move);
    } catch (e) {
      console.warn(`[moments] could not move frame ${move.id}:`, e);
    }
  }
  return moved;
}
```

**Verify `File.move` against the installed typings** (`node_modules/expo-file-system/build/*.d.ts`) before using it — check whether it takes a `File`, a `Directory`, or a uri string, whether it is synchronous, and whether a `copy`-then-`delete` pair is needed instead. Adapt the body to what the SDK provides, keeping the signature above. Remember the Phase 1 lesson: `File.text()` is async while `File.textSync()` is not, so do not assume.

- [ ] **Step 7: Typecheck, test, commit**

```bash
npx tsc --noEmit
npm test
git add src/moments
git commit -m "feat(moments): add storage-state helpers and frame migration"
```

---

### Task 2: Expose embedded subtitle cues from expo-video

ExoPlayer already decodes the embedded subtitle track and renders it. `Player.Listener.onCues(CueGroup)` is where that text passes through, and expo-video does not forward it. This task patches expo-video to emit it as a JS event.

**Files:**
- Modify: `node_modules/expo-video/android/src/main/java/expo/modules/video/records/VideoEventPayloads.kt`
- Modify: `node_modules/expo-video/android/src/main/java/expo/modules/video/player/PlayerEvent.kt`
- Modify: `node_modules/expo-video/android/src/main/java/expo/modules/video/player/VideoPlayer.kt`
- Modify: `node_modules/expo-video/build/VideoPlayerEvents.types.d.ts`
- Regenerate: `patches/expo-video+56.1.4.patch`

**Interfaces:**
- Produces: a `subtitleCueChange` event on the player, payload `{ text: string }`, where `text` is the currently displayed embedded cue text (`''` when nothing is showing). Consumed by Task 3.

**No Jest coverage** — Kotlin is unreachable from jest-expo. Verification is `npx tsc --noEmit`, a successful `npx expo run:android`, and the device check.

- [ ] **Step 1: Save a pristine copy for the patch diff**

The existing patch must survive. Before editing anything:

```bash
mkdir -p /tmp/expo-video-pristine
cp -r node_modules/expo-video /tmp/expo-video-pristine/current
```

Then reconstruct a truly pristine tree by reverse-applying the existing patch to that copy, so the regenerated patch contains **both** the old `DataSourceUtils.kt` hunk and your new ones. Confirm `patches/expo-video+56.1.4.patch` touches `utils/DataSourceUtils.kt` before you start, and confirm it still does when you finish.

- [ ] **Step 2: Add the event payload**

In `records/VideoEventPayloads.kt`, following the shape of the neighbouring payload classes (read `SubtitleTrackChangedEventPayload` and copy its structure — it is a `Record` with `@Field` properties):

```kotlin
class SubtitleCueChangedEventPayload(
  @Field val text: String
) : Record
```

- [ ] **Step 3: Add the event**

In `player/PlayerEvent.kt`, beside `SubtitleTrackChanged`:

```kotlin
  data class SubtitleCueChanged(val text: String) : PlayerEvent() {
    override val name = "subtitleCueChange"
    override val jsEventPayload = SubtitleCueChangedEventPayload(text)
  }
```

Add the payload import next to the existing `SubtitleTrackChangedEventPayload` import. The `when` block near the bottom of the file dispatches to native listeners and ends in `else -> Unit`; this event is JS-only, exactly like `SubtitleTrackChanged`, so it needs no branch there.

- [ ] **Step 4: Emit it from the player listener**

In `player/VideoPlayer.kt`, inside the same listener object that already implements `onIsPlayingChanged` and `onTracksChanged`, add:

```kotlin
    override fun onCues(cueGroup: CueGroup) {
      // ExoPlayer already decodes and renders the selected embedded subtitle
      // track; this is the only place its text is observable. Forwarded so JS
      // can seed a captured moment's note with the line on screen — expo-video
      // otherwise exposes track selection but never the cues themselves.
      val text = cueGroup.cues
        .mapNotNull { it.text?.toString() }
        .filter { it.isNotBlank() }
        .joinToString("\n")
      sendEvent(PlayerEvent.SubtitleCueChanged(text))
    }
```

Add `import androidx.media3.common.text.CueGroup` with the other media3 imports. Check the exact import path against the media3 version this expo-video builds against; if `androidx.media3.common.text.CueGroup` is wrong, find the real one rather than guessing.

- [ ] **Step 5: Declare the event to TypeScript**

In `node_modules/expo-video/build/VideoPlayerEvents.types.d.ts`, add to the `VideoPlayerEvents` interface, beside `subtitleTrackChange`:

```ts
    /**
     * Fires when the displayed embedded subtitle cue changes. `text` is '' when
     * no cue is on screen. Patched in locally; not upstream expo-video.
     */
    subtitleCueChange(payload: {
        text: string;
    }): void;
```

- [ ] **Step 6: Regenerate the patch**

Rebuild `patches/expo-video+56.1.4.patch` so it carries the pre-existing `DataSourceUtils.kt` hunk **and** the four new file changes, using `git diff --no-index` between the pristine tree and `node_modules/expo-video` as `docs/HANDOFF.md` describes. Then verify:

```bash
grep -c '^diff --git' patches/expo-video+56.1.4.patch   # expect 5
grep 'DataSourceUtils' patches/expo-video+56.1.4.patch  # must still be present
```

If `DataSourceUtils.kt` is missing from the regenerated patch, stop — you have destroyed the HEVC startup fix.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add patches
git commit -m "feat(expo-video): emit embedded subtitle cues as subtitleCueChange

ExoPlayer decodes and renders the selected embedded subtitle track, but
expo-video exposes only track selection, never the cue text. Forward it
so a captured moment can seed its note from the line on screen."
```

---

### Task 3: Consume cues and prompt for storage access

**Files:**
- Create: `src/player/use-embedded-cue.ts`
- Create: `src/components/moments-storage-sheet.tsx`
- Modify: `src/app/player.tsx`
- Modify: `src/app/settings/player.tsx`
- Modify: `src/db/settings-repo.ts` usage (no schema change — `settings` is a key/value table)

**Interfaces:**
- Consumes: `subtitleCueChange` (Task 2); `momentsDirIsShared`, `invalidateMomentsDir`, `moveMomentFrames` (Task 1); `planMomentMigration` (Task 1); `openAllFilesAccessSettings` (`@/subtitles/storage-access`); `getMoments`, `updateMomentFrameUri` (see Step 4).
- Produces: nothing consumed later in this plan.

**No Jest coverage** — hooks and screen wiring, per the Phase 1 convention.

- [ ] **Step 1: The cue hook**

Create `src/player/use-embedded-cue.ts`:

```ts
import type { VideoPlayer } from 'expo-video';
import { useEffect, useRef } from 'react';

/**
 * Latest embedded subtitle line, in a ref rather than state.
 *
 * Cues change several times a second during dialogue, and the player screen is
 * already re-rendering ~1×/s from timeUpdate. Putting this in state would add a
 * re-render per cue for a value only ever read at the instant of a capture.
 */
export function useEmbeddedCue(player: VideoPlayer): { current: string } {
  const cueRef = useRef('');

  useEffect(() => {
    cueRef.current = '';
    const sub = player.addListener('subtitleCueChange', ({ text }) => {
      cueRef.current = text;
    });
    return () => sub.remove();
  }, [player]);

  return cueRef;
}
```

If `tsc` rejects the event name, the Task 2 `.d.ts` patch did not apply — fix that rather than casting the type away.

- [ ] **Step 2: Seed the note from either subtitle source**

In `src/app/player.tsx`, call the hook near the other player hooks:

```ts
  const embeddedCueRef = useEmbeddedCue(player);
```

and in `handleCaptureMoment`, replace the `note: subtitles.activeText` argument with:

```ts
        // External sidecar cues come from our own parser; embedded cues come
        // from ExoPlayer via the patched subtitleCueChange event. Only one can
        // be active at a time, so first non-empty wins.
        note: subtitles.activeText || embeddedCueRef.current,
```

`subtitles.activeText` is a `useCallback` dependency and must stay one; `embeddedCueRef` is a ref and must not be added to the dependency array.

- [ ] **Step 3: The storage-access sheet**

Create `src/components/moments-storage-sheet.tsx`, modelled on the existing `src/components/storage-access-sheet.tsx` — read that file and match its structure, copy and button treatment.

Content: explain that moments are being saved inside the app, so uninstalling or clearing data will delete them; granting "All files access" lets them live in `53XY/Moments` on internal storage instead, still hidden from the gallery. Primary action calls `openAllFilesAccessSettings()`; secondary action dismisses.

Props: `{ onOpenSettings: () => void; onDismiss: () => void }`.

- [ ] **Step 4: Persist the frame uri after a move**

Add to `src/db/moments-repo.ts`:

```ts
export async function updateMomentFrameUri(
  db: SQLiteDatabase,
  id: string,
  frameUri: string,
): Promise<void> {
  await db.runAsync('UPDATE moments SET frame_uri = ? WHERE id = ?', [frameUri, id]);
}
```

- [ ] **Step 5: Prompt once, and migrate when access appears**

In `src/app/player.tsx`, after a successful capture:

- If `momentsDirIsShared()` is false and the settings key `moments.storagePromptShown` is not `'1'`, show `MomentsStorageSheet` and set that key so the prompt never nags twice. Use `getSetting`/`setSetting` from `@/db/settings-repo`.
- The sheet's primary action calls `openAllFilesAccessSettings()`.

Then, so the grant is noticed on return, add a `useFocusEffect` (the screen already imports it) that runs when the player screen regains focus:

```ts
      // The user may have just returned from the system settings screen with
      // All files access newly granted. The cached directory is stale, so
      // re-probe; if moments can now reach shared storage, move the ones
      // already saved so a single install does not end up split across two
      // locations.
      if (momentsDirIsShared()) return;
      invalidateMomentsDir();
      if (!momentsDirIsShared()) return;
      void migrateMomentsToSharedStorage();
```

Implement `migrateMomentsToSharedStorage()` in `src/moments/use-capture-moment.ts` as an exported hook `useMigrateMoments()` following that file's existing shape: read `getMoments(db)`, `planMomentMigration(moments, ensureMomentsDir())`, `moveMomentFrames(plan)`, then `updateMomentFrameUri` for each **successfully moved** frame, then rewrite the manifest. Only rows whose file actually moved get their uri rewritten — a frame left behind must keep the uri that still resolves.

- [ ] **Step 6: Surface storage state in Settings**

In `src/app/settings/player.tsx`, add a Moments row showing where moments are stored — "Internal storage (survives uninstall)" or "Inside the app (removed if you uninstall)" — with an action that opens All-files-access settings when it is not shared. Follow the file's existing `SettingsGroup`/`ListItem` idiom.

- [ ] **Step 7: Verify and commit**

```bash
npx tsc --noEmit
npm test
git add src
git commit -m "feat(moments): seed notes from embedded cues and prompt for storage access"
```

---

## Device verification (needs a full rebuild — Task 2 changes native code)

```bash
npx expo run:android
```

1. **The patch actually compiled in.** `unzip -p android/app/build/outputs/apk/debug/app-debug.apk classes.dex | strings | grep subtitleCueChange` — a green Gradle build alone proves nothing about which source Gradle used.
2. **HEVC startup did not regress.** Play the `.mkv` that used to take 7–12s to start; it must still start in well under a second, and scrubbing must still work. This is the check that the regenerated patch kept `DataSourceUtils.kt`.
3. **Embedded subtitle note.** With an embedded subtitle track selected, capture while a line is on screen and tap **Edit** — the line should be pre-filled.
4. **External subtitle note still works.** Same, with a sidecar `.srt` loaded.
5. **No subtitle → empty note**, not a stale line from earlier in the film.
6. **The prompt appears.** With All-files access off, capture once: the storage sheet should explain the situation and offer the settings shortcut. Capture again — it must not nag a second time.
7. **Grant and return.** Turn on All-files access, come back to the player, and confirm `/storage/emulated/0/53XY/Moments/` now exists with `.nomedia`, `moments.json`, and the JPEGs **moved** out of the app-private directory.
8. **Existing moments survived the move** — the same count, still with their titles and notes.
