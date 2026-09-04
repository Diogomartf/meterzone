package expo.modules.sharesheet

import expo.modules.kotlin.exception.CodedException

class ShareSheetInvalidUriException(message: String) :
  CodedException("Cannot share the given file: $message")
