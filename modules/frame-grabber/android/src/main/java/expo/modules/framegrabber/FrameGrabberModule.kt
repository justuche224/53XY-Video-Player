package expo.modules.framegrabber

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream

class GrabOptions : Record {
  @Field var positionsMs: List<Double> = emptyList()
  @Field var targetWidth: Int = 640
  @Field var minScore: Double = 0.0
  @Field var quality: Double = 0.8
  @Field var outPath: String = ""
}

class FrameGrabberModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FrameGrabber")

    /**
     * Walks `positionsMs` in order and stops at the first frame scoring at least
     * `minScore`, so the common case costs a single decode. If nothing clears the
     * bar, the best-scoring candidate is written anyway — a mediocre frame beats a
     * blank tile. Returns null only when no position decodes at all.
     */
    AsyncFunction("grabFrame") { sourceUri: String, options: GrabOptions ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(context, Uri.parse(sourceUri))

        var bestBitmap: Bitmap? = null
        var bestScore = -1.0
        var bestPositionMs = 0.0

        for (positionMs in options.positionsMs) {
          val bitmap = grabScaled(retriever, (positionMs * 1000).toLong(), options.targetWidth)
            ?: continue
          val score = FrameScorer.score(bitmap)
          if (score > bestScore) {
            bestBitmap?.recycle()
            bestBitmap = bitmap
            bestScore = score
            bestPositionMs = positionMs
          } else {
            bitmap.recycle()
          }
          if (score >= options.minScore) break
        }

        val winner = bestBitmap ?: return@AsyncFunction null
        val path = options.outPath.removePrefix("file://")
        writeJpeg(winner, path, options.quality)
        winner.recycle()

        mapOf(
          "uri" to "file://$path",
          "positionMs" to bestPositionMs,
          "score" to bestScore,
        )
      } finally {
        retriever.release()
      }
    }
  }

  /**
   * OPTION_CLOSEST_SYNC snaps to the nearest keyframe — sub-second precision is
   * irrelevant for a poster frame and exact seeking is dramatically slower.
   * The scale box is square so the aspect-preserving fit yields `targetWidth`
   * for landscape video and caps height for portrait.
   */
  private fun grabScaled(
    retriever: MediaMetadataRetriever,
    timeUs: Long,
    targetWidth: Int,
  ): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      return retriever.getScaledFrameAtTime(
        timeUs,
        MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
        targetWidth,
        targetWidth,
      )
    }
    val full = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
      ?: return null
    if (full.width <= targetWidth) return full
    val height = (full.height.toFloat() * targetWidth / full.width).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(full, targetWidth, height, true)
    if (scaled !== full) full.recycle()
    return scaled
  }

  private fun writeJpeg(bitmap: Bitmap, path: String, quality: Double) {
    val file = File(path)
    file.parentFile?.mkdirs()
    FileOutputStream(file).use { out ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt().coerceIn(1, 100), out)
    }
  }
}
