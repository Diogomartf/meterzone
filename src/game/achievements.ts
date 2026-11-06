import type { PersistState } from '@/game/types';

/**
 * Game Center achievements. Each id is a vendor id in App Store Connect, and a
 * live one can't be removed, so add to this list rather than changing it.
 * Names, points and artwork live in `scripts/sync-achievements.ts`.
 */
export const ACHIEVEMENT_IDS = [
  'meterzone.games.10',
  'meterzone.games.100',
  'meterzone.games.1000',
  'meterzone.level.10',
  'meterzone.level.30',
  'meterzone.level.50',
  'meterzone.level.75',
  'meterzone.level.100',
  'meterzone.streak.5',
  'meterzone.streak.10',
  'meterzone.streak.16',
  'meterzone.streak.25',
  'meterzone.perfect.first',
  'meterzone.perfect.run10',
  'meterzone.perfect.total1000',
  'meterzone.clean.20',
  'meterzone.daily.first',
  'meterzone.daily.streak7',
  'meterzone.daily.top10',
  'meterzone.daily.first_place',
  'meterzone.skin.first',
  'meterzone.skin.gold',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export function isAchievementId(value: unknown): value is AchievementId {
  return ACHIEVEMENT_IDS.includes(value as AchievementId);
}

/** What only one moment can prove: saved progress doesn't keep these. */
export type AchievementMoment = {
  /** Perfects in the run that just ended. */
  perfects?: number;
  /** Rounds cleared in that run before losing the first life. */
  cleanRounds?: number;
  /** Final place on a closed daily board. */
  dailyRank?: number;
};

type Progress = Pick<
  PersistState,
  | 'bestComboAllTime'
  | 'bestLevel'
  | 'dailyBest'
  | 'dailyRecord'
  | 'dailyRewardDay'
  | 'dailyStreak'
  | 'totalPerfects'
  | 'totalRuns'
  | 'unlockedSkins'
>;

const RULES: Record<
  AchievementId,
  (progress: Progress, moment: AchievementMoment) => boolean
> = {
  'meterzone.games.10': (p) => p.totalRuns >= 10,
  'meterzone.games.100': (p) => p.totalRuns >= 100,
  'meterzone.games.1000': (p) => p.totalRuns >= 1000,
  'meterzone.level.10': (p) => deepestLevel(p) >= 10,
  'meterzone.level.30': (p) => deepestLevel(p) >= 30,
  'meterzone.level.50': (p) => deepestLevel(p) >= 50,
  'meterzone.level.75': (p) => deepestLevel(p) >= 75,
  'meterzone.level.100': (p) => deepestLevel(p) >= 100,
  'meterzone.streak.5': (p) => p.bestComboAllTime >= 5,
  'meterzone.streak.10': (p) => p.bestComboAllTime >= 10,
  // The streak where `comboMultiplier` reaches its ×5 cap
  'meterzone.streak.16': (p) => p.bestComboAllTime >= 16,
  'meterzone.streak.25': (p) => p.bestComboAllTime >= 25,
  'meterzone.perfect.first': (p) => p.totalPerfects >= 1,
  'meterzone.perfect.run10': (_, m) => (m.perfects ?? 0) >= 10,
  'meterzone.perfect.total1000': (p) => p.totalPerfects >= 1000,
  'meterzone.clean.20': (_, m) => (m.cleanRounds ?? 0) >= 20,
  'meterzone.daily.first': (p) => p.dailyBest.date !== '',
  'meterzone.daily.streak7': (p) => p.dailyStreak.count >= 7,
  'meterzone.daily.top10': (p) => p.dailyRewardDay !== '',
  'meterzone.daily.first_place': (_, m) => m.dailyRank === 1,
  'meterzone.skin.first': (p) => p.unlockedSkins.length > 1,
  'meterzone.skin.gold': (p) => p.unlockedSkins.includes('gold'),
};

/** `bestLevel` skips daily runs, but they count here. */
function deepestLevel(p: Progress) {
  return Math.max(p.bestLevel, p.dailyBest.level, p.dailyRecord.level);
}

/**
 * Adds whatever the player has newly earned. Returns the same state when
 * nothing changed. Saved progress is checked every time, which is also how
 * players from before achievements get credit for what they already did.
 */
export function withAchievements<
  T extends Progress & Pick<PersistState, 'earnedAchievements'>,
>(state: T, moment: AchievementMoment = {}): T {
  const earned = ACHIEVEMENT_IDS.filter(
    (id) => !state.earnedAchievements.includes(id) && RULES[id](state, moment),
  );
  if (earned.length === 0) return state;
  return {
    ...state,
    earnedAchievements: [...state.earnedAchievements, ...earned],
  };
}

/** Earned, but not yet accepted by Game Center. */
export function pendingAchievements(
  state: Pick<PersistState, 'earnedAchievements' | 'reportedAchievements'>,
): AchievementId[] {
  return state.earnedAchievements.filter(
    (id) => !state.reportedAchievements.includes(id),
  );
}

/** Today's streak of daily runs, given the one saved before this run. */
export function nextDailyStreak(
  streak: PersistState['dailyStreak'],
  day: string,
): PersistState['dailyStreak'] {
  // Same day, or a run that started before the last finish: nothing to add.
  if (day <= streak.day) return streak;
  if (streak.day === '') return { day, count: 1 };
  const next = new Date(`${streak.day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const isNextDay = next.toISOString().slice(0, 10) === day;
  return { day, count: isNextDay ? streak.count + 1 : 1 };
}
