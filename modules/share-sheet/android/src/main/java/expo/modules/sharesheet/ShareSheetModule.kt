package expo.modules.sharesheet

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShareSheetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareSheet")

    AsyncFunction("setValueAsync") { value: String ->
    }
  }
}
