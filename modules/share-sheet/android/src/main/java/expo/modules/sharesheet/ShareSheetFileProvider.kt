package expo.modules.sharesheet

import androidx.core.content.FileProvider

/**
 * Own subclass rather than `androidx.core.content.FileProvider` directly: the
 * manifest merger keys providers by class name, and `expo-sharing` already
 * declares one, so sharing the base class would collide at build time.
 */
class ShareSheetFileProvider : FileProvider()
