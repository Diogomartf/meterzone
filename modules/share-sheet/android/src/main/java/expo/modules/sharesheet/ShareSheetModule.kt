package expo.modules.sharesheet

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ShareSheetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ShareSheet")

    /**
     * ACTION_SEND carrying the image *and* the caption, so an app that supports
     * both composes them as one message. `expo-sharing` drops the text and
     * React Native's `Share` drops the image, which is why this exists.
     *
     * Resolves once the chooser has been presented — the user's pick, and
     * whether they follow through, is not reported back.
     */
    AsyncFunction("shareImageWithTextAsync") { fileUri: String, text: String, mimeType: String, dialogTitle: String? ->
      val contentUri = contentUriFor(fileUri)

      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra(Intent.EXTRA_TEXT, text)
        // Some apps read the stream off the clip data rather than the extra.
        clipData = android.content.ClipData.newRawUri(null, contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      val chooser = Intent.createChooser(send, dialogTitle)

      // The chooser's own grant is enough on stock Android, but a number of
      // OEM sheets hand the intent on without it — grant each target directly.
      context.packageManager
        .queryIntentActivities(chooser, PackageManager.MATCH_DEFAULT_ONLY)
        .forEach {
          context.grantUriPermission(
            it.activityInfo.packageName,
            contentUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
          )
        }

      appContext.throwingActivity.startActivity(chooser)
    }
  }

  /**
   * `react-native-view-shot` hands back a `file://` URI (or a bare path on some
   * versions); either way the file has to be re-exposed through our provider,
   * since a raw `file://` URI cannot cross an app boundary.
   */
  private fun contentUriFor(fileUri: String): Uri {
    val parsed = Uri.parse(fileUri)
    val path = when (parsed.scheme) {
      null, "file" -> parsed.path
      else -> throw ShareSheetInvalidUriException("expected a local file, got $fileUri")
    } ?: throw ShareSheetInvalidUriException("no path in $fileUri")

    val file = File(path)
    if (!file.exists()) {
      throw ShareSheetInvalidUriException("no file at $path")
    }

    return try {
      FileProvider.getUriForFile(
        context,
        context.applicationInfo.packageName + ".ShareSheetFileProvider",
        file
      )
    } catch (e: IllegalArgumentException) {
      // Outside the <paths> the provider declares — cache and files dirs.
      throw ShareSheetInvalidUriException("$path is not in a shareable directory")
    }
  }
}
