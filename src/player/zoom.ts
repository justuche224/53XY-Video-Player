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
export const SNAP_TOLERANCE = 0.06;

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

/**
 * Upper pinch bound: every named uniform mode must be reachable by fingers
 * with overshoot headroom, whatever the screen/video geometry.
 */
export function maxPinchScale(
  screen: Size,
  natural: Size | null,
  pixelRatio: number,
): number {
  if (!natural) return MAX_SCALE;
  const headroom = 1.3;
  return Math.max(
    MAX_SCALE,
    cropScale(screen, natural) * headroom,
    pixelScale(screen, natural, pixelRatio) * headroom,
  );
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
