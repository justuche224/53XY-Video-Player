# Plan 3b-ii-a — Pan Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen pan to the player — vertical-left = brightness, vertical-right = volume, horizontal = scrub (preview, commit on release) — each with a HUD indicator.

**Architecture:** Pure pan math lives in `src/player/pan.ts` (Jest-tested). A `Gesture.Pan()` is added to the composed gesture; the worklet stays thin and forwards raw pan data to JS via `scheduleOnRN`, where the JS handler decides the axis once, applies brightness/volume live, and previews/commits the scrub. A new `pan-indicators.tsx` renders the HUDs.

**Tech Stack:** Expo SDK 56, RN 0.85, `react-native-gesture-handler` `Gesture.Pan()`, `react-native-reanimated`, `react-native-worklets` (`scheduleOnRN`), `expo-brightness`, `expo-video`. All installed — **pure JS, no native rebuild, no permissions.**

## Global Constraints

- **Pure logic → Jest; gesture/UI/native → `tsc --noEmit` clean + the 75-test suite staying green** (no RN renderer tests for the player).
- **Commits: plain conventional — NO `Co-Authored-By:` and NO "Generated with" trailer.**
- **No new dependencies, no native rebuild, no permissions.** `setBrightnessAsync`/`getBrightnessAsync` are app-level (do NOT use `setSystemBrightnessAsync`). Ships via Fast Refresh.
- **Worklet→JS hops use `scheduleOnRN`** (NOT deprecated `runOnJS`). Keep the pure helpers OFF the worklet — the pan worklet forwards raw numbers to JS, which calls `panAxis`/`panHalf`/`clamp01`/`scrubDeltaSec` (same pattern as the 3b-i double-tap fix, which decides `tapZone` on the JS thread).
- **Defaults:** scrub window `120` s (full-width drag = ±120 s); vertical sensitivity `delta = −dy / screenHeight`; axis-decide threshold `8` px.
- **`player.tsx` lifecycle is load-bearing.** Do not break resume/progress/subscription effects or the cached `lastPositionSecRef`/`lastDurationSecRef`. A scrub commit must set `lastPositionSecRef` (like `handleSeek`/`handleDoubleTap` do).
- **expo-video / expo-brightness API:** `player.volume` (settable 0..1), `player.currentTime`/`duration` (seconds); `import * as Brightness from 'expo-brightness'` → `Brightness.getBrightnessAsync(): Promise<number>`, `Brightness.setBrightnessAsync(v: number): Promise<void>`.

---

### Task 1: Pure pan helpers

**Files:**
- Create: `src/player/pan.ts`
- Test: `src/player/__tests__/pan.test.ts`

**Interfaces:**
- Produces:
  - `panAxis(dx: number, dy: number): 'horizontal' | 'vertical'` — `Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'`.
  - `panHalf(x: number, width: number): 'left' | 'right'` — `x < width / 2 ? 'left' : 'right'`.
  - `clamp01(v: number): number` — clamp to `[0, 1]`.
  - `scrubDeltaSec(dx: number, width: number, windowSec: number): number` — `width <= 0 ? 0 : (dx / width) * windowSec`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/player/__tests__/pan.test.ts
import { panAxis, panHalf, clamp01, scrubDeltaSec } from '../pan';

describe('panAxis', () => {
  it('is horizontal when |dx| > |dy|', () => {
    expect(panAxis(20, 5)).toBe('horizontal');
  });
  it('is vertical when |dy| >= |dx|', () => {
    expect(panAxis(5, 20)).toBe('vertical');
    expect(panAxis(10, 10)).toBe('vertical');
  });
  it('uses magnitude, ignoring sign', () => {
    expect(panAxis(-20, 5)).toBe('horizontal');
    expect(panAxis(5, -20)).toBe('vertical');
  });
});

describe('panHalf', () => {
  it('is left in the left half, right at/after the midpoint', () => {
    expect(panHalf(10, 100)).toBe('left');
    expect(panHalf(50, 100)).toBe('right');
    expect(panHalf(80, 100)).toBe('right');
  });
});

describe('clamp01', () => {
  it('clamps to [0,1]', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe('scrubDeltaSec', () => {
  it('maps a full-width drag to ±windowSec', () => {
    expect(scrubDeltaSec(100, 100, 120)).toBe(120);
    expect(scrubDeltaSec(-50, 100, 120)).toBe(-60);
  });
  it('returns 0 for non-positive width', () => {
    expect(scrubDeltaSec(50, 0, 120)).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail** — `npm test -- src/player/__tests__/pan` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/player/pan.ts
export function panAxis(dx: number, dy: number): 'horizontal' | 'vertical' {
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

export function panHalf(x: number, width: number): 'left' | 'right' {
  return x < width / 2 ? 'left' : 'right';
}

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function scrubDeltaSec(dx: number, width: number, windowSec: number): number {
  if (width <= 0) return 0;
  return (dx / width) * windowSec;
}
```

- [ ] **Step 4: Run tests** — `npm test -- src/player/__tests__/pan` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/player/pan.ts src/player/__tests__/pan.test.ts
git commit -m "feat(player): pure pan helpers (axis, half, clamp01, scrub delta)"
```

---

### Task 2: Pan gesture, HUD indicators, and player wiring

Adds the pan gesture, the brightness/volume/scrub behavior, and the HUDs. Device-verified;
gate on `tsc` + the suite + the checklist.

**Files:**
- Create: `src/components/player/pan-indicators.tsx`
- Modify: `src/components/player/player-gestures.tsx` (add `Gesture.Pan()` + height shared value + pan callbacks)
- Modify: `src/app/player.tsx` (pan handlers: brightness save/restore, volume, scrub preview/commit; HUD state; render `PanIndicators`)

**Interfaces:**
- Consumes: `panAxis`, `panHalf`, `clamp01`, `scrubDeltaSec` from `@/player/pan`; `seekTarget` from `@/player/seek`; `formatTime` from `@/player/format-time`; `Brightness` from `expo-brightness`; `scheduleOnRN` from `react-native-worklets`.
- Produces:
  - `PlayerGestures` gains props `{ onPanStart: () => void; onPanMove: (x: number, translationX: number, translationY: number, width: number, height: number) => void; onPanEnd: () => void }` (existing tap/long-press props unchanged).
  - `PanIndicators` props: `{ levelHud: { kind: 'brightness' | 'volume'; level: number } | null; scrubHud: { targetSec: number; deltaSec: number } | null }`.

**`player-gestures.tsx` — add the pan (use verbatim; worklet stays thin, forwards raw numbers):**

```tsx
// add to imports: nothing new beyond existing useSharedValue/Gesture/scheduleOnRN
// inside the component, alongside `const width = useSharedValue(0);`
const height = useSharedValue(0);

// inside the useMemo, build the pan and add it to the Race:
const pan = Gesture.Pan()
  .onStart(() => {
    'worklet';
    scheduleOnRN(onPanStart);
  })
  .onUpdate((e) => {
    'worklet';
    scheduleOnRN(onPanMove, e.x, e.translationX, e.translationY, width.value, height.value);
  })
  .onEnd(() => {
    'worklet';
    scheduleOnRN(onPanEnd);
  });

return Gesture.Race(pan, longPress, Gesture.Exclusive(doubleTap, singleTap));
// useMemo deps: add onPanStart, onPanMove, onPanEnd to the existing dep array
```

Set `height.value` in the same `onLayout` that sets `width.value`:
`width.value = ev.nativeEvent.layout.width; height.value = ev.nativeEvent.layout.height;`

**`player.tsx` wiring (behavior contract):**
- Refs: `const originalBrightnessRef = useRef(1);` (saved screen brightness), `const brightnessRef = useRef(1);` (current), `const panRef = useRef<{ axis: 'horizontal' | 'vertical' | null; half: 'left' | 'right'; brightnessStart: number; volumeStart: number; scrubBaseSec: number }>({ axis: null, half: 'left', brightnessStart: 1, volumeStart: 1, scrubBaseSec: 0 });`
- State: `const [levelHud, setLevelHud] = useState<{ kind: 'brightness' | 'volume'; level: number } | null>(null);` `const [scrubHud, setScrubHud] = useState<{ targetSec: number; deltaSec: number } | null>(null);`
- On mount effect: `Brightness.getBrightnessAsync().then(b => { if (b >= 0) { originalBrightnessRef.current = b; brightnessRef.current = b; } });` cleanup: `Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => {});` (restore on unmount). Add as its own `useEffect(..., [])`.
- `handlePanStart` (`useCallback`, deps `[player]`): reset `panRef.current = { axis: null, half: 'left', brightnessStart: brightnessRef.current, volumeStart: player.volume, scrubBaseSec: lastPositionSecRef.current };`
- `handlePanMove` (`useCallback`, deps `[player]`): 
  - `const st = panRef.current;`
  - If `st.axis === null`: if `Math.abs(translationX) < 8 && Math.abs(translationY) < 8` return; else `st.axis = panAxis(translationX, translationY); if (st.axis === 'vertical') st.half = panHalf(x - translationX, width);` (start x = current x − translation).
  - If `st.axis === 'horizontal'`: `const deltaSec = scrubDeltaSec(translationX, width, 120); const target = seekTarget(st.scrubBaseSec, deltaSec, lastDurationSecRef.current); setScrubHud({ targetSec: target, deltaSec });` (preview only — do NOT seek here).
  - Else (vertical): `const base = st.half === 'left' ? st.brightnessStart : st.volumeStart; const level = clamp01(base - translationY / height); if (st.half === 'left') { brightnessRef.current = level; Brightness.setBrightnessAsync(level).catch(() => {}); setLevelHud({ kind: 'brightness', level }); } else { player.volume = level; setLevelHud({ kind: 'volume', level }); }`
- `handlePanEnd` (`useCallback`, deps `[player]`): if `panRef.current.axis === 'horizontal' && scrubHud` (read latest via a ref or functional set) → commit: `player.currentTime = target; setPositionSec(target); lastPositionSecRef.current = target;`. Then `setScrubHud(null); setLevelHud(null);`. **To read the committed target reliably, keep a `scrubTargetRef` updated in `handlePanMove` (set `scrubTargetRef.current = target`) and commit from it in `handlePanEnd`** (avoids stale `scrubHud` closure).
- Wire `onPanStart`/`onPanMove`/`onPanEnd` onto `<PlayerGestures>`; render `<PanIndicators levelHud={levelHud} scrubHud={scrubHud} />` in the indicators layer (next to `<GestureIndicators>`).

**`pan-indicators.tsx` (behavior contract):**
- Absolute-fill, `pointerEvents="none"`.
- When `levelHud`: a centered pill — icon (`☀` brightness / `🔊` volume) above a thin vertical or horizontal level bar whose fill = `level` (0..1). White-on-`rgba(0,0,0,0.6)`, matching the existing indicator style.
- When `scrubHud`: a center bubble showing `formatTime(targetSec)` and a signed delta `(+|-)formatTime(|deltaSec|)` (e.g. `12:30  +0:45`).
- Each shows only while its HUD prop is non-null (the gesture handlers clear them on end).

- [ ] **Step 1:** Add `Gesture.Pan()` + `height` shared value + the three pan callbacks to `player-gestures.tsx` per the verbatim block; extend the `useMemo` deps and the `onLayout`.
- [ ] **Step 2:** Create `pan-indicators.tsx` per the contract (match existing indicator styling).
- [ ] **Step 3:** Wire `player.tsx`: brightness save/restore effect, the three pan handlers (reusing `panAxis`/`panHalf`/`clamp01`/`scrubDeltaSec`/`seekTarget`), HUD state, `scrubTargetRef`, and render `PanIndicators`. Ensure scrub commit updates `lastPositionSecRef`.
- [ ] **Step 4:** `npx tsc --noEmit` → clean; `npm test` → all green (Task 1 added pan tests to the prior 75; no UI tests here).
- [ ] **Step 5: Commit**

```bash
git add src/components/player/pan-indicators.tsx src/components/player/player-gestures.tsx src/app/player.tsx
git commit -m "feat(player): swipe brightness/volume and drag-scrub gestures with HUDs"
```

**Device checklist (user, Fast Refresh — no rebuild):**
- Vertical swipe on the **left** half changes **screen brightness** (up = brighter) with a ☀ HUD; leaving the player **restores** the original brightness.
- Vertical swipe on the **right** half changes **volume** (up = louder) with a 🔊 HUD.
- **Horizontal drag** shows a target-time/delta bubble and moves the seekbar; the video **seeks on release**, not during the drag; the library bar reflects the new position after backing out.
- A drag locks to one axis (no mid-drag flip between brightness and scrub).
- Tap / double-tap (3-zone) / long-press-2× still work and aren't triggered by a deliberate drag.

---

## Final whole-branch review

After Task 2, one terse whole-branch review (opus): `tsc` clean, suite green, no
`Co-Authored-By`/"Generated with" trailers, the pan composes cleanly with tap/double-tap/
long-press (a drag doesn't fire a tap; a tap doesn't start a pan), axis is locked once per
drag, brightness is saved on mount and restored on unmount, volume/scrub use the live
player, the scrub commit syncs `lastPositionSecRef`, and helpers are reused (not
reimplemented, and not called inside a worklet). Then hand the user the device checklist;
merge after they verify.

## Self-review notes
- **Spec coverage:** brightness swipe (left) ✓(T2) · volume swipe (right) ✓(T2) ·
  horizontal drag-scrub preview+commit ✓(T2) · axis lock ✓(T2) · brightness restore on exit
  ✓(T2) · HUD indicators ✓(T2) · pure helpers tested ✓(T1).
- **Deferred to 3b-ii-b (not here):** lock, edge-double-tap fix.
- **Type consistency:** `panAxis`/`panHalf`/`clamp01`/`scrubDeltaSec` signatures consistent
  T1→T2; `PanIndicators` `levelHud`/`scrubHud` shapes consistent within T2; the pan callback
  signatures match between `player-gestures.tsx` and `player.tsx`.
