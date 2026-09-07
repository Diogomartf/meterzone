import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ShareSheetModule extends NativeModule {
  /**
   * Opens the system chooser with an ACTION_SEND intent carrying both the image
   * and the caption, so apps that support it compose the two as one message.
   */
  shareImageWithTextAsync(
    fileUri: string,
    text: string,
    mimeType: string,
    dialogTitle?: string,
  ): Promise<void>;
}

/** Android only — null on every other platform, and on builds predating it. */
export default requireOptionalNativeModule<ShareSheetModule>('ShareSheet');
