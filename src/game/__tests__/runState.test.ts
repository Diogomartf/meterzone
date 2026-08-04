import { describe, expect, test } from 'bun:test';

import { makeRound } from '@/game/levels';
import { STARTING_LIVES, scoreFill } from '@/game/scoring';
import {
  feedbackSlotFor,
  INITIAL_COUNTDOWN,
  initialRunState,
  runReducer,
  type Feedback,
  type RunAction,
  type RunState,
} from '@/game/runState';
import type { RoundConfig, RoundOutcome } from '@/game/types';

/** Binary-exact fractions so band boundaries land where they read. */
function round(overrides: Partial<RoundConfig> = {}): RoundConfig {
  return {
    level: 2,
    target: 0.5,
    zoneHalf: 0.25,
    greatHalf: 0.125,
    perfectHalf: 0.0625,
    fillMs: 3000,
    moving: false,
    shrinking: false,
    meterScale: 1,
    ...overrides,
  };
}

const feedbackFor = (result: RoundOutcome): Feedback => ({
  label: result.label,
  points: result.points,
  combo: result.combo,
  comboGrew: result.combo > 0,
  slot: feedbackSlotFor(result.label),
});

/** Apply a sequence of actions, as the component would over a run. */
function run(state: RunState, ...actions: RunAction[]): RunState {
  return actions.reduce(runReducer, state);
}

/** Score a tap at `fill` against the state's current round. */
function tap(state: RunState, fill: number): RunState {
  const result = scoreFill(fill, state.round, state.combo);
  return runReducer(state, {
    type: 'scored',
    result,
    feedback: feedbackFor(result),
  });
}

const started = () =>
  run(initialRunState(round()), { type: 'startRun', daily: false });

describe('initialRunState', () => {
  test('starts idle on the home screen with a full run of lives', () => {
    const s = initialRunState(round());
    expect(s.phase).toBe('ready');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(STARTING_LIVES);
    expect(s.combo).toBe(0);
    expect(s.countdown).toBe(INITIAL_COUNTDOWN);
    expect(s.stats.attempts).toBe(0);
    expect(s.paused).toBe(false);
    expect(s.pauseResume).toBeNull();
    expect(s.pendingTimer).toBeNull();
  });
});

describe('startRun', () => {
  test('clears the previous run', () => {
    const dirty = run(
      initialRunState(round()),
      { type: 'phase', phase: 'filling' },
      { type: 'announceNewBest' },
    );
    const scored = tap(dirty, 0.5);
    const fresh = runReducer(scored, { type: 'startRun', daily: false });

    expect(fresh.score).toBe(0);
    expect(fresh.combo).toBe(0);
    expect(fresh.lives).toBe(STARTING_LIVES);
    expect(fresh.stats.attempts).toBe(0);
    expect(fresh.isNewBest).toBe(false);
    expect(fresh.feedback).toBeNull();
    expect(fresh.phase).toBe('ready');
  });

  test('records which mode is being played', () => {
    expect(
      runReducer(initialRunState(round()), { type: 'startRun', daily: true })
        .dailyMode,
    ).toBe(true);
    expect(
      runReducer(initialRunState(round()), { type: 'startRun', daily: false })
        .dailyMode,
    ).toBe(false);
  });
});

describe('scoring a round', () => {
  test('a hit adds points and keeps every heart', () => {
    const s = tap(started(), 0.5);
    expect(s.phase).toBe('result');
    expect(s.score).toBeGreaterThan(0);
    expect(s.lives).toBe(STARTING_LIVES);
    expect(s.stats.attempts).toBe(1);
    expect(s.stats.hits).toBe(1);
    expect(s.stats.perfects).toBe(1);
  });

  test('a miss costs a heart and scores nothing', () => {
    const s = tap(started(), 0.95);
    expect(s.phase).toBe('result');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(STARTING_LIVES - 1);
    expect(s.combo).toBe(0);
    expect(s.stats.misses).toBe(1);
    expect(s.stats.hits).toBe(0);
  });

  test('three misses empty the hearts', () => {
    let s = started();
    for (let i = 0; i < STARTING_LIVES; i++) s = tap(s, 0.95);
    expect(s.lives).toBe(0);
    expect(s.stats.misses).toBe(STARTING_LIVES);
  });

  test('a streak accumulates score and bestCombo', () => {
    let s = started();
    for (let i = 0; i < 5; i++) s = tap(s, 0.5);
    expect(s.combo).toBe(5);
    expect(s.stats.bestCombo).toBe(5);
    expect(s.stats.perfects).toBe(5);
    expect(s.score).toBeGreaterThan(0);
  });

  test('a miss resets the streak but not the best-combo record', () => {
    let s = started();
    for (let i = 0; i < 4; i++) s = tap(s, 0.5);
    s = tap(s, 0.95);
    expect(s.combo).toBe(0);
    expect(s.stats.bestCombo).toBe(4);
  });

  test('the feedback chip is carried into state for the callout', () => {
    const s = tap(started(), 0.5);
    expect(s.feedback?.label).toBe('Perfect');
    expect(runReducer(s, { type: 'clearFeedback' }).feedback).toBeNull();
  });
});

describe('new best', () => {
  test('announcing is idempotent — the cue fires once per run', () => {
    const once = runReducer(started(), { type: 'announceNewBest' });
    const twice = runReducer(once, { type: 'announceNewBest' });
    expect(once.isNewBest).toBe(true);
    expect(twice).toBe(once);
  });

  test('game over carries the committed verdict', () => {
    const s = runReducer(started(), { type: 'gameOver', isNewBest: true });
    expect(s.phase).toBe('gameover');
    expect(s.isNewBest).toBe(true);
  });
});

describe('pause parks the right thing to resume', () => {
  test('mid-fill parks the exact meter position', () => {
    const filling = run(started(), { type: 'phase', phase: 'filling' });
    const s = runReducer(filling, { type: 'pause', fillAt: 0.42 });
    expect(s.paused).toBe(true);
    expect(s.pauseResume).toEqual({ kind: 'fill', fillAt: 0.42 });
  });

  test('mid-countdown parks the number on screen', () => {
    const counting = run(
      started(),
      { type: 'phase', phase: 'countdown' },
      { type: 'countdown', value: 2 },
    );
    const s = runReducer(counting, { type: 'pause', fillAt: 0 });
    expect(s.pauseResume).toEqual({ kind: 'countdown', countAt: 2 });
  });

  test('a pending startFill parks the start rather than the meter', () => {
    const waiting = run(
      started(),
      { type: 'phase', phase: 'result' },
      { type: 'pendingTimer', pending: 'startFill' },
    );
    expect(
      runReducer(waiting, { type: 'pause', fillAt: 0 }).pauseResume,
    ).toEqual({ kind: 'startFill' });
  });

  test('a pending advance on the results beat parks the advance', () => {
    const resting = run(
      started(),
      { type: 'phase', phase: 'result' },
      { type: 'pendingTimer', pending: 'advance' },
    );
    expect(
      runReducer(resting, { type: 'pause', fillAt: 0 }).pauseResume,
    ).toEqual({ kind: 'advance' });
  });

  test('a dead run parks nothing — there is no next meter', () => {
    let s = started();
    for (let i = 0; i < STARTING_LIVES; i++) s = tap(s, 0.95);
    s = runReducer(s, { type: 'pendingTimer', pending: 'advance' });
    expect(s.lives).toBe(0);
    expect(runReducer(s, { type: 'pause', fillAt: 0 }).pauseResume).toBeNull();
  });

  test('pausing on the home screen parks nothing', () => {
    const s = runReducer(initialRunState(round()), {
      type: 'pause',
      fillAt: 0,
    });
    expect(s.paused).toBe(true);
    expect(s.pauseResume).toBeNull();
  });

  test('a pause always clears the pending timer it interrupted', () => {
    for (const pending of ['countdown', 'startFill', 'advance'] as const) {
      const s = run(
        started(),
        { type: 'phase', phase: 'filling' },
        { type: 'pendingTimer', pending },
        { type: 'pause', fillAt: 0.3 },
      );
      expect(s.pendingTimer).toBeNull();
    }
  });

  test('a second pause cannot clobber an already parked resume', () => {
    const parked = run(
      started(),
      { type: 'phase', phase: 'filling' },
      { type: 'pause', fillAt: 0.42 },
    );
    // Phase moves on while the sheet is open; pausing again must not lose the fill.
    const again = run(
      parked,
      { type: 'phase', phase: 'ready' },
      { type: 'pause', fillAt: 0 },
    );
    expect(again.pauseResume).toEqual({ kind: 'fill', fillAt: 0.42 });
  });
});

describe('resume', () => {
  test('clears the pause so the run can progress again', () => {
    const s = run(
      started(),
      { type: 'phase', phase: 'filling' },
      { type: 'pause', fillAt: 0.42 },
      { type: 'resume' },
    );
    expect(s.paused).toBe(false);
    expect(s.pauseResume).toBeNull();
  });

  test('round-trips without disturbing the run', () => {
    const mid = run(tap(started(), 0.5), { type: 'phase', phase: 'filling' });
    const after = run(mid, { type: 'pause', fillAt: 0.6 }, { type: 'resume' });
    expect(after.score).toBe(mid.score);
    expect(after.lives).toBe(mid.lives);
    expect(after.combo).toBe(mid.combo);
    expect(after.stats).toEqual(mid.stats);
    expect(after.round).toBe(mid.round);
  });
});

describe('leaving a run', () => {
  test('idle wipes the run, the pause and the pending timer', () => {
    const messy = run(
      tap(started(), 0.5),
      { type: 'phase', phase: 'filling' },
      { type: 'pendingTimer', pending: 'advance' },
      { type: 'pause', fillAt: 0.7 },
      { type: 'announceNewBest' },
    );
    const idle = runReducer(messy, { type: 'idle', round: round() });

    expect(idle.phase).toBe('ready');
    expect(idle.score).toBe(0);
    expect(idle.lives).toBe(STARTING_LIVES);
    expect(idle.combo).toBe(0);
    expect(idle.stats.attempts).toBe(0);
    expect(idle.isNewBest).toBe(false);
    expect(idle.feedback).toBeNull();
    expect(idle.paused).toBe(false);
    expect(idle.pauseResume).toBeNull();
    expect(idle.pendingTimer).toBeNull();
    expect(idle.dailyMode).toBe(false);
  });
});

describe('beginRound', () => {
  test('swaps the round and carries progress across levels', () => {
    const scored = tap(started(), 0.5);
    const next = makeRound(2);
    const s = runReducer(scored, { type: 'beginRound', round: next });
    expect(s.round).toBe(next);
    expect(s.score).toBe(scored.score);
    expect(s.combo).toBe(scored.combo);
  });

  test('leaves the callout to finish fading — startFill clears it', () => {
    const scored = tap(started(), 0.5);
    const s = runReducer(scored, { type: 'beginRound', round: makeRound(2) });
    expect(s.feedback).toBe(scored.feedback);
    expect(runReducer(s, { type: 'clearFeedback' }).feedback).toBeNull();
  });
});

describe('a whole run', () => {
  test('survives pauses at every phase and still ends consistently', () => {
    let s = run(initialRunState(round()), { type: 'startRun', daily: false });

    // Level 1: countdown, paused halfway through.
    s = run(
      s,
      { type: 'phase', phase: 'countdown' },
      { type: 'countdown', value: 2 },
      { type: 'pause', fillAt: 0 },
    );
    expect(s.pauseResume).toEqual({ kind: 'countdown', countAt: 2 });
    s = runReducer(s, { type: 'resume' });

    // Fill, paused mid-meter, then tapped for a Perfect.
    s = run(
      s,
      { type: 'phase', phase: 'filling' },
      { type: 'pause', fillAt: 0.3 },
      { type: 'resume' },
    );
    s = tap(s, 0.5);
    expect(s.stats.perfects).toBe(1);

    // Results beat, paused before the advance fires.
    s = run(
      s,
      { type: 'pendingTimer', pending: 'advance' },
      { type: 'pause', fillAt: 0 },
    );
    expect(s.pauseResume).toEqual({ kind: 'advance' });
    s = run(s, { type: 'resume' }, { type: 'beginRound', round: round() });

    // Burn the remaining hearts.
    for (let i = 0; i < STARTING_LIVES; i++) s = tap(s, 0.95);
    expect(s.lives).toBe(0);

    s = runReducer(s, { type: 'gameOver', isNewBest: false });
    expect(s.phase).toBe('gameover');
    expect(s.stats.attempts).toBe(1 + STARTING_LIVES);
    expect(s.stats.hits).toBe(1);
    expect(s.stats.misses).toBe(STARTING_LIVES);
  });
});
