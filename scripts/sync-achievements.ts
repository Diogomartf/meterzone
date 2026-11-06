/**
 * Creates MeterZone's Game Center achievements in App Store Connect, with their
 * text in every store language and generated artwork. Safe to run again: it
 * only adds what's missing, so it won't change anything already there. A new
 * achievement needs an entry here and its id in `src/game/achievements.ts`.
 *
 *   bun run achievements:sync --art-only   # just draw build/achievements/*.png
 *   bun run achievements:sync
 *
 * Needs `asc` logged in, ImageMagick and rsvg-convert.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ACHIEVEMENT_IDS, type AchievementId } from '../src/game/achievements';

const APP_ID = '6794744179';
const ART_DIR = 'build/achievements';
const FONT =
  'node_modules/@expo-google-fonts/lilita-one/400Regular/LilitaOne_400Regular.ttf';
const STORE_LOCALES = {
  'en-US': 'en',
  'pt-BR': 'ptBR',
  'pt-PT': 'ptPT',
  'es-ES': 'es',
  'es-MX': 'es',
} as const;

type Lang = (typeof STORE_LOCALES)[keyof typeof STORE_LOCALES];
type Text = { name: string; before: string; after: string };
type Style = keyof typeof STYLES;
type Achievement = {
  points: number;
  hidden?: boolean;
  style: Style;
  /** How full the meter is drawn, 0 to 1: higher tiers fill it further. */
  fill: number;
  /** Numbers only, so one image works in every language. */
  badge: string;
  text: Record<Lang, Text>;
};

const STYLES = {
  games: ['#2B9BF0', '#22CFD0'],
  level: ['#E11D48', '#FFA010'],
  combo: ['#2457B8', '#8FD3F7'],
  perfect: ['#F5A800', '#FFF0A0'],
  clean: ['#22CFD0', '#C6EE22'],
  daily: ['#3EDD3A', '#FFE21F'],
  skin: ['#9A5B00', '#FFD93D'],
};

const copy = {
  games: (n: string): Record<Lang, Omit<Text, 'name'>> => ({
    en: { before: `Play ${n} games.`, after: `You played ${n} games.` },
    ptBR: {
      before: `Jogue ${n} partidas.`,
      after: `Você jogou ${n} partidas.`,
    },
    ptPT: { before: `Joga ${n} partidas.`, after: `Jogaste ${n} partidas.` },
    es: { before: `Juega ${n} partidas.`, after: `Jugaste ${n} partidas.` },
  }),
  level: (n: number): Record<Lang, Omit<Text, 'name'>> => ({
    en: { before: `Reach level ${n}.`, after: `You reached level ${n}.` },
    ptBR: {
      before: `Chegue ao nível ${n}.`,
      after: `Você chegou ao nível ${n}.`,
    },
    ptPT: { before: `Chega ao nível ${n}.`, after: `Chegaste ao nível ${n}.` },
    es: { before: `Llega al nivel ${n}.`, after: `Llegaste al nivel ${n}.` },
  }),
  combo: (n: number): Record<Lang, Omit<Text, 'name'>> => ({
    en: {
      before: `Reach a combo of ${n}.`,
      after: `You reached a combo of ${n}.`,
    },
    ptBR: {
      before: `Faça um combo de ${n}.`,
      after: `Você fez um combo de ${n}.`,
    },
    ptPT: {
      before: `Faz um combo de ${n}.`,
      after: `Fizeste um combo de ${n}.`,
    },
    es: {
      before: `Consigue un combo de ${n}.`,
      after: `Conseguiste un combo de ${n}.`,
    },
  }),
};

const named = (
  names: Record<Lang, string>,
  body: Record<Lang, Omit<Text, 'name'>>,
) =>
  Object.fromEntries(
    (Object.keys(names) as Lang[]).map((lang) => [
      lang,
      { name: names[lang], ...body[lang] },
    ]),
  ) as Record<Lang, Text>;

const pt = (name: string, es: string, en: string) => ({
  en,
  ptBR: name,
  ptPT: name,
  es,
});

const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  'meterzone.games.10': {
    points: 10,
    style: 'games',
    fill: 0.3,
    badge: '10',
    text: named(
      pt('Aquecimento', 'Calentamiento', 'Warmed Up'),
      copy.games('10'),
    ),
  },
  'meterzone.games.100': {
    points: 25,
    style: 'games',
    fill: 0.6,
    badge: '100',
    text: named(pt('Presença Fixa', 'Habitual', 'Regular'), copy.games('100')),
  },
  'meterzone.games.1000': {
    points: 75,
    style: 'games',
    fill: 0.9,
    badge: '1000',
    text: named(pt('Mania do Medidor', 'Manía del Medidor', 'Meter Maniac'), {
      en: copy.games('1,000').en,
      ptBR: copy.games('1.000').ptBR,
      ptPT: copy.games('1000').ptPT,
      es: copy.games('1000').es,
    }),
  },
  'meterzone.level.10': {
    points: 5,
    style: 'level',
    fill: 0.2,
    badge: '10',
    text: named(
      pt('Dois Dígitos', 'Dos Dígitos', 'Double Digits'),
      copy.level(10),
    ),
  },
  'meterzone.level.30': {
    points: 15,
    style: 'level',
    fill: 0.4,
    badge: '30',
    text: named(
      pt('Clube dos 30', 'Club de los 30', 'Thirty Up'),
      copy.level(30),
    ),
  },
  'meterzone.level.50': {
    points: 50,
    style: 'level',
    fill: 0.6,
    badge: '50',
    text: named(
      {
        en: 'Halfway to Legend',
        ptBR: 'Meio Caminho',
        ptPT: 'A Meio Caminho',
        es: 'A Medio Camino',
      },
      copy.level(50),
    ),
  },
  'meterzone.level.75': {
    points: 80,
    style: 'level',
    fill: 0.8,
    badge: '75',
    text: named(
      {
        en: 'Red Zone',
        ptBR: 'Zona Vermelha',
        ptPT: 'Zona Vermelha',
        es: 'Zona Roja',
      },
      copy.level(75),
    ),
  },
  'meterzone.level.100': {
    points: 100,
    hidden: true,
    style: 'level',
    fill: 1,
    badge: '100',
    text: named(
      pt('Fora do Medidor', 'Fuera del Medidor', 'Off the Meter'),
      copy.level(100),
    ),
  },
  'meterzone.streak.5': {
    points: 5,
    style: 'combo',
    fill: 0.25,
    badge: '5',
    text: named(pt('Em Ritmo', 'En Racha', 'On a Roll'), copy.combo(5)),
  },
  'meterzone.streak.10': {
    points: 15,
    style: 'combo',
    fill: 0.5,
    badge: '10',
    text: named(
      pt('Foco Total', 'Concentración Total', 'Locked In'),
      copy.combo(10),
    ),
  },
  'meterzone.streak.16': {
    points: 40,
    style: 'combo',
    fill: 0.75,
    badge: 'x5',
    text: named(pt('Potência Máxima', 'Máxima Potencia', 'Full Power'), {
      en: {
        before: 'Reach the x5 combo multiplier.',
        after: 'You reached the x5 combo multiplier.',
      },
      ptBR: {
        before: 'Chegue ao multiplicador de combo x5.',
        after: 'Você chegou ao multiplicador de combo x5.',
      },
      ptPT: {
        before: 'Chega ao multiplicador de combo x5.',
        after: 'Chegaste ao multiplicador de combo x5.',
      },
      es: {
        before: 'Llega al multiplicador de combo x5.',
        after: 'Llegaste al multiplicador de combo x5.',
      },
    }),
  },
  'meterzone.streak.25': {
    points: 75,
    style: 'combo',
    fill: 1,
    badge: '25',
    text: named(pt('Intocável', 'Intocable', 'Untouchable'), copy.combo(25)),
  },
  'meterzone.perfect.first': {
    points: 5,
    style: 'perfect',
    fill: 0.25,
    badge: '1',
    text: named(
      {
        en: 'Bullseye',
        ptBR: 'Na Mosca',
        ptPT: 'Em Cheio',
        es: 'En el Blanco',
      },
      {
        en: {
          before: 'Land your first Perfect.',
          after: 'You landed your first Perfect.',
        },
        ptBR: {
          before: 'Faça seu primeiro Perfeito.',
          after: 'Você fez seu primeiro Perfeito.',
        },
        ptPT: {
          before: 'Faz o teu primeiro Perfeito.',
          after: 'Fizeste o teu primeiro Perfeito.',
        },
        es: {
          before: 'Consigue tu primer Perfecto.',
          after: 'Conseguiste tu primer Perfecto.',
        },
      },
    ),
  },
  'meterzone.perfect.run10': {
    points: 30,
    style: 'perfect',
    fill: 0.6,
    badge: '10',
    text: named(pt('Mira Afiada', 'Puntería Fina', 'Sharp Run'), {
      en: {
        before: 'Land 10 Perfects in one run.',
        after: 'You landed 10 Perfects in one run.',
      },
      ptBR: {
        before: 'Faça 10 Perfeitos em uma partida.',
        after: 'Você fez 10 Perfeitos em uma partida.',
      },
      ptPT: {
        before: 'Faz 10 Perfeitos numa partida.',
        after: 'Fizeste 10 Perfeitos numa partida.',
      },
      es: {
        before: 'Consigue 10 Perfectos en una partida.',
        after: 'Conseguiste 10 Perfectos en una partida.',
      },
    }),
  },
  'meterzone.perfect.total1000': {
    points: 50,
    style: 'perfect',
    fill: 0.95,
    badge: '1000',
    text: named(pt('Perfeccionismo', 'Perfeccionismo', 'Perfectionist'), {
      en: {
        before: 'Land 1,000 Perfects in total.',
        after: 'You landed 1,000 Perfects.',
      },
      ptBR: {
        before: 'Faça 1.000 Perfeitos no total.',
        after: 'Você fez 1.000 Perfeitos.',
      },
      ptPT: {
        before: 'Faz 1000 Perfeitos no total.',
        after: 'Fizeste 1000 Perfeitos.',
      },
      es: {
        before: 'Consigue 1000 Perfectos en total.',
        after: 'Conseguiste 1000 Perfectos.',
      },
    }),
  },
  'meterzone.clean.20': {
    points: 40,
    style: 'clean',
    fill: 0.7,
    badge: '20',
    text: named(pt('Sem Falhas', 'Sin Fallos', 'Clean Sheet'), {
      en: {
        before: 'Clear 20 levels without losing a life.',
        after: 'You cleared 20 levels without losing a life.',
      },
      ptBR: {
        before: 'Passe 20 níveis sem perder uma vida.',
        after: 'Você passou 20 níveis sem perder uma vida.',
      },
      ptPT: {
        before: 'Passa 20 níveis sem perder uma vida.',
        after: 'Passaste 20 níveis sem perder uma vida.',
      },
      es: {
        before: 'Supera 20 niveles sin perder una vida.',
        after: 'Superaste 20 niveles sin perder una vida.',
      },
    }),
  },
  'meterzone.daily.first': {
    points: 5,
    style: 'daily',
    fill: 0.25,
    badge: '1',
    text: named(pt('Compromisso Diário', 'Cita Diaria', 'Daily Driver'), {
      en: {
        before: 'Finish a Daily Challenge.',
        after: 'You finished a Daily Challenge.',
      },
      ptBR: {
        before: 'Conclua um Desafio Diário.',
        after: 'Você concluiu um Desafio Diário.',
      },
      ptPT: {
        before: 'Conclui um Desafio Diário.',
        after: 'Concluíste um Desafio Diário.',
      },
      es: {
        before: 'Completa un Desafío Diario.',
        after: 'Completaste un Desafío Diario.',
      },
    }),
  },
  'meterzone.daily.streak7': {
    points: 30,
    style: 'daily',
    fill: 0.5,
    badge: '7',
    text: named(pt('Sete Seguidos', 'Siete Seguidos', 'Seven Straight'), {
      en: {
        before: 'Finish the Daily Challenge 7 days in a row.',
        after: 'You finished the Daily Challenge 7 days in a row.',
      },
      ptBR: {
        before: 'Conclua o Desafio Diário 7 dias seguidos.',
        after: 'Você concluiu o Desafio Diário 7 dias seguidos.',
      },
      ptPT: {
        before: 'Conclui o Desafio Diário 7 dias seguidos.',
        after: 'Concluíste o Desafio Diário 7 dias seguidos.',
      },
      es: {
        before: 'Completa el Desafío Diario 7 días seguidos.',
        after: 'Completaste el Desafío Diario 7 días seguidos.',
      },
    }),
  },
  'meterzone.daily.top10': {
    points: 40,
    style: 'daily',
    fill: 0.75,
    badge: '10',
    text: named(pt('Top 10', 'Top 10', 'Top Ten'), {
      en: {
        before: 'Finish in the top 10 of a Daily board.',
        after: 'You finished in the top 10 of a Daily board.',
      },
      ptBR: {
        before: 'Termine entre os 10 primeiros do Diário.',
        after: 'Você terminou entre os 10 primeiros do Diário.',
      },
      ptPT: {
        before: 'Termina entre os 10 primeiros do Diário.',
        after: 'Terminaste entre os 10 primeiros do Diário.',
      },
      es: {
        before: 'Termina entre los 10 primeros del Diario.',
        after: 'Terminaste entre los 10 primeros del Diario.',
      },
    }),
  },
  'meterzone.daily.first_place': {
    points: 75,
    hidden: true,
    style: 'daily',
    fill: 1,
    badge: '1',
    text: named(
      {
        en: 'Number One',
        ptBR: 'Número Um',
        ptPT: 'Número Um',
        es: 'Número Uno',
      },
      {
        en: {
          before: 'Finish first on a Daily board.',
          after: 'You finished first on a Daily board.',
        },
        ptBR: {
          before: 'Termine em primeiro no Diário.',
          after: 'Você terminou em primeiro no Diário.',
        },
        ptPT: {
          before: 'Termina em primeiro no Diário.',
          after: 'Terminaste em primeiro no Diário.',
        },
        es: {
          before: 'Termina primero en el Diario.',
          after: 'Terminaste primero en el Diario.',
        },
      },
    ),
  },
  'meterzone.skin.first': {
    points: 15,
    style: 'skin',
    fill: 0.35,
    badge: '1',
    text: named(
      {
        en: 'New Look',
        ptBR: 'Visual Novo',
        ptPT: 'Visual Novo',
        es: 'Nuevo Look',
      },
      {
        en: {
          before: 'Buy your first skin.',
          after: 'You bought your first skin.',
        },
        ptBR: {
          before: 'Compre sua primeira skin.',
          after: 'Você comprou sua primeira skin.',
        },
        ptPT: {
          before: 'Compra a tua primeira skin.',
          after: 'Compraste a tua primeira skin.',
        },
        es: {
          before: 'Compra tu primera skin.',
          after: 'Compraste tu primera skin.',
        },
      },
    ),
  },
  'meterzone.skin.gold': {
    points: 50,
    style: 'skin',
    fill: 1,
    badge: 'Au',
    text: named(pt('Padrão Ouro', 'Patrón Oro', 'Gold Standard'), {
      en: { before: 'Own the Gold skin.', after: 'You own the Gold skin.' },
      ptBR: { before: 'Tenha a skin Ouro.', after: 'Você tem a skin Ouro.' },
      ptPT: { before: 'Tem a skin Ouro.', after: 'Tens a skin Ouro.' },
      es: { before: 'Consigue la skin Oro.', after: 'Tienes la skin Oro.' },
    }),
  },
};

function check() {
  const total = Object.values(ACHIEVEMENTS).reduce(
    (sum, a) => sum + a.points,
    0,
  );
  if (total > 1000)
    throw new Error(`${total} points: Game Center allows 1,000`);
  for (const id of ACHIEVEMENT_IDS) {
    for (const { name, before, after } of Object.values(
      ACHIEVEMENTS[id].text,
    )) {
      if (name.length > 30) throw new Error(`Name too long: ${name}`);
      if (before.length > 200 || after.length > 200) {
        throw new Error(`Description too long: ${id}`);
      }
    }
  }
  console.log(
    `${ACHIEVEMENT_IDS.length} achievements, ${total} of 1,000 points`,
  );
}

/** The meter filled to this tier, as a flat square PNG Game Center accepts. */
function drawArt(id: AchievementId) {
  const { style, fill, badge } = ACHIEVEMENTS[id];
  const [low, high] = STYLES[style];
  const size = 1024;
  const surface = size - Math.round(size * (0.08 + fill * 0.8));
  const waveStep = size / 4;
  const wave = `M0 ${surface} q${waveStep / 2} -36 ${waveStep} 0 t${waveStep} 0 t${waveStep} 0 t${waveStep} 0 V${size} H0 Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="l" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${low}"/><stop offset="1" stop-color="${high}"/></linearGradient></defs>
    <rect width="${size}" height="${size}" fill="#0B1533"/>
    <path d="${wave}" fill="url(#l)"/>
    <circle cx="512" cy="512" r="430" fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="20"/>
  </svg>`;
  const base = join(ART_DIR, `${id}.base.png`);
  const out = join(ART_DIR, `${id}.png`);
  execFileSync('rsvg-convert', ['-o', base], { input: svg });
  const pointsize = badge.length >= 4 ? 300 : badge.length === 3 ? 380 : 480;
  execFileSync('magick', [
    base,
    '-font',
    FONT,
    '-pointsize',
    String(pointsize),
    '-gravity',
    'center',
    '-stroke',
    '#0B1533',
    '-strokewidth',
    '36',
    '-fill',
    '#0B1533',
    '-annotate',
    '0',
    badge,
    '-stroke',
    'none',
    '-fill',
    '#FFFFFF',
    '-annotate',
    '0',
    badge,
    '-alpha',
    'off',
    '-density',
    '72',
    out,
  ]);
  execFileSync('rm', [base]);
  return out;
}

function asc<T>(...args: string[]): T {
  const out = execFileSync(
    'asc',
    ['game-center', 'achievements', ...args, '--output', 'json'],
    {
      encoding: 'utf8',
    },
  );
  return JSON.parse(out) as T;
}

type Row = { id: string; attributes: Record<string, string> };

function sync() {
  const existing = new Map(
    asc<{ data: Row[] }>('list', '--app', APP_ID, '--paginate').data.map(
      (row) => [row.attributes.vendorIdentifier, row.id],
    ),
  );
  for (const id of ACHIEVEMENT_IDS) {
    const achievement = ACHIEVEMENTS[id];
    const achievementId =
      existing.get(id) ??
      asc<{ data: Row }>(
        'create',
        '--app',
        APP_ID,
        '--reference-name',
        achievement.text.en.name,
        '--vendor-id',
        id,
        '--points',
        String(achievement.points),
        `--show-before-earned=${!achievement.hidden}`,
      ).data.id;
    const locales = new Set(
      asc<{ data: Row[] }>(
        'localizations',
        'list',
        '--achievement-id',
        achievementId,
        '--paginate',
      ).data.map((row) => row.attributes.locale),
    );
    for (const [locale, lang] of Object.entries(STORE_LOCALES)) {
      if (locales.has(locale)) continue;
      const { name, before, after } = achievement.text[lang];
      const { data } = asc<{ data: Row }>(
        'localizations',
        'create',
        '--achievement-id',
        achievementId,
        '--locale',
        locale,
        '--name',
        name,
        '--before-earned-description',
        before,
        '--after-earned-description',
        after,
      );
      asc(
        'images',
        'upload',
        '--localization-id',
        data.id,
        '--file',
        join(ART_DIR, `${id}.png`),
      );
    }
    console.log(`${id}: done`);
  }
}

check();
mkdirSync(ART_DIR, { recursive: true });
ACHIEVEMENT_IDS.forEach(drawArt);
console.log(`Artwork: ${readdirSync(ART_DIR).length} files in ${ART_DIR}`);
if (!process.argv.includes('--art-only')) sync();
