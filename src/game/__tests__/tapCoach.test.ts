import { describe, expect, test } from 'bun:test';

import type { Phase } from '@/game/runState';
import {
  TAP_HINT_PLAYS,
  mergeLiveTapHintPlays,
  migrateTapHintPlays,
  nextTapHintPlays,
  rollbackLiveTapHintPlays,
  shouldShowTapHint,
  shouldShowTapHowTo,
} from '@/game/tapCoach';

function hint(
  overrides: Partial<{
    tapHintPlays: number;
    coachThisFill: boolean;
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
    coachThisFill: boolean;
    phase: Phase;
    paused: boolean;
  }> = {},
) {
  return shouldShowTapHowTo({
    tapHintPlays: 0,
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
});

describe('shouldShowTapHowTo', () => {
  test('shows under LVL during countdown while slots remain', () => {
    expect(howTo({ phase: 'countdown' })).toBe(true);
    expect(howTo({ tapHintPlays: 2, phase: 'countdown' })).toBe(true);
  });

  test('shows during filling only after the slot is persisted', () => {
    expect(howTo({ phase: 'filling' })).toBe(false);
    expect(howTo({ phase: 'filling', coachThisFill: true })).toBe(true);
  });

  test('hides on ready, result and game over', () => {
    expect(howTo({ phase: 'ready' })).toBe(false);
    expect(howTo({ phase: 'result' })).toBe(false);
    expect(howTo({ phase: 'gameover' })).toBe(false);
  });

  test('hides once the lifetime count is used up', () => {
    expect(howTo({ tapHintPlays: TAP_HINT_PLAYS, phase: 'countdown' })).toBe(
      false,
    );
  });

  test('the fill that consumed the last slot still shows how-to', () => {
    expect(howTo({ tapHintPlays: TAP_HINT_PLAYS, coachThisFill: true })).toBe(
      true,
    );
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
