import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { RoundLabel } from '@/game/types';

const platformOk = Platform.OS === 'ios' || Platform.OS === 'android';
const isAndroid = Platform.OS === 'android';
let userEnabled = true;

type Intensity =
  'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';

/** First type is preferred; later ones exist on older Android APIs. */
const ANDROID_HAPTICS: Record<Intensity, Haptics.AndroidHaptics[]> = {
  light: [
    Haptics.AndroidHaptics.Clock_Tick,
    Haptics.AndroidHaptics.Keyboard_Tap,
  ],
  medium: [
    Haptics.AndroidHaptics.Context_Click,
    Haptics.AndroidHaptics.Virtual_Key,
  ],
  heavy: [Haptics.AndroidHaptics.Confirm, Haptics.AndroidHaptics.Long_Press],
  selection: [
    Haptics.AndroidHaptics.Clock_Tick,
    Haptics.AndroidHaptics.Keyboard_Tap,
  ],
  success: [
    Haptics.AndroidHaptics.Confirm,
    Haptics.AndroidHaptics.Context_Click,
  ],
  error: [Haptics.AndroidHaptics.Reject, Haptics.AndroidHaptics.Long_Press],
};

/** Sync from persist so gameHaptics respects the settings toggle. */
export function setGameHapticsEnabled(enabled: boolean) {
  userEnabled = enabled;
}

async function androidFeel(kind: Intensity) {
  for (const type of ANDROID_HAPTICS[kind]) {
    try {
      await Haptics.performAndroidHapticsAsync(type);
      return;
    } catch {
      // Confirm/Reject/etc. are missing on older API levels.
    }
  }
}

async function safe(run: () => Promise<unknown>) {
  if (!platformOk || !userEnabled) return;
  try {
    await run();
  } catch {
    // Simulators / web / older Android APIs can reject haptics — ignore.
  }
}

function feel(kind: Intensity) {
  if (isAndroid) {
    return safe(() => androidFeel(kind));
  }
  switch (kind) {
    case 'light':
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    case 'medium':
      return safe(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      );
    case 'heavy':
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    case 'selection':
      return safe(() => Haptics.selectionAsync());
    case 'success':
      return safe(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      );
    case 'error':
      return safe(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const gameHaptics = {
  /** Big punch when the player taps to stop */
  stop() {
    return feel('heavy');
  },

  /** Soft kick when a round starts filling */
  start() {
    return feel('medium');
  },

  /** Countdown beat — ramps up into GO */
  countdownTick(n: number) {
    if (n <= 0) return feel('heavy');
    if (n === 1) return feel('medium');
    return feel('light');
  },

  /** Advance / retry */
  next() {
    return feel('selection');
  },

  /** Light tick when liquid crosses into the zone */
  zoneEnter() {
    return feel('light');
  },

  /** Graded result buzz */
  async result(label: RoundLabel) {
    if (!platformOk || !userEnabled) return;

    // Android's haptic engine drops or replaces rapid pulses, so keep those
    // beats shorter than the iOS Taptic sequences.
    switch (label) {
      case 'Perfect':
        await feel('success');
        await sleep(isAndroid ? 70 : 40);
        await feel('heavy');
        if (!isAndroid) {
          await sleep(50);
          await feel('medium');
        }
        break;
      case 'Great':
        await feel('success');
        await sleep(isAndroid ? 50 : 30);
        await feel('medium');
        break;
      case 'Good':
        await feel('medium');
        break;
      case 'Nice':
        await feel('light');
        break;
      case 'Miss':
        await feel('heavy');
        await sleep(isAndroid ? 80 : 90);
        await feel('error');
        if (!isAndroid) {
          await sleep(70);
          await feel('medium');
        }
        break;
    }
  },
};
