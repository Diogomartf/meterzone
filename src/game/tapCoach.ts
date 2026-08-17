import type { Phase } from '@/game/runState';

/** How many fills a new player sees the pointing-hand TAP coach (lifetime persist). */
export const TAP_HINT_PLAYS = 3;

/** Tap gesture plays this many times in a single new-user game. */
export const TAP_HINT_PER_GAME = 3;

/** Games a new player sees the TAP hand. After this, it stays off. */
export const TAP_HINT_GAMES = 5;

/** Show the TAP hand this many ms before the fill reaches the zone. */
export const TAP_HINT_LEAD_MS = 1500;

/** Delay from fill start so the hand appears TAP_HINT_LEAD_MS before the zone. */
export function tapHintAppearDelay(fillMs: number, target: number): number {
  const ms = Number.isFinite(fillMs) ? Math.max(0, fillMs) : 0;
  const t = Number.isFinite(target) ? Math.min(1, Math.max(0, target)) : 0;
  return Math.max(0, Math.round(ms * t - TAP_HINT_LEAD_MS));
}

/** How many games the "tap the zone" line appears on. */
export const TAP_HOW_TO_PLAYS = 10;

/** Copy under the level label while the first-play coach is up. */
export const TAP_HOW_TO = 'Tap when meter hits the color zone';

type HintInput = {
  tapHintPlays: number;
  /** True while this fill is showing the TAP coach. */
  coachThisFill?: boolean;
  /** Finished games before this run. */
  totalRuns?: number;
  /** Latched at Play so the TAP hand can finish this new-user run. */
  hintThisRun?: boolean;
  /** Latched at Play so the intro survives the whole run. */
  howToThisRun?: boolean;
  phase: Phase;
  paused: boolean;
};

/** True on a new user's first TAP_HINT_PER_GAME fills, first TAP_HINT_GAMES games. */
export function shouldShowTapHint({
  coachThisFill = false,
  hintThisRun = false,
  totalRuns = 0,
  phase,
  paused,
}: HintInput): boolean {
  if (paused || phase !== 'filling') return false;
  if (!coachThisFill) return false;
  if (hintThisRun) return true;
  return totalRuns < TAP_HINT_GAMES;
}

/**
 * How-to line under LVL. First TAP_HOW_TO_PLAYS games, not levels.
 * Hidden on ready / game over. `howToThisRun` keeps it eligible for the
 * delayed fade even as levels change.
 */
export function shouldShowTapHowTo({
  totalRuns = 0,
  howToThisRun = false,
  phase,
}: HintInput): boolean {
  if (phase === 'ready' || phase === 'gameover') return false;
  if (howToThisRun) return true;
  return totalRuns < TAP_HOW_TO_PLAYS;
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
