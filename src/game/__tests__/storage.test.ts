import { beforeEach, describe, expect, test } from 'bun:test';

import { REVIEW_PROMPT_MAX } from '@/game/review';
import {
  clearPersist,
  commitRunResult,
  dailySeed,
  loadPersist,
  markReviewAccepted,
  recordReviewPromptDecline,
  savePersist,
  setHapticsEnabled,
  setSoundMuted,
  todayKey,
} from '@/game/storage';

import { readAsyncStorage, resetAsyncStorage, seedAsyncStorage } from './setup';

/** Must match the key in storage.ts. */
const KEY = 'zone-meter:persist-v1';

const seed = (value: unknown) => seedAsyncStorage(KEY, JSON.stringify(value));

beforeEach(() => {
  resetAsyncStorage();
});

describe('loadPersist defaults', () => {
  test('an empty install gets sane defaults', async () => {
    const s = await loadPersist();
    expect(s.highScore).toBe(0);
    expect(s.totalRuns).toBe(0);
    expect(s.hapticsEnabled).toBe(true);
    expect(s.soundMuted).toBe(false);
    expect(s.unlockedSkins).toEqual(['toxic']);
    expect(s.reviewPromptStatus).toBe('none');
    expect(s.reviewPromptsShown).toBe(0);
  });

  test('corrupt JSON falls back to defaults instead of throwing', async () => {
    seedAsyncStorage(KEY, '{ this is not json');
    const s = await loadPersist();
    expect(s.highScore).toBe(0);
    expect(s.unlockedSkins).toEqual(['toxic']);
  });

  test('defaults are not shared between loads', async () => {
    const a = await loadPersist();
    a.unlockedSkins.push('lava');
    const b = await loadPersist();
    expect(b.unlockedSkins).toEqual(['toxic']);
  });

  test('an empty unlockedSkins array is repaired', async () => {
    seed({ unlockedSkins: [] });
    expect((await loadPersist()).unlockedSkins).toEqual(['toxic']);
  });
});

describe('loadPersist review-prompt migration', () => {
  test("legacy 'declined' becomes one prompt shown", async () => {
    seed({ reviewPromptStatus: 'declined' });
    const s = await loadPersist();
    expect(s.reviewPromptsShown).toBe(1);
    expect(s.reviewPromptStatus).toBe('none');
  });

  test("legacy 'exhausted' maxes out the ladder", async () => {
    seed({ reviewPromptStatus: 'exhausted' });
    const s = await loadPersist();
    expect(s.reviewPromptsShown).toBe(REVIEW_PROMPT_MAX);
    expect(s.reviewPromptStatus).toBe('none');
  });

  test("legacy 'accepted' is preserved and maxes the ladder", async () => {
    seed({ reviewPromptStatus: 'accepted' });
    const s = await loadPersist();
    expect(s.reviewPromptStatus).toBe('accepted');
    expect(s.reviewPromptsShown).toBe(REVIEW_PROMPT_MAX);
  });

  test('an unknown status degrades to none', async () => {
    seed({ reviewPromptStatus: 'something-else' });
    expect((await loadPersist()).reviewPromptStatus).toBe('none');
  });

  test('an explicit count wins over the legacy status', async () => {
    seed({ reviewPromptStatus: 'exhausted', reviewPromptsShown: 1 });
    expect((await loadPersist()).reviewPromptsShown).toBe(1);
  });

  test('an out-of-range count is clamped', async () => {
    seed({ reviewPromptsShown: 99 });
    expect((await loadPersist()).reviewPromptsShown).toBe(REVIEW_PROMPT_MAX);
    seed({ reviewPromptsShown: -5 });
    expect((await loadPersist()).reviewPromptsShown).toBe(0);
  });
});

describe('loadPersist dailyRecord migration', () => {
  test('an older save with only dailyBest back-fills dailyRecord', async () => {
    seed({ dailyBest: { date: '2026-01-01', score: 900, level: 12 } });
    const s = await loadPersist();
    expect(s.dailyRecord).toEqual({
      date: '2026-01-01',
      score: 900,
      level: 12,
    });
  });

  test('an older save with no daily score leaves dailyRecord empty', async () => {
    seed({ dailyBest: { date: '', score: 0, level: 0 } });
    expect((await loadPersist()).dailyRecord).toEqual({
      date: '',
      score: 0,
      level: 0,
    });
  });

  test('a dailyBest better than the stored record is promoted', async () => {
    seed({
      dailyBest: { date: '2026-02-02', score: 5000, level: 40 },
      dailyRecord: { date: '2026-01-01', score: 900, level: 12 },
    });
    expect((await loadPersist()).dailyRecord.score).toBe(5000);
  });

  test('a standing record beats a weaker dailyBest', async () => {
    seed({
      dailyBest: { date: '2026-02-02', score: 100, level: 3 },
      dailyRecord: { date: '2026-01-01', score: 900, level: 12 },
    });
    expect((await loadPersist()).dailyRecord.score).toBe(900);
  });

  test('an equal score is broken by level', async () => {
    seed({
      dailyBest: { date: '2026-02-02', score: 900, level: 20 },
      dailyRecord: { date: '2026-01-01', score: 900, level: 12 },
    });
    const record = (await loadPersist()).dailyRecord;
    expect(record.level).toBe(20);
    expect(record.date).toBe('2026-02-02');
  });

  test('malformed daily fields coerce to zero rather than NaN', async () => {
    seed({ dailyBest: { date: '2026-01-01', score: 'oops', level: null } });
    const s = await loadPersist();
    expect(s.dailyBest.score).toBe(0);
    expect(s.dailyBest.level).toBe(0);
  });
});

describe('commitRunResult', () => {
  test('a normal run raises highScore and bestLevel', async () => {
    const s = await commitRunResult({
      score: 1200,
      coinsEarned: 10,
      bestCombo: 6,
      bestLevel: 14,
      isDaily: false,
    });
    expect(s.highScore).toBe(1200);
    expect(s.bestLevel).toBe(14);
    expect(s.bestComboAllTime).toBe(6);
    expect(s.coins).toBe(10);
    expect(s.totalRuns).toBe(1);
  });

  test('a weaker run never lowers a standing best', async () => {
    await commitRunResult({
      score: 1200,
      coinsEarned: 0,
      bestCombo: 6,
      bestLevel: 14,
      isDaily: false,
    });
    const s = await commitRunResult({
      score: 30,
      coinsEarned: 0,
      bestCombo: 1,
      bestLevel: 2,
      isDaily: false,
    });
    expect(s.highScore).toBe(1200);
    expect(s.bestLevel).toBe(14);
    expect(s.bestComboAllTime).toBe(6);
    expect(s.totalRuns).toBe(2);
  });

  test('daily and normal bests are tracked separately', async () => {
    const s = await commitRunResult({
      score: 4000,
      coinsEarned: 0,
      bestCombo: 3,
      bestLevel: 30,
      isDaily: true,
    });
    expect(s.highScore).toBe(0);
    expect(s.bestLevel).toBe(0);
    expect(s.dailyBest.score).toBe(4000);
    expect(s.dailyBest.date).toBe(todayKey());
    expect(s.dailyRecord.score).toBe(4000);
  });

  test('a stale daily best is replaced rather than maxed', async () => {
    seed({ dailyBest: { date: '2020-01-01', score: 9999, level: 80 } });
    const s = await commitRunResult({
      score: 10,
      coinsEarned: 0,
      bestCombo: 0,
      bestLevel: 1,
      isDaily: true,
    });
    // Yesterday's 9999 must not carry into today's board...
    expect(s.dailyBest.score).toBe(10);
    expect(s.dailyBest.date).toBe(todayKey());
    // ...but it is still the all-time daily record.
    expect(s.dailyRecord.score).toBe(9999);
  });

  test('same-day daily runs keep the best of the day', async () => {
    await commitRunResult({
      score: 500,
      coinsEarned: 0,
      bestCombo: 0,
      bestLevel: 5,
      isDaily: true,
    });
    const s = await commitRunResult({
      score: 200,
      coinsEarned: 0,
      bestCombo: 0,
      bestLevel: 2,
      isDaily: true,
    });
    expect(s.dailyBest.score).toBe(500);
    expect(s.dailyBest.level).toBe(5);
  });

  test('coins and totalRuns accumulate across runs', async () => {
    for (let i = 0; i < 5; i++) {
      await commitRunResult({
        score: 1,
        coinsEarned: 3,
        bestCombo: 0,
        bestLevel: 1,
        isDaily: false,
      });
    }
    const s = await loadPersist();
    expect(s.coins).toBe(15);
    expect(s.totalRuns).toBe(5);
  });

  test('the result is persisted, not just returned', async () => {
    await commitRunResult({
      score: 777,
      coinsEarned: 0,
      bestCombo: 0,
      bestLevel: 9,
      isDaily: false,
    });
    expect((await loadPersist()).highScore).toBe(777);
    expect(readAsyncStorage(KEY)).toContain('777');
  });
});

describe('review persistence', () => {
  test('markReviewAccepted is sticky', async () => {
    await markReviewAccepted();
    expect((await loadPersist()).reviewPromptStatus).toBe('accepted');
    await recordReviewPromptDecline();
    expect((await loadPersist()).reviewPromptStatus).toBe('accepted');
  });

  test('a decline advances the ladder and records the run count', async () => {
    await commitRunResult({
      score: 1,
      coinsEarned: 0,
      bestCombo: 0,
      bestLevel: 1,
      isDaily: false,
    });
    const s = await recordReviewPromptDecline();
    expect(s.reviewPromptsShown).toBe(1);
    expect(s.reviewLastPromptAtRuns).toBe(1);
  });

  test('declines never exceed the cap', async () => {
    for (let i = 0; i < 10; i++) await recordReviewPromptDecline();
    expect((await loadPersist()).reviewPromptsShown).toBe(REVIEW_PROMPT_MAX);
  });
});

describe('settings toggles', () => {
  test('sound and haptics round-trip through storage', async () => {
    expect((await setSoundMuted(true)).soundMuted).toBe(true);
    expect((await loadPersist()).soundMuted).toBe(true);
    expect((await setHapticsEnabled(false)).hapticsEnabled).toBe(false);
    expect((await loadPersist()).hapticsEnabled).toBe(false);
  });

  test('toggling one setting preserves the other', async () => {
    await setSoundMuted(true);
    await setHapticsEnabled(false);
    const s = await loadPersist();
    expect(s.soundMuted).toBe(true);
    expect(s.hapticsEnabled).toBe(false);
  });
});

describe('clearPersist', () => {
  test('wipes progress and returns fresh defaults', async () => {
    await commitRunResult({
      score: 5000,
      coinsEarned: 50,
      bestCombo: 9,
      bestLevel: 40,
      isDaily: false,
    });
    const cleared = await clearPersist();
    expect(cleared.highScore).toBe(0);
    expect(cleared.coins).toBe(0);
    expect(cleared.totalRuns).toBe(0);
    expect(readAsyncStorage(KEY)).toBeUndefined();
    expect((await loadPersist()).highScore).toBe(0);
  });
});

describe('savePersist round-trip', () => {
  test('a saved state loads back unchanged', async () => {
    const original = await loadPersist();
    const edited = { ...original, highScore: 4242, bestLevel: 33 };
    await savePersist(edited);
    const reloaded = await loadPersist();
    expect(reloaded.highScore).toBe(4242);
    expect(reloaded.bestLevel).toBe(33);
  });
});

describe('todayKey and dailySeed', () => {
  test('todayKey is an ISO calendar date', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('dailySeed is stable within a day and a valid uint32', () => {
    const a = dailySeed();
    const b = dailySeed();
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
  });
});
