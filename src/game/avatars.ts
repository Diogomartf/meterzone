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
 * coins. Priced under skins, but still a goal that spans weeks of play; a top
 * daily finish (see DAILY_REWARDS) gets a player there faster.
 */
export const AVATAR_PACKS: readonly AvatarPack[] = [
  {
    id: 'animals',
    name: msg('Animals'),
    cost: 0,
    emojis: [
      '🦊',
      '🐼',
      '🐸',
      '🐯',
      '🐙',
      '🐳',
      '🦄',
      '🐵',
      '🐧',
      '🦖',
      '🐨',
      '🦉',
      '🐢',
      '🦩',
      '🐝',
      '🐶',
      '🐱',
      '🦒',
    ],
  },
  {
    id: 'food',
    name: msg('Food'),
    // About 30 games for an average player; each pack after it costs 3x
    // the one before, like the skins.
    cost: 1500,
    emojis: [
      '🍕',
      '🍩',
      '🌮',
      '🍔',
      '🍉',
      '🍓',
      '🥑',
      '🧁',
      '🍣',
      '🍿',
      '🍜',
      '🥐',
      '🍪',
      '🍦',
      '🍟',
      '🍰',
      '🌭',
      '🍇',
    ],
  },
  {
    id: 'space',
    name: msg('Space'),
    cost: 4500,
    emojis: [
      '🚀',
      '👽',
      '🪐',
      '🌙',
      '⭐',
      '☄️',
      '🛸',
      '👾',
      '🌍',
      '🌞',
      '🌌',
      '🛰️',
      '🔭',
      '🌠',
      '🌑',
      '🌟',
      '🌕',
      '💫',
    ],
  },
  {
    id: 'sports',
    name: msg('Sports'),
    cost: 13500,
    emojis: [
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🎾',
      '🏐',
      '🏓',
      '🥊',
      '⛳',
      '🏆',
      '🏒',
      '🏸',
      '🥋',
      '🛹',
      '🏄',
      '🏉',
      '🎳',
      '🥏',
    ],
  },
  {
    id: 'legends',
    name: msg('Legends'),
    cost: 40500,
    emojis: [
      '👑',
      '💎',
      '🔥',
      '⚡',
      '🐉',
      '🦁',
      '🎯',
      '🦅',
      '🌈',
      '🦚',
      '🦸',
      '🧙',
      '🗿',
      '🔱',
      '🌋',
      '🏰',
      '🛡️',
      '🔮',
    ],
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
  '#8B5CF6',
  '#3D5AFE',
  '#FF3DA5',
  '#C68B59',
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
 * Every offered emoji, pack by pack: an avatar's code on the leaderboard is its
 * place here. Codes already live on Game Center, so only ever append emoji and
 * colors, and add packs at the end; never reorder or remove (tests pin this).
 */
const ALL_EMOJIS: readonly string[] = AVATAR_PACKS.flatMap(
  (pack) => pack.emojis,
);

/** Marks a context as an avatar code; 0 (old builds) means none. */
const AVATAR_CODE_VERSION = 1;

/**
 * Packs an avatar into the 64-bit context Game Center stores with each score,
 * so other players see the avatar picked by whoever set it. 0 when there's none.
 */
export function encodeAvatar(avatar: PlayerAvatar | null | undefined): number {
  if (!avatar) return 0;
  const emoji = ALL_EMOJIS.indexOf(avatar.emoji);
  const color = AVATAR_COLORS.indexOf(avatar.color);
  if (emoji < 0 || color < 0) return 0;
  return AVATAR_CODE_VERSION * 2 ** 24 + emoji * 2 ** 8 + color;
}

/** The avatar a score's context carries, or null for none or an unknown code. */
export function decodeAvatar(
  context: number | null | undefined,
): PlayerAvatar | null {
  if (!context || !Number.isSafeInteger(context) || context < 0) return null;
  if (Math.floor(context / 2 ** 24) !== AVATAR_CODE_VERSION) return null;
  const emoji = ALL_EMOJIS[Math.floor(context / 2 ** 8) % 2 ** 16];
  const color = AVATAR_COLORS[context % 2 ** 8];
  return emoji && color ? { emoji, color } : null;
}

/**
 * A stand-in avatar for players whose score carries none (submitted before
 * avatars were shared, or from an older build): stable per name, free pack.
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
