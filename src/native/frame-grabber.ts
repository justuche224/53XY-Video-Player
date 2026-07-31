// Thin re-export of the local FrameGrabber Expo module (Android video frame
// extraction with black/flat-frame rejection), so app code imports via @/native.
export { default as FrameGrabber } from '../../modules/frame-grabber/src/FrameGrabberModule';
export type {
  GrabFrameOptions,
  GrabFrameResult,
} from '../../modules/frame-grabber/src/FrameGrabberModule';
