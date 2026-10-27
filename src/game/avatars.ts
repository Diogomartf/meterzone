import { msg } from 'gt-react-native';

import type { AvatarPackId, PlayerAvatar } from '@/game/types';

export type AvatarPack = {
  id: AvatarPackId;
  name: string;
  cost: number;
  emojis: readonly string[];
};

/**
 * Emoji packs for the player's avatar. Animals is free; the rest unlock with
 * coins. Priced well under skins — a good run earns a couple dozen coins, so
 * these land over days of play rather than months.
 */
export const AVATAR_PACKS: readonly AvatarPack[] = [
  {
    id: 'animals',
    name: msg('Animals'),
    cost: 0,
    emojis: ['🦊', '🐼', '🐸', '🐯', '🐙', '🐳', '🦄', '🐵', '🐧', '🦖'],
  },
  {
    id: 'food',
    name: msg('Food'),
    cost: 150,
    emojis: ['🍕', '🍩', '🌮', '🍔', '🍉', '🍓', '🥑', '🧁', '🍣', '🍿'],
  },
  {
    id: 'space',
    name: msg('Space'),
    cost: 500,
    emojis: ['🚀', '👽', '🪐', '🌙', '⭐', '☄️', '🛸', '👾', '🌍', '🌞'],
  },
  {
    id: 'sports',
    name: msg('Sports'),
    cost: 1200,
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🥊', '⛳', '🏆'],
  },
  {
    id: 'legends',
    name: msg('Legends'),
    cost: 3000,
    emojis: ['👑', '💎', '🔥', '⚡', '🐉', '🦁', '🎯', '🦅', '🌈', '🦚'],
  },
];

export const FREE_AVATAR_PACK: AvatarPackId = 'animals';

/** Avatar backgrounds — all free, picked independently of the emoji. */
export const AVATAR_COLORS: readonly string[] = [
  '#FF8A3D',
  '#FFC800',
  '#8CFF2A',
  '#5CDE70',
  '#4EC0CA',
  '#1CB0F6',
  '#C9A7FF',
  '#FF8FC8',
  '#FF6A6A',
  '#C9D4E3',
];

export function avatarPack(id: AvatarPackId): AvatarPack {
  return AVATAR_PACKS.find((pack) => pack.id === id) ?? AVATAR_PACKS[0];
}

/** The pack an emoji belongs to, or null for one we don't offer. */
export function packOfEmoji(emoji: string): AvatarPack | null {
  return AVATAR_PACKS.find((pack) => pack.emojis.includes(emoji)) ?? null;
}

export function isAvatarPackId(value: unknown): value is AvatarPackId {
  return AVATAR_PACKS.some((pack) => pack.id === value);
}

/** A starting avatar: a free-pack emoji on any background. */
export function randomAvatar(rng: () => number = Math.random): PlayerAvatar {
  const emojis = avatarPack(FREE_AVATAR_PACK).emojis;
  return {
    emoji: emojis[Math.floor(rng() * emojis.length)],
    color: AVATAR_COLORS[Math.floor(rng() * AVATAR_COLORS.length)],
  };
}

/** Only offered emoji on offered colors — guards against stale or edited saves. */
export function isValidAvatar(value: unknown): value is PlayerAvatar {
  if (!value || typeof value !== 'object') return false;
  const { emoji, color } = value as Partial<PlayerAvatar>;
  return (
    typeof emoji === 'string' &&
    typeof color === 'string' &&
    packOfEmoji(emoji) != null &&
    AVATAR_COLORS.includes(color)
  );
}

export type AvatarPackAction = 'owned' | 'unlock' | 'locked';

/** What the picker's pack button should offer right now. */
export function avatarPackAction(
  pack: AvatarPack,
  unlocked: readonly AvatarPackId[],
  coins: number,
): AvatarPackAction {
  if (pack.cost === 0 || unlocked.includes(pack.id)) return 'owned';
  return coins >= pack.cost ? 'unlock' : 'locked';
}

/**
 * Other players' avatars on the leaderboard. Their own picks never reach this
 * device, so each name maps to a stable free-pack avatar instead.
 */
export function avatarFor(name: string): PlayerAvatar {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const emojis = avatarPack(FREE_AVATAR_PACK).emojis;
  return {
    emoji: emojis[hash % emojis.length],
    color: AVATAR_COLORS[(hash >>> 4) % AVATAR_COLORS.length],
  };
}
