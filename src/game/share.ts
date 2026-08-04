import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';
import { Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Frames must commit and paint before `captureRef` can see them — callers hide
 * their chrome (Share/Retry buttons) a render earlier, and this is the beat we
 * wait for that to land on screen.
 */
const PAINT_SETTLE_MS = 60;

/** Caption attached to any shared score image. */
export const SHARE_SCORE_CAPTION = 'Can you top that?';

export type ShareCaptureOptions = {
  /** Caption sent alongside the image. */
  message: string;
  /** Android share-sheet title. */
  dialogTitle?: string;
};

/**
 * Capture a view as a PNG and hand it to the platform share sheet.
 *
 * iOS goes through `Share.share` so the caption and image travel together;
 * Android's Share ignores `url`, so it uses expo-sharing when available. Falls
 * back to a text-only share whenever the capture or the image path is
 * unavailable, so the button never dead-ends.
 *
 * Resolves once a share sheet was presented; failures throw (callers catch).
 */
export async function captureAndShare(
  target: View | null,
  { message, dialogTitle = message }: ShareCaptureOptions,
): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, PAINT_SETTLE_MS));

  if (!target) {
    await Share.share({ message });
    return;
  }

  const uri = await captureRef(target, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  if (Platform.OS === 'ios') {
    await Share.share({ message, url: uri });
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle,
      UTI: 'public.png',
    });
    return;
  }

  await Share.share({ message });
}
