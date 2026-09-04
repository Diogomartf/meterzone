import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';
import { Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import ShareSheet from '../../modules/share-sheet/src/ShareSheetModule';
import { MARKETING_URL } from '@/game/review';

/**
 * Frames must commit and paint before `captureRef` can see them — callers hide
 * their chrome (Share/Retry buttons) a render earlier, and this is the beat we
 * wait for that to land on screen.
 */
const PAINT_SETTLE_MS = 60;

/**
 * Dares paired with a shared score image. The picture already shows the number,
 * so the text does the other job: needle the reader into a rematch. Rotated at
 * random so a friend who gets a few doesn't read the same line twice.
 */
export const SHARE_SCORE_DARES = [
  'Beat my score if you can 👀',
  'Think you can beat this? 👀',
  'I stopped the meter. Can you? 🎯',
  'Your turn. One tap, no mercy.',
  "Bet you can't top this 😏",
  'Come and take it.',
  'One tap stands between you and this score.',
  'Go on, make me look bad 👇',
  'Nailed the zone. Your move.',
  'Harder than it looks. Prove me wrong.',
] as const;

/** A random dare plus the link, so the challenge is one tap from playable. */
export function shareScoreCaption(): string {
  const dare =
    SHARE_SCORE_DARES[Math.floor(Math.random() * SHARE_SCORE_DARES.length)];
  return `${dare}\n${MARKETING_URL}`;
}

export type ShareCaptureOptions = {
  /** Caption sent alongside the image, and the text-only fallback. */
  message: string;
  /** Android share-sheet title. */
  dialogTitle?: string;
};

/**
 * Capture a view as a PNG and hand it to the platform share sheet.
 *
 * Both platforms send the caption alongside the image so a messaging app can
 * compose them as one message: iOS through `Share.share`, Android through our
 * `share-sheet` module, since `expo-sharing` drops the text and React Native's
 * `Share` drops the image. Falls back to expo-sharing and then to a text-only
 * share, so the button never dead-ends.
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

  if (Platform.OS === 'android' && ShareSheet) {
    try {
      await ShareSheet.shareImageWithTextAsync(
        uri,
        message,
        'image/png',
        dialogTitle,
      );
      return;
    } catch {
      // An OEM sheet that refused the intent — fall through to the image-only
      // path rather than dead-ending.
    }
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
