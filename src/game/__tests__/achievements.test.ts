import { describe, expect, test } from 'bun:test';

import {
  ACHIEVEMENT_IDS,
  isAchievementId,
  nextDailyStreak,
  pendingAchievements,
  withAchievements,
} from '@/game/achievements';
import { comboMultiplier, MAX_COMBO_MULT } from '@/game/scoring';
import type { PersistState } from '@/game/types';

const fresh = {
  bestComboAllTime: 0,
  bestLevel: 0,
  dailyBest: { date: '', score: 0, level: 0 },
  dailyRecord: { date: '', score: 0, level: 0 },
  dailyRewardDay: '',
  dailyStreak: { day: '', count: 0 },
  totalPerfects: 0,
  totalRuns: 0,
  unlockedSkins: ['toxic'],
  earnedAchievements: [],
} as Parameters<typeof withAchievements>[0];

const earned = (
  state: Partial<typeof fresh> = {},
  moment?: Parameters<typeof withAchievements>[1],
) => withAchievements({ ...fresh, ...state }, moment).earnedAchievements;

describe('withAchievements', () => {
  test('a new player has earned nothing', () => {
    expect(earned()).toEqual([]);
  });

  test('returns the same state when nothing is new', () => {
    const state = { ...fresh, totalRuns: 10 };
    const once = withAchievements(state);
    expect(once).not.toBe(state);
    expect(withAchievements(once)).toBe(once);
  });

  test('crossing a threshold earns every tier up to it', () => {
    expect(earned({ totalRuns: 9 })).toEqual([]);
    expect(earned({ totalRuns: 100 })).toEqual([
      'meterzone.games.10',
      'meterzone.games.100',
    ]);
  });

  test('never takes an achievement back', () => {
    expect(earned({ earnedAchievements: ['meterzone.games.1000'] })).toEqual([
      'meterzone.games.1000',
    ]);
  });

  test('daily runs count towards level achievements', () => {
    expect(
      earned({ dailyBest: { date: '2026-11-01', score: 900, level: 10 } }),
    ).toContain('meterzone.level.10');
  });

  test('Full Power is the streak that reaches the multiplier cap', () => {
    expect(comboMultiplier(15)).toBeLessThan(MAX_COMBO_MULT);
    expect(comboMultiplier(16)).toBe(MAX_COMBO_MULT);
    expect(earned({ bestComboAllTime: 15 })).not.toContain(
      'meterzone.streak.16',
    );
    expect(earned({ bestComboAllTime: 16 })).toContain('meterzone.streak.16');
  });

  test('one-run achievements need the moment, and then stay', () => {
    expect(earned({}, { perfects: 9, cleanRounds: 19 })).toEqual([]);
    expect(earned({}, { perfects: 10, cleanRounds: 20 })).toEqual([
      'meterzone.perfect.run10',
      'meterzone.clean.20',
    ]);
  });

  test('only first place on a daily board earns Number One', () => {
    expect(earned({ dailyRewardDay: '2026-11-01' }, { dailyRank: 2 })).toEqual([
      'meterzone.daily.top10',
    ]);
    expect(earned({ dailyRewardDay: '2026-11-01' }, { dailyRank: 1 })).toEqual([
      'meterzone.daily.top10',
      'meterzone.daily.first_place',
    ]);
  });

  test('buying a skin counts, the free one does not', () => {
    expect(earned({ unlockedSkins: ['toxic', 'lava'] })).toEqual([
      'meterzone.skin.first',
    ]);
    expect(earned({ unlockedSkins: ['toxic', 'gold'] })).toContain(
      'meterzone.skin.gold',
    );
  });
});

describe('nextDailyStreak', () => {
  const start = { day: '', count: 0 };

  test('the first daily starts at one', () => {
    expect(nextDailyStreak(start, '2026-11-01')).toEqual({
      day: '2026-11-01',
      count: 1,
    });
  });

  test('the next UTC day extends it, across a month end', () => {
    expect(
      nextDailyStreak({ day: '2026-11-30', count: 3 }, '2026-12-01'),
    ).toEqual({ day: '2026-12-01', count: 4 });
  });

  test('a second run on the same day adds nothing', () => {
    const streak = { day: '2026-11-01', count: 3 };
    expect(nextDailyStreak(streak, '2026-11-01')).toBe(streak);
  });

  test('a run that started before the last finish adds nothing', () => {
    const streak = { day: '2026-11-02', count: 3 };
    expect(nextDailyStreak(streak, '2026-11-01')).toBe(streak);
  });

  test('a missed day starts over', () => {
    expect(
      nextDailyStreak({ day: '2026-11-01', count: 6 }, '2026-11-03'),
    ).toEqual({ day: '2026-11-03', count: 1 });
  });
});

test('pendingAchievements leaves out what Game Center already took', () => {
  const state: Pick<
    PersistState,
    'earnedAchievements' | 'reportedAchievements'
  > = {
    earnedAchievements: ['meterzone.games.10', 'meterzone.level.10'],
    reportedAchievements: ['meterzone.games.10'],
  };
  expect(pendingAchievements(state)).toEqual(['meterzone.level.10']);
});

test('ids are unique, and unknown ones are rejected', () => {
  expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
  expect(isAchievementId('meterzone.games.10')).toBe(true);
  expect(isAchievementId('meterzone.games.11')).toBe(false);
});
