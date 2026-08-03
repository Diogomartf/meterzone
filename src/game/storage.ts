import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SKIN } from '@/game/skins';
import { REVIEW_PROMPT_MAX } from '@/game/review';
import type { PersistState, ReviewPromptStatus, SkinId } from '@/game/types';

const KEY = 'zone-meter:persist-v1';

type DailyScore = PersistState['dailyBest'];

const EMPTY_DAILY: DailyScore = { date: '', score: 0, level: 0 };

const DEFAULT_STATE: PersistState = {
  highScore: 0,
  coins: 0,
  unlockedSkins: ['toxic'],
  equippedSkin: DEFAULT_SKIN,
  bestComboAllTime: 0,
  bestLevel: 0,
  dailyBest: { ...EMPTY_DAILY },
  dailyRecord: { ...EMPTY_DAILY },
  soundMuted: false,
  hapticsEnabled: true,
  totalRuns: 0,
  reviewPromptStatus: 'none',
  reviewPromptsShown: 0,
  reviewLastPromptAtRuns: 0,
};

function parseReviewPromptStatus(value: unknown): ReviewPromptStatus {
  if (value === 'accepted') return 'accepted';
  return 'none';
}

/** Migrate legacy declined/exhausted into prompts-shown count. */
function parseReviewPromptsShown(parsed: Record<string, unknown>): number {
  if (Number.isFinite(parsed.reviewPromptsShown as number)) {
    return Math.max(
      0,
      Math.min(REVIEW_PROMPT_MAX, Number(parsed.reviewPromptsShown)),
    );
  }
  // Legacy statuses from earlier builds
  const legacy = parsed.reviewPromptStatus;
  if (legacy === 'exhausted') return REVIEW_PROMPT_MAX;
  if (legacy === 'declined') return 1;
  if (legacy === 'accepted') return REVIEW_PROMPT_MAX;
  return 0;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseDailyScore(value: Partial<DailyScore> | undefined): DailyScore {
  if (!value) return { ...EMPTY_DAILY };
  return {
    date: value.date ?? '',
    score: Number(value.score) || 0,
    level: Number(value.level) || 0,
  };
}

function betterDaily(a: DailyScore, b: DailyScore): DailyScore {
  if (b.score > a.score) return b;
  if (b.score === a.score && b.level > a.level) return b;
  return a;
}

export async function loadPersist(): Promise<PersistState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE, unlockedSkins: [...DEFAULT_STATE.unlockedSkins] };
    const parsed = JSON.parse(raw) as Partial<PersistState>;
    const dailyBest = parseDailyScore(parsed.dailyBest);
    // Migrate older saves that only had dailyBest
    const dailyRecord = parsed.dailyRecord
      ? parseDailyScore(parsed.dailyRecord)
      : dailyBest.score > 0
        ? { ...dailyBest }
        : { ...EMPTY_DAILY };
    return {
      ...DEFAULT_STATE,
      ...parsed,
      unlockedSkins: parsed.unlockedSkins?.length
        ? (parsed.unlockedSkins as SkinId[])
        : ['toxic'],
      equippedSkin: parsed.equippedSkin ?? DEFAULT_SKIN,
      dailyBest,
      dailyRecord: betterDaily(dailyRecord, dailyBest),
      soundMuted: Boolean(parsed.soundMuted),
      hapticsEnabled: parsed.hapticsEnabled !== false,
      bestLevel: Number.isFinite(parsed.bestLevel) ? Number(parsed.bestLevel) : 0,
      totalRuns: Number.isFinite(parsed.totalRuns) ? Math.max(0, Number(parsed.totalRuns)) : 0,
      reviewPromptStatus: parseReviewPromptStatus(parsed.reviewPromptStatus),
      reviewPromptsShown: parseReviewPromptsShown(
        parsed as Record<string, unknown>,
      ),
      reviewLastPromptAtRuns: Number.isFinite(parsed.reviewLastPromptAtRuns)
        ? Math.max(0, Number(parsed.reviewLastPromptAtRuns))
        : 0,
    };
  } catch {
    return { ...DEFAULT_STATE, unlockedSkins: [...DEFAULT_STATE.unlockedSkins] };
  }
}

export async function setSoundMuted(muted: boolean): Promise<PersistState> {
  const prev = await loadPersist();
  const next = { ...prev, soundMuted: muted };
  await savePersist(next);
  return next;
}

export async function setHapticsEnabled(enabled: boolean): Promise<PersistState> {
  const prev = await loadPersist();
  const next = { ...prev, hapticsEnabled: enabled };
  await savePersist(next);
  return next;
}

export async function savePersist(state: PersistState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/** Wipe all saved progress and return fresh defaults. */
export async function clearPersist(): Promise<PersistState> {
  await AsyncStorage.removeItem(KEY);
  return {
    ...DEFAULT_STATE,
    unlockedSkins: [...DEFAULT_STATE.unlockedSkins],
  };
}

export async function commitRunResult(input: {
  score: number;
  coinsEarned: number;
  bestCombo: number;
  bestLevel: number;
  isDaily: boolean;
}): Promise<PersistState> {
  const prev = await loadPersist();
  const today = todayKey();
  const sameDailyDay = prev.dailyBest.date === today;

  let dailyBest = prev.dailyBest;
  let dailyRecord = prev.dailyRecord;

  if (input.isDaily) {
    dailyBest = {
      date: today,
      score: sameDailyDay
        ? Math.max(prev.dailyBest.score, input.score)
        : input.score,
      level: sameDailyDay
        ? Math.max(prev.dailyBest.level, input.bestLevel)
        : input.bestLevel,
    };
    dailyRecord = betterDaily(prev.dailyRecord, dailyBest);
  }

  const next: PersistState = {
    ...prev,
    // Coins kept in save data but not surfaced in UI for now
    coins: prev.coins + input.coinsEarned,
    bestComboAllTime: Math.max(prev.bestComboAllTime, input.bestCombo),
    // Normal and daily bests are tracked separately
    highScore: input.isDaily
      ? prev.highScore
      : Math.max(prev.highScore, input.score),
    bestLevel: input.isDaily
      ? prev.bestLevel
      : Math.max(prev.bestLevel, input.bestLevel),
    dailyBest,
    dailyRecord,
    totalRuns: (prev.totalRuns ?? 0) + 1,
  };
  await savePersist(next);
  return next;
}

export async function setReviewPromptStatus(
  status: ReviewPromptStatus,
): Promise<PersistState> {
  const prev = await loadPersist();
  if (status === 'accepted' && prev.reviewPromptStatus === 'accepted') {
    return prev;
  }
  const next = { ...prev, reviewPromptStatus: status };
  await savePersist(next);
  return next;
}

/**
 * User intentionally opened the review flow (soft prompt or menu).
 * Apple does not tell us if a rating was submitted — treating engage as done
 * stops further auto soft prompts.
 */
export async function markReviewAccepted(): Promise<PersistState> {
  return setReviewPromptStatus('accepted');
}

/** Record a "Not now" — advances ladder and starts the inter-prompt cooldown. */
export async function recordReviewPromptDecline(): Promise<PersistState> {
  const prev = await loadPersist();
  if (prev.reviewPromptStatus === 'accepted') return prev;
  const next: PersistState = {
    ...prev,
    reviewPromptStatus: 'none',
    reviewPromptsShown: Math.min(
      REVIEW_PROMPT_MAX,
      (prev.reviewPromptsShown ?? 0) + 1,
    ),
    reviewLastPromptAtRuns: prev.totalRuns,
  };
  await savePersist(next);
  return next;
}

export async function unlockSkin(skin: SkinId, cost: number): Promise<PersistState | null> {
  const prev = await loadPersist();
  if (prev.unlockedSkins.includes(skin)) return prev;
  if (prev.coins < cost) return null;
  const next: PersistState = {
    ...prev,
    coins: prev.coins - cost,
    unlockedSkins: [...prev.unlockedSkins, skin],
    equippedSkin: skin,
  };
  await savePersist(next);
  return next;
}

export async function equipSkin(skin: SkinId): Promise<PersistState | null> {
  const prev = await loadPersist();
  if (!prev.unlockedSkins.includes(skin)) return null;
  const next = { ...prev, equippedSkin: skin };
  await savePersist(next);
  return next;
}

export function dailySeed(): number {
  const d = todayKey();
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export { todayKey };
