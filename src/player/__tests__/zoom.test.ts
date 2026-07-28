import {
  clampScale, cropScale, pixelScale, modeScale, restingScale,
  cycleMode, snapZoom, modeLabel, isDisplayMode, maxPinchScale,
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
    // crop = 1.25; 1.28/1.25 = 1.024 → within 6%
    expect(snapZoom(1.28, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toEqual({ kind: 'mode', mode: 'crop' });
  });
  it('stays free between targets', () => {
    expect(snapZoom(1.12, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toEqual({ kind: 'free', scale: 1.12 });
  });
  it('snaps to fit at the edge of the widened 6% tolerance', () => {
    // fit target = 1; 1.05/1 = 1.05 → 5% off, within the new 6% window
    expect(snapZoom(1.05, LANDSCAPE_SCREEN, WIDE_VIDEO, 3)).toEqual({ kind: 'mode', mode: 'fit' });
  });
  it('only fit is a target without natural size', () => {
    expect(snapZoom(1.02, LANDSCAPE_SCREEN, null, 3)).toEqual({ kind: 'mode', mode: 'fit' });
    expect(snapZoom(1.3, LANDSCAPE_SCREEN, null, 3)).toEqual({ kind: 'free', scale: 1.3 });
  });
});

describe('maxPinchScale', () => {
  it('returns MAX_SCALE when there is no natural size', () => {
    expect(maxPinchScale(LANDSCAPE_SCREEN, null, 3)).toBe(MAX_SCALE);
  });
  it('returns MAX_SCALE when crop/pixel headroom is small', () => {
    // crop = 1 (matching 16:9 aspect); contain = min(1600/1920, 900/1080) = 0.8333…,
    // pixel = 1/(3 * 0.8333…) = 0.4 — both well under MAX_SCALE even with headroom.
    expect(
      maxPinchScale({ width: 1600, height: 900 }, { width: 1920, height: 1080 }, 3),
    ).toBe(4);
  });
  it('exceeds MAX_SCALE with headroom for a portrait screen + wide video', () => {
    // screen 360×780, video 1920×804.
    // contain = min(360/1920, 780/804) = min(0.1875, 0.970149…) = 0.1875
    // cover   = max(360/1920, 780/804) = 0.970149…
    // cropScale = cover / contain = 0.970149… / 0.1875 = 5.174129…
    // cropScale * 1.3 headroom = 6.726368…
    const screen = { width: 360, height: 780 };
    const video = { width: 1920, height: 804 };
    const crop = cropScale(screen, video);
    expect(maxPinchScale(screen, video, 3)).toBeCloseTo(crop * 1.3, 5);
    expect(maxPinchScale(screen, video, 3)).toBeGreaterThan(4);
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
