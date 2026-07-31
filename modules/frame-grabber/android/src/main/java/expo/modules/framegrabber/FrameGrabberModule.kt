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
import kotlin.math.max

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
     *
     * Runs on [appContext.backgroundCoroutineScope] rather than the implicit
     * `Queues.DEFAULT`: decoding + scoring several keyframes can take hundreds of ms
     * to seconds on large/high-res sources, and `Queues.DEFAULT` is a single
     * app-wide `HandlerThread` shared by every Expo module's `AsyncFunction`.
     * Staying on it would starve unrelated native calls (expo-file-system,
     * expo-media-library, expo-brightness, ...) during a library-wide sweep.
     */
    AsyncFunction("grabFrame") { sourceUri: String, options: GrabOptions ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val retriever = MediaMetadataRetriever()
      try {
        // expo-media-library (and other callers) build `file://` uris by raw string
        // concatenation with no percent-encoding, so filenames containing `#`, `?`
        // or `%` are not valid uri components. Uri.parse().getPath() would percent-
        // *decode* such a path and silently truncate or corrupt it (e.g. `#3.mkv` is
        // parsed as a fragment). For a `file://` source, skip Uri parsing entirely
        // and hand MediaMetadataRetriever the raw filesystem path — this mirrors how
        // outPath is already handled below, so both ends agree on "raw string, no
        // percent-decoding". Any other scheme (e.g. `content://`) still needs real
        // Uri resolution, so that path is untouched.
        if (sourceUri.startsWith("file://")) {
          retriever.setDataSource(sourceUri.removePrefix("file://"))
        } else {
          retriever.setDataSource(context, Uri.parse(sourceUri))
        }

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
        try {
          writeJpeg(winner, path, options.quality)
        } finally {
          // Guarantee the recycle whether writeJpeg succeeds or throws (e.g. disk
          // full, uncreatable parent dir) — otherwise the winner's native-heap
          // pixels leak until finalization on API 24/25.
          winner.recycle()
        }

        mapOf(
          "uri" to "file://$path",
          "positionMs" to bestPositionMs,
          "score" to bestScore,
        )
      } finally {
        retriever.release()
      }
    }.runOnQueue(appContext.backgroundCoroutineScope)
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
    // Fit inside a targetWidth x targetWidth box on the longer edge, matching the
    // API >= O_MR1 path above. Scaling by width alone overshoots for portrait video:
    // a 1080x1920 source at targetWidth=640 would come out 640x1137 (longest edge
    // 1137, ~3.2x the intended pixel area) instead of 360x640.
    val longerEdge = max(full.width, full.height)
    if (longerEdge <= targetWidth) return full
    val scale = targetWidth.toFloat() / longerEdge
    val width = (full.width * scale).toInt().coerceAtLeast(1)
    val height = (full.height * scale).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(full, width, height, true)
    if (scaled !== full) full.recycle()
    return scaled
  }

  private fun writeJpeg(bitmap: Bitmap, path: String, quality: Double) {
    val file = File(path)
    val parent = file.parentFile
    if (parent != null && !parent.exists() && !parent.mkdirs() && !parent.exists()) {
      // mkdirs() can race with another writer and return false even though the
      // directory now exists; only fail loudly if it's genuinely still missing.
      throw java.io.IOException("Could not create thumbnail directory: ${parent.path}")
    }
    val ok = FileOutputStream(file).use { out ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt().coerceIn(1, 100), out)
    }
    if (!ok) {
      // A false return means the encoder wrote a partial/empty file. Leaving it in
      // place would let Task 5 persist that uri and thumb-policy's needsThumbnail
      // treat a 0-byte JPEG as healthy since the file exists — a tile that never
      // self-heals. Delete it and fail the promise instead.
      file.delete()
      throw java.io.IOException("Bitmap.compress returned false for $path")
    }
  }
}
