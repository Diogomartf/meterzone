import { makeRound } from '@/game/levels';
import { STARTING_LIVES } from '@/game/scoring';
import type {
  RoundConfig,
  RoundLabel,
  RoundOutcome,
  SessionStats,
} from '@/game/types';

/**
 * The whole run state machine as one pure reducer.
 *
 * It lives outside the component for two reasons. First, timers and Reanimated
 * callbacks need the *current* values synchronously, which a captured `useState`
 * closure cannot give them — GameScreen used to keep a hand-written `useRef`
 * mirror beside each piece of state, and every update had to remember to write
 * both. Deriving the ref and the React state from this one function removes that
 * whole class of drift. Second, the pause/resume paths are the trickiest part of
 * the game and were previously impossible to test; as a pure function they are
 * covered by runState.test.ts.
 */

export type Phase = 'ready' | 'countdown' | 'filling' | 'result' | 'gameover';

/** What to replay once the menu closes. */
export type PauseResume =
  | { kind: 'fill'; fillAt: number }
  | { kind: 'countdown'; countAt: number }
  | { kind: 'startFill' }
  | { kind: 'advance' };

/** Which timer is in flight, so a pause knows what it is interrupting. */
export type PendingTimer = 'countdown' | 'startFill' | 'advance' | null;

/** Side chips — fixed per label so Nice / Great don't jump around. */
export type FeedbackSlot = 'left' | 'right';

export type Feedback = {
  label: RoundLabel;
  points: number;
  combo: number;
  comboGrew: boolean;
  slot: FeedbackSlot;
};

export function feedbackSlotFor(label: RoundLabel): FeedbackSlot {
  // Great = right, Nice = left — same spot every time
  return label === 'Great' ? 'right' : 'left';
}

export const INITIAL_COUNTDOWN = 3;

export type RunState = {
  phase: Phase;
  round: RoundConfig;
  score: number;
  lives: number;
  combo: number;
  countdown: number;
  stats: SessionStats;
  dailyMode: boolean;
  /** True once this run has beaten the best it started from. */
  isNewBest: boolean;
  feedback: Feedback | null;
  /** Menu is open — the run must not progress. */
  paused: boolean;
  pauseResume: PauseResume | null;
  pendingTimer: PendingTimer;
};

export function emptyStats(): SessionStats {
  return {
    attempts: 0,
    hits: 0,
    perfects: 0,
    misses: 0,
    bestCombo: 0,
    coinsEarned: 0,
  };
}

/** Fold one round's outcome into the running session tally. */
export function tallyRound(
  prev: SessionStats,
  result: RoundOutcome,
): SessionStats {
  return {
    attempts: prev.attempts + 1,
    hits: result.result === 'miss' ? prev.hits : prev.hits + 1,
    perfects: result.result === 'perfect' ? prev.perfects + 1 : prev.perfects,
    misses: result.costsLife ? prev.misses + 1 : prev.misses,
    bestCombo: Math.max(prev.bestCombo, result.combo),
    coinsEarned: prev.coinsEarned + result.coins,
  };
}

export function initialRunState(round: RoundConfig = makeRound(1)): RunState {
  return {
    phase: 'ready',
    round,
    score: 0,
    lives: STARTING_LIVES,
    combo: 0,
    countdown: INITIAL_COUNTDOWN,
    stats: emptyStats(),
    dailyMode: false,
    isNewBest: false,
    feedback: null,
    paused: false,
    pauseResume: null,
    pendingTimer: null,
  };
}

export type RunAction =
  /** Home screen with a fresh idle meter (Go Back, Delete data). */
  | { type: 'idle'; round: RoundConfig }
  /** Start a run at level 1. */
  | { type: 'startRun'; daily: boolean }
  /** Swap in the next round's config. */
  | { type: 'beginRound'; round: RoundConfig }
  | { type: 'phase'; phase: Phase }
  | { type: 'countdown'; value: number }
  /** A tap (or a full meter) was judged. */
  | { type: 'scored'; result: RoundOutcome; feedback: Feedback }
  /** Mid-run cue when the run passes the best it started from. */
  | { type: 'announceNewBest' }
  /** Run finished and was committed; `isNewBest` is the persisted verdict. */
  | { type: 'gameOver'; isNewBest: boolean }
  | { type: 'clearFeedback' }
  | { type: 'pendingTimer'; pending: PendingTimer }
  /** Menu opened. `fillAt` is where the meter froze, for a mid-fill pause. */
  | { type: 'pause'; fillAt: number }
  /**
   * Park a resume from a timer that fired while the menu was already open.
   * Distinct from `pause`, which derives the resume from the current phase.
   */
  | { type: 'park'; resume: PauseResume }
  /** Menu closed. Read `pauseResume` *before* dispatching to know what to replay. */
  | { type: 'resume' };

/**
 * Decide what a pause should park for replay.
 *
 * Ordering matters: an in-flight fill or countdown wins over whatever timer is
 * pending, because those are what the player can see moving. Falls through to
 * the existing `pauseResume` so a second pause cannot clobber a parked resume.
 */
function pauseResumeFor(s: RunState, fillAt: number): PauseResume | null {
  if (s.phase === 'filling') return { kind: 'fill', fillAt };
  if (s.phase === 'countdown') {
    return { kind: 'countdown', countAt: s.countdown };
  }
  if (s.pendingTimer === 'startFill') return { kind: 'startFill' };
  if (s.pendingTimer === 'advance' || s.phase === 'result') {
    const fresh = s.pendingTimer === 'advance' || s.pauseResume == null;
    // A dead run has nothing to advance to — the results screen stays put.
    if (fresh && s.lives > 0 && s.phase === 'result') {
      return { kind: 'advance' };
    }
  }
  return s.pauseResume;
}

export function runReducer(s: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'idle':
      return initialRunState(action.round);

    case 'startRun':
      return {
        ...initialRunState(s.round),
        dailyMode: action.daily,
      };

    case 'beginRound':
      // Deliberately leaves `feedback` alone — the previous round's callout is
      // still fading out over the meter slide, and startFill clears it.
      return { ...s, round: action.round };

    case 'phase':
      return { ...s, phase: action.phase };

    case 'countdown':
      return { ...s, countdown: action.value };

    case 'scored': {
      const { result } = action;
      return {
        ...s,
        phase: 'result',
        combo: result.combo,
        // Points are 0 on a miss, so this is safe for both branches.
        score: s.score + result.points,
        lives: result.costsLife ? s.lives - 1 : s.lives,
        stats: tallyRound(s.stats, result),
        feedback: action.feedback,
      };
    }

    case 'announceNewBest':
      return s.isNewBest ? s : { ...s, isNewBest: true };

    case 'gameOver':
      return { ...s, phase: 'gameover', isNewBest: action.isNewBest };

    case 'clearFeedback':
      return s.feedback == null ? s : { ...s, feedback: null };

    case 'pendingTimer':
      return { ...s, pendingTimer: action.pending };

    case 'pause':
      return {
        ...s,
        paused: true,
        pauseResume: pauseResumeFor(s, action.fillAt),
        // Every timer is cleared on pause; the parked resume replaces them.
        pendingTimer: null,
      };

    case 'park':
      return { ...s, pauseResume: action.resume };

    case 'resume':
      return { ...s, paused: false, pauseResume: null };
  }
}
