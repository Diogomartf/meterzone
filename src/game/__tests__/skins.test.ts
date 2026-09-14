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

/** Hard ceiling on the search below — far past anything a person plays. */
const MAX_SEARCHED_LEVEL = 5000;

/**
 * Consecutive Perfects, from level 1, that a single run needs to afford `cost`.
 *
 * This is the unit the pricing is really denominated in. The game has no
 * terminal level and Perfect pays `5 + floor(combo / 2)`, so a flawless run
 * banks coins without bound — no price can put a look beyond one run in
 * principle. What a price does fix is the depth of flawless play it demands,
 * and that is what these tests pin down.
 */
function perfectLevelsToAfford(cost: number): number {
  let coins = 0;
  let combo = 0;
  for (let level = 1; level <= MAX_SEARCHED_LEVEL; level++) {
    const round = {
      ...makeRound(level),
      target: 0.5,
      targetEnd: 0.5,
      moving: false,
    };
    const hit = scoreFill(round.target, round, combo);
    coins += hit.coins;
    combo = hit.combo;
    if (coins >= cost) return level;
  }
  throw new Error(
    `cost ${cost} not reachable within ${MAX_SEARCHED_LEVEL} perfect levels`,
  );
}

describe('skinAction', () => {
  test('the equipped unlocked skin is equipped', () => {
    expect(skinAction(SKINS.toxic, 'toxic', ['toxic'], 0)).toBe('equipped');
  });

  test('an owned look can be equipped', () => {
    expect(skinAction(SKINS.lava, 'toxic', ['toxic', 'lava'], 0)).toBe('equip');
  });

  test('enough coins unlocks a locked look', () => {
    expect(skinAction(SKINS.lava, 'toxic', ['toxic'], SKINS.lava.cost)).toBe(
      'unlock',
    );
    expect(skinAction(SKINS.gold, 'toxic', ['toxic'], SKINS.gold.cost)).toBe(
      'unlock',
    );
  });

  test('short coins stay locked', () => {
    expect(
      skinAction(SKINS.lava, 'toxic', ['toxic'], SKINS.lava.cost - 1),
    ).toBe('locked');
    expect(skinAction(SKINS.ice, 'toxic', ['toxic'], 0)).toBe('locked');
  });

  test('an equipped id that is not unlocked is treated as locked or unlockable', () => {
    // Save corruption / stale equip should not look "equipped".
    expect(skinAction(SKINS.lava, 'lava', ['toxic'], 0)).toBe('locked');
    expect(skinAction(SKINS.lava, 'lava', ['toxic'], SKINS.lava.cost)).toBe(
      'unlock',
    );
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

  /**
   * Floors, not exact prices. They fail if a cost is cut or if coin payouts are
   * inflated — either of which makes a look cheaper in flawless play than the
   * pricing intends — while leaving room to retune without churning the test.
   */
  test('each look costs hundreds of consecutive Perfects in one run', () => {
    expect(perfectLevelsToAfford(SKINS.lava.cost)).toBeGreaterThanOrEqual(250);
    expect(perfectLevelsToAfford(SKINS.ice.cost)).toBeGreaterThanOrEqual(450);
    expect(perfectLevelsToAfford(SKINS.gold.cost)).toBeGreaterThanOrEqual(850);
  });

  test('a deep, realistic run buys nothing', () => {
    // 60 levels is already a strong run — far past where an ordinary player
    // dies — and every level of it Perfect. Nothing should be affordable.
    const strongRun = coinsFromPerfectRun(60);
    expect(strongRun).toBeGreaterThan(0);
    for (const id of SKIN_IDS) {
      const skin = SKINS[id];
      if (skin.cost === 0) continue;
      expect(skin.cost).toBeGreaterThan(strongRun);
      expect(skinAction(skin, 'toxic', ['toxic'], strongRun)).toBe('locked');
    }
  });

  test('each look is a clear step up from the last', () => {
    // Guards the escalation, not the exact prices: retuning one cost must not
    // quietly flatten the ladder into three looks that land in the same week.
    const paid = SKIN_IDS.map((id) => SKINS[id]).filter((s) => s.cost > 0);
    for (let i = 1; i < paid.length; i++) {
      const deeper =
        perfectLevelsToAfford(paid[i].cost) -
        perfectLevelsToAfford(paid[i - 1].cost);
      expect(deeper).toBeGreaterThanOrEqual(150);
    }
  });
});
