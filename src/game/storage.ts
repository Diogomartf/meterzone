import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SKIN } from '@/game/skins';
import { REVIEW_PROMPT_MAX } from '@/game/review';
import { migrateTapHintPlays, nextTapHintPlays } from '@/game/tapCoach';
import type { PersistState, ReviewPromptStatus, SkinId } from '@/game/types';

const KEY = 'zone-meter:persist-v1';
/** Tiny sidecar written before the full blob so a kill cannot drop coach progress. */
const TAP_HINT_KEY = 'zone-meter:tap-hint-plays';

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
  tapHintPlays: 0,
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

function freshPersist(): PersistState {
  return {
    ...DEFAULT_STATE,
    unlockedSkins: [...DEFAULT_STATE.unlockedSkins],
  };
}

async function readTapHintSidecar(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(TAP_HINT_KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return nextTapHintPlays(n, 0);
  } catch {
    return null;
  }
}

async function applyTapHintSidecar(plays: number): Promise<number> {
  const sidecar = await readTapHintSidecar();
  if (sidecar == null) return plays;
  return Math.max(plays, sidecar);
}

export async function loadPersist(): Promise<PersistState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      const base = freshPersist();
      return {
        ...base,
        tapHintPlays: await applyTapHintSidecar(base.tapHintPlays),
      };
    }
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
      bestLevel: Number.isFinite(parsed.bestLevel)
        ? Number(parsed.bestLevel)
        : 0,
      totalRuns: Number.isFinite(parsed.totalRuns)
        ? Math.max(0, Number(parsed.totalRuns))
        : 0,
      reviewPromptStatus: parseReviewPromptStatus(parsed.reviewPromptStatus),
      reviewPromptsShown: parseReviewPromptsShown(
        parsed as Record<string, unknown>,
      ),
      reviewLastPromptAtRuns: Number.isFinite(parsed.reviewLastPromptAtRuns)
        ? Math.max(0, Number(parsed.reviewLastPromptAtRuns))
        : 0,
      tapHintPlays: await applyTapHintSidecar(migrateTapHintPlays(parsed)),
    };
  } catch {
    const base = freshPersist();
    return {
      ...base,
      tapHintPlays: await applyTapHintSidecar(base.tapHintPlays),
    };
  }
}

let persistChain: Promise<unknown> = Promise.resolve();

function withPersistLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = persistChain.then(fn, fn);
  persistChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function setSoundMuted(muted: boolean): Promise<PersistState> {
  return withPersistLock(async () => {
    const prev = await loadPersist();
    const next = { ...prev, soundMuted: muted };
    await savePersist(next);
    return next;
  });
}

export async function setHapticsEnabled(
  enabled: boolean,
): Promise<PersistState> {
  return withPersistLock(async () => {
    const prev = await loadPersist();
    const next = { ...prev, hapticsEnabled: enabled };
    await savePersist(next);
    return next;
  });
}

export async function savePersist(state: PersistState): Promise<void> {
  const tapHintPlays = nextTapHintPlays(state.tapHintPlays, 0);
  const previousSidecar = await AsyncStorage.getItem(TAP_HINT_KEY);
  // Sidecar first — a kill mid-write still keeps the coach count.
  await AsyncStorage.setItem(TAP_HINT_KEY, String(tapHintPlays));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...state, tapHintPlays }));
  } catch (error) {
    try {
      if (previousSidecar == null) {
        await AsyncStorage.removeItem(TAP_HINT_KEY);
      } else {
        await AsyncStorage.setItem(TAP_HINT_KEY, previousSidecar);
      }
    } catch {
      // Best-effort rollback; the blob write is the error to surface.
    }
    throw error;
  }
}

/** Wipe all saved progress and return fresh defaults. */
export async function clearPersist(): Promise<PersistState> {
  return withPersistLock(async () => {
    await AsyncStorage.removeItem(TAP_HINT_KEY);
    await AsyncStorage.removeItem(KEY);
    return freshPersist();
  });
}

/**
 * Persist first-play TAP coach progress.
 * Writes the tiny sidecar count before the full save blob.
 * With no argument, counts one more coached fill. With a count, keeps the
 * higher of disk and that value so an in-flight write cannot go backwards.
 */
export async function recordTapHintPlay(plays?: number): Promise<PersistState> {
  return withPersistLock(async () => {
    const prev = await loadPersist();
    const tapHintPlays =
      plays == null
        ? nextTapHintPlays(prev.tapHintPlays, 1)
        : Math.max(prev.tapHintPlays, nextTapHintPlays(plays, 0));
    if (tapHintPlays === prev.tapHintPlays) return prev;
    const next = { ...prev, tapHintPlays };
    await savePersist(next);
    return next;
  });
}

/**
 * Set the TAP coach count, including lowering it to release an unused slot.
 * Pass `expected` to no-op when disk has already moved on (a newer fill).
 */
export async function restoreTapHintPlays(
  plays: number,
  expected?: number,
): Promise<PersistState> {
  return withPersistLock(async () => {
    const prev = await loadPersist();
    if (expected != null && prev.tapHintPlays !== expected) return prev;
    const tapHintPlays = nextTapHintPlays(plays, 0);
    if (tapHintPlays === prev.tapHintPlays) return prev;
    const next = { ...prev, tapHintPlays };
    await savePersist(next);
    return next;
  });
}

export async function commitRunResult(input: {
  score: number;
  coinsEarned: number;
  bestCombo: number;
  bestLevel: number;
  isDaily: boolean;
}): Promise<PersistState> {
  return withPersistLock(async () => {
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
      // Coach progress is recorded per fill — do not fold this run's attempts
      // here or an abandoned run's fills would be forgotten, then double-counted.
      tapHintPlays: prev.tapHintPlays,
    };
    await savePersist(next);
    return next;
  });
}

export async function setReviewPromptStatus(
  status: ReviewPromptStatus,
): Promise<PersistState> {
  return withPersistLock(async () => {
    const prev = await loadPersist();
    if (status === 'accepted' && prev.reviewPromptStatus === 'accepted') {
      return prev;
    }
    const next = { ...prev, reviewPromptStatus: status };
    await savePersist(next);
    return next;
  });
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
  return withPersistLock(async () => {
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
  });
}

export async function unlockSkin(
  skin: SkinId,
  cost: number,
): Promise<PersistState | null> {
  return withPersistLock(async () => {
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
  });
}

export async function equipSkin(skin: SkinId): Promise<PersistState | null> {
  return withPersistLock(async () => {
    const prev = await loadPersist();
    if (!prev.unlockedSkins.includes(skin)) return null;
    const next = { ...prev, equippedSkin: skin };
    await savePersist(next);
    return next;
  });
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
