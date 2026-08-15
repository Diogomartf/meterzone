export type RoundResult = 'perfect' | 'zone' | 'near' | 'miss';
export type RoundLabel =
  'Perfect' | 'Great' | 'Good' | 'Nice' | 'Close' | 'Miss';

export type RoundConfig = {
  level: number;
  /** Target center as 0–1 from bottom */
  target: number;
  /** Optional second target for moving zone */
  targetEnd?: number;
  /** Half-width of the outer Nice band (full passable zone) at start (0–1) */
  zoneHalf: number;
  /** Half-width at end of fill if shrinking */
  zoneHalfEnd?: number;
  /** Half-width of the Great band (between Nice and Perfect) (0–1) */
  greatHalf: number;
  /** Half-width of the Perfect bullseye (0–1) */
  perfectHalf: number;
  /** Fill duration in ms */
  fillMs: number;
  /** Whether zone moves during the fill */
  moving: boolean;
  /** Whether zone shrinks during the fill */
  shrinking: boolean;
  /** Visual meter scale (height/width), ~0.72–1.15 */
  meterScale: number;
};

export type RoundOutcome = {
  result: RoundResult;
  label: RoundLabel;
  fill: number;
  /** Points before combo */
  basePoints: number;
  /** Points after combo */
  points: number;
  distance: number;
  combo: number;
  multiplier: number;
  coins: number;
  /** True when this miss/near should cost a life */
  costsLife: boolean;
};

export type SessionStats = {
  attempts: number;
  hits: number;
  perfects: number;
  misses: number;
  bestCombo: number;
  coinsEarned: number;
};

export type SkinId = 'toxic' | 'lava' | 'ice' | 'gold';

/**
 * Soft review prompt — native Store Review only after `accepted`.
 * At most a few spaced asks (see REVIEW_PROMPT_MILESTONES); always + high score.
 */
export type ReviewPromptStatus = 'none' | 'accepted';

export type PersistState = {
  highScore: number;
  coins: number;
  unlockedSkins: SkinId[];
  equippedSkin: SkinId;
  bestComboAllTime: number;
  /** Deepest level reached in a normal (non-daily) run */
  bestLevel: number;
  /** Best daily score for a calendar day (today when date matches) */
  dailyBest: { date: string; score: number; level: number };
  /** Best daily score ever, with the day it was set */
  dailyRecord: { date: string; score: number; level: number };
  soundMuted: boolean;
  /** Vibration / haptic feedback during play */
  hapticsEnabled: boolean;
  /** Finished runs across all modes (normal + daily) */
  totalRuns: number;
  /** Soft “enjoying MeterZone?” — `accepted` stops auto prompts */
  reviewPromptStatus: ReviewPromptStatus;
  /**
   * Soft prompts already dismissed with Not now (0…REVIEW_PROMPT_MAX).
   * Caps lifetime auto-asks so we don't fatigue players.
   */
  reviewPromptsShown: number;
  /** totalRuns when the last soft prompt was answered (decline). */
  reviewLastPromptAtRuns: number;
  /**
   * Fills already coached with the on-screen TAP hint (0…TAP_HINT_PLAYS).
   * Advances as each fill completes so an abandoned run still counts.
   * New installs start at 0; players from before this field skip the coach.
   */
  tapHintPlays: number;
};
