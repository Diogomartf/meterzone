import { registerDevMenuItems } from 'expo-dev-menu';
import { Image } from 'expo-image';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { msg, useGT, useLocale, useMessages } from 'gt-react-native';

import { setAnalyticsLanguage, track, trackScreen } from '@/analytics';
import { styles } from '@/game/gameScreenStyles';
import { CountdownBurst } from '@/game/CountdownBurst';
import { DailyCard } from '@/game/DailyCard';
import { Hearts } from '@/game/Hearts';
import { LiveBackdrop } from '@/game/LiveBackdrop';
import { MenuSheet } from '@/game/MenuSheet';
import { MissBreak } from '@/game/MissBreak';
import { PerfectSwoosh } from '@/game/PerfectSwoosh';
import { DailyRewardModal } from '@/game/DailyRewardModal';
import { previewSampleRanking } from '@/game/RankingScreen';
import { ReviewPromptModal } from '@/game/ReviewPromptModal';
import { CoinBadge, ScoreModule } from '@/game/ScoreModule';
import { TapHint, TAP_BALL_GAP } from '@/game/TapHint';
import { TapHowToLine } from '@/game/TapHowToLine';
import {
  METER_BASE_H,
  METER_BASE_W,
  METER_WRAP_EXTRA,
  meterFloor,
  meterInnerHeight,
  VerticalMeter,
} from '@/game/VerticalMeter';
import { formatScore } from '@/game/format';
import { gameHaptics, setGameHapticsEnabled } from '@/game/haptics';
import { createRng, makeRound } from '@/game/levels';
import { shouldShowReviewPrompt } from '@/game/review';
import { comboMultiplier, scoreFill, STARTING_LIVES } from '@/game/scoring';
import {
  shouldShowTapHint,
  shouldShowTapHowTo,
  tapHintAppearDelay,
} from '@/game/tapCoach';
import {
  feedbackSlotFor,
  INITIAL_COUNTDOWN,
  type Feedback,
  type FeedbackSlot,
} from '@/game/runState';
import { captureAndShare, shareScoreCaption } from '@/game/share';
import { DEFAULT_SKIN, SKIN_IDS, SKINS } from '@/game/skins';
import {
  clearPersist,
  commitRunResult,
  dailySeed,
  ensureAvatar,
  equipSkin,
  markReviewAccepted,
  recordReviewPromptDecline,
  setAvatar,
  setButtonSoundsEnabled,
  setHapticsEnabled,
  setSoundMuted,
  todayKey,
  unlockAvatarPack,
  unlockSkin,
} from '@/game/storage';
import type {
  AvatarPackId,
  PlayerAvatar,
  RoundConfig,
  RoundLabel,
  SessionStats,
  SkinId,
} from '@/game/types';
import {
  dailyRewardCoins,
  isSignedInToRanking,
  loadRanking,
  pointsToPass,
  rankingAvailable,
  signInToRanking,
  submitRunToRanking,
} from '@/game/ranking';
import { useRunState } from '@/game/useRunState';
import { MainButton } from '@/game/MainButton';
import { MenuIcon } from '@/game/MenuIcon';
import {
  ResultScreen,
  type DailyRank,
  type RunResult,
} from '@/game/ResultScreen';
import { useDailyReward } from '@/game/useDailyReward';
import { useAchievements } from '@/game/useAchievements';
import { useAvatarSync } from '@/game/useAvatarSync';
import { usePersistState } from '@/game/usePersistState';
import { useSounds } from '@/game/useSounds';
import { useTapCoach } from '@/game/useTapCoach';
import { resetScreenshotAutoplay, useMeterTap } from '@/game/useMeterTap';

const LOGO = require('../../assets/images/zone-meter-logo.webp');
const FEEDBACK_EMAIL = 'hello@meterzone.net';

const DAILY_ICON = require('../../assets/images/daily-card-calendar.webp');
/** Each skin's backdrop; every one keeps the pad at the same height. */
const SKIN_BG: Record<SkinId, number> = {
  toxic: require('../../assets/images/game-bg.webp'),
  lava: require('../../assets/images/game-bg-lava.webp'),
  ice: require('../../assets/images/game-bg-ice.webp'),
  gold: require('../../assets/images/game-bg-gold.webp'),
};
/** Pad surface in the backdrops (fraction of image height from top). */
const PAD_SURFACE_Y = 0.905;
/** Extra lift so the meter sits above the pad. */
const METER_LIFT = 16;
/** Least space between the home cards and PLAY. */
const HOME_PLAY_GAP = 16;

/**
 * Run pacing, in ms. These are the knobs that decide how the game *feels*
 * between taps — kept together so pacing can be tuned in one place rather than
 * hunted through the flow. Per-animation easing curves stay at their call sites.
 */
const TIMING = {
  /** Brief freeze after the meter lands so short zones can be read before fill. */
  levelReadPause: 139,
  /** Gap between countdown numbers. */
  countdownTick: 560,
  /** Beat after "GO!" before the fill starts. */
  countdownToFill: 520,
  /** Hold on the result before the next meter — a Perfect gets to breathe. */
  advanceAfterHit: 480,
  advanceAfterPerfect: 900,
  advanceAfterMiss: 620,
  /** Settle time after closing the menu before the queued advance resumes. */
  advanceAfterResume: 200,
  /** Meter slide-out, then the next one slides in. */
  meterSlideOut: 220,
  meterSlideIn: 340,
  /** Let the results screen land before asking for a review. */
  reviewPromptDelay: 900,
} as const;

/** Off-screen X the meter slides between. */
const METER_ENTER_X = 340;
const METER_EXIT_X = -360;

const FEEDBACK_SLOT_STYLE: Record<
  FeedbackSlot,
  {
    top: `${number}%`;
    left?: number;
    right?: number;
    alignItems: 'flex-start' | 'flex-end';
  }
> = {
  left: { top: '44%', left: 10, alignItems: 'flex-start' },
  right: { top: '44%', right: 10, alignItems: 'flex-end' },
};

/**
 * Shown-to-player wording for each judgement. `RoundLabel` stays the internal
 * key so scoring and haptics keep comparing against stable English values.
 */
const LABEL_TEXT: Record<RoundLabel, string> = {
  Perfect: msg('PERFECT'),
  Great: msg('GREAT'),
  Good: msg('GOOD'),
  Nice: msg('NICE'),
  Close: msg('CLOSE'),
  Miss: msg('MISS'),
};

/** Stable so the hit layer's props do not churn between renders. */
const ACTIVATE_ACTION = [{ name: 'activate' as const }];

const LABEL_COLORS: Record<RoundLabel, string> = {
  Perfect: '#FFE14A',
  Great: '#E24B2D',
  Good: '#58CC02',
  Nice: '#1B3A8C',
  Close: '#FFC800',
  Miss: '#6B7280',
};

/**
 * The shared values that describe where the zone sits and how it travels
 * during a fill. Bundled so the writer below can live at module scope: a
 * component-level function would have to name every one of these in a hook
 * dependency array, and React Compiler refuses to compile a component that
 * mutates values listed as dependencies.
 */
type ZoneMotion = {
  zoneTarget: SharedValue<number>;
  zoneHalf: SharedValue<number>;
  zoneFrom: SharedValue<number>;
  zoneTo: SharedValue<number>;
  zoneMoves: SharedValue<number>;
  halfFrom: SharedValue<number>;
  halfTo: SharedValue<number>;
  zoneShrinks: SharedValue<number>;
};

/**
 * The fill is the game clock, not decoration. Reanimated's default
 * (`ReduceMotion.System`) jumps every animation straight to its end value when
 * iOS Reduce Motion is on, which filled the meter to 100% on the first frame
 * and made every round a miss.
 */
const FILL_EASING = Easing.bezier(0.2, 0.05, 0.35, 1);
const fillTiming = (duration: number) => ({
  duration,
  easing: FILL_EASING,
  reduceMotion: ReduceMotion.Never,
});

/** Point the painted zone at a round's start/end geometry. */
function syncZoneMotion(zone: ZoneMotion, config: RoundConfig) {
  zone.zoneFrom.set(config.target);
  zone.zoneTo.set(config.targetEnd ?? config.target);
  zone.zoneMoves.set(config.moving && config.targetEnd != null ? 1 : 0);
  zone.halfFrom.set(config.zoneHalf);
  zone.halfTo.set(config.zoneHalfEnd ?? config.zoneHalf);
  zone.zoneShrinks.set(config.shrinking && config.zoneHalfEnd != null ? 1 : 0);
  zone.zoneTarget.set(config.target);
  zone.zoneHalf.set(config.zoneHalf);
}

export function GameScreen() {
  const gt = useGT();
  const m = useMessages();
  /** Flag of the language in play — the home-screen shortcut into the picker. */
  const insets = useSafeAreaInsets();
  const { height: windowH, width: windowW } = useWindowDimensions();
  const { persist, persistRef, applyPersist } = usePersistState();
  const muted = Boolean(persist?.soundMuted);
  const buttonSounds = persist?.buttonSoundsEnabled !== false;
  const { play } = useSounds(muted, buttonSounds);

  const locale = useLocale();
  useEffect(() => {
    setAnalyticsLanguage(locale);
  }, [locale]);

  const [state, dispatch, stateRef] = useRunState();
  const {
    phase,
    round,
    score,
    lives,
    combo,
    countdown,
    stats,
    dailyMode,
    isNewBest,
    feedback,
    paused: menuOpen,
  } = state;

  const {
    coachThisFill,
    howToThisRun,
    hintThisRun,
    fillCycle,
    beginFill,
    endFill,
    beginRun: beginCoachRun,
    haltCoach,
    onHintPlayed,
    flushCoachWrite,
  } = useTapCoach({
    persist,
    persistRef,
    applyPersist,
    phase,
    paused: menuOpen,
  });

  /** Best (for the played mode) at the moment a finished run is committed. */
  const [previousBest, setPreviousBest] = useState(0);
  const [perfectBurstKey, setPerfectBurstKey] = useState(0);
  const [missBurstKey, setMissBurstKey] = useState(0);
  const shareRef = useRef<View>(null);
  const [menuInitialView, setMenuInitialView] = useState<
    'menu' | 'highscores' | 'language' | 'skins' | 'ranking'
  >('menu');
  const [capturingShare, setCapturingShare] = useState(false);
  /** Where today's daily run landed on the board, for the game-over line. */
  const [dailyRank, setDailyRank] = useState<DailyRank | null>(null);
  /** Dev-menu skin preview: shows a look on the meter without unlocking it. */
  const [devSkin, setDevSkin] = useState<SkinId | null>(null);
  // Where the home cards end and how tall PLAY is, so PLAY never sits on them.
  const [homeCardsBottom, setHomeCardsBottom] = useState(0);
  const [playH, setPlayH] = useState(0);
  /** Dev-menu preview of the result screen, with sample numbers. */
  const [resultPreview, setResultPreview] = useState<RunResult | null>(null);
  /** The daily rank line a dev-menu preview shows, since previews never load one. */
  const [previewRank, setPreviewRank] = useState<DailyRank | null>(null);
  const [reviewPromptVisible, setReviewPromptVisible] = useState(false);
  const reviewPromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fill = useSharedValue(0);
  const zoneTarget = useSharedValue(round.target);
  const zoneHalf = useSharedValue(round.zoneHalf);
  // Zone motion params — driven from fill so visuals match scoreFill/zoneAt
  const zoneFrom = useSharedValue(round.target);
  const zoneTo = useSharedValue(round.target);
  const zoneMoves = useSharedValue(0);
  const halfFrom = useSharedValue(round.zoneHalf);
  const halfTo = useSharedValue(round.zoneHalf);
  const zoneShrinks = useSharedValue(0);
  const meterX = useSharedValue(0);
  // Bumped whenever a run is halted. Meter-slide callbacks carry the value
  // from when they started and do nothing if it has changed since, so a slide
  // that finishes just after the player leaves can't spawn a round on home.
  const runTokenRef = useRef(0);
  const feedbackOpacity = useSharedValue(0);
  const feedbackScale = useSharedValue(0.7);
  const comboPulse = useSharedValue(1);
  const comboLabelOpacity = useSharedValue(0);
  const newBestPulse = useSharedValue(1);
  const isFilling = useSharedValue(0);

  const zone = useMemo(
    () => ({
      zoneTarget,
      zoneHalf,
      zoneFrom,
      zoneTo,
      zoneMoves,
      halfFrom,
      halfTo,
      zoneShrinks,
    }),
    [
      zoneTarget,
      zoneHalf,
      zoneFrom,
      zoneTo,
      zoneMoves,
      halfFrom,
      halfTo,
      zoneShrinks,
    ],
  );

  /** Best score at run start — used to detect a live / final new high. */
  const runBestBaselineRef = useRef(0);
  /**
   * UTC day the run started on — it picks the daily sequence, so a daily run
   * belongs to that day's challenge even if it ends after midnight.
   */
  const runDayRef = useRef(todayKey());
  /** "COMBO" label only once per streak, then multiplier alone */
  const comboIntroShownRef = useRef(false);
  const rngRef = useRef<() => number>(Math.random);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});
  const startFillRef = useRef<() => void>(() => {});
  const runCountdownFromRef = useRef<(at: number) => void>(() => {});
  /** GO already played the start sting — the fill that follows must not replay it. */
  const fillAfterGoRef = useRef(false);

  const skin = SKINS[devSkin ?? persist?.equippedSkin ?? DEFAULT_SKIN];

  useEffect(() => {
    syncZoneMotion(zone, round);
  }, [round, zone]);

  // Sign in once the saved bests are loaded so they can be backfilled.
  const rankingSignInStarted = useRef(false);
  const [rankingSignInDone, setRankingSignInDone] = useState(false);
  useEffect(() => {
    if (!persist || rankingSignInStarted.current) return;
    rankingSignInStarted.current = true;
    void signInToRanking(persist).then(() => setRankingSignInDone(true));
  }, [persist]);

  const dailyReward = useDailyReward(rankingSignInDone, applyPersist);
  useAchievements(persist, rankingSignInDone);
  useAvatarSync(persist, rankingSignInDone);

  useEffect(() => {
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (countTimer.current) clearTimeout(countTimer.current);
    };
  }, []);

  /** Animation side of a judged round — the chip itself lives in run state. */
  const showFeedback = (next: Omit<Feedback, 'slot'>) => {
    const isPerfect = next.label === 'Perfect';
    const isMiss = next.label === 'Miss';

    const pulseCombo = (showIntro: boolean) => {
      comboPulse.set(
        withSequence(
          withTiming(1.28, { duration: 120, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        ),
      );
      if (!showIntro) return;
      // First streak only — then just the multiplier
      comboLabelOpacity.set(0);
      comboLabelOpacity.set(
        withSequence(
          withTiming(1, { duration: 90 }),
          withDelay(
            650,
            withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
          ),
        ),
      );
      comboIntroShownRef.current = true;
    };

    if (next.combo <= 1) {
      comboIntroShownRef.current = false;
      comboLabelOpacity.set(0);
    }

    // Perfect / Miss get dedicated center callouts; others keep side chips
    if (isPerfect) {
      feedbackOpacity.set(0);
      setPerfectBurstKey((k) => k + 1);
      if (next.comboGrew && next.combo > 1) {
        pulseCombo(!comboIntroShownRef.current);
      }
      return;
    }

    if (isMiss) {
      feedbackOpacity.set(0);
      setMissBurstKey((k) => k + 1);
      comboLabelOpacity.set(0);
      comboIntroShownRef.current = false;
      return;
    }

    feedbackOpacity.set(0);
    feedbackScale.set(0.55);
    feedbackOpacity.set(
      withSequence(
        withTiming(1, { duration: 90 }),
        withDelay(520, withTiming(0, { duration: 260 })),
      ),
    );
    feedbackScale.set(
      withSequence(
        withTiming(1.18, { duration: 140, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    if (next.comboGrew && next.combo > 1) {
      pulseCombo(!comboIntroShownRef.current);
    }
  };

  const announceNewBest = () => {
    // `isNewBest` doubles as the "already announced" latch — the reducer makes
    // the action a no-op once it is set, so the cue fires once per run.
    if (stateRef.current.isNewBest) return;
    dispatch({ type: 'announceNewBest' });
    newBestPulse.set(
      withSequence(
        withTiming(1.22, { duration: 140, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    void gameHaptics.result('Great');
  };

  /**
   * After a daily run of today's sequence, looks up the player's place on the
   * daily board for the game-over line. Signed-out players get an invite
   * instead; offline or unranked shows nothing. Ignored once they've left.
   */
  const showDailyRank = async (submitted: Promise<void>) => {
    const isToday =
      stateRef.current.dailyMode && runDayRef.current === todayKey();
    if (!rankingAvailable || !isToday) {
      setDailyRank(null);
      return;
    }
    if (!isSignedInToRanking()) {
      setDailyRank({ kind: 'signedOut' });
      return;
    }
    const token = runTokenRef.current;
    setDailyRank({ kind: 'checking' });
    // Read the board after the score is in, or it may show the old place.
    await submitted;
    const board = await loadRanking('daily').catch(() => null);
    if (token !== runTokenRef.current) return;
    setDailyRank(
      board?.you
        ? {
            kind: 'placed',
            rank: board.you.rank,
            toNext: pointsToPass(board.you, board.above),
          }
        : null,
    );
  };

  const endRun = async (finalScore: number, session: SessionStats) => {
    // Snapshot the pre-run best so the results screen can show the record
    // that was standing (previous score / difference from it).
    setPreviousBest(runBestBaselineRef.current);
    await flushCoachWrite();
    const next = await commitRunResult({
      score: finalScore,
      coinsEarned: session.coinsEarned,
      bestCombo: session.bestCombo,
      bestLevel: stateRef.current.round.level,
      isDaily: stateRef.current.dailyMode,
      perfects: session.perfects,
      cleanRounds: session.cleanRounds,
      day: runDayRef.current,
    });
    applyPersist(next);
    const submitted = submitRunToRanking(
      finalScore,
      stateRef.current.dailyMode,
      runDayRef.current,
      next.avatar,
    );
    void showDailyRank(submitted);
    const beatBest = finalScore > 0 && finalScore >= runBestBaselineRef.current;
    dispatch({ type: 'gameOver', isNewBest: beatBest });
    track('game_ended', {
      mode: stateRef.current.dailyMode ? 'daily' : 'normal',
      score: finalScore,
      level: stateRef.current.round.level,
      coins_earned: session.coinsEarned,
      best_combo: session.bestCombo,
      is_new_best: beatBest,
      total_runs: next.totalRuns,
    });

    // Soft prompt only — native Store Review waits for a positive tap.
    if (shouldShowReviewPrompt(next, { isNewHighScore: beatBest })) {
      if (reviewPromptTimer.current) clearTimeout(reviewPromptTimer.current);
      reviewPromptTimer.current = setTimeout(() => {
        reviewPromptTimer.current = null;
        track('review_prompt_shown', { total_runs: next.totalRuns });
        setReviewPromptVisible(true);
      }, TIMING.reviewPromptDelay);
    }
  };

  useEffect(() => {
    return () => {
      if (reviewPromptTimer.current) clearTimeout(reviewPromptTimer.current);
    };
  }, []);

  const analyticsScreen =
    phase === 'ready' ? 'home' : phase === 'gameover' ? 'game_over' : 'game';
  useEffect(() => {
    trackScreen(analyticsScreen);
  }, [analyticsScreen]);

  const onReviewAccept = () => {
    setReviewPromptVisible(false);
    // Persist before native UI so we never re-prompt even if they bounce.
    void markReviewAccepted().then(applyPersist);
  };

  const onReviewDecline = () => {
    setReviewPromptVisible(false);
    void recordReviewPromptDecline().then(applyPersist);
  };

  /**
   * Queue the move to the next meter. If the menu opens before it fires, the
   * advance is parked on the run state and replayed when the sheet closes.
   */
  const scheduleAdvance = (delayMs: number) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    dispatch({ type: 'pendingTimer', pending: 'advance' });
    autoTimer.current = setTimeout(() => {
      dispatch({ type: 'pendingTimer', pending: null });
      if (stateRef.current.paused) {
        dispatch({ type: 'park', resume: { kind: 'advance' } });
        return;
      }
      advanceRef.current();
    }, delayMs);
  };

  const finishRound = (value: number) => {
    const before = stateRef.current;
    const result = scoreFill(value, before.round, before.combo);
    const comboGrew = result.combo > before.combo;
    isFilling.set(0);
    void gameHaptics.result(result.label === 'Close' ? 'Nice' : result.label);

    // One dispatch folds combo, score, lives, stats, phase and the callout
    // together, so they can never be left half-applied. Everything below is a
    // side effect and stays out of it.
    dispatch({
      type: 'scored',
      result,
      feedback: {
        label: result.label,
        points: result.points,
        combo: result.combo,
        comboGrew,
        slot: feedbackSlotFor(result.label),
      },
    });
    const after = stateRef.current;
    endFill();

    showFeedback({
      label: result.label,
      points: result.points,
      combo: result.combo,
      comboGrew,
    });

    if (result.costsLife) {
      play('miss');
      if (after.lives <= 0) {
        void endRun(after.score, after.stats);
      } else {
        scheduleAdvance(TIMING.advanceAfterMiss);
      }
      return;
    }

    play(result.result === 'perfect' ? 'perfect' : 'zone');
    if (after.score > runBestBaselineRef.current) {
      announceNewBest();
    }
    scheduleAdvance(
      result.result === 'perfect'
        ? TIMING.advanceAfterPerfect
        : TIMING.advanceAfterHit,
    );
  };

  const startFill = () => {
    if (stateRef.current.paused) {
      dispatch({ type: 'park', resume: { kind: 'startFill' } });
      return;
    }
    const current = stateRef.current.round;
    beginFill();

    dispatch({ type: 'clearFeedback' });
    feedbackOpacity.set(0);
    dispatch({ type: 'phase', phase: 'filling' });
    isFilling.set(1);
    syncZoneMotion(zone, current);
    fill.set(0);
    const fromGo = fillAfterGoRef.current;
    fillAfterGoRef.current = false;
    if (!fromGo) play('start');
    void gameHaptics.start();
    fill.set(
      withTiming(1, fillTiming(current.fillMs), (finished) => {
        if (!finished) return;
        // Drop the UI-thread lock here, not in `finishRound`. The round is
        // over the moment the fill lands; leaving `isFilling` set until the
        // JS thread gets around to `finishRound` leaves a window where a tap
        // passes the gesture's guard and scores the same round a second time.
        isFilling.set(0);
        runOnJS(finishRound)(1);
      }),
    );
  };

  // No dep array on purpose: these three refs exist to break definition-order
  // cycles, and must always point at the newest closure. React Compiler keeps
  // the function identities stable, so this is a ref write, not a re-subscribe.
  useEffect(() => {
    startFillRef.current = startFill;
  });

  const runCountdownFrom = (current: number) => {
    if (countTimer.current) clearTimeout(countTimer.current);

    if (current <= 0) {
      fillAfterGoRef.current = true;
      dispatch({ type: 'pendingTimer', pending: 'startFill' });
      countTimer.current = setTimeout(() => {
        dispatch({ type: 'pendingTimer', pending: null });
        if (stateRef.current.paused) {
          dispatch({ type: 'park', resume: { kind: 'startFill' } });
          return;
        }
        startFillRef.current();
      }, TIMING.countdownToFill);
      return;
    }

    dispatch({ type: 'pendingTimer', pending: 'countdown' });
    countTimer.current = setTimeout(() => {
      dispatch({ type: 'pendingTimer', pending: null });
      if (stateRef.current.paused) {
        dispatch({
          type: 'park',
          resume: { kind: 'countdown', countAt: current },
        });
        return;
      }
      const next = current - 1;
      dispatch({ type: 'countdown', value: next });
      if (next > 0) {
        play('tick');
        void gameHaptics.countdownTick(next);
        runCountdownFromRef.current(next);
      } else {
        play('start');
        void gameHaptics.countdownTick(0);
        runCountdownFromRef.current(0);
      }
    }, TIMING.countdownTick);
  };

  useEffect(() => {
    runCountdownFromRef.current = runCountdownFrom;
  });

  const beginRound = (next: RoundConfig, animateIn: boolean) => {
    dispatch({ type: 'beginRound', round: next });
    fill.set(0);
    syncZoneMotion(zone, next);

    // Only countdown on the very first meter of a run
    if (next.level === 1) {
      meterX.set(0);
      dispatch({ type: 'phase', phase: 'countdown' });
      dispatch({ type: 'countdown', value: INITIAL_COUNTDOWN });
      play('tick');
      void gameHaptics.countdownTick(INITIAL_COUNTDOWN);
      runCountdownFromRef.current(INITIAL_COUNTDOWN);
      return;
    }

    // Later levels: land the meter, pause so the zone is readable, then fill
    const token = runTokenRef.current;
    const startAfterReadPause = (from: number) => {
      if (from !== runTokenRef.current) return;
      if (stateRef.current.paused) {
        dispatch({ type: 'park', resume: { kind: 'startFill' } });
        return;
      }
      if (countTimer.current) clearTimeout(countTimer.current);
      dispatch({ type: 'pendingTimer', pending: 'startFill' });
      countTimer.current = setTimeout(() => {
        dispatch({ type: 'pendingTimer', pending: null });
        if (stateRef.current.paused) {
          dispatch({ type: 'park', resume: { kind: 'startFill' } });
          return;
        }
        startFillRef.current();
      }, TIMING.levelReadPause);
    };

    if (animateIn) {
      meterX.set(METER_ENTER_X);
      meterX.set(
        withTiming(
          0,
          { duration: TIMING.meterSlideIn, easing: Easing.out(Easing.cubic) },
          (done) => {
            if (done) runOnJS(startAfterReadPause)(token);
          },
        ),
      );
    } else {
      meterX.set(0);
      startAfterReadPause(token);
    }
  };

  const spawnNextLevel = () => {
    const current = stateRef.current.round;
    const next = makeRound(current.level + 1, {
      previousTarget: current.target,
      rng: rngRef.current,
    });
    beginRound(next, true);
  };

  const onMeterSlidOut = (from: number) => {
    if (from !== runTokenRef.current) return;
    if (stateRef.current.paused) {
      dispatch({ type: 'park', resume: { kind: 'advance' } });
      return;
    }
    spawnNextLevel();
  };

  const advanceLevel = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    dispatch({ type: 'pendingTimer', pending: null });
    // Slide current meter out, then bring next in
    const token = runTokenRef.current;
    meterX.set(
      withTiming(
        METER_EXIT_X,
        { duration: TIMING.meterSlideOut, easing: Easing.in(Easing.cubic) },
        (done) => {
          if (done) runOnJS(onMeterSlidOut)(token);
        },
      ),
    );
  };

  useEffect(() => {
    advanceRef.current = advanceLevel;
  });

  const onZoneEnter = () => {
    void gameHaptics.zoneEnter();
  };

  /**
   * The only per-frame reaction on `fill`. It was two — one lerping the zone,
   * one watching for the zone-enter haptic — which meant two worklet
   * invocations and two sets of shared-value reads every frame of every fill.
   * The order inside matters: the zone has to be moved to this frame's
   * position before the crossing is judged against it.
   */
  useAnimatedReaction(
    () => fill.value,
    (value, prev) => {
      // Skip the writes when the zone is static; the crossing check below
      // still runs, since a fixed zone is crossed just the same.
      if (zoneMoves.value) {
        zoneTarget.set(
          zoneFrom.value + (zoneTo.value - zoneFrom.value) * value,
        );
      }
      if (zoneShrinks.value) {
        zoneHalf.set(halfFrom.value + (halfTo.value - halfFrom.value) * value);
      }

      if (isFilling.value !== 1 || prev == null) return;
      const low = zoneTarget.value - zoneHalf.value;
      if (prev < low && value >= low) runOnJS(onZoneEnter)();
    },
    [onZoneEnter],
  );

  /**
   * Stop every pending timer and in-flight animation and drop the pause state,
   * so nothing queued from the previous run can fire into the next one.
   */
  const haltRun = () => {
    runTokenRef.current += 1;
    haltCoach();
    if (countTimer.current) clearTimeout(countTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    countTimer.current = null;
    autoTimer.current = null;
    fillAfterGoRef.current = false;
    // Drops the pause, the parked resume and the pending timer in one step.
    dispatch({ type: 'resume' });
    dispatch({ type: 'pendingTimer', pending: null });
    cancelAnimation(meterX);
    meterX.set(0);
    cancelAnimation(fill);
  };

  /** Reset the animation layer that sits alongside run state. */
  const resetRunVisuals = () => {
    comboIntroShownRef.current = false;
    comboLabelOpacity.set(0);
    newBestPulse.set(1);
    feedbackOpacity.set(0);
    isFilling.set(0);
    meterX.set(0);
  };

  /** Back to the home screen with a fresh idle meter. */
  const resetToIdle = () => {
    haltRun();
    resetRunVisuals();
    fill.set(0);
    rngRef.current = Math.random;
    const idle = makeRound(1);
    dispatch({ type: 'idle', round: idle });
    syncZoneMotion(zone, idle);
  };

  const startRun = (daily: boolean) => {
    haltRun();
    resetRunVisuals();
    beginCoachRun(persistRef.current?.totalRuns ?? persist?.totalRuns ?? 0);
    resetScreenshotAutoplay();
    runDayRef.current = todayKey();
    dispatch({ type: 'startRun', daily });
    track('game_started', {
      mode: daily ? 'daily' : 'normal',
      total_runs: persistRef.current?.totalRuns ?? 0,
    });
    rngRef.current = daily
      ? createRng(dailySeed(runDayRef.current))
      : Math.random;
    runBestBaselineRef.current = daily
      ? persist?.dailyBest.date === todayKey()
        ? persist.dailyBest.score
        : 0
      : (persist?.highScore ?? 0);
    beginRound(makeRound(1, { rng: rngRef.current }), false);
  };

  const resumeFillFrom = (from: number) => {
    const current = stateRef.current.round;
    const remaining = Math.max(90, Math.round(current.fillMs * (1 - from)));
    dispatch({ type: 'phase', phase: 'filling' });
    isFilling.set(1);
    fill.set(from);
    fill.set(
      withTiming(1, fillTiming(remaining), (finished) => {
        if (!finished) return;
        // Drop the UI-thread lock here, not in `finishRound`. The round is
        // over the moment the fill lands; leaving `isFilling` set until the
        // JS thread gets around to `finishRound` leaves a window where a tap
        // passes the gesture's guard and scores the same round a second time.
        isFilling.set(0);
        runOnJS(finishRound)(1);
      }),
    );
  };

  const openMenu = () => {
    void gameHaptics.next();

    // Freeze the meter before dispatching so the parked position is the exact
    // one the player last saw.
    let fillAt = 0;
    if (stateRef.current.phase === 'filling') {
      fillAt = fill.value;
      cancelAnimation(fill);
      fill.set(fillAt);
      isFilling.set(0);
    }
    // The reducer decides what to park from the current phase / pending timer.
    dispatch({ type: 'pause', fillAt });

    if (countTimer.current) {
      clearTimeout(countTimer.current);
      countTimer.current = null;
    }
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }

    // Freeze any in-flight meter slide. cancelAnimation already pins meterX at
    // its current value, which is what an `advance` resume wants — only a
    // pending startFill needs the meter snapped back to centre.
    cancelAnimation(meterX);
    if (stateRef.current.pauseResume?.kind === 'startFill') {
      meterX.set(0);
    }
  };

  // Dev-menu shortcuts (Cmd+D in the simulator) to open the cards that
  // otherwise need a real top-ten finish or a run of good games.
  const previewDailyReward = dailyReward.preview;
  const openSampleRanking = useEffectEvent((players: number, you: number) => {
    previewSampleRanking(players, you);
    setMenuInitialView('ranking');
    openMenu();
  });
  const openBestScores = useEffectEvent(() => {
    setMenuInitialView('highscores');
    openMenu();
  });
  useEffect(() => {
    if (!__DEV__) return;
    const reward = (rank: number) => ({
      name: `Reward card · #${rank}`,
      callback: () =>
        previewDailyReward({
          day: 'preview',
          rank,
          coins: dailyRewardCoins(rank),
        }),
      shouldCollapse: true,
    });
    const preview = (
      name: string,
      run: Pick<RunResult, 'daily' | 'isNewBest' | 'score' | 'best'>,
      rank: DailyRank | null = null,
    ) => ({
      name,
      callback: () => {
        setPreviewRank(rank);
        setResultPreview({
          ...run,
          day: todayKey(),
          accuracy: 72,
          combo: 5,
          level: 9,
          coinsEarned: 18,
        });
      },
      shouldCollapse: true,
    });
    // One entry per screen first; their variants after, so the list starts
    // with everything there is to look at.
    void registerDevMenuItems([
      preview('Game over', {
        daily: false,
        isNewBest: false,
        score: 655,
        best: 4861,
      }),
      preview('New record', {
        daily: false,
        isNewBest: true,
        score: 5120,
        best: 4861,
      }),
      preview('Daily new record', {
        daily: true,
        isNewBest: true,
        score: 230,
        best: 0,
      }),
      reward(1),
      {
        name: 'Review prompt',
        callback: () => setReviewPromptVisible(true),
        shouldCollapse: true,
      },
      {
        name: 'Ranking · 8 players, you #5',
        callback: () => openSampleRanking(8, 5),
        shouldCollapse: true,
      },
      {
        name: 'Best scores',
        callback: () => openBestScores(),
        shouldCollapse: true,
      },
      preview('Game over · daily', {
        daily: true,
        isNewBest: false,
        score: 120,
        best: 230,
      }),
      preview('Daily new record · beat best', {
        daily: true,
        isNewBest: true,
        score: 1840,
        best: 1215,
      }),
      preview(
        'Daily rank · #7, 120 to #6',
        { daily: true, isNewBest: false, score: 1120, best: 1215 },
        { kind: 'placed', rank: 7, toNext: 120 },
      ),
      preview(
        'Daily rank · #1',
        { daily: true, isNewBest: true, score: 1840, best: 1215 },
        { kind: 'placed', rank: 1, toNext: null },
      ),
      preview(
        'Daily rank · checking',
        { daily: true, isNewBest: false, score: 1120, best: 1215 },
        { kind: 'checking' },
      ),
      preview(
        'Daily rank · signed out',
        { daily: true, isNewBest: false, score: 1120, best: 1215 },
        { kind: 'signedOut' },
      ),
      reward(2),
      reward(3),
      reward(7),
      {
        name: 'Ranking · 30 players, you #23',
        callback: () => openSampleRanking(30, 23),
        shouldCollapse: true,
      },
      // Try every meter look without coins; nothing is saved.
      ...SKIN_IDS.map((id) => ({
        name: `Skin · ${SKINS[id].name}`,
        callback: () => setDevSkin(id),
        shouldCollapse: true,
      })),
      {
        name: 'Skin · equipped',
        callback: () => setDevSkin(null),
        shouldCollapse: true,
      },
    ]);
  }, [previewDailyReward]);

  const openScores = () => {
    setMenuInitialView('highscores');
    openMenu();
  };

  const openSkins = () => {
    void gameHaptics.next();
    setMenuInitialView('skins');
    openMenu();
  };

  const onUnlockSkin = (id: SkinId) => {
    void (async () => {
      const next = await unlockSkin(id, SKINS[id].cost);
      if (!next) {
        void gameHaptics.result('Miss');
        return;
      }
      applyPersist(next);
      track('skin_unlocked', { skin: id, cost: SKINS[id].cost });
      void gameHaptics.result('Great');
    })();
  };

  const onEquipSkin = (id: SkinId) => {
    void (async () => {
      const next = await equipSkin(id);
      if (!next) return;
      applyPersist(next);
      track('skin_equipped', { skin: id });
      void gameHaptics.next();
    })();
  };

  const onSelectAvatar = (avatar: PlayerAvatar) => {
    void (async () => {
      const next = await setAvatar(avatar);
      if (!next) return;
      applyPersist(next);
      void gameHaptics.next();
    })();
  };

  const onUnlockAvatarPack = (id: AvatarPackId) => {
    void (async () => {
      const next = await unlockAvatarPack(id);
      if (!next) {
        void gameHaptics.result('Miss');
        return;
      }
      applyPersist(next);
      track('avatar_pack_unlocked', { pack: id });
      void gameHaptics.result('Great');
    })();
  };

  const closeMenu = () => {
    // Read the parked resume before dispatching — `resume` clears it.
    const resume = stateRef.current.pauseResume;
    dispatch({ type: 'resume' });
    if (!resume) return;

    if (resume.kind === 'fill') {
      resumeFillFrom(resume.fillAt);
      return;
    }
    if (resume.kind === 'countdown') {
      runCountdownFromRef.current(resume.countAt);
      return;
    }
    if (resume.kind === 'startFill') {
      meterX.set(0);
      startFillRef.current();
      return;
    }
    if (resume.kind === 'advance') {
      autoTimer.current = setTimeout(
        () => advanceRef.current(),
        TIMING.advanceAfterResume,
      );
    }
  };

  const toggleSound = async () => {
    const next = await setSoundMuted(!(persist?.soundMuted ?? false));
    applyPersist(next);
    void gameHaptics.next();
  };

  const toggleButtonSounds = async () => {
    const next = await setButtonSoundsEnabled(!buttonSounds);
    applyPersist(next);
    void gameHaptics.next();
  };

  const toggleHaptics = async () => {
    const enabled = !(persist?.hapticsEnabled !== false);
    setGameHapticsEnabled(enabled);
    const next = await setHapticsEnabled(enabled);
    applyPersist(next);
    if (enabled) void gameHaptics.next();
  };

  const goBackFromMenu = () => {
    void gameHaptics.next();
    resetToIdle();
  };

  const startModeFromMenu = (daily: boolean) => {
    void gameHaptics.next();
    startRun(daily);
  };

  const sendFeedback = async () => {
    void gameHaptics.next();
    const subject = encodeURIComponent('MeterZone feedback');
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;
    try {
      // Don't gate on canOpenURL — iOS returns false for mailto: unless the
      // scheme is listed in LSApplicationQueriesSchemes.
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        gt('Feedback'),
        gt('Email us at {email}', {
          email: FEEDBACK_EMAIL,
        }),
      );
    }
  };

  const deleteData = async () => {
    void gameHaptics.next();
    const next = await clearPersist();
    applyPersist(next);
    // A fresh start gets a fresh random avatar, like a first launch.
    void ensureAvatar().then(applyPersist);
    setGameHapticsEnabled(next.hapticsEnabled !== false);
    resetToIdle();
  };

  /**
   * Everything after the meter is already frozen. Sound, haptics and scoring
   * are JS-side work that no longer sits between the finger and the stop.
   */
  const onTapSettled = (stoppedAt: number) => {
    play('tap');
    void gameHaptics.stop();
    finishRound(stoppedAt);
  };

  const { gesture: tapGesture, activate: activateTap } = useMeterTap({
    fill,
    isFilling,
    zoneTarget,
    zoneHalf,
    zoneFrom,
    zoneTo,
    zoneMoves,
    halfFrom,
    halfTo,
    zoneShrinks,
    onSettled: onTapSettled,
  });

  const meterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: meterX.value }],
  }));
  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: [{ scale: feedbackScale.value }],
  }));
  const comboBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: windowW * 0.3 }, { scale: comboPulse.value }],
  }));
  const comboLabelStyle = useAnimatedStyle(() => ({
    opacity: comboLabelOpacity.value,
    height: comboLabelOpacity.value * 18,
    marginBottom: comboLabelOpacity.value * 2,
    overflow: 'hidden' as const,
  }));
  const newBestStyle = useAnimatedStyle(() => ({
    transform: [{ scale: newBestPulse.value }],
  }));

  const accuracy =
    stats.attempts > 0 ? Math.round((stats.hits / stats.attempts) * 100) : 0;

  const persistedBest = dailyMode
    ? persist?.dailyBest.date === todayKey()
      ? persist.dailyBest.score
      : 0
    : (persist?.highScore ?? 0);
  const displayedBest =
    isNewBest && phase !== 'ready'
      ? Math.max(score, persistedBest)
      : persistedBest;

  const dailyPlayedToday = persist?.dailyBest.date === todayKey();
  const shareScoreImage = async () => {
    if (capturingShare || !shareRef.current) return;
    // Re-renders without the Share/Retry/settings chrome before the capture.
    setCapturingShare(true);
    // `finally` would read better, but React Compiler cannot lower a try block
    // with a finalizer and would skip optimizing this whole component.
    await captureAndShare(shareRef.current, {
      message: shareScoreCaption(m),
      dialogTitle: gt('Share your score'),
    }).catch(() => {
      Alert.alert(gt('Share failed'), gt('Could not create the score image.'));
    });
    setCapturingShare(false);
  };

  // Every finished run (or a dev-menu preview) shows the full-screen result.
  const runResult: RunResult | null =
    resultPreview ??
    (phase === 'gameover'
      ? {
          daily: dailyMode,
          day: todayKey(),
          score,
          isNewBest,
          best: isNewBest ? previousBest : persistedBest,
          accuracy,
          combo: stats.bestCombo,
          level: round.level,
          coinsEarned: stats.coinsEarned,
        }
      : null);

  const hitEnabled = phase === 'filling' && !menuOpen;
  const showTapHint =
    persist != null &&
    shouldShowTapHint({
      tapHintPlays: persist.tapHintPlays,
      coachThisFill,
      hintThisRun,
      totalRuns: persist.totalRuns,
      phase,
      paused: menuOpen,
    });
  const showTapHowTo =
    persist != null &&
    shouldShowTapHowTo({
      tapHintPlays: persist.tapHintPlays,
      totalRuns: persist.totalRuns,
      howToThisRun,
      phase,
      paused: menuOpen,
    });
  const meterScale = round.meterScale;
  const meterWrapH = METER_BASE_H * meterScale + METER_WRAP_EXTRA;
  const meterW = METER_BASE_W * meterScale;
  const innerH = meterInnerHeight(meterScale);
  // Pin meter base to the yellow pad in the background art
  const meterBottom =
    Math.max(insets.bottom + 4, windowH * (1 - PAD_SURFACE_Y)) + METER_LIFT;
  // PLAY sits over the meter's middle, but on short screens it moves down
  // until it clears the best and Daily cards.
  const menuBottom = Math.max(
    insets.bottom + 16,
    Math.min(
      meterBottom + meterWrapH * 0.42,
      windowH - homeCardsBottom - HOME_PLAY_GAP - playH,
    ),
  );
  const tapBallX = windowW / 2 + meterW / 2 + TAP_BALL_GAP;
  const tapBallBottom =
    meterBottom + meterFloor(meterScale) + round.target * innerH;
  return (
    <View ref={shareRef} style={styles.root} collapsable={false}>
      <View style={styles.backdrop} pointerEvents="none">
        <Image
          source={SKIN_BG[skin.id]}
          style={styles.backdropImage}
          contentFit="cover"
          contentPosition="center"
          priority="high"
          cachePolicy="memory-disk"
          recyclingKey={`game-bg-v4-${skin.id}`}
        />
        {/* Only toxic's art comes in layers; the others have them baked in. */}
        {skin.id === 'toxic' ? (
          <LiveBackdrop paused={phase === 'gameover'} />
        ) : null}
      </View>

      <View
        style={[
          styles.meterAnchor,
          {
            bottom: meterBottom,
            height: meterWrapH,
          },
          phase === 'gameover' && styles.meterDimmed,
        ]}
        pointerEvents="none"
      >
        <Animated.View style={meterStyle}>
          <VerticalMeter
            fill={fill}
            zoneTarget={zoneTarget}
            zoneHalf={zoneHalf}
            perfectHalf={round.perfectHalf}
            greatHalf={round.greatHalf}
            skin={skin}
            scale={meterScale}
            active={phase === 'filling'}
          />
        </Animated.View>
      </View>

      <TapHint
        visible={showTapHint}
        cycleKey={fillCycle}
        appearDelay={tapHintAppearDelay(round.fillMs, round.target)}
        ballX={tapBallX}
        ballBottom={tapBallBottom}
        onPlay={onHintPlayed}
      />

      <View
        style={[styles.content, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
        collapsable={false}
      >
        <View
          style={styles.topBlock}
          pointerEvents="box-none"
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setHomeCardsBottom(y + height);
          }}
        >
          <View style={styles.topRow} pointerEvents="box-none">
            <View style={styles.topLeft} pointerEvents="none">
              <Image
                source={LOGO}
                style={styles.logoHud}
                contentFit="contain"
              />
            </View>

            {/* A daily run says so, up in the header to leave the game room. */}
            {dailyMode && phase !== 'ready' && phase !== 'gameover' ? (
              <View style={styles.dailySlot} pointerEvents="none">
                <View style={styles.dailyBadge}>
                  <Image
                    source={DAILY_ICON}
                    style={styles.dailyBadgeIcon}
                    contentFit="contain"
                  />
                  <Text style={styles.dailyBadgeText}>{gt('DAILY')}</Text>
                </View>
              </View>
            ) : null}

            {phase === 'ready' ? (
              <View style={styles.topRight} pointerEvents="box-none">
                <CoinBadge coins={persist?.coins ?? 0} onPress={openSkins} />
                <MainButton
                  tone="cyan"
                  size="small"
                  track="home.menu"
                  onPress={() => {
                    setMenuInitialView('menu');
                    openMenu();
                  }}
                  accessibilityLabel={gt('Menu')}
                >
                  <MenuIcon />
                </MainButton>
              </View>
            ) : phase === 'gameover' ? null : (
              <View
                style={[styles.bestPill, isNewBest && styles.bestPillHot]}
                pointerEvents="none"
              >
                <Text
                  style={[styles.bestLabel, isNewBest && styles.bestLabelHot]}
                >
                  {/* The DAILY badge in the header already names the mode. */}
                  {isNewBest ? gt('NEW BEST') : gt('BEST')}
                </Text>
                <Text
                  style={[styles.bestValue, isNewBest && styles.bestValueHot]}
                >
                  {formatScore(displayedBest)}
                </Text>
                {!isNewBest ? (
                  <View style={styles.scoreLevelPill}>
                    <Text style={styles.scoreLevelText}>
                      {gt('Level {level}', {
                        level: dailyMode
                          ? persist?.dailyBest.date === todayKey()
                            ? (persist.dailyBest.level ?? 0)
                            : 0
                          : (persist?.bestLevel ?? 0),
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
          {phase === 'ready' ? (
            <View style={styles.homeCards}>
              <ScoreModule
                best={persist?.highScore ?? 0}
                bestLevel={persist?.bestLevel ?? 0}
                onOpen={openScores}
              />
              <DailyCard onPress={() => startRun(true)} />
            </View>
          ) : null}
        </View>

        {phase !== 'ready' && phase !== 'gameover' ? (
          <View style={styles.statsBlock} pointerEvents="none">
            <View style={styles.heartsAboveScore}>
              <Hearts lives={lives} max={STARTING_LIVES} />
            </View>
            <Text style={styles.metaLine}>
              {gt('LVL {level}', { level: round.level })}
            </Text>
            <Text style={[styles.bigScore, isNewBest && styles.bigScoreHot]}>
              {formatScore(score)}
            </Text>
            <TapHowToLine visible={showTapHowTo} />
            {isNewBest ? (
              <Animated.Text style={[styles.newBestTag, newBestStyle]}>
                {gt('NEW BEST')}
              </Animated.Text>
            ) : null}
          </View>
        ) : null}

        {phase !== 'ready' && phase !== 'gameover' && combo > 1 ? (
          <Animated.View
            style={[
              styles.comboFloat,
              { bottom: Math.max(insets.bottom + 6, meterBottom - 64) },
              comboBadgeStyle,
            ]}
            pointerEvents="none"
          >
            <Animated.View style={comboLabelStyle}>
              <Text style={styles.comboFloatLabel}>{gt('COMBO')}</Text>
            </Animated.View>
            <Text style={styles.comboFloatValue}>
              ×{comboMultiplier(combo).toFixed(2)}
            </Text>
          </Animated.View>
        ) : null}

        <PerfectSwoosh
          visible={phase !== 'gameover' && feedback?.label === 'Perfect'}
          burstKey={perfectBurstKey}
          points={feedback?.points ?? 0}
          combo={feedback?.comboGrew ? feedback.combo : 0}
        />

        <MissBreak
          visible={phase !== 'gameover' && feedback?.label === 'Miss'}
          burstKey={missBurstKey}
          livesLeft={lives}
        />

        <Animated.View
          style={[
            styles.feedback,
            feedback ? FEEDBACK_SLOT_STYLE[feedback.slot] : null,
            feedbackStyle,
            phase === 'gameover' && styles.hidden,
          ]}
          pointerEvents="none"
        >
          {feedback &&
          feedback.label !== 'Perfect' &&
          feedback.label !== 'Miss' ? (
            <>
              <Text
                style={[
                  styles.feedbackLabel,
                  feedback.label === 'Great' && styles.feedbackLabelGreat,
                  { color: LABEL_COLORS[feedback.label] },
                  feedback.slot === 'left' && styles.feedbackAlignStart,
                  feedback.slot === 'right' && styles.feedbackAlignEnd,
                ]}
                numberOfLines={1}
              >
                {m(LABEL_TEXT[feedback.label])}!
              </Text>
              {feedback.points > 0 ? (
                <Text
                  style={[
                    styles.feedbackPoints,
                    feedback.slot === 'left' && styles.feedbackAlignStart,
                    feedback.slot === 'right' && styles.feedbackAlignEnd,
                  ]}
                >
                  +{feedback.points}
                </Text>
              ) : null}
              {feedback.comboGrew && feedback.combo > 1 ? (
                <Text
                  style={[
                    styles.feedbackCombo,
                    feedback.slot === 'left' && styles.feedbackAlignStart,
                    feedback.slot === 'right' && styles.feedbackAlignEnd,
                  ]}
                >
                  {gt('COMBO x{count}', { count: feedback.combo })}
                </Text>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        <CountdownBurst value={countdown} visible={phase === 'countdown'} />

        {phase === 'ready' ? (
          <>
            <View
              style={[styles.menuCol, { bottom: menuBottom }]}
              pointerEvents="box-none"
              onLayout={(e) => setPlayH(e.nativeEvent.layout.height)}
            >
              <MainButton
                tone="gold"
                size="large"
                style={styles.mainCta}
                label={gt('PLAY')}
                track="home.play"
                // Silent: it drops straight into the game and its countdown.
                clickSound={false}
                onPress={() => startRun(false)}
              />
            </View>
          </>
        ) : null}

        <View
          style={[
            styles.bottomBar,
            { bottom: insets.bottom + 16 },
            capturingShare && styles.hidden,
          ]}
          pointerEvents={capturingShare ? 'none' : 'box-none'}
        >
          {/* On the home screen the menu button and Daily sit up top instead. */}
          {phase === 'ready' ? null : (
            <MainButton
              tone="cyan"
              size="small"
              track="game.menu"
              onPress={() => {
                setMenuInitialView('menu');
                openMenu();
              }}
              accessibilityLabel={gt('Menu')}
            >
              <MenuIcon />
            </MainButton>
          )}
        </View>
      </View>

      {runResult ? (
        <ResultScreen
          result={runResult}
          dailyRank={resultPreview ? previewRank : dailyRank}
          onOpenRanking={() => {
            setResultPreview(null);
            setMenuInitialView('ranking');
            openMenu();
          }}
          capturing={capturingShare}
          onRetry={() => {
            if (resultPreview) {
              setResultPreview(null);
              return;
            }
            void gameHaptics.next();
            startRun(dailyMode);
          }}
          onShare={() => {
            if (resultPreview) return;
            void gameHaptics.next();
            void shareScoreImage();
          }}
          onHome={() => {
            if (resultPreview) {
              setResultPreview(null);
              return;
            }
            goBackFromMenu();
          }}
          onMenu={() => {
            setResultPreview(null);
            setMenuInitialView('menu');
            openMenu();
          }}
        />
      ) : null}

      {hitEnabled ? (
        <GestureDetector gesture={tapGesture}>
          <View
            style={styles.hitLayer}
            accessible
            accessibilityRole="button"
            accessibilityLabel={gt('Tap to stop the meter')}
            // The gesture only sees real touches. An assistive activation
            // produces none, so it needs its own route to the same settlement
            // or the announced button cannot be pressed: `onAccessibilityTap`
            // for VoiceOver, the activate action for TalkBack.
            onAccessibilityTap={activateTap}
            accessibilityActions={ACTIVATE_ACTION}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'activate') activateTap();
            }}
          />
        </GestureDetector>
      ) : null}

      <MenuSheet
        visible={menuOpen}
        soundOn={!muted}
        buttonSoundsOn={buttonSounds}
        hapticsOn={persist?.hapticsEnabled !== false}
        canGoBack={phase !== 'ready'}
        dailyMode={dailyMode}
        initialView={menuInitialView}
        highScore={persist?.highScore ?? 0}
        bestLevel={persist?.bestLevel ?? 0}
        dailyPlayedToday={Boolean(dailyPlayedToday)}
        dailyTodayScore={
          persist?.dailyBest.date === todayKey() ? persist.dailyBest.score : 0
        }
        dailyTodayLevel={
          persist?.dailyBest.date === todayKey() ? persist.dailyBest.level : 0
        }
        dailyRecordScore={persist?.dailyRecord.score ?? 0}
        dailyRecordLevel={persist?.dailyRecord.level ?? 0}
        dailyRecordDate={persist?.dailyRecord.date ?? ''}
        coins={persist?.coins ?? 0}
        unlockedSkins={persist?.unlockedSkins ?? ['toxic']}
        equippedSkin={persist?.equippedSkin ?? DEFAULT_SKIN}
        avatar={persist?.avatar ?? null}
        unlockedAvatarPacks={persist?.unlockedAvatarPacks ?? ['animals']}
        onClose={closeMenu}
        onToggleSound={() => void toggleSound()}
        onToggleButtonSounds={() => void toggleButtonSounds()}
        onToggleHaptics={() => void toggleHaptics()}
        onGoBack={goBackFromMenu}
        onStartMode={startModeFromMenu}
        onSendFeedback={() => void sendFeedback()}
        onDeleteData={() => void deleteData()}
        onUnlockSkin={onUnlockSkin}
        onEquipSkin={onEquipSkin}
        onSelectAvatar={onSelectAvatar}
        onUnlockAvatarPack={onUnlockAvatarPack}
      />

      {/* Waits for the home screen, so it never lands mid-run. */}
      <DailyRewardModal
        reward={
          phase === 'ready' && !menuOpen && !reviewPromptVisible
            ? dailyReward.reward
            : null
        }
        onClose={() => {
          play('coins');
          dailyReward.dismiss();
        }}
      />

      <ReviewPromptModal
        visible={reviewPromptVisible}
        onAccept={onReviewAccept}
        onDecline={onReviewDecline}
      />
    </View>
  );
}
