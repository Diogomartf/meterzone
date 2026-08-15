import { describe, expect, test } from 'bun:test';

import type { Phase } from '@/game/runState';
import {
  TAP_HINT_PLAYS,
  migrateTapHintPlays,
  nextTapHintPlays,
  shouldShowTapHint,
  shouldShowTapHowTo,
} from '@/game/tapCoach';

function hint(
  overrides: Partial<{
    tapHintPlays: number;
    attemptsThisRun: number;
    phase: Phase;
    paused: boolean;
  }> = {},
) {
  return shouldShowTapHint({
    tapHintPlays: 0,
    attemptsThisRun: 0,
    phase: 'filling',
    paused: false,
    ...overrides,
  });
}

function howTo(
  overrides: Partial<{
    tapHintPlays: number;
    attemptsThisRun: number;
    phase: Phase;
    paused: boolean;
  }> = {},
) {
  return shouldShowTapHowTo({
    tapHintPlays: 0,
    attemptsThisRun: 0,
    phase: 'filling',
    paused: false,
    ...overrides,
  });
}

describe('shouldShowTapHint', () => {
  test('shows while the first fill is running', () => {
    expect(hint()).toBe(true);
  });

  test('shows for the first three fills of a new player', () => {
    expect(hint({ attemptsThisRun: 0 })).toBe(true);
    expect(hint({ attemptsThisRun: 1 })).toBe(true);
    expect(hint({ attemptsThisRun: 2 })).toBe(true);
    expect(hint({ attemptsThisRun: 3 })).toBe(false);
  });

  test('counts lifetime plays plus this run together', () => {
    expect(hint({ tapHintPlays: 2, attemptsThisRun: 0 })).toBe(true);
    expect(hint({ tapHintPlays: 2, attemptsThisRun: 1 })).toBe(false);
    expect(hint({ tapHintPlays: TAP_HINT_PLAYS, attemptsThisRun: 0 })).toBe(
      false,
    );
  });

  test('hides when the meter is not filling', () => {
    for (const phase of ['ready', 'countdown', 'result', 'gameover'] as const) {
      expect(hint({ phase })).toBe(false);
    }
  });

  test('hides while the menu is open', () => {
    expect(hint({ paused: true })).toBe(false);
  });
});

describe('shouldShowTapHowTo', () => {
  test('shows under LVL during countdown and filling', () => {
    expect(howTo({ phase: 'countdown' })).toBe(true);
    expect(howTo({ phase: 'filling' })).toBe(true);
  });

  test('hides on ready, result and game over', () => {
    expect(howTo({ phase: 'ready' })).toBe(false);
    expect(howTo({ phase: 'result' })).toBe(false);
    expect(howTo({ phase: 'gameover' })).toBe(false);
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
