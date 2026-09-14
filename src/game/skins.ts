import type { SkinId } from '@/game/types';

export type SkinDef = {
  id: SkinId;
  name: string;
  cost: number;
  liquid: readonly [string, string, string, string, string];
  shell: string;
  shellDark: string;
};

export const SKINS: Record<SkinId, SkinDef> = {
  toxic: {
    id: 'toxic',
    name: 'Toxic',
    cost: 0,
    // Top → bottom: hot yellow surface → lime → cyan base (matches art)
    liquid: ['#FFE94A', '#B8FF2A', '#2DFF6A', '#00E0D0', '#00A8FF'],
    shell: '#73BF2E',
    shellDark: '#4E9A16',
  },
  lava: {
    id: 'lava',
    name: 'Lava',
    cost: 220,
    liquid: ['#FFE8C8', '#FFB020', '#FF5A1F', '#E11D48', '#7F1D1D'],
    shell: '#F97316',
    shellDark: '#C2410C',
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    cost: 1000,
    liquid: ['#F0F9FF', '#BAE6FD', '#38BDF8', '#2563EB', '#1E3A8A'],
    shell: '#38BDF8',
    shellDark: '#0284C7',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    // Rarest look — more than 100 consecutive Perfects (~2900 coins).
    cost: 3500,
    liquid: ['#FFFBEB', '#FDE68A', '#FBBF24', '#D97706', '#92400E'],
    shell: '#EAB308',
    shellDark: '#A16207',
  },
};

export const DEFAULT_SKIN: SkinId = 'toxic';

/** Display order in the shop — cheapest extra first, gold last. */
export const SKIN_IDS: readonly SkinId[] = ['toxic', 'lava', 'ice', 'gold'];

export type SkinAction = 'equipped' | 'equip' | 'unlock' | 'locked';

/** What the shop button should do for this skin right now. */
export function skinAction(
  skin: SkinDef,
  equipped: SkinId,
  unlocked: readonly SkinId[],
  coins: number,
): SkinAction {
  if (skin.id === equipped && unlocked.includes(skin.id)) return 'equipped';
  if (unlocked.includes(skin.id)) return 'equip';
  if (coins >= skin.cost) return 'unlock';
  return 'locked';
}

export function unlockedSkinCount(unlocked: readonly SkinId[]): number {
  const owned = new Set(unlocked);
  return SKIN_IDS.filter((id) => owned.has(id)).length;
}

/** `#RGB` / `#RRGGBB` → `rgba(...)` so foam and glow can fade. */
export function hexAlpha(hex: string, alpha: number): string {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex;
  const n =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

/** Meniscus + glow taken from the liquid stops so each look reads as itself. */
export function liquidSurface(skin: SkinDef): {
  foam: readonly [string, string, string];
  glow: readonly [string, string, string];
  shadow: string;
} {
  const top = skin.liquid[0];
  const high = skin.liquid[1];
  return {
    foam: ['#FFFFFF', top, high],
    glow: [hexAlpha(high, 0), hexAlpha(high, 0.28), hexAlpha(top, 0.5)],
    shadow: high,
  };
}
