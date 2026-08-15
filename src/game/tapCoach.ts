import type { Phase } from '@/game/runState';

/** How many fills a new player sees the on-screen tap coach. */
export const TAP_HINT_PLAYS = 3;

type HintInput = {
  tapHintPlays: number;
  attemptsThisRun: number;
  phase: Phase;
  paused: boolean;
};

/** True while the meter is filling for a new player's first few taps. */
export function shouldShowTapHint({
  tapHintPlays,
  attemptsThisRun,
  phase,
  paused,
}: HintInput): boolean {
  if (paused || phase !== 'filling') return false;
  return tapHintPlays + attemptsThisRun < TAP_HINT_PLAYS;
}

/** Fold this run's fills into the lifetime coach count, capped. */
export function nextTapHintPlays(prev: number, attempts: number): number {
  const shown = Number.isFinite(prev) ? Math.max(0, prev) : 0;
  const extra = Number.isFinite(attempts) ? Math.max(0, attempts) : 0;
  return Math.min(TAP_HINT_PLAYS, shown + extra);
}

/**
 * Saves from before the tap coach: anyone who already played skips it.
 * An explicit count always wins.
 */
export function migrateTapHintPlays(parsed: {
  tapHintPlays?: unknown;
  totalRuns?: unknown;
  highScore?: unknown;
}): number {
  if (Number.isFinite(parsed.tapHintPlays as number)) {
    return Math.max(0, Number(parsed.tapHintPlays));
  }
  if (Number(parsed.totalRuns) > 0 || Number(parsed.highScore) > 0) {
    return TAP_HINT_PLAYS;
  }
  return 0;
}
