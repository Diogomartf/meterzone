import { describe, expect, test } from 'bun:test';

import {
  comboMultiplier,
  MAX_COMBO_MULT,
  nextCombo,
  scoreFill,
  STARTING_LIVES,
} from '@/game/scoring';
import type { RoundConfig } from '@/game/types';

/**
 * Static round using binary-exact fractions. Decimal halves like 0.05 make
 * `0.5 + greatHalf` land a float epsilon outside the band, which would test
 * IEEE-754 rather than the scoring rules.
 */
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

describe('comboMultiplier', () => {
  test('starts at 1 and grows 0.25 per step', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1.25);
    expect(comboMultiplier(4)).toBe(2);
  });

  test('clamps at MAX_COMBO_MULT', () => {
    expect(comboMultiplier(16)).toBe(MAX_COMBO_MULT);
    expect(comboMultiplier(1000)).toBe(MAX_COMBO_MULT);
  });

  test('treats negative streaks as zero', () => {
    expect(comboMultiplier(-5)).toBe(1);
  });
});

describe('nextCombo', () => {
  test('Perfect and Great extend the streak', () => {
    expect(nextCombo(3, 'Perfect')).toBe(4);
    expect(nextCombo(3, 'Great')).toBe(4);
  });

  test('Nice and Close decay the streak without going negative', () => {
    expect(nextCombo(3, 'Nice')).toBe(2);
    expect(nextCombo(3, 'Close')).toBe(2);
    expect(nextCombo(0, 'Nice')).toBe(0);
  });

  test('Miss resets the streak', () => {
    expect(nextCombo(9, 'Miss')).toBe(0);
  });
});

describe('scoreFill band boundaries', () => {
  const r = round();

  test('dead center is Perfect', () => {
    expect(scoreFill(0.5, r, 0).label).toBe('Perfect');
  });

  test('exactly at perfectHalf is still Perfect (inclusive)', () => {
    expect(scoreFill(0.5 + r.perfectHalf, r, 0).label).toBe('Perfect');
    expect(scoreFill(0.5 - r.perfectHalf, r, 0).label).toBe('Perfect');
  });

  test('just past perfectHalf is Great', () => {
    expect(scoreFill(0.5 + r.perfectHalf + 1e-6, r, 0).label).toBe('Great');
  });

  test('exactly at greatHalf is still Great (inclusive)', () => {
    expect(scoreFill(0.5 + r.greatHalf, r, 0).label).toBe('Great');
  });

  test('just past greatHalf is Nice', () => {
    expect(scoreFill(0.5 + r.greatHalf + 1e-6, r, 0).label).toBe('Nice');
  });

  test('exactly at the rim is still Nice (inclusive)', () => {
    expect(scoreFill(0.5 + r.zoneHalf, r, 0).label).toBe('Nice');
  });

  test('outside the rim is a Miss that costs a life', () => {
    const out = scoreFill(0.5 + r.zoneHalf + 1e-6, r, 0);
    expect(out.label).toBe('Miss');
    expect(out.result).toBe('miss');
    expect(out.costsLife).toBe(true);
    expect(out.points).toBe(0);
    expect(out.combo).toBe(0);
  });

  test('only a Miss costs a life', () => {
    for (const fill of [0.5, 0.53, 0.58]) {
      expect(scoreFill(fill, r, 0).costsLife).toBe(false);
    }
  });
});

describe('scoreFill combo handling', () => {
  test('level 1 suppresses combo entirely — it teaches the tap', () => {
    const lvl1 = round({ level: 1 });
    const out = scoreFill(0.5, lvl1, 7);
    expect(out.label).toBe('Perfect');
    expect(out.combo).toBe(0);
    expect(out.multiplier).toBe(1);
  });

  test('level 2+ applies the incoming streak as a multiplier', () => {
    const plain = scoreFill(0.5, round(), 0);
    const streaked = scoreFill(0.5, round(), 4);
    expect(streaked.multiplier).toBe(2);
    expect(streaked.points).toBe(plain.basePoints * 2);
    expect(streaked.combo).toBe(5);
  });

  test('a Nice decays the streak rather than resetting it', () => {
    const r = round();
    expect(scoreFill(0.5 + r.greatHalf + 1e-6, r, 4).combo).toBe(3);
  });
});

describe('scoreFill scaling', () => {
  test('deeper levels award more base points for the same accuracy', () => {
    const shallow = scoreFill(0.5, round({ level: 2 }), 0);
    const deep = scoreFill(0.5, round({ level: 50 }), 0);
    expect(deep.basePoints).toBeGreaterThan(shallow.basePoints);
  });

  test('closer taps score higher within the Great band', () => {
    const r = round();
    const near = scoreFill(0.5 + r.perfectHalf + 0.001, r, 0);
    const far = scoreFill(0.5 + r.greatHalf - 0.001, r, 0);
    expect(near.label).toBe('Great');
    expect(far.label).toBe('Great');
    expect(near.basePoints).toBeGreaterThan(far.basePoints);
  });

  test('better outcomes pay more coins', () => {
    const r = round();
    const perfect = scoreFill(0.5, r, 0);
    const great = scoreFill(0.5 + r.greatHalf, r, 0);
    const nice = scoreFill(0.5 + r.zoneHalf, r, 0);
    expect(perfect.coins).toBeGreaterThan(great.coins);
    expect(great.coins).toBeGreaterThan(nice.coins);
    expect(scoreFill(0.9, r, 0).coins).toBe(0);
  });

  test('reports the distance from the zone center', () => {
    expect(scoreFill(0.62, round(), 0).distance).toBeCloseTo(0.12, 10);
  });
});

describe('scoreFill against a moving zone', () => {
  test('judges the zone where it is at the moment of the tap', () => {
    const moving = round({ moving: true, target: 0.2, targetEnd: 0.8 });
    // At t=1 the zone has travelled to 0.8, so a tap at 0.8 is a bullseye
    // even though it is nowhere near the starting target of 0.2.
    expect(scoreFill(1, moving, 0).distance).toBeGreaterThan(0);
    const half = round({ moving: true, target: 0, targetEnd: 1 });
    expect(scoreFill(0.5, half, 0).label).toBe('Perfect');
  });
});

test('STARTING_LIVES is 3', () => {
  expect(STARTING_LIVES).toBe(3);
});
