/** Longest edge of a saved frame, in pixels. Big enough to show someone. */
export const MOMENT_WIDTH = 1280;
/** JPEG quality for a saved frame, 0..1. Higher than a thumbnail's: this one is looked at. */
export const MOMENT_QUALITY = 0.9;
/** How long the capture confirmation stays on screen. */
export const SNACKBAR_MS = 5000;
/**
 * Container-reported durations drift slightly between scans, so a relink match
 * on duration needs tolerance. Used in Phase 2.
 */
export const RELINK_DURATION_TOLERANCE_MS = 1000;

/** Folder name under the app document directory, used only in the fallback case. */
export const MOMENTS_DIR_NAME = 'moments';
export const MANIFEST_FILENAME = 'moments.json';
/**
 * Primary home for frames. Shared storage, so it survives uninstall and Clear
 * Data; a `.nomedia` in it keeps the gallery and media scanner out.
 */
export const SHARED_MOMENTS_DIR = 'file:///storage/emulated/0/53XY/Moments';
