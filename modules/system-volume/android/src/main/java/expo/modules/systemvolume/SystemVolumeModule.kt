package expo.modules.systemvolume

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SystemVolumeModule : Module() {
  private val audioManager: AudioManager
    get() {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      return context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

  override fun definition() = ModuleDefinition {
    Name("SystemVolume")

    // Current music-stream volume as a 0..1 fraction.
    Function("getVolume") {
      val am = audioManager
      val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      if (max == 0) 0.0 else am.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max.toDouble()
    }

    // Set the music-stream volume from a 0..1 fraction; returns the actual
    // (step-quantized) resulting fraction so the UI can reflect the true value.
    Function("setVolume") { value: Double ->
      val am = audioManager
      val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      val clamped = value.coerceIn(0.0, 1.0)
      val index = Math.round(clamped * max).toInt()
      am.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
      if (max == 0) 0.0 else index.toDouble() / max.toDouble()
    }
  }
}
