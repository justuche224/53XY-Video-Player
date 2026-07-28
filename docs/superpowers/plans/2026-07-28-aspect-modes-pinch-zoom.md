# Aspect Modes + Pinch-Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add display modes (Fit → Crop → Stretch → 100%) with a chrome cycle button, free pinch-to-zoom with % HUD and 4% snap-to-mode, and per-video mode persistence.

**Architecture:** All zoom math lives in a pure module `src/player/zoom.ts`. The `VideoView` stays full-screen; uniform modes (Fit/Crop/100%) and free zoom are rendered as a Reanimated `transform: scale` on the video wrapper with `contentFit="contain"`, so one shared value drives everything at 60 fps. Stretch is the sole special case: `contentFit="fill"` at scale 1. Pinch is a new `Gesture.Pinch` in the existing player gesture arena; the resting mode persists in a new `display_mode` column on `watch_progress` (migration 5).

**Tech Stack:** expo-video ~56.1.4 (`contentFit`: `'contain' | 'cover' | 'fill'`; natural size from the `sourceLoad` event's `availableVideoTracks[0].size`), react-native-gesture-handler 2.31, react-native-reanimated 4.3, react-native-worklets (`scheduleOnRN`), expo-sqlite, Jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-player-feel-pack-design.md` §A. Mode cycle order **Fit → Crop → Stretch → 100%**; free scale clamp **[0.25, 4.0]**; snap tolerance **4%**; persistence per-video, **only when resting mode ≠ Fit** (NULL otherwise); free-zoom % is session-only; pinch disabled while locked.
- Per `AGENTS.md`: expo-video API usage verified against https://docs.expo.dev/versions/v56.0.0/sdk/video/ (done — facts in Tech Stack above; re-check there if anything looks off).
- Repo conventions: pure logic in `src/player/*.ts` with Jest tests in `src/player/__tests__/`; player chrome text is white-on-video regardless of theme; comments state constraints, not narration.
- Gesture discipline: this repo has fought RNGH wedge bugs (see `gestureGen` remount in `src/app/player.tsx:182-402`). Never touch that machinery; every gesture change gets the on-device pass in Task 7.
- After each task: `npx tsc --noEmit` clean and `npx jest` green before committing.
- Tasks 1–6 need no emulator or device — `tsc` + Jest only. On-device work happens exclusively in Task 7 with the user's adb-connected phone (dev build is normally already installed; coordinate with the user if not).

---

### Task 1: Zoom model (pure logic)

**Files:**
- Create: `src/player/zoom.ts`
- Test: `src/player/__tests__/zoom.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by Tasks 4–6):

```ts
export type DisplayMode = 'fit' | 'crop' | 'stretch' | 'pixel';
export type ZoomState =
  | { kind: 'mode'; mode: DisplayMode }
  | { kind: 'free'; scale: number };
export interface Size { width: number; height: number }
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
export const SNAP_TOLERANCE = 0.04;
export function clampScale(s: number): number;
export function cropScale(screen: Size, natural: Size): number;
export function pixelScale(screen: Size, natural: Size, pixelRatio: number): number;
export function modeScale(mode: DisplayMode, screen: Size, natural: Size | null, pixelRatio: number): number;
export function restingScale(state: ZoomState, screen: Size, natural: Size | null, pixelRatio: number): number;
export function cycleMode(mode: DisplayMode, hasNatural: boolean): DisplayMode;
export function snapZoom(scale: number, screen: Size, natural: Size | null, pixelRatio: number): ZoomState;
export function modeLabel(mode: DisplayMode): string; // 'Fit' | 'Crop' | 'Stretch' | '100%'
export function isDisplayMode(v: string | null | undefined): v is DisplayMode;
```

**Math (all scales are relative to the Fit baseline — a full-screen `contentFit="contain"` view at transform scale 1):**
- `contain = min(screen.w / natural.w, screen.h / natural.h)` (internal helper)
- `cropScale = max(screen.w / natural.w, screen.h / natural.h) / contain` — uniform scale at which the contain box exactly covers the screen.
- `pixelScale = 1 / (pixelRatio * contain)` — natural pixels map 1:1 to screen pixels (screen sizes are dp, natural size is px).
- `modeScale`: `fit` and `stretch` → 1; `crop`/`pixel` → the above, but **1 when `natural` is null** (graceful until `sourceLoad` arrives).
- `cycleMode(mode, hasNatural)`: fit→crop→stretch→pixel→fit; when `hasNatural` is false, skip crop and pixel (fit→stretch→fit).
- `snapZoom(scale, …)`: candidate targets are fit (1) plus crop and pixel when `natural` is present; pick the candidate minimizing `|scale/target − 1|`; if that minimum ≤ `SNAP_TOLERANCE` return `{kind:'mode', mode}`, else `{kind:'free', scale}`. (Stretch is never a snap target — it's non-uniform.)

- [ ] **Step 1: Write the failing tests**

Follow the style of `src/player/__tests__/pan.test.ts`. Cover at minimum:

```ts
import {
  clampScale, cropScale, pixelScale, modeScale, restingScale,
  cycleMode, snapZoom, modeLabel, isDisplayMode,
  MIN_SCALE, MAX_SCALE, SNAP_TOLERANCE,
} from '../zoom';

const LANDSCAPE_SCREEN = { width: 800, height: 360 };  // ~20:9 phone, landscape dp
const WIDE_VIDEO = { width: 1920, height: 1080 };      // 16:9
const TALL_VIDEO = { width: 1080, height: 1920 };      // 9:16

describe('cropScale', () => {
  it('is the cover/contain ratio for a 16:9 video on a 20:9 screen', () => {
    // contain = min(800/1920, 360/1080) = 0.3333…; cover = max(…) = 0.41666…
    expect(cropScale(LANDSCAPE_SCREEN, WIDE_VIDEO)).toBeCloseTo(1.25, 5);
  });
  it('is 1 when aspect ratios match', () => {
    expect(cropScale({ width: 1600, height: 900 }, WIDE_VIDEO)).toBeCloseTo(1, 5);
  });
  it('handles portrait video on landscape screen', () => {
    // contain = min(800/1080, 360/1920) = 0.1875; cover = 0.7407…
    expect(cropScale(LANDSCAPE_SCREEN, TALL_VIDEO)).toBeCloseTo(3.9506, 3);
  });
});

describe('pixelScale', () => {
  it('maps natural pixels 1:1 to screen pixels', () => {
    // contain = 1/3; pixelRatio 3 → pixelScale = 1/(3 * 1/3) = 1
    expect(pixelScale({ width: 640, height: 360 }, WIDE_VIDEO, 3)).toBeCloseTo(1, 5);
  });
  it('is < 1 for a small video on a dense screen', () => {
    // 480p video, contain = min(800/854, 360/480) = 0.75, ratio 2.75 → 1/(2.75*0.75)
    expect(pixelScale(LANDSCAPE_SCREEN, { width: 854, height: 480 }, 2.75)).toBeCloseTo(0.4848, 3);
  });
});

describe('modeScale / restingScale', () => {
  it('fit and stretch are always 1', () => {
    expect(modeScale('fit', LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toBe(1);
    expect(modeScale('stretch', LANDSCAPE_SCREEN, null, 3)).toBe(1);
  });
  it('crop and pixel fall back to 1 without a natural size', () => {
    expect(modeScale('crop', LANDSCAPE_SCREEN, null, 3)).toBe(1);
    expect(modeScale('pixel', LANDSCAPE_SCREEN, null, 3)).toBe(1);
  });
  it('restingScale returns the free scale as-is', () => {
    expect(restingScale({ kind: 'free', scale: 1.7 }, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toBe(1.7);
  });
  it('restingScale resolves a mode via modeScale', () => {
    expect(restingScale({ kind: 'mode', mode: 'crop' }, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toBeCloseTo(1.25, 5);
  });
});

describe('cycleMode', () => {
  it('cycles fit → crop → stretch → pixel → fit with natural size', () => {
    expect(cycleMode('fit', true)).toBe('crop');
    expect(cycleMode('crop', true)).toBe('stretch');
    expect(cycleMode('stretch', true)).toBe('pixel');
    expect(cycleMode('pixel', true)).toBe('fit');
  });
  it('skips crop and pixel without natural size', () => {
    expect(cycleMode('fit', false)).toBe('stretch');
    expect(cycleMode('stretch', false)).toBe('fit');
  });
});

describe('snapZoom', () => {
  it('snaps to fit within tolerance', () => {
    expect(snapZoom(1.03, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toEqual({ kind: 'mode', mode: 'fit' });
  });
  it('snaps to crop within tolerance', () => {
    // crop = 1.25; 1.28/1.25 = 1.024 → within 4%
    expect(snapZoom(1.28, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toEqual({ kind: 'mode', mode: 'crop' });
  });
  it('stays free between targets', () => {
    expect(snapZoom(1.12, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toEqual({ kind: 'free', scale: 1.12 });
  });
  it('only fit is a target without natural size', () => {
    expect(snapZoom(1.02, LANDSCAPE_SCREEN, null, 3)).toEqual({ kind: 'mode', mode: 'fit' });
    expect(snapZoom(1.3, LANDSCAPE_SCREEN, null, 3)).toEqual({ kind: 'free', scale: 1.3 });
  });
});

describe('clampScale', () => {
  it('clamps to [MIN_SCALE, MAX_SCALE]', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE);
    expect(clampScale(9)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('modeLabel / isDisplayMode', () => {
  it('labels every mode', () => {
    expect(modeLabel('fit')).toBe('Fit');
    expect(modeLabel('crop')).toBe('Crop');
    expect(modeLabel('stretch')).toBe('Stretch');
    expect(modeLabel('pixel')).toBe('100%');
  });
  it('validates persisted strings', () => {
    expect(isDisplayMode('crop')).toBe(true);
    expect(isDisplayMode('zoom')).toBe(false);
    expect(isDisplayMode(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/player/__tests__/zoom.test.ts`
Expected: FAIL — cannot find module `../zoom`.

- [ ] **Step 3: Implement `src/player/zoom.ts`**

```ts
// src/player/zoom.ts
// All scales are relative to the Fit baseline: a full-screen VideoView with
// contentFit="contain" at transform scale 1. Screen sizes are dp; natural
// sizes are px (hence pixelRatio in pixelScale).

export type DisplayMode = 'fit' | 'crop' | 'stretch' | 'pixel';

export type ZoomState =
  | { kind: 'mode'; mode: DisplayMode }
  | { kind: 'free'; scale: number };

export interface Size {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
export const SNAP_TOLERANCE = 0.04;

export function clampScale(s: number): number {
  if (s < MIN_SCALE) return MIN_SCALE;
  if (s > MAX_SCALE) return MAX_SCALE;
  return s;
}

function containScale(screen: Size, natural: Size): number {
  return Math.min(screen.width / natural.width, screen.height / natural.height);
}

export function cropScale(screen: Size, natural: Size): number {
  const contain = containScale(screen, natural);
  const cover = Math.max(screen.width / natural.width, screen.height / natural.height);
  return cover / contain;
}

export function pixelScale(screen: Size, natural: Size, pixelRatio: number): number {
  return 1 / (pixelRatio * containScale(screen, natural));
}

export function modeScale(
  mode: DisplayMode,
  screen: Size,
  natural: Size | null,
  pixelRatio: number,
): number {
  if (mode === 'fit' || mode === 'stretch') return 1;
  if (!natural) return 1;
  return mode === 'crop' ? cropScale(screen, natural) : pixelScale(screen, natural, pixelRatio);
}

export function restingScale(
  state: ZoomState,
  screen: Size,
  natural: Size | null,
  pixelRatio: number,
): number {
  return state.kind === 'free' ? state.scale : modeScale(state.mode, screen, natural, pixelRatio);
}

const CYCLE: DisplayMode[] = ['fit', 'crop', 'stretch', 'pixel'];

export function cycleMode(mode: DisplayMode, hasNatural: boolean): DisplayMode {
  const order = hasNatural ? CYCLE : CYCLE.filter((m) => m === 'fit' || m === 'stretch');
  const idx = order.indexOf(mode);
  return order[(idx + 1) % order.length] ?? 'fit';
}

export function snapZoom(
  scale: number,
  screen: Size,
  natural: Size | null,
  pixelRatio: number,
): ZoomState {
  const candidates: Array<{ mode: DisplayMode; target: number }> = [{ mode: 'fit', target: 1 }];
  if (natural) {
    candidates.push({ mode: 'crop', target: cropScale(screen, natural) });
    candidates.push({ mode: 'pixel', target: pixelScale(screen, natural, pixelRatio) });
  }
  let best = candidates[0];
  let bestDist = Math.abs(scale / best.target - 1);
  for (const c of candidates.slice(1)) {
    const d = Math.abs(scale / c.target - 1);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return bestDist <= SNAP_TOLERANCE
    ? { kind: 'mode', mode: best.mode }
    : { kind: 'free', scale };
}

const LABELS: Record<DisplayMode, string> = {
  fit: 'Fit',
  crop: 'Crop',
  stretch: 'Stretch',
  pixel: '100%',
};

export function modeLabel(mode: DisplayMode): string {
  return LABELS[mode];
}

export function isDisplayMode(v: string | null | undefined): v is DisplayMode {
  return v === 'fit' || v === 'crop' || v === 'stretch' || v === 'pixel';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/player/__tests__/zoom.test.ts` then `npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/player/zoom.ts src/player/__tests__/zoom.test.ts
git commit -m "feat(player): add pure zoom model for display modes and pinch snap"
```

---

### Task 2: `display_mode` persistence (migration 5 + repo)

**Files:**
- Modify: `src/db/schema.ts` (append migration, bump `LATEST_VERSION` to 5)
- Modify: `src/db/progress-repo.ts` (add `getDisplayMode`, `setDisplayMode`)
- Test: `src/db/__tests__/schema.test.ts` (extend), `src/db/__tests__/progress-repo-display-mode.test.ts` (create)

**Interfaces:**
- Consumes: `MIGRATIONS`/`LATEST_VERSION` from `src/db/schema.ts`; `SQLiteDatabase` (`getFirstAsync(sql, params)`, `runAsync(sql, params)`).
- Produces (used by Task 6):

```ts
export async function getDisplayMode(db: SQLiteDatabase, videoId: string): Promise<string | null>;
export async function setDisplayMode(
  db: SQLiteDatabase,
  videoId: string,
  mode: string | null,
  nowMs: number,
): Promise<void>;
```

Note: `upsertProgress`'s `ON CONFLICT … DO UPDATE` names its columns explicitly, so routine progress writes never clobber `display_mode`. `setDisplayMode` must upsert because a `watch_progress` row may not exist yet for a fresh video (`last_played_at` is NOT NULL — supply `nowMs`).

- [ ] **Step 1: Write the failing tests**

Read `src/db/__tests__/schema.test.ts` first and extend it in its existing style with:

```ts
it('migration 5 adds display_mode to watch_progress', () => {
  const m5 = MIGRATIONS.find((m) => m.version === 5);
  expect(m5).toBeDefined();
  expect(m5!.up).toContain('ALTER TABLE watch_progress ADD COLUMN display_mode TEXT');
  expect(LATEST_VERSION).toBe(5);
});
```

Create `src/db/__tests__/progress-repo-display-mode.test.ts` with a minimal fake capturing SQL + params (match the fake-db style used in the repo's existing repo tests — read `src/db/__tests__/history-repo.test.ts` first and mirror its fake):

```ts
import { getDisplayMode, setDisplayMode } from '../progress-repo';
import type { SQLiteDatabase } from 'expo-sqlite';

function makeFakeDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let firstResult: unknown = null;
  const db = {
    async runAsync(sql: string, params: unknown[]) {
      calls.push({ sql, params });
    },
    async getFirstAsync(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return firstResult;
    },
  } as unknown as SQLiteDatabase;
  return { db, calls, setFirstResult: (r: unknown) => (firstResult = r) };
}

describe('getDisplayMode', () => {
  it('returns the stored mode', async () => {
    const { db, setFirstResult } = makeFakeDb();
    setFirstResult({ display_mode: 'crop' });
    expect(await getDisplayMode(db, 'v1')).toBe('crop');
  });
  it('returns null when no row or no mode', async () => {
    const { db } = makeFakeDb();
    expect(await getDisplayMode(db, 'v1')).toBeNull();
  });
});

describe('setDisplayMode', () => {
  it('upserts the mode with defaults for a missing row', async () => {
    const { db, calls } = makeFakeDb();
    await setDisplayMode(db, 'v1', 'crop', 123);
    expect(calls[0].sql).toContain('INSERT INTO watch_progress');
    expect(calls[0].sql).toContain('display_mode = excluded.display_mode');
    expect(calls[0].params).toEqual(['v1', 123, 'crop']);
  });
  it('writes NULL to clear (fit)', async () => {
    const { db, calls } = makeFakeDb();
    await setDisplayMode(db, 'v1', null, 123);
    expect(calls[0].params).toEqual(['v1', 123, null]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/db`
Expected: FAIL — migration 5 missing, functions not exported.

- [ ] **Step 3: Implement**

Append to `MIGRATIONS` in `src/db/schema.ts` and bump the constant:

```ts
  {
    version: 5,
    up: `ALTER TABLE watch_progress ADD COLUMN display_mode TEXT;`,
  },
```

```ts
export const LATEST_VERSION = 5;
```

Append to `src/db/progress-repo.ts`:

```ts
export async function getDisplayMode(
  db: SQLiteDatabase,
  videoId: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ display_mode: string | null }>(
    'SELECT display_mode FROM watch_progress WHERE video_id = ?',
    [videoId],
  );
  return row?.display_mode ?? null;
}

// Upsert: a fresh video may have no progress row yet (last_played_at is NOT
// NULL, hence nowMs). Progress writes name their columns in ON CONFLICT, so
// they never clobber display_mode and vice versa.
export async function setDisplayMode(
  db: SQLiteDatabase,
  videoId: string,
  mode: string | null,
  nowMs: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO watch_progress (video_id, position_ms, percent, completed, last_played_at, display_mode)
     VALUES (?, 0, 0, 0, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET display_mode = excluded.display_mode`,
    [videoId, nowMs, mode],
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/db` then `npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/progress-repo.ts src/db/__tests__/schema.test.ts src/db/__tests__/progress-repo-display-mode.test.ts
git commit -m "feat(db): migration 5 adds watch_progress.display_mode + repo accessors"
```

---

### Task 3: Pinch gesture in the player arena

**Files:**
- Modify: `src/components/player/player-gestures.tsx`

**Interfaces:**
- Consumes: existing `PlayerGestures` composition (`Gesture.Race(pan, longPress, Exclusive(doubleTap, singleTap))`), `scheduleOnRN` from `react-native-worklets`, `SharedValue<number>` from reanimated, `MIN_SCALE`/`MAX_SCALE` (inline the numbers in the worklet — worklets must not close over module imports they don't need; use literals `0.25` and `4` with a comment tying them to `zoom.ts`).
- Produces (used by Task 6): three new props on `PlayerGesturesProps`:

```ts
/** Resting zoom scale; the pinch worklet reads it at onStart as the base. */
zoomScale: SharedValue<number>;
onPinchStart: () => void;
/** Fires on every pinch update with the clamped live scale (for the % HUD). */
onPinchUpdate: (scale: number) => void;
/** Fires once with the final clamped scale. */
onPinchEnd: (scale: number) => void;
```

- [ ] **Step 1: Add the pinch gesture and re-compose**

In `player-gestures.tsx`:

1. Add the three props + `zoomScale` to `PlayerGesturesProps` and destructure them.
2. Add `const pinchRef = useRef<GestureType | undefined>(undefined);` and include it in the `playerGestureRelations` array.
3. Inside the `useMemo`, before `composed`, add:

```ts
    // Two-finger zoom. zoomBase is captured at onStart so e.scale (relative to
    // gesture start) composes with the current resting scale. Clamp bounds are
    // MIN_SCALE/MAX_SCALE from src/player/zoom.ts — inlined for the worklet.
    const pinch = Gesture.Pinch()
      .withRef(pinchRef)
      .onStart(() => {
        'worklet';
        zoomBase.value = zoomScale.value;
        scheduleOnRN(onPinchStart);
      })
      .onUpdate((e) => {
        'worklet';
        const s = Math.min(4, Math.max(0.25, zoomBase.value * e.scale));
        zoomScale.value = s;
        scheduleOnRN(onPinchUpdate, s);
      })
      .onEnd(() => {
        'worklet';
        scheduleOnRN(onPinchEnd, zoomScale.value);
      });
```

with `const zoomBase = useSharedValue(1);` declared next to `width`/`height` (it is pinch-internal — not a prop).

4. Constrain the pan to one finger so a second finger can never scrub, and add pinch to the race:

```ts
    const pan = Gesture.Pan()
      .withRef(panRef)
      .maxPointers(1)
      // …existing handlers unchanged…
```

```ts
    return Gesture.Race(pinch, pan, longPress, Gesture.Exclusive(doubleTap, singleTap));
```

5. Add `zoomScale` and the three callbacks to the `useMemo` dependency array.

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc reports errors **only** in `src/app/player.tsx` is NOT acceptable — `PlayerGestures` call site doesn't have the new props yet, so make the three callbacks and `zoomScale` **required** props but expect the player.tsx error; to keep this task independently green, update the call site in `src/app/player.tsx` minimally in this same task:

```ts
const zoomScale = useSharedValue(1);
```

(import `useSharedValue` from `react-native-reanimated`) and pass no-op handlers:

```tsx
zoomScale={zoomScale}
onPinchStart={() => {}}
onPinchUpdate={() => {}}
onPinchEnd={() => {}}
```

Task 6 replaces the no-ops with real wiring. After this, tsc clean, jest green.

- [ ] **Step 3: Commit**

```bash
git add src/components/player/player-gestures.tsx src/app/player.tsx
git commit -m "feat(player): add pinch gesture to arena, single-pointer pan"
```

---

### Task 4: Zoom HUD

**Files:**
- Modify: `src/components/player/pan-indicators.tsx`

**Interfaces:**
- Consumes: existing `PanIndicators` center-pill styles.
- Produces (used by Task 6): new prop on `PanIndicatorsProps`:

```ts
zoomHud: { kind: 'percent'; percent: number } | { kind: 'label'; label: string } | null;
```

`percent` is an integer (e.g. `115` → "115%"); `label` is a mode name ("Fit", "Crop", "Stretch", "100%").

- [ ] **Step 1: Implement**

Extend the props interface, add `zoomHud` to the early-return check (`if (!levelHud && !scrubHud && !zoomHud) return null;`), and render inside the wrapper, matching the scrub pill's look:

```tsx
      {zoomHud && (
        <View style={styles.center}>
          <View style={styles.scrubPill}>
            <Text style={styles.scrubTime}>
              {zoomHud.kind === 'percent' ? `${zoomHud.percent}%` : zoomHud.label}
            </Text>
          </View>
        </View>
      )}
```

Update the call site in `src/app/player.tsx` to pass `zoomHud={null}` for now (replaced in Task 6).

- [ ] **Step 2: Typecheck, test, commit**

Run: `npx tsc --noEmit && npx jest`
Expected: clean/green.

```bash
git add src/components/player/pan-indicators.tsx src/app/player.tsx
git commit -m "feat(player): zoom HUD pill (live % and mode label)"
```

---

### Task 5: Mode cycle button in the bottom bar

**Files:**
- Modify: `src/components/player/bottom-bar.tsx`

**Interfaces:**
- Consumes: `DisplayMode` from `@/player/zoom`; `PlayerPressableScale`; `MaterialIcons` from `@expo/vector-icons`.
- Produces (used by Task 6): new props on `BottomBarProps`:

```ts
displayMode: DisplayMode;
onCycleDisplayMode: () => void;
```

The button sits in the bottom row, left of the speed chip. Icon per mode (all exist in MaterialIcons): fit → `fit-screen`, crop → `crop`, stretch → `aspect-ratio`, pixel → `crop-free`. The parent decides what the next mode is (it knows whether natural size is available) — the bar only reports the press.

- [ ] **Step 1: Implement**

```tsx
import { MaterialIcons } from '@expo/vector-icons';
import type { DisplayMode } from '@/player/zoom';

const MODE_ICON: Record<DisplayMode, keyof typeof MaterialIcons.glyphMap> = {
  fit: 'fit-screen',
  crop: 'crop',
  stretch: 'aspect-ratio',
  pixel: 'crop-free',
};
```

In the row, before the speed chip (speed chip keeps `marginLeft: 'auto'`; give the mode button a small `marginLeft: 'auto'`-free placement by putting it immediately before the chip and moving `marginLeft: 'auto'` onto a wrapping spacer — simplest: place the button after a `<View style={{ marginLeft: 'auto' }} />` spacer and remove `marginLeft: 'auto'` from `speedChip`, keeping the two controls grouped on the right with `gap`):

```tsx
        <View style={styles.rightControls}>
          <PlayerPressableScale onPress={onCycleDisplayMode} style={styles.modeButton}>
            <MaterialIcons name={MODE_ICON[displayMode]} size={20} color="#fff" />
          </PlayerPressableScale>
          <PlayerPressableScale
            onPress={() => onCycleRate(nextRate(rate))}
            style={[
              styles.speedChip,
              { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill },
            ]}>
            <Text style={styles.speedText}>{rateLabel}</Text>
          </PlayerPressableScale>
        </View>
```

with styles:

```ts
  rightControls: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

(remove `marginLeft: 'auto'` from `speedChip`). Update the `BottomBar` call site in `src/app/player.tsx` with `displayMode={'fit'}` and `onCycleDisplayMode={() => {}}` placeholders (replaced in Task 6).

- [ ] **Step 2: Typecheck, test, commit**

Run: `npx tsc --noEmit && npx jest`
Expected: clean/green.

```bash
git add src/components/player/bottom-bar.tsx src/app/player.tsx
git commit -m "feat(player): display-mode cycle button in bottom bar"
```

---

### Task 6: Player integration

**Files:**
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–5: `zoom.ts` API, `getDisplayMode`/`setDisplayMode`, `PlayerGestures` pinch props, `PanIndicators.zoomHud`, `BottomBar.displayMode`/`onCycleDisplayMode`. Also `useWindowDimensions` + `PixelRatio` from `react-native`, `Animated`/`useAnimatedStyle`/`withTiming` from `react-native-reanimated`, and expo-video's `sourceLoad` event (payload: `availableVideoTracks: VideoTrack[]`, each with `size: { width, height }`).
- Produces: complete feature; no downstream consumers.

- [ ] **Step 1: Wire state, natural size, and the animated wrapper**

In `src/app/player.tsx`:

1. Imports:

```ts
import { PixelRatio, useWindowDimensions } from 'react-native'; // extend existing react-native import
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  cycleMode, isDisplayMode, modeLabel, restingScale, snapZoom,
  type DisplayMode, type ZoomState,
} from '@/player/zoom';
import { getDisplayMode, setDisplayMode } from '@/db/progress-repo';
```

2. State (near the other UI state):

```ts
  // ── Zoom / display-mode state ────────────────────────────────────────────
  const screen = useWindowDimensions();
  const pixelRatio = PixelRatio.get();
  const [zoomState, setZoomState] = useState<ZoomState>({ kind: 'mode', mode: 'fit' });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoomHud, setZoomHud] = useState<
    { kind: 'percent'; percent: number } | { kind: 'label'; label: string } | null
  >(null);
  const zoomHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchActiveRef = useRef(false);
  // zoomScale already exists from Task 3
```

The current display mode (for the button icon and cycling) derives as:

```ts
  const displayMode: DisplayMode = zoomState.kind === 'mode' ? zoomState.mode : 'fit';
```

(While free-zoomed, the button shows the fit icon; pressing it goes to crop — first cycle step — which is fine.)

3. Natural size: seed a fallback from the library row and correct it from `sourceLoad` (reset both on video switch):

```ts
  // Natural video size: library scan dims as fallback, corrected by sourceLoad
  // (availableVideoTracks[0].size, in px) once the container is parsed.
  useEffect(() => {
    const v = videosRef.current.find((vv) => vv.id === videoId);
    setNaturalSize(v?.width && v?.height ? { width: v.width, height: v.height } : null);
    const sub = player.addListener('sourceLoad', (payload) => {
      const size = payload.availableVideoTracks?.[0]?.size;
      if (size?.width && size?.height) {
        setNaturalSize({ width: size.width, height: size.height });
      }
    });
    return () => sub.remove();
  }, [player, videoId]);
```

4. Load persisted mode on video switch (alongside, not inside, the resume effect):

```ts
  // Apply the persisted display mode (spec: written only when ≠ fit).
  useEffect(() => {
    let cancelled = false;
    setZoomState({ kind: 'mode', mode: 'fit' });
    getDisplayMode(db, videoId)
      .then((m) => {
        if (!cancelled && isDisplayMode(m)) setZoomState({ kind: 'mode', mode: m });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, videoId]);
```

5. Single "apply" effect — resolves the resting scale whenever anything it depends on changes (mode load, sourceLoad arriving, rotation), and animates to it. Skipped mid-pinch so it can't fight the gesture:

```ts
  // Drive the resting scale. Re-runs on rotation and when naturalSize arrives
  // (e.g. persisted crop applied before sourceLoad). Never during a pinch.
  useEffect(() => {
    if (pinchActiveRef.current) return;
    const target = restingScale(zoomState, screen, naturalSize, pixelRatio);
    zoomScale.value = withTiming(target, { duration: 180 });
  }, [zoomState, naturalSize, screen.width, screen.height, pixelRatio, zoomScale]);
```

6. Animated video wrapper — replace the current plain wrapper `View` (the `pointerEvents="none"` one around `VideoView`) with:

```tsx
      <Animated.View style={[StyleSheet.absoluteFill, zoomAnimatedStyle]} pointerEvents="none">
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit={zoomState.kind === 'mode' && zoomState.mode === 'stretch' ? 'fill' : 'contain'}
          allowsPictureInPicture={pictureInPicture}
          startsPictureInPictureAutomatically={pictureInPicture}
        />
      </Animated.View>
```

(keep the existing comment block about `pointerEvents="none"` / expo/expo#35479 — it still applies), with:

```ts
  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));
```

- [ ] **Step 2: Wire handlers (pinch, cycle, HUD, persistence)**

1. HUD helper — a label flash auto-dismisses; live % stays while pinching:

```ts
  const flashZoomLabel = useCallback((label: string) => {
    if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current);
    setZoomHud({ kind: 'label', label });
    zoomHudTimerRef.current = setTimeout(() => setZoomHud(null), 800);
  }, []);
```

(clear the timer in an unmount effect: `useEffect(() => () => { if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current); }, []);`)

2. Persistence helper (spec: NULL for fit, mode string otherwise):

```ts
  const persistDisplayMode = useCallback(
    (mode: DisplayMode) => {
      setDisplayMode(db, currentVideoIdRef.current, mode === 'fit' ? null : mode, Date.now()).catch(() => {});
    },
    [db],
  );
```

3. Pinch callbacks (replace the Task 3 no-ops):

```ts
  const handlePinchStart = useCallback(() => {
    pinchActiveRef.current = true;
    // A pinch is a zoom, never a boost: kill a boost the long-press may have
    // started before the second finger landed.
    handleBoostEnd();
    // Stretch is non-uniform; pinching exits it to the uniform baseline first.
    setZoomState((s) =>
      s.kind === 'mode' && s.mode === 'stretch' ? { kind: 'free', scale: 1 } : s,
    );
  }, [handleBoostEnd]);

  const handlePinchUpdate = useCallback((scale: number) => {
    setZoomHud({ kind: 'percent', percent: Math.round(scale * 100) });
  }, []);

  const handlePinchEnd = useCallback(
    (scale: number) => {
      pinchActiveRef.current = false;
      const snapped = snapZoom(scale, screen, naturalSize, pixelRatio);
      setZoomState(snapped);
      if (snapped.kind === 'mode') {
        flashZoomLabel(modeLabel(snapped.mode));
        persistDisplayMode(snapped.mode);
      } else {
        setZoomHud(null);
      }
      // The apply-effect animates zoomScale to the snapped target.
    },
    [screen, naturalSize, pixelRatio, flashZoomLabel, persistDisplayMode],
  );
```

4. Cycle button handler:

```ts
  const handleCycleDisplayMode = useCallback(() => {
    const next = cycleMode(displayMode, naturalSize !== null);
    setZoomState({ kind: 'mode', mode: next });
    flashZoomLabel(modeLabel(next));
    persistDisplayMode(next);
  }, [displayMode, naturalSize, flashZoomLabel, persistDisplayMode]);
```

5. Update call sites: `PlayerGestures` gets `onPinchStart={handlePinchStart} onPinchUpdate={handlePinchUpdate} onPinchEnd={handlePinchEnd}` (zoomScale already passed); `PanIndicators` gets `zoomHud={zoomHud}`; `BottomBar` gets `displayMode={displayMode}` and `onCycleDisplayMode={handleCycleDisplayMode}`.

6. In `handleNavigateTo`, add `setZoomHud(null);` to the reset block (zoom state itself resets via the videoId-keyed load effect).

Note: the locked case needs no special handling — `PlayerGestures` (and thus pinch) isn't mounted while `locked` is true, which satisfies the spec's "pinch disabled while locked".

- [ ] **Step 3: Typecheck and full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: clean/green (this task adds no unit tests — the logic it wires was tested in Tasks 1–2).

- [ ] **Step 4: Commit**

```bash
git add src/app/player.tsx
git commit -m "feat(player): wire display modes, pinch-zoom, HUD, and per-video persistence"
```

---

### Task 7: On-device verification + docs

**Files:**
- Modify: `docs/HANDOFF.md` (status ledger — record the shipped feature and any new caveats)

Per the repo's debugging memory: phone is usually adb-connected; verify on-device, screenshots at 1.17× coordinate scale if tapping via adb. Check `adb devices` first; if no device, pause and ask the user to plug in.

- [ ] **Step 1: Build/deploy the dev build and run the gesture regression checklist**

Verify each, in both portrait and landscape, and again after one orientation change (the historical wedge trigger):

1. Cycle button: Fit → Crop → Stretch → 100% → Fit; HUD label flashes each step; icon updates.
2. Pinch: live % HUD tracks fingers; release near Fit/Crop/100% snaps with label flash; release elsewhere keeps free scale.
3. Pinch starting from Stretch drops to contain baseline, then follows fingers.
4. Regression sweep — all pre-existing gestures still work after pinching: single-tap chrome toggle, 3-zone double-tap, long-press 2× boost (and: boost must NOT fire during a two-finger pinch), brightness/volume swipes, drag-scrub, seekbar drag, lock overlay (pinch dead while locked), orientation rotate + lock button, prev/next switch (gestureGen remount path), PiP on swipe-home.
5. Persistence: set Crop on a video → back out → reopen → Crop applies (before/at first frame, no visible jump after load); set Fit → reopen → Fit; free zoom → reopen → Fit (session-only).
6. Portrait video on landscape screen and vice versa: Crop and 100% scale correctly (no letterbox in Crop, pixel-true in 100%).

Fix anything that fails; commit fixes individually with descriptive messages.

- [ ] **Step 2: Update `docs/HANDOFF.md`**

Record: feature A shipped (modes, pinch, snap, persistence via migration 5), the transform-scale rendering approach, and the pan `maxPointers(1)` change. Keep ledger style.

- [ ] **Step 3: Final full check + commit**

Run: `npx tsc --noEmit && npx jest`

```bash
git add docs/HANDOFF.md
git commit -m "docs: record aspect-modes + pinch-zoom in handoff ledger"
```
