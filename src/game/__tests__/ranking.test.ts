import { describe, expect, test } from 'bun:test';

import { avatarFor } from '@/game/avatars';
import {
  dailyRewardCoins,
  formatClock,
  msUntilDailyReset,
  pointsToPass,
  type RankEntry,
} from '@/game/ranking';

function entry(rank: number, score: number, isYou = false): RankEntry {
  return { rank, name: `P${rank}`, score, isYou };
}

describe('pointsToPass', () => {
  test('needs one more than the gap to overtake', () => {
    expect(pointsToPass(entry(3, 751, true), entry(2, 799))).toBe(49);
  });

  test('a tie still needs one point', () => {
    expect(pointsToPass(entry(3, 800, true), entry(2, 800))).toBe(1);
  });

  test('nothing to chase at #1 or off the board', () => {
    expect(pointsToPass(entry(1, 900, true), null)).toBeNull();
    expect(pointsToPass(null, entry(5, 100))).toBeNull();
  });
});

describe('avatarFor', () => {
  test('is stable for a name', () => {
    expect(avatarFor('Diogo')).toEqual(avatarFor('Diogo'));
  });

  test('handles an empty name', () => {
    expect(avatarFor('').emoji.length).toBeGreaterThan(0);
  });
});

describe('msUntilDailyReset', () => {
  test('counts down to the next 00:00 UTC', () => {
    const now = new Date(Date.UTC(2026, 9, 27, 18, 30));
    expect(msUntilDailyReset(now)).toBe(5.5 * 60 * 60 * 1000);
  });

  test('a fresh day is a full day away', () => {
    const now = new Date(Date.UTC(2026, 9, 27, 0, 0));
    expect(msUntilDailyReset(now)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('formatClock', () => {
  test('pads hours, minutes and seconds', () => {
    expect(formatClock((3 * 3600 + 31 * 60 + 12) * 1000)).toBe('03:31:12');
  });

  test('never goes negative', () => {
    expect(formatClock(-500)).toBe('00:00:00');
  });
});

describe('dailyRewardCoins', () => {
  test('pays the podium most, then a flat amount to #10', () => {
    expect([1, 2, 3, 4, 10].map(dailyRewardCoins)).toEqual([
      500, 300, 200, 100, 100,
    ]);
  });

  test('pays nothing outside the top ten', () => {
    expect([0, 11, 250, -1, 1.5].map(dailyRewardCoins)).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });
});
