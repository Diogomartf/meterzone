import { describe, expect, test } from 'bun:test';

import type { Phase } from '@/game/runState';
import {
  TAP_HINT_GAMES,
  TAP_HINT_LEAD_MS,
  TAP_HINT_PLAYS,
  TAP_HOW_TO_PLAYS,
  mergeLiveTapHintPlays,
  migrateTapHintPlays,
  nextTapHintPlays,
  rollbackLiveTapHintPlays,
  shouldShowTapHint,
  shouldShowTapHowTo,
  tapHintAppearDelay,
} from '@/game/tapCoach';

function hint(
  overrides: Partial<{
    tapHintPlays: number;
    coachThisFill: boolean;
    hintThisRun: boolean;
    totalRuns: number;
    phase: Phase;
    paused: boolean;
  }> = {},
) {
  return shouldShowTapHint({
    tapHintPlays: 0,
    phase: 'filling',
    paused: false,
    ...overrides,
  });
}

function howTo(
  overrides: Partial<{
    tapHintPlays: number;
    totalRuns: number;
    howToThisRun: boolean;
    phase: Phase;
    paused: boolean;
  }> = {},
) {
  return shouldShowTapHowTo({
    tapHintPlays: 0,
    totalRuns: 0,
    phase: 'filling',
    paused: false,
    ...overrides,
  });
}

describe('shouldShowTapHint', () => {
  test('stays hidden until this fill’s slot has been persisted', () => {
    expect(hint()).toBe(false);
    expect(hint({ tapHintPlays: 0 })).toBe(false);
    expect(hint({ tapHintPlays: 2 })).toBe(false);
  });

  test('shows only after the persisted latch is set', () => {
    expect(hint({ coachThisFill: true })).toBe(true);
    expect(hint({ tapHintPlays: TAP_HINT_PLAYS, coachThisFill: true })).toBe(
      true,
    );
  });

  test('hides when the meter is not filling', () => {
    for (const phase of ['ready', 'countdown', 'result', 'gameover'] as const) {
      expect(hint({ phase, coachThisFill: true })).toBe(false);
    }
  });

  test('hides while the menu is open', () => {
    expect(hint({ paused: true, coachThisFill: true })).toBe(false);
  });

  test('shows during the first TAP_HINT_GAMES games', () => {
    expect(hint({ coachThisFill: true, totalRuns: 0 })).toBe(true);
    expect(hint({ coachThisFill: true, totalRuns: TAP_HINT_GAMES - 1 })).toBe(
      true,
    );
    expect(hint({ coachThisFill: true, totalRuns: TAP_HINT_GAMES })).toBe(
      false,
    );
  });

  test('stays eligible across a run latched as a new-user game', () => {
    expect(
      hint({
        coachThisFill: true,
        hintThisRun: true,
        totalRuns: TAP_HINT_GAMES,
      }),
    ).toBe(true);
  });
});

describe('shouldShowTapHowTo', () => {
  test('shows during the first TAP_HOW_TO_PLAYS games', () => {
    expect(howTo({ phase: 'countdown', totalRuns: 0 })).toBe(true);
    expect(howTo({ phase: 'filling', totalRuns: 9 })).toBe(true);
    expect(howTo({ phase: 'result', totalRuns: 9 })).toBe(true);
  });

  test('stays eligible across levels when this run was latched', () => {
    expect(
      howTo({
        totalRuns: TAP_HOW_TO_PLAYS,
        howToThisRun: true,
        phase: 'result',
      }),
    ).toBe(true);
  });

  test('hides on ready and game over', () => {
    expect(howTo({ phase: 'ready' })).toBe(false);
    expect(howTo({ phase: 'gameover', howToThisRun: true })).toBe(false);
  });

  test('hides after 10 finished games', () => {
    expect(
      howTo({ totalRuns: TAP_HOW_TO_PLAYS, phase: 'countdown' }),
    ).toBe(false);
  });
});

describe('nextTapHintPlays', () => {
  test('adds this run and caps at TAP_HINT_PLAYS', () => {
    expect(nextTapHintPlays(0, 1)).toBe(1);
    expect(nextTapHintPlays(0, 5)).toBe(TAP_HINT_PLAYS);
    expect(nextTapHintPlays(2, 2)).toBe(TAP_HINT_PLAYS);
    expect(nextTapHintPlays(TAP_HINT_PLAYS, 9)).toBe(TAP_HINT_PLAYS);
  });

  test('ignores negative or non-finite values', () => {
    expect(nextTapHintPlays(-4, 2)).toBe(2);
    expect(nextTapHintPlays(1, -8)).toBe(1);
    expect(nextTapHintPlays(Number.NaN, 2)).toBe(2);
  });
});

describe('mergeLiveTapHintPlays', () => {
  test('keeps the higher of live and incoming', () => {
    expect(mergeLiveTapHintPlays(1, 2)).toBe(2);
    expect(mergeLiveTapHintPlays(2, 1)).toBe(2);
    expect(mergeLiveTapHintPlays(0, 1)).toBe(1);
  });
});

describe('rollbackLiveTapHintPlays', () => {
  test('rolls back this fill when live still matches the optimistic count', () => {
    expect(rollbackLiveTapHintPlays(1, 1, 0)).toBe(0);
    expect(rollbackLiveTapHintPlays(2, 2, 1)).toBe(1);
  });

  test('does not lower a newer fill’s optimistic count', () => {
    expect(rollbackLiveTapHintPlays(2, 1, 0)).toBe(2);
    expect(rollbackLiveTapHintPlays(3, 2, 0)).toBe(3);
  });
});

describe('migrateTapHintPlays', () => {
  test('a fresh install starts at zero', () => {
    expect(migrateTapHintPlays({})).toBe(0);
  });

  test('veterans from before the coach skip it', () => {
    expect(migrateTapHintPlays({ totalRuns: 4 })).toBe(TAP_HINT_PLAYS);
    expect(migrateTapHintPlays({ highScore: 1200 })).toBe(TAP_HINT_PLAYS);
  });

  test('an explicit count always wins', () => {
    expect(
      migrateTapHintPlays({ tapHintPlays: 1, totalRuns: 9, highScore: 500 }),
    ).toBe(1);
    expect(migrateTapHintPlays({ tapHintPlays: 0, totalRuns: 9 })).toBe(0);
  });
});

describe('tapHintAppearDelay', () => {
  test('lands TAP_HINT_LEAD_MS before the fill reaches the zone', () => {
    expect(tapHintAppearDelay(3000, 0.8)).toBe(2400 - TAP_HINT_LEAD_MS);
    expect(tapHintAppearDelay(3100, 0.6)).toBe(1860 - TAP_HINT_LEAD_MS);
  });

  test('starts immediately when the zone is closer than the lead', () => {
    expect(tapHintAppearDelay(800, 0.4)).toBe(0);
    expect(tapHintAppearDelay(900, 0.5)).toBe(0);
  });
});
