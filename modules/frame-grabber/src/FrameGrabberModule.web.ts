import { registerWebModule, NativeModule } from 'expo';

import type { GrabFrameOptions, GrabFrameResult } from './FrameGrabberModule';

// Frame extraction is Android-only; web is a no-op stub.
class FrameGrabberModule extends NativeModule<{}> {
  async grabFrame(_uri: string, _options: GrabFrameOptions): Promise<GrabFrameResult | null> {
    return null;
  }
}

export default registerWebModule(FrameGrabberModule, 'FrameGrabberModule');
