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
