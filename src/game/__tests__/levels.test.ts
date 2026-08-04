import { describe, expect, test } from 'bun:test';

import { createRng, makeRound, zoneAt } from '@/game/levels';

const LEVELS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('createRng', () => {
  test('is deterministic for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const drawsA = Array.from({ length: 50 }, () => a());
    const drawsB = Array.from({ length: 50 }, () => b());
    expect(drawsA).toEqual(drawsB);
  });

  test('different seeds diverge', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 20 }, () => a())).not.toEqual(
      Array.from({ length: 20 }, () => b()),
    );
  });

  test('stays within [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('a zero seed does not collapse to a constant', () => {
    const rng = createRng(0);
    const draws = new Set(Array.from({ length: 20 }, () => rng()));
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe('makeRound band invariants', () => {
  test('bands nest: perfect < great < zone, across all levels', () => {
    for (const level of LEVELS) {
      const r = makeRound(level, { rng: createRng(level) });
      expect(r.perfectHalf).toBeGreaterThan(0);
      expect(r.greatHalf).toBeGreaterThan(r.perfectHalf);
      expect(r.zoneHalf).toBeGreaterThan(r.greatHalf);
    }
  });

  test('the zone always fits inside the meter', () => {
    for (const level of LEVELS) {
      const r = makeRound(level, { rng: createRng(level) });
      expect(r.target - r.zoneHalf).toBeGreaterThan(0);
      expect(r.target + r.zoneHalf).toBeLessThan(1);
    }
  });

  test('fill stays deliberate — never a reaction test', () => {
    for (const level of LEVELS) {
      const r = makeRound(level, { rng: createRng(level) });
      expect(r.fillMs).toBeGreaterThan(1500);
      expect(r.fillMs).toBeLessThan(4000);
    }
  });

  test('level is clamped to at least 1', () => {
    expect(makeRound(0).level).toBe(1);
    expect(makeRound(-10).level).toBe(1);
  });

  test('difficulty is monotonic in spirit — deep zones are tighter than early ones', () => {
    const early = makeRound(1, { rng: createRng(7) });
    const deep = makeRound(150, { rng: createRng(7) });
    expect(deep.zoneHalf).toBeLessThan(early.zoneHalf);
    expect(deep.perfectHalf).toBeLessThan(early.perfectHalf);
  });
});

describe('makeRound easy ramp', () => {
  test('levels 1-10 keep a full-size meter and a wide zone', () => {
    for (let level = 1; level <= 10; level++) {
      const r = makeRound(level, { rng: createRng(level) });
      expect(r.meterScale).toBe(1);
      expect(r.zoneHalf).toBeGreaterThanOrEqual(0.048);
      expect(r.moving).toBe(false);
      expect(r.shrinking).toBe(false);
    }
  });

  test('moving and shrinking zones never appear before their gate levels', () => {
    for (let level = 1; level < 35; level++) {
      expect(makeRound(level, { rng: createRng(level) }).moving).toBe(false);
    }
    for (let level = 1; level < 45; level++) {
      expect(makeRound(level, { rng: createRng(level) }).shrinking).toBe(false);
    }
  });
});

describe('makeRound determinism — the daily challenge contract', () => {
  test('same seed produces an identical round sequence', () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      let previousTarget: number | undefined;
      return LEVELS.map((level) => {
        const r = makeRound(level, { previousTarget, rng });
        previousTarget = r.target;
        return r;
      });
    };
    expect(run(20260803)).toEqual(run(20260803));
  });

  test('different seeds produce different sequences', () => {
    const first = (seed: number) => makeRound(20, { rng: createRng(seed) });
    expect(first(1).target).not.toBe(first(2).target);
  });
});

describe('makeRound target spacing', () => {
  test('consecutive targets are pushed apart past the easy ramp', () => {
    const rng = createRng(42);
    let previousTarget = 0.5;
    let tooClose = 0;
    for (let level = 11; level <= 100; level++) {
      const r = makeRound(level, { previousTarget, rng });
      if (Math.abs(r.target - previousTarget) < 0.09) tooClose++;
      previousTarget = r.target;
    }
    // Retry loop gives up after 6 tries, so a few may slip through.
    expect(tooClose).toBeLessThan(10);
  });
});

describe('zoneAt', () => {
  test('a static zone is identical at every point of the fill', () => {
    const r = makeRound(5, { rng: createRng(3) });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(zoneAt(r, t)).toEqual({
        target: r.target,
        zoneHalf: r.zoneHalf,
        greatHalf: r.greatHalf,
        perfectHalf: r.perfectHalf,
      });
    }
  });

  test('a moving zone interpolates linearly from target to targetEnd', () => {
    const r = { ...makeRound(40), moving: true, target: 0.2, targetEnd: 0.8 };
    expect(zoneAt(r, 0).target).toBeCloseTo(0.2, 10);
    expect(zoneAt(r, 0.5).target).toBeCloseTo(0.5, 10);
    expect(zoneAt(r, 1).target).toBeCloseTo(0.8, 10);
  });

  test('a shrinking zone only eats the outer Nice ring', () => {
    const base = makeRound(50);
    const r = {
      ...base,
      shrinking: true,
      zoneHalf: 0.05,
      zoneHalfEnd: 0.02,
      greatHalf: 0.01,
      perfectHalf: 0.004,
    };
    expect(zoneAt(r, 0).zoneHalf).toBeCloseTo(0.05, 10);
    expect(zoneAt(r, 1).zoneHalf).toBeCloseTo(0.02, 10);
    // Great and Perfect must hold still while Nice tightens.
    for (const t of [0, 0.5, 1]) {
      expect(zoneAt(r, t).greatHalf).toBe(r.greatHalf);
      expect(zoneAt(r, t).perfectHalf).toBe(r.perfectHalf);
      expect(zoneAt(r, t).zoneHalf).toBeGreaterThan(r.greatHalf);
    }
  });

  test('shrink never collapses the zone into the Great band', () => {
    const base = makeRound(60);
    const r = {
      ...base,
      shrinking: true,
      zoneHalf: 0.05,
      zoneHalfEnd: 0.001,
      greatHalf: 0.01,
    };
    expect(zoneAt(r, 1).zoneHalf).toBeGreaterThan(r.greatHalf);
  });
});
