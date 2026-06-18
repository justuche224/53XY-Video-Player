import { NativeModule, requireNativeModule } from 'expo';

declare class SystemVolumeModule extends NativeModule<{}> {
  /** Current music-stream volume as a 0..1 fraction. */
  getVolume(): number;
  /** Set the music-stream volume from a 0..1 fraction; returns the actual (step-quantized) value. */
  setVolume(value: number): number;
}

export default requireNativeModule<SystemVolumeModule>('SystemVolume');
