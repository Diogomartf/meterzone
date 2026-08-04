import { describe, expect, test } from 'bun:test';

import {
  REVIEW_MIN_RUNS_BETWEEN_PROMPTS,
  REVIEW_PROMPT_MAX,
  REVIEW_PROMPT_MILESTONES,
  shouldShowReviewPrompt,
} from '@/game/review';
import type { PersistState } from '@/game/types';

type ReviewState = Pick<
  PersistState,
  | 'totalRuns'
  | 'reviewPromptStatus'
  | 'reviewPromptsShown'
  | 'reviewLastPromptAtRuns'
>;

function state(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    totalRuns: 0,
    reviewPromptStatus: 'none',
    reviewPromptsShown: 0,
    reviewLastPromptAtRuns: 0,
    ...overrides,
  };
}

const HIGH = { isNewHighScore: true };
const NO_HIGH = { isNewHighScore: false };

describe('shouldShowReviewPrompt gating', () => {
  test('never asks without a new high score — we only ask in a good mood', () => {
    expect(shouldShowReviewPrompt(state({ totalRuns: 10_000 }), NO_HIGH)).toBe(
      false,
    );
  });

  test('never asks again once accepted', () => {
    expect(
      shouldShowReviewPrompt(
        state({ totalRuns: 10_000, reviewPromptStatus: 'accepted' }),
        HIGH,
      ),
    ).toBe(false);
  });

  test('stops permanently at REVIEW_PROMPT_MAX', () => {
    expect(
      shouldShowReviewPrompt(
        state({ totalRuns: 10_000, reviewPromptsShown: REVIEW_PROMPT_MAX }),
        HIGH,
      ),
    ).toBe(false);
  });

  test('a shown count above the cap is still treated as exhausted', () => {
    expect(
      shouldShowReviewPrompt(
        state({ totalRuns: 10_000, reviewPromptsShown: 99 }),
        HIGH,
      ),
    ).toBe(false);
  });
});

describe('shouldShowReviewPrompt milestones', () => {
  test('each rung requires its run milestone', () => {
    REVIEW_PROMPT_MILESTONES.forEach((milestone, shown) => {
      expect(
        shouldShowReviewPrompt(
          state({ totalRuns: milestone - 1, reviewPromptsShown: shown }),
          HIGH,
        ),
      ).toBe(false);
      expect(
        shouldShowReviewPrompt(
          state({ totalRuns: milestone, reviewPromptsShown: shown }),
          HIGH,
        ),
      ).toBe(true);
    });
  });

  test('milestones increase, so each ask is further apart', () => {
    const rungs = [...REVIEW_PROMPT_MILESTONES];
    const sorted = [...rungs].sort((a, b) => a - b);
    expect(rungs).toEqual(sorted);
    expect(new Set(rungs).size).toBe(rungs.length);
  });

  test('REVIEW_PROMPT_MAX matches the ladder length', () => {
    expect(REVIEW_PROMPT_MAX).toBe(REVIEW_PROMPT_MILESTONES.length);
  });
});

describe('shouldShowReviewPrompt cooldown after a decline', () => {
  const secondRung = REVIEW_PROMPT_MILESTONES[1];

  test('holds off until the inter-prompt gap has passed', () => {
    const lastAt = secondRung - 10;
    expect(
      shouldShowReviewPrompt(
        state({
          totalRuns: lastAt + REVIEW_MIN_RUNS_BETWEEN_PROMPTS - 1,
          reviewPromptsShown: 1,
          reviewLastPromptAtRuns: lastAt,
        }),
        HIGH,
      ),
    ).toBe(false);
  });

  test('asks once the gap is satisfied', () => {
    const lastAt = secondRung - 10;
    expect(
      shouldShowReviewPrompt(
        state({
          totalRuns: lastAt + REVIEW_MIN_RUNS_BETWEEN_PROMPTS,
          reviewPromptsShown: 1,
          reviewLastPromptAtRuns: lastAt,
        }),
        HIGH,
      ),
    ).toBe(true);
  });

  test('a never-prompted install is not held back by the cooldown', () => {
    expect(
      shouldShowReviewPrompt(
        state({
          totalRuns: REVIEW_PROMPT_MILESTONES[0],
          reviewLastPromptAtRuns: 0,
        }),
        HIGH,
      ),
    ).toBe(true);
  });
});

describe('shouldShowReviewPrompt over an install lifetime', () => {
  test('asks at most REVIEW_PROMPT_MAX times across 5000 runs', () => {
    let s = state();
    let asks = 0;
    for (let run = 1; run <= 5000; run++) {
      s = { ...s, totalRuns: run };
      // Worst case for fatigue: every single run sets a new high score.
      if (shouldShowReviewPrompt(s, HIGH)) {
        asks++;
        // Player taps "Not now".
        s = {
          ...s,
          reviewPromptsShown: s.reviewPromptsShown + 1,
          reviewLastPromptAtRuns: run,
        };
      }
    }
    expect(asks).toBe(REVIEW_PROMPT_MAX);
  });

  test('accepting on the first ask means no further asks', () => {
    let s = state();
    let asks = 0;
    for (let run = 1; run <= 5000; run++) {
      s = { ...s, totalRuns: run };
      if (shouldShowReviewPrompt(s, HIGH)) {
        asks++;
        s = { ...s, reviewPromptStatus: 'accepted' };
      }
    }
    expect(asks).toBe(1);
  });
});
