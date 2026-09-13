import { describe, expect, test } from 'bun:test';

import { scoreFill } from '@/game/scoring';
import { makeRound } from '@/game/levels';
import {
  SKINS,
  SKIN_IDS,
  hexAlpha,
  liquidSurface,
  skinAction,
  unlockedSkinCount,
} from '@/game/skins';

/** Bank from `levels` consecutive Perfects on a fresh run. */
function coinsFromPerfectRun(levels: number): number {
  let coins = 0;
  let combo = 0;
  for (let level = 1; level <= levels; level++) {
    const round = {
      ...makeRound(level),
      target: 0.5,
      targetEnd: 0.5,
      moving: false,
    };
    const hit = scoreFill(round.target, round, combo);
    coins += hit.coins;
    combo = hit.combo;
  }
  return coins;
}

describe('skinAction', () => {
  test('the equipped unlocked skin is equipped', () => {
    expect(skinAction(SKINS.toxic, 'toxic', ['toxic'], 0)).toBe('equipped');
  });

  test('an owned look can be equipped', () => {
    expect(skinAction(SKINS.lava, 'toxic', ['toxic', 'lava'], 0)).toBe('equip');
  });

  test('enough coins unlocks a locked look', () => {
    expect(skinAction(SKINS.lava, 'toxic', ['toxic'], 120)).toBe('unlock');
    expect(skinAction(SKINS.gold, 'toxic', ['toxic'], SKINS.gold.cost)).toBe(
      'unlock',
    );
  });

  test('short coins stay locked', () => {
    expect(skinAction(SKINS.lava, 'toxic', ['toxic'], 119)).toBe('locked');
    expect(skinAction(SKINS.ice, 'toxic', ['toxic'], 0)).toBe('locked');
  });

  test('an equipped id that is not unlocked is treated as locked or unlockable', () => {
    // Save corruption / stale equip should not look "equipped".
    expect(skinAction(SKINS.lava, 'lava', ['toxic'], 0)).toBe('locked');
    expect(skinAction(SKINS.lava, 'lava', ['toxic'], 120)).toBe('unlock');
  });
});

describe('unlockedSkinCount', () => {
  test('counts known skins only', () => {
    expect(unlockedSkinCount(['toxic'])).toBe(1);
    expect(unlockedSkinCount(['toxic', 'lava', 'ice', 'gold'])).toBe(4);
    expect(unlockedSkinCount(['toxic', 'toxic', 'mystery' as never])).toBe(1);
  });
});

describe('hexAlpha', () => {
  test('expands six-digit hex and clamps alpha', () => {
    expect(hexAlpha('#FF0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    expect(hexAlpha('00A8FF', 0)).toBe('rgba(0,168,255,0)');
    expect(hexAlpha('#0F0', 2)).toBe('rgba(0,255,0,1)');
  });
});

describe('liquidSurface', () => {
  test('foam and glow follow the liquid stops', () => {
    const surface = liquidSurface(SKINS.ice);
    expect(surface.foam).toEqual([
      '#FFFFFF',
      SKINS.ice.liquid[0],
      SKINS.ice.liquid[1],
    ]);
    expect(surface.shadow).toBe(SKINS.ice.liquid[1]);
    expect(surface.glow[0]).toBe(hexAlpha(SKINS.ice.liquid[1], 0));
    expect(surface.glow[2]).toBe(hexAlpha(SKINS.ice.liquid[0], 0.5));
  });
});

describe('SKIN_IDS', () => {
  test('covers every defined skin once, cheapest extra first', () => {
    expect(SKIN_IDS).toEqual(['toxic', 'lava', 'ice', 'gold']);
    expect(new Set(SKIN_IDS).size).toBe(Object.keys(SKINS).length);
    expect(SKINS.toxic.cost).toBe(0);
    expect(SKINS.lava.cost).toBeLessThan(SKINS.ice.cost);
    expect(SKINS.ice.cost).toBeLessThan(SKINS.gold.cost);
  });

  test('Gold stays locked through a 100-level Perfect run', () => {
    const bank = coinsFromPerfectRun(100);
    expect(bank).toBeGreaterThan(0);
    expect(SKINS.gold.cost).toBeGreaterThan(bank);
    expect(skinAction(SKINS.gold, 'toxic', ['toxic'], bank)).toBe('locked');
  });
});
