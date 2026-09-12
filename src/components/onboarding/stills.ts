/**
 * Six blurred, out-of-focus "video frame" stills for the onboarding facsimiles.
 * They are static JPEGs rather than palette-driven tiles on purpose: a poster on
 * a real card is arbitrary imagery too, and a flat colour block is exactly what
 * made the old mockups read as placeholders. Generated once with ImageMagick
 * (soft bokeh blobs, heavy blur, vignette, grain); ~13 KB each.
 */
export const STILLS = {
  sunset: require('../../../assets/images/onboarding/sunset.jpg'),
  night: require('../../../assets/images/onboarding/night.jpg'),
  forest: require('../../../assets/images/onboarding/forest.jpg'),
  neon: require('../../../assets/images/onboarding/neon.jpg'),
  desert: require('../../../assets/images/onboarding/desert.jpg'),
  steel: require('../../../assets/images/onboarding/steel.jpg'),
} as const;

export type StillKey = keyof typeof STILLS;
