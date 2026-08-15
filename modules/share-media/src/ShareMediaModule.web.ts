import { registerWebModule, NativeModule } from 'expo';

// Multi-file sharing is Android-only; web is a no-op stub.
class ShareMediaModule extends NativeModule<{}> {
  shareMedia(_uris: string[], _dialogTitle?: string): void {}
}

export default registerWebModule(ShareMediaModule, 'ShareMediaModule');
