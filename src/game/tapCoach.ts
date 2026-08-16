import type { Phase } from '@/game/runState';

/** How many fills a new player sees the on-screen tap coach. */
export const TAP_HINT_PLAYS = 3;

/** Copy under the level label while the first-play coach is up. */
export const TAP_HOW_TO = 'Tap when meter hits the color zone';

type HintInput = {
  tapHintPlays: number;
  /** True while this fill is showing the TAP coach. */
  coachThisFill?: boolean;
  phase: Phase;
  paused: boolean;
};

/** True while the meter is filling for a new player's first few taps. */
export function shouldShowTapHint({
  coachThisFill = false,
  phase,
  paused,
}: HintInput): boolean {
  if (paused || phase !== 'filling') return false;
  return coachThisFill;
}

/** How-to line under LVL — filling and countdown, so it can be read before GO. */
export function shouldShowTapHowTo({
  tapHintPlays,
  coachThisFill = false,
  phase,
  paused,
}: HintInput): boolean {
  if (paused) return false;
  if (phase === 'countdown') return tapHintPlays < TAP_HINT_PLAYS;
  if (phase === 'filling') return coachThisFill;
  return false;
}

/** Fold this run's fills into the lifetime coach count, capped. */
export function nextTapHintPlays(prev: number, attempts: number): number {
  const shown = Number.isFinite(prev) ? Math.max(0, prev) : 0;
  const extra = Number.isFinite(attempts) ? Math.max(0, attempts) : 0;
  return Math.min(TAP_HINT_PLAYS, shown + extra);
}

/** Raise the in-memory coach count. Never lower it over a newer fill. */
export function mergeLiveTapHintPlays(live: number, incoming: number): number {
  return Math.max(nextTapHintPlays(live, 0), nextTapHintPlays(incoming, 0));
}

/**
 * Undo this fill's optimistic increment only if live still equals `expected`.
 * A newer fill's count is left untouched so the coach cannot be shown extra times.
 */
export function rollbackLiveTapHintPlays(
  live: number,
  expected: number,
  disk: number,
): number {
  const current = nextTapHintPlays(live, 0);
  if (current !== nextTapHintPlays(expected, 0)) return current;
  return nextTapHintPlays(disk, 0);
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
