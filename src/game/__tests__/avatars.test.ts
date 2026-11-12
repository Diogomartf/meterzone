import { describe, expect, test } from 'bun:test';

import {
  AVATAR_COLORS,
  AVATAR_PACKS,
  avatarPack,
  avatarPackAction,
  decodeAvatar,
  encodeAvatar,
  isValidAvatar,
  packOfEmoji,
  randomAvatar,
} from '@/game/avatars';

describe('randomAvatar', () => {
  test('draws from the free pack and the color list', () => {
    const avatar = randomAvatar(() => 0.99);
    expect(packOfEmoji(avatar.emoji)?.id).toBe('animals');
    expect(AVATAR_COLORS).toContain(avatar.color);
  });
});

describe('avatarPackAction', () => {
  const food = avatarPack('food');

  test('the free pack is always owned', () => {
    expect(avatarPackAction(avatarPack('animals'), [], 0)).toBe('owned');
  });

  test('unlock once affordable, locked before', () => {
    expect(avatarPackAction(food, ['animals'], food.cost)).toBe('unlock');
    expect(avatarPackAction(food, ['animals'], food.cost - 1)).toBe('locked');
  });

  test('bought packs stay owned', () => {
    expect(avatarPackAction(food, ['animals', 'food'], 0)).toBe('owned');
  });
});

describe('AVATAR_PACKS', () => {
  test('each paid pack costs 3x the one before', () => {
    const costs = AVATAR_PACKS.map((p) => p.cost).filter((c) => c > 0);
    expect(costs.length).toBeGreaterThan(1);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBe(costs[i - 1] * 3);
    }
  });
});

describe('isValidAvatar', () => {
  test('accepts an offered emoji on an offered color', () => {
    expect(isValidAvatar({ emoji: '🦊', color: AVATAR_COLORS[0] })).toBe(true);
  });

  test('rejects unknown emoji, colors, and junk', () => {
    expect(isValidAvatar({ emoji: '🫠', color: AVATAR_COLORS[0] })).toBe(false);
    expect(isValidAvatar({ emoji: '🦊', color: '#000000' })).toBe(false);
    expect(isValidAvatar(null)).toBe(false);
  });
});

describe('avatar codes', () => {
  test('every offered avatar survives the round trip', () => {
    for (const pack of AVATAR_PACKS) {
      for (const emoji of pack.emojis) {
        for (const color of AVATAR_COLORS) {
          expect(decodeAvatar(encodeAvatar({ emoji, color }))).toEqual({
            emoji,
            color,
          });
        }
      }
    }
  });

  // Codes already sit on Game Center: reordering the emoji or colors would
  // show other players the wrong avatar. Append only.
  test('codes never change', () => {
    expect(encodeAvatar({ emoji: '🦊', color: '#FF8A3D' })).toBe(16777216);
    expect(encodeAvatar({ emoji: '🍕', color: '#FFC800' })).toBe(16781825);
    expect(encodeAvatar({ emoji: '🔮', color: '#C68B59' })).toBe(16800013);
  });

  test('no avatar, unknown picks and old scores carry none', () => {
    expect(encodeAvatar(null)).toBe(0);
    expect(encodeAvatar({ emoji: '🙂', color: '#FF8A3D' })).toBe(0);
    expect(decodeAvatar(0)).toBeNull();
    expect(decodeAvatar(undefined)).toBeNull();
    expect(decodeAvatar(12345)).toBeNull();
    expect(decodeAvatar(2 ** 24 + 9999 * 2 ** 8)).toBeNull();
  });
});
