package expo.modules.sharemedia

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NonContentUriException(uri: String) :
  CodedException("Only content:// URIs can be shared, received: $uri")

/**
 * Multi-file sharing. expo-sharing's shareAsync takes a single url, so sharing
 * a selection needs ACTION_SEND_MULTIPLE, which only exists at the intent level.
 *
 * Callers pass expo-media-library asset ids, which on Android already ARE
 * MediaStore content:// URIs — no FileProvider, no copying, no path decoding.
 */
class ShareMediaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareMedia")

    Function("shareMedia") { uriStrings: List<String>, dialogTitle: String? ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()

      if (uriStrings.isNotEmpty()) {
        // A file:// in EXTRA_STREAM throws FileUriExposedException on API 24+.
        // Asset ids are content:// already, so anything else is a caller bug and
        // should fail loudly here rather than mysteriously on a user's phone.
        uriStrings.firstOrNull { !it.startsWith(CONTENT_SCHEME) }?.let {
          throw NonContentUriException(it)
        }

        val uris = ArrayList(uriStrings.map { Uri.parse(it) })

        val intent = if (uris.size == 1) {
          Intent(Intent.ACTION_SEND).apply {
            type = MIME_TYPE
            putExtra(Intent.EXTRA_STREAM, uris[0])
          }
        } else {
          Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = MIME_TYPE
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
          }
        }

        // EXTRA_STREAM alone doesn't reliably grant read access to every item
        // across OEMs — the classic "receiver only got the first file" bug.
        // The ClipData copy is what makes the grant cover the whole set.
        // newRawUri (not newUri) keeps this off the ContentResolver.
        intent.clipData = ClipData.newRawUri(CLIP_LABEL, uris[0]).also { clip ->
          for (i in 1 until uris.size) clip.addItem(ClipData.Item(uris[i]))
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        activity.startActivity(Intent.createChooser(intent, dialogTitle))
      }
    }
  }

  companion object {
    private const val MIME_TYPE = "video/*"
    private const val CONTENT_SCHEME = "content://"
    private const val CLIP_LABEL = "Videos"
  }
}
