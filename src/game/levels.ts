import type { RoundConfig } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ramp(level: number, halfLife: number) {
  return 1 - Math.exp(-(Math.max(1, level) - 1) / halfLife);
}

function grind(level: number) {
  // Extremely slow long-term pressure
  return Math.log2(1 + Math.max(0, level - 1) * 0.02);
}

/** Tiny seeded RNG for daily challenge reproducibility */
export function createRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export type MakeRoundOptions = {
  previousTarget?: number;
  rng?: () => number;
};

/**
 * Bump when the curve changes, so analytics can tell runs on one curve from
 * another (`game_ended.difficulty_version`). 1 was the original slow curve.
 */
export const DIFFICULTY_VERSION = 2;

/** Warm-up rounds before the pressure starts. */
export const WARMUP_LEVELS = 9;
/** First levels that can roll a moving / shrinking zone. */
export const MOVING_FROM = 12;
export const SHRINKING_FROM = 18;
/** Levels where the game steps up at once: faster meter, tighter zone. */
export const STEP_LEVELS = [10, 20] as const;
const STEP_SPEED = 0.85; // fill time × this at each step
const STEP_ZONE = 0.85; // zone, Great and Perfect × this at each step

/** How many step-ups a level has passed (0, 1 or 2). */
export function stepsAt(level: number) {
  return STEP_LEVELS.filter((s) => level >= s).length;
}

/**
 * Infinite increasing difficulty, Flappy Bird style: nine very slow warm-up
 * rounds to learn the tap, then a step up at level 10 (and again at 20) and a
 * steady climb in speed and tightness after that.
 */
export function makeRound(
  level: number,
  opts: MakeRoundOptions = {},
): RoundConfig {
  const n = Math.max(1, level);
  const rand = opts.rng ?? Math.random;
  const easy = n <= WARMUP_LEVELS;
  const easyT = easy ? (n - 1) / (WARMUP_LEVELS - 1) : 1; // 0 at lvl1 → 1 at the last warm-up

  // Speed climbs steadily; the zone closes in within ~30 levels
  const hardLevel = Math.max(1, n - WARMUP_LEVELS);
  const speedR = ramp(hardLevel, 25);
  const zoneR = ramp(hardLevel, 22);
  const placeR = ramp(hardLevel, 30);
  const g = grind(hardLevel);

  let fillMs: number;
  let zoneHalf: number;

  if (easy) {
    // Very slow, wide warm-up: learn the tap, not the reflex
    fillMs = Math.round(lerp(3600, 3200, easyT));
    zoneHalf = lerp(0.082, 0.056, easyT);
  } else {
    // Faster every level, down to a floor that still leaves time to aim
    fillMs = Math.round(clamp(lerp(2800, 1500, speedR) - g * 40, 1300, 2800));
    // Precision pressure: outer Nice tightens first
    zoneHalf = clamp(lerp(0.056, 0.022, zoneR) - g * 0.001, 0.014, 0.055);
  }

  // Slim Perfect strike; Great is a modest ring — aim, don't spam
  const coreR = easy ? easyT * 0.3 : lerp(0.3, 1, ramp(hardLevel, 25));
  // Step-ups at levels 10 and 20: a jump on top of the smooth ramp
  const stepZone = STEP_ZONE ** stepsAt(n);
  fillMs = Math.round(Math.max(900, fillMs * STEP_SPEED ** stepsAt(n)));
  zoneHalf *= stepZone;

  const perfectHalf = clamp(
    (lerp(0.013, 0.0055, coreR) - (easy ? 0 : g * 0.0003)) * stepZone,
    0.0045,
    0.013,
  );
  let greatHalf = Math.max(perfectHalf * 2.2, perfectHalf + 0.0045);

  // Nice margin outside Great — eaten before the core shrinks
  const niceMargin = easy
    ? lerp(0.024, 0.016, easyT)
    : clamp(lerp(0.016, 0.004, zoneR) - g * 0.00045, 0.0035, 0.02);
  zoneHalf = Math.max(zoneHalf, greatHalf + niceMargin);
  greatHalf = Math.min(greatHalf, zoneHalf - 0.003);

  const edgePad = easy
    ? lerp(0.08, 0.12, easyT)
    : clamp(lerp(0.12, 0.06, placeR) - g * 0.0007, 0.035, 0.12);
  const min = zoneHalf + edgePad;
  const max = 1 - zoneHalf - edgePad * 0.7;

  let target = min + rand() * Math.max(0.01, max - min);
  if (easy) {
    // Keep early targets near the middle so the fat zone covers most taps
    const mid = 0.5;
    const spread = lerp(0.08, 0.18, easyT);
    target = clamp(mid + (rand() - 0.5) * 2 * spread, min, max);
  } else if (opts.previousTarget != null) {
    let tries = 0;
    while (Math.abs(target - opts.previousTarget) < 0.09 && tries < 6) {
      target = min + rand() * Math.max(0.01, max - min);
      tries += 1;
    }
  }

  // Moving / shrinking are rare extras — they add focus, not panic
  // Moving / shrinking zones join early and get common
  const moving =
    n >= MOVING_FROM &&
    rand() < clamp(0.08 + (n - MOVING_FROM) * 0.008, 0.08, 0.35);
  const shrinking =
    n >= SHRINKING_FROM &&
    rand() < clamp(0.06 + (n - SHRINKING_FROM) * 0.006, 0.06, 0.28);

  let targetEnd: number | undefined;
  if (moving) {
    targetEnd = min + rand() * Math.max(0.01, max - min);
    if (Math.abs(targetEnd - target) < 0.12) {
      targetEnd = clamp(target + (rand() > 0.5 ? 0.16 : -0.16), min, max);
    }
  }

  // Never wider than the start: deep in a run the zone can already sit
  // below the Great + 0.004 floor, and a "shrink" must not widen it
  const zoneHalfEnd = shrinking
    ? Math.min(
        zoneHalf,
        Math.max(greatHalf + 0.004, zoneHalf * lerp(0.85, 0.7, ramp(n, 40))),
      )
    : undefined;

  // Vary meter size for visual variety (still readable)
  const sizeRoll = rand();
  const meterScale = easy
    ? 1
    : sizeRoll < 0.25
      ? 0.78
      : sizeRoll < 0.5
        ? 0.9
        : sizeRoll < 0.8
          ? 1
          : 1.12;

  return {
    level: n,
    target,
    targetEnd,
    zoneHalf,
    zoneHalfEnd,
    greatHalf,
    perfectHalf,
    fillMs,
    moving,
    shrinking,
    meterScale,
  };
}

export type RoundKind = 'static' | 'moving' | 'shrinking' | 'moving_shrinking';

/** What kind of zone a round has, for analytics. Exactly one per round. */
export function roundKind(
  round: Pick<RoundConfig, 'moving' | 'shrinking'>,
): RoundKind {
  if (round.moving && round.shrinking) return 'moving_shrinking';
  if (round.moving) return 'moving';
  if (round.shrinking) return 'shrinking';
  return 'static';
}

export type LevelBand = 'l1_9' | 'l10_19' | 'l20_29' | 'l30p';

/**
 * Level bands for analytics, split at the step-ups so a band's rounds share
 * roughly one speed and zone size. Miss rates are only comparable within one.
 */
export function levelBand(level: number): LevelBand {
  if (level < STEP_LEVELS[0]) return 'l1_9';
  if (level < STEP_LEVELS[1]) return 'l10_19';
  if (level < 30) return 'l20_29';
  return 'l30p';
}

/** Resolve live zone position/size at fill progress t (0–1). */
export function zoneAt(round: RoundConfig, t: number) {
  const target =
    round.moving && round.targetEnd != null
      ? lerp(round.target, round.targetEnd, t)
      : round.target;
  // Mid-fill shrink only eats the Nice outer ring — Great / Perfect stay put
  const zoneHalf =
    round.shrinking && round.zoneHalfEnd != null
      ? Math.max(
          round.greatHalf + 0.003,
          lerp(round.zoneHalf, round.zoneHalfEnd, t),
        )
      : round.zoneHalf;
  return {
    target,
    zoneHalf,
    greatHalf: round.greatHalf,
    perfectHalf: round.perfectHalf,
  };
}
