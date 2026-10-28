import { Platform } from 'react-native';

import GameServices, {
  type NativeRankEntry,
} from '../../modules/game-services/src/GameServicesModule';
import { todayKey } from '@/game/storage';
import type { PersistState } from '@/game/types';

/**
 * Leaderboard IDs per platform. iOS IDs are the vendor IDs from App Store
 * Connect; Android IDs are the ones Play Console generates. The daily board
 * resets at 00:00 UTC, matching `todayKey`, so everyone on it played the same
 * daily sequence.
 */
const LEADERBOARD_IDS = Platform.select({
  ios: { normal: 'meterzone.normal.best', daily: 'meterzone.daily.best' },
  // Filled in once the leaderboards exist in Play Console.
  android: { normal: '', daily: '' },
  default: { normal: '', daily: '' },
});

/** True when this build can show rankings. */
export const rankingAvailable =
  GameServices != null &&
  LEADERBOARD_IDS.normal !== '' &&
  (GameServices.isAvailable?.() ?? true);

/** Scores already saved on this device, re-submitted after each sign-in. */
type SavedBests = { highScore: number; dailyTodayScore: number };

/**
 * Signs in silently with the device's account, then re-submits the bests
 * already saved on this device so players who predate rankings still show up.
 * Never throws — rankings are a bonus, not a requirement to play.
 */
export async function signInToRanking(persist: PersistState): Promise<void> {
  if (!rankingAvailable || !GameServices) return;
  try {
    const signedIn = await GameServices.authenticateAsync(false);
    if (!signedIn) return;
    await submitBests({
      highScore: persist.highScore,
      dailyTodayScore:
        persist.dailyBest.date === todayKey() ? persist.dailyBest.score : 0,
    });
  } catch {
    // Offline or sign-in restricted — try again next launch.
  }
}

export function isSignedInToRanking(): boolean {
  return rankingAvailable && GameServices?.isAuthenticated() === true;
}

/**
 * Asks the player to sign in (Google shows its prompt; iOS asks GameKit again,
 * which may refuse after repeated cancels), then submits the saved bests.
 * Resolves false when the player is still signed out.
 */
export async function signInToRankingInteractive(
  bests: SavedBests,
): Promise<boolean> {
  if (!rankingAvailable || !GameServices) return false;
  let signedIn: boolean;
  try {
    signedIn = await GameServices.authenticateAsync(true);
  } catch {
    return false;
  }
  if (!signedIn) return false;
  // Signed in either way — a failed upload is retried at the next sign-in.
  await submitBests(bests).catch(() => undefined);
  return true;
}

/**
 * Re-reads the sign-in state without prompting — for when the app returns to
 * the foreground (the player may have signed in from Settings meanwhile).
 */
export async function refreshRankingSignIn(): Promise<boolean> {
  if (!rankingAvailable || !GameServices) return false;
  try {
    return await GameServices.authenticateAsync(false);
  } catch {
    return false;
  }
}

/** Calls back whenever the native sign-in state changes. */
export function subscribeToRankingSignIn(
  onChange: (signedIn: boolean) => void,
): () => void {
  if (!rankingAvailable || !GameServices) return () => undefined;
  const subscription = GameServices.addListener('onSignInChange', (event) =>
    onChange(event.signedIn),
  );
  return () => subscription.remove();
}

export type RankEntry = {
  rank: number;
  name: string;
  score: number;
  isYou: boolean;
};

export type RankBoard = {
  top: RankEntry[];
  /** The player's own entry — null until they have a score on the board. */
  you: RankEntry | null;
  /** The entry right above the player, for "N points to #2". */
  above: RankEntry | null;
};

/** Endless is the all-time board for normal runs; daily resets every day. */
export type RankingKind = 'endless' | 'daily';

/** Entries shown per board — the podium plus the rest of the top ten. */
export const RANKING_SIZE = 10;

/** Loads one board. Throws when signed out or offline. */
export async function loadRanking(kind: RankingKind): Promise<RankBoard> {
  if (!GameServices) throw new Error('Rankings are not available');
  const board = await GameServices.loadLeaderboardAsync(
    kind === 'daily' ? LEADERBOARD_IDS.daily : LEADERBOARD_IDS.normal,
    RANKING_SIZE,
    kind === 'daily',
  );
  return {
    top: board.top.map(withName),
    you: board.you ? withName(board.you) : null,
    above: board.above ? withName(board.above) : null,
  };
}

/** Display name, falling back to the player's nickname when it's blank. */
function withName(entry: NativeRankEntry): RankEntry {
  const name = entry.name?.trim() || entry.alias?.trim() || '';
  return { rank: entry.rank, name, score: entry.score, isYou: entry.isYou };
}

/** Time left until the daily board resets at 00:00 UTC, matching `todayKey`. */
export function msUntilDailyReset(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return next - now.getTime();
}

/** 3h 31m 12s → "03:31:12". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Points the player needs to overtake the entry above — null at #1 or off the board. */
export function pointsToPass(
  you: RankEntry | null,
  above: RankEntry | null,
): number | null {
  if (!you || !above || you.rank <= 1) return null;
  return Math.max(1, above.score - you.score + 1);
}

/** Opens the leaderboards for a player who is already signed in. */
export async function openRanking(): Promise<void> {
  try {
    await GameServices?.showLeaderboardsAsync();
  } catch {
    // Nothing to recover — the menu stays open.
  }
}

/**
 * Submits a finished run. `runDay` is the UTC day the run started on: a daily
 * run that started before midnight played yesterday's sequence, so it must not
 * land on today's board.
 */
export async function submitRunToRanking(
  score: number,
  isDaily: boolean,
  runDay: string,
): Promise<void> {
  if (isDaily && runDay !== todayKey()) return;
  try {
    await submitBest(
      isDaily ? LEADERBOARD_IDS.daily : LEADERBOARD_IDS.normal,
      score,
    );
  } catch {
    // A failed submit is not retried, but the next sign-in re-submits bests.
  }
}

async function submitBests(bests: SavedBests) {
  await submitBest(LEADERBOARD_IDS.normal, bests.highScore);
  await submitBest(LEADERBOARD_IDS.daily, bests.dailyTodayScore);
}

async function submitBest(leaderboardId: string, score: number) {
  if (!rankingAvailable || !GameServices || score <= 0) return;
  await GameServices.submitScoreAsync(score, [leaderboardId]);
}

/** Coins for a final daily rank: the podium, then a flat amount for the rest of the top ten. */
export const DAILY_REWARDS = { podium: [500, 300, 200], topTen: 100 } as const;

/** Coins a final daily rank earns — 0 outside the top ten. */
export function dailyRewardCoins(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > RANKING_SIZE) return 0;
  return DAILY_REWARDS.podium[rank - 1] ?? DAILY_REWARDS.topTen;
}

/** A finished daily the player placed on, keyed by its UTC day. */
export type DailyFinish = { day: string; rank: number; coins: number };

/**
 * The player's final place on yesterday's daily board, when it earns coins.
 * The day comes from Game Center, not the device clock. Null when signed out,
 * offline, unranked, or outside the top ten — rewards are a bonus, never an
 * error. iOS only; Play Games has no closed daily boards to read.
 */
export async function loadDailyFinish(): Promise<DailyFinish | null> {
  if (!isSignedInToRanking() || !GameServices?.loadPreviousOccurrenceAsync) {
    return null;
  }
  try {
    const previous = await GameServices.loadPreviousOccurrenceAsync(
      LEADERBOARD_IDS.daily,
    );
    if (!previous?.you) return null;
    const coins = dailyRewardCoins(previous.you.rank);
    if (coins === 0) return null;
    const day = new Date(previous.start).toISOString().slice(0, 10);
    return { day, rank: previous.you.rank, coins };
  } catch {
    return null;
  }
}
