import { NativeModule, requireNativeModule } from 'expo';

export interface GrabFrameOptions {
  /** Positions to try, in priority order. */
  positionsMs: number[];
  /** Longest edge of the written JPEG, in pixels. */
  targetWidth: number;
  /** Stop at the first frame scoring at least this. Pass 0 to take the first decodable frame. */
  minScore: number;
  /** JPEG quality, 0..1. */
  quality: number;
  /** Absolute destination path; parent directories are created. */
  outPath: string;
}

export interface GrabFrameResult {
  /** file:// uri of the written JPEG. */
  uri: string;
  positionMs: number;
  score: number;
}

declare class FrameGrabberModule extends NativeModule<{}> {
  /** Resolves null when no candidate position decodes. */
  grabFrame(uri: string, options: GrabFrameOptions): Promise<GrabFrameResult | null>;
}

export default requireNativeModule<FrameGrabberModule>('FrameGrabber');
