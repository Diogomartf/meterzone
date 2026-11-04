/**
 * Estimates how many games a player needs to afford each skin and avatar pack.
 *
 * Plays many simulated runs through the real `scoreFill`, `makeRound` and
 * catalog prices, so the table follows any change to payouts or costs. The
 * players are made up: each has fixed odds of Perfect / Great / Nice at level 1
 * and a miss chance that grows with the level as zones shrink. There is no
 * analytics yet, so this is a model, not player data.
 *
 * Run with `bun run sim:coins`.
 */
// `gt-react-native` can't load off-device; pack names only need `msg`.
Bun.plugin({
  setup(build) {
    build.module('gt-react-native', () => ({
      exports: { msg: (message) => message },
      loader: 'object',
    }));
  },
});

const { AVATAR_PACKS } = await import('@/game/avatars');
const { makeRound } = await import('@/game/levels');
const { scoreFill, STARTING_LIVES } = await import('@/game/scoring');
const { SKINS } = await import('@/game/skins');

const RUNS = 200_000;

/** Tuned so casual / average / good die around levels 15 / 21 / 33. */
const PLAYERS = {
  casual: { perfect: 0.1, great: 0.3, miss: 0.12, missPerLevel: 0.01 },
  average: { perfect: 0.2, great: 0.4, miss: 0.07, missPerLevel: 0.006 },
  good: { perfect: 0.35, great: 0.4, miss: 0.03, missPerLevel: 0.0035 },
};

/** A fill that lands in the band the player rolled. */
function tapFill(round, outcome) {
  const { target, perfectHalf, greatHalf, zoneHalf } = round;
  if (outcome === 'perfect') return target;
  if (outcome === 'great') return target + (perfectHalf + greatHalf) / 2;
  if (outcome === 'nice') return target + (greatHalf + zoneHalf) / 2;
  return target + zoneHalf + 0.05;
}

function rollOutcome(player, level) {
  const miss = Math.min(0.9, player.miss + player.missPerLevel * (level - 1));
  const scale = (1 - miss) / (1 - player.miss);
  const r = Math.random();
  if (r < miss) return 'miss';
  if (r < miss + player.perfect * scale) return 'perfect';
  if (r < miss + (player.perfect + player.great) * scale) return 'great';
  return 'nice';
}

function playRun(player) {
  let lives = STARTING_LIVES;
  let combo = 0;
  let coins = 0;
  let level = 0;
  while (lives > 0) {
    level++;
    // A still zone, so the fill lands in the band that was rolled
    const round = { ...makeRound(level), moving: false, shrinking: false };
    const hit = scoreFill(
      tapFill(round, rollOutcome(player, level)),
      round,
      combo,
    );
    coins += hit.coins;
    combo = hit.combo;
    if (hit.costsLife) lives--;
  }
  return { coins, level };
}

const items = [
  ...Object.values(SKINS).map((s) => ({
    name: `${s.name} (skin)`,
    cost: s.cost,
  })),
  ...AVATAR_PACKS.map((p) => ({ name: `${p.name} (pack)`, cost: p.cost })),
]
  .filter((item) => item.cost > 0)
  .sort((a, b) => a.cost - b.cost);
items.push({
  name: 'Everything',
  cost: items.reduce((sum, item) => sum + item.cost, 0),
});

const perGame = {};
for (const [name, player] of Object.entries(PLAYERS)) {
  let coins = 0;
  let levels = 0;
  for (let i = 0; i < RUNS; i++) {
    const run = playRun(player);
    coins += run.coins;
    levels += run.level;
  }
  perGame[name] = coins / RUNS;
  console.log(
    `${name}: dies around level ${Math.round(levels / RUNS)}, ${Math.round(coins / RUNS)} coins a game`,
  );
}

const names = Object.keys(PLAYERS);
console.log(
  `\n| Item | Price | ${names.map((n) => `${n} games`).join(' | ')} |`,
);
console.log(`|---|---|${names.map(() => '---|').join('')}`);
for (const item of items) {
  const games = names.map(
    (n) => `~${Math.ceil(item.cost / perGame[n]).toLocaleString('en-US')}`,
  );
  console.log(
    `| ${item.name} | ${item.cost.toLocaleString('en-US')} | ${games.join(' | ')} |`,
  );
}
