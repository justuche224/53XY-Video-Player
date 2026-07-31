package expo.modules.framegrabber

import android.graphics.Bitmap
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Scores how usable a frame is as a poster image, in 0..1.
 *
 * Two signals, both on luma: the mean rejects black frames, fade-ins and blown
 * white flashes outright; the standard deviation is the score itself, and is
 * what separates a real scene from a studio logo on a flat background — a
 * brightness check alone happily accepts a solid grey card.
 */
object FrameScorer {
  private const val WORK_WIDTH = 160
  private const val MIN_MEAN_LUMA = 0.06
  private const val MAX_MEAN_LUMA = 0.97

  fun score(bitmap: Bitmap): Double {
    val work = downscale(bitmap)
    val width = work.width
    val height = work.height
    if (width <= 0 || height <= 0) {
      if (work !== bitmap) work.recycle()
      return 0.0
    }

    val pixels = IntArray(width * height)
    work.getPixels(pixels, 0, width, 0, 0, width, height)
    if (work !== bitmap) work.recycle()

    var sum = 0.0
    var sumOfSquares = 0.0
    for (pixel in pixels) {
      val r = (pixel shr 16) and 0xFF
      val g = (pixel shr 8) and 0xFF
      val b = pixel and 0xFF
      val luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
      sum += luma
      sumOfSquares += luma * luma
    }

    val count = pixels.size.toDouble()
    val mean = sum / count
    if (mean < MIN_MEAN_LUMA || mean > MAX_MEAN_LUMA) return 0.0

    val variance = (sumOfSquares / count) - (mean * mean)
    return sqrt(max(0.0, variance)).coerceIn(0.0, 1.0)
  }

  private fun downscale(bitmap: Bitmap): Bitmap {
    if (bitmap.width <= WORK_WIDTH) return bitmap
    val height = (bitmap.height.toFloat() * WORK_WIDTH / bitmap.width).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bitmap, WORK_WIDTH, height, true)
  }
}
