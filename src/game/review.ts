import * as StoreReview from 'expo-store-review';
import { Linking, Platform, Share } from 'react-native';

import type { PersistState } from '@/game/types';

/** App Store Connect numeric app id — write-review deep links. */
export const APP_STORE_ID = '6794744179';
export const MARKETING_URL = 'https://meterzone.net/';
export const SHARE_APP_MESSAGE =
  'Can you tap THE ZONE? Play MeterZone — free one-tap timing game.\n' +
  MARKETING_URL;

/**
 * Soft prompt ladder — few asks, wide gaps (anti-fatigue).
 * Index = reviewPromptsShown. Always requires a new high score.
 *
 *   1st → 20+ runs + high score
 *   2nd → 100+ runs + high score (+ min gap since last ask)
 *   3rd → 350+ runs + high score (+ min gap)
 *   then stop (menu Review still works)
 */
export const REVIEW_PROMPT_MILESTONES = [20, 100, 350] as const;

/** Hard cap on auto soft prompts for the lifetime of an install. */
export const REVIEW_PROMPT_MAX = REVIEW_PROMPT_MILESTONES.length;

/**
 * Minimum finished runs between soft prompts after a "Not now".
 * Prevents back-to-back celebration asks even if milestones were closer.
 */
export const REVIEW_MIN_RUNS_BETWEEN_PROMPTS = 60;

/**
 * Whether to show our soft prompt after a finished run.
 * Native Store Review is never called from here — only after a positive tap.
 */
export function shouldShowReviewPrompt(
  state: Pick<
    PersistState,
    | 'totalRuns'
    | 'reviewPromptStatus'
    | 'reviewPromptsShown'
    | 'reviewLastPromptAtRuns'
  >,
  opts: { isNewHighScore: boolean },
): boolean {
  // Already chose to review — never auto-ask again
  if (state.reviewPromptStatus === 'accepted') return false;
  // Only on a personal best (good mood)
  if (!opts.isNewHighScore) return false;

  const shown = Math.max(
    0,
    Math.min(state.reviewPromptsShown ?? 0, REVIEW_PROMPT_MAX),
  );
  if (shown >= REVIEW_PROMPT_MAX) return false;

  const milestone = REVIEW_PROMPT_MILESTONES[shown];
  if (milestone == null) return false;

  const runs = state.totalRuns;
  if (runs < milestone) return false;

  // Spacing after a prior decline
  const lastAt = state.reviewLastPromptAtRuns ?? 0;
  if (lastAt > 0 && runs < lastAt + REVIEW_MIN_RUNS_BETWEEN_PROMPTS) {
    return false;
  }

  return true;
}

/**
 * Ask Apple for the native in-app rating UI.
 * Prefer this after a positive user gesture — do not call cold.
 */
export async function requestNativeReview(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) {
      const hasAction = await StoreReview.hasAction();
      if (hasAction) {
        await StoreReview.requestReview();
        return;
      }
    }
  } catch {
    // Fall through to store URL.
  }

  const url =
    Platform.OS === 'ios'
      ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
      : Platform.OS === 'android'
        ? 'market://details?id=com.diogomartf.meterzone'
        : MARKETING_URL;

  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // ignore
  }

  if (Platform.OS === 'android') {
    await Linking.openURL(
      'https://play.google.com/store/apps/details?id=com.diogomartf.meterzone',
    );
    return;
  }

  await Linking.openURL(MARKETING_URL);
}

export async function shareApp(): Promise<void> {
  await Share.share(
    Platform.OS === 'ios'
      ? { message: SHARE_APP_MESSAGE, url: MARKETING_URL }
      : { message: SHARE_APP_MESSAGE },
  );
}
