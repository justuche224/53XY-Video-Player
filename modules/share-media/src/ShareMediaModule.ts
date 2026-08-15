import { NativeModule, requireNativeModule } from 'expo';

declare class ShareMediaModule extends NativeModule<{}> {
  /**
   * Open the system share sheet for one or more videos.
   * @param uris MediaStore `content://` URIs (expo-media-library asset ids on
   *             Android). Anything else throws — `file://` in EXTRA_STREAM is a
   *             FileUriExposedException on API 24+.
   */
  shareMedia(uris: string[], dialogTitle?: string): void;
}

export default requireNativeModule<ShareMediaModule>('ShareMedia');
