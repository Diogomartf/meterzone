import type { SkinId } from '@/game/types';

export type SkinDef = {
  id: SkinId;
  name: string;
  cost: number;
  liquid: readonly [string, string, string, string, string];
  shell: string;
  shellDark: string;
  /** Polished metal: a bright band across the liquid and dark edges. */
  metallic?: boolean;
  /** Frozen: milky frost along the edges and a few glints in the liquid. */
  frosty?: boolean;
};

export const SKINS: Record<SkinId, SkinDef> = {
  toxic: {
    id: 'toxic',
    name: 'Toxic',
    cost: 0,
    // Top → bottom: sunny yellow → lime → bright green → cyan → sky blue,
    // vivid and solid like the store art, in a lime frame
    liquid: ['#FFE21F', '#C6EE22', '#3EDD3A', '#22CFD0', '#2B9BF0'],
    shell: '#8ED91E',
    shellDark: '#4E9A0E',
  },
  lava: {
    id: 'lava',
    name: 'Lava',
    // The first extra look takes about 100 games for an average player
    // (~50 coins a game), so it is banked across sessions, not won in one run.
    // Each look after it costs 3x the one before.
    cost: 5000,
    liquid: ['#FFD08A', '#FFA010', '#FF5A1F', '#E11D48', '#7F1D1D'],
    shell: '#F97316',
    shellDark: '#C2410C',
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    // 3x Lava: about 280 average games.
    cost: 15000,
    // Snow-white surface through pale glacier blue to a deep cold base.
    liquid: ['#F7FCFF', '#D4F0FF', '#8FD3F7', '#4A9EE6', '#2457B8'],
    shell: '#7DD3FC',
    shellDark: '#2B8FD0',
    frosty: true,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    // The end of the road, 3x Ice: about 850 average games.
    cost: 45000,
    // Bright and dark stops alternate down the tube, like light on metal.
    liquid: ['#FFF8D6', '#FFD93D', '#FFF0A0', '#F5A800', '#9A5B00'],
    shell: '#FACC15',
    shellDark: '#B7791F',
    metallic: true,
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
