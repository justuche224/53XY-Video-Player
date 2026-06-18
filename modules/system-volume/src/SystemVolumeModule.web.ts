import { registerWebModule, NativeModule } from 'expo';

// System volume control is Android-only; web is a no-op stub.
class SystemVolumeModule extends NativeModule<{}> {
  getVolume(): number {
    return 1;
  }
  setVolume(value: number): number {
    return value;
  }
}

export default registerWebModule(SystemVolumeModule, 'SystemVolumeModule');
