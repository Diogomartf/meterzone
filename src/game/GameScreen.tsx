import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors } from '@/constants/gameTheme';
import { styles } from '@/game/gameScreenStyles';
import { CountdownBurst } from '@/game/CountdownBurst';
import { GameCta, SecondaryCta } from '@/game/GameCta';
import { Hearts } from '@/game/Hearts';
import { MenuSheet } from '@/game/MenuSheet';
import { MissBreak } from '@/game/MissBreak';
import { PerfectSwoosh } from '@/game/PerfectSwoosh';
import { ReviewPromptModal } from '@/game/ReviewPromptModal';
import { ScoreModule } from '@/game/ScoreModule';
import { TapHint, TAP_BALL_GAP } from '@/game/TapHint';
import { TapHowToLine } from '@/game/TapHowToLine';
import { VerticalMeter } from '@/game/VerticalMeter';
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
import { captureAndShare, SHARE_SCORE_CAPTION } from '@/game/share';
import { DEFAULT_SKIN, SKINS } from '@/game/skins';
import {
  clearPersist,
  commitRunResult,
  dailySeed,
  markReviewAccepted,
  recordReviewPromptDecline,
  setHapticsEnabled,
  setSoundMuted,
  todayKey,
} from '@/game/storage';
import type { RoundConfig, RoundLabel, SessionStats } from '@/game/types';
import { useRunState } from '@/game/useRunState';
import { usePersistState } from '@/game/usePersistState';
import { useSounds } from '@/game/useSounds';
import { useTapCoach } from '@/game/useTapCoach';

const LOGO = require('../../assets/images/zone-meter-logo.png');
const GAME_BG = require('../../assets/images/game-bg.png');
const TROPHY = require('../../assets/images/trophy.png');
const FEEDBACK_EMAIL = 'hello@meterzone.net';

/** Yellow pad surface in game-bg.png (fraction of image height from top). */
const PAD_SURFACE_Y = 0.905;
/** Extra lift so the meter sits above the pad. */
const METER_LIFT = 16;
const METER_BASE_H = 340;
const METER_BASE_W = 100;
const METER_WRAP_EXTRA = 28;
/** Inner tube is 20px shorter than the shell (VerticalMeter innerH). */
const METER_INNER_INSET = 20;
/** Shell padding + glass border under the fill, from the wrap bottom. */
const METER_GLASS_BOTTOM = (scale: number) => 10 + 9 * scale + 3;

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

const LABEL_COLORS: Record<RoundLabel, string> = {
  Perfect: '#FFE14A',
  Great: '#E24B2D',
  Good: '#58CC02',
  Nice: '#1B3A8C',
  Close: '#FFC800',
  Miss: '#6B7280',
};

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowH, width: windowW } = useWindowDimensions();
  const { persist, persistRef, applyPersist } = usePersistState();
  const muted = Boolean(persist?.soundMuted);
  const { play } = useSounds(muted);

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
  const [menuInitialView, setMenuInitialView] = useState<'menu' | 'highscores'>(
    'menu',
  );
  const [capturingShare, setCapturingShare] = useState(false);
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
  const feedbackOpacity = useSharedValue(0);
  const feedbackScale = useSharedValue(0.7);
  const comboPulse = useSharedValue(1);
  const comboLabelOpacity = useSharedValue(0);
  const newBestPulse = useSharedValue(1);
  const isFilling = useSharedValue(0);

  const syncZoneMotion = useCallback(
    (config: RoundConfig) => {
      zoneFrom.set(config.target);
      zoneTo.set(config.targetEnd ?? config.target);
      zoneMoves.set(config.moving && config.targetEnd != null ? 1 : 0);
      halfFrom.set(config.zoneHalf);
      halfTo.set(config.zoneHalfEnd ?? config.zoneHalf);
      zoneShrinks.value =
        config.shrinking && config.zoneHalfEnd != null ? 1 : 0;
      zoneTarget.set(config.target);
      zoneHalf.set(config.zoneHalf);
    },
    // Shared values are stable refs — listing them as deps makes the React Compiler
    // treat the `.value` writes above as forbidden mutation and bail out of the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Best score at run start — used to detect a live / final new high. */
  const runBestBaselineRef = useRef(0);
  /** "COMBO" label only once per streak, then multiplier alone */
  const comboIntroShownRef = useRef(false);
  const lockingTap = useRef(false);
  const rngRef = useRef<() => number>(Math.random);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});
  const startFillRef = useRef<() => void>(() => {});
  const runCountdownFromRef = useRef<(at: number) => void>(() => {});

  const skin = SKINS[persist?.equippedSkin ?? DEFAULT_SKIN];

  useEffect(() => {
    syncZoneMotion(round);
  }, [round, syncZoneMotion]);

  // Keep the painted zone locked to fill progress (same lerp as zoneAt / scoreFill).
  // Skip writes when the zone is static — fill still drives zone-enter haptics below.
  useAnimatedReaction(
    () => fill.value,
    (t) => {
      const moves = zoneMoves.value;
      const shrinks = zoneShrinks.value;
      if (!moves && !shrinks) return;
      if (moves) {
        zoneTarget.set(zoneFrom.value + (zoneTo.value - zoneFrom.value) * t);
      }
      if (shrinks) {
        zoneHalf.set(halfFrom.value + (halfTo.value - halfFrom.value) * t);
      }
    },
    [],
  );
  useEffect(() => {
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (countTimer.current) clearTimeout(countTimer.current);
    };
  }, []);

  /** Animation side of a judged round — the chip itself lives in run state. */
  const showFeedback = useCallback((next: Omit<Feedback, 'slot'>) => {
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
    // Shared values only — all stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const announceNewBest = useCallback(() => {
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
  }, [dispatch, newBestPulse, stateRef]);

  const endRun = useCallback(
    async (finalScore: number, session: SessionStats) => {
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
      });
      applyPersist(next);
      const beatBest =
        finalScore > 0 && finalScore >= runBestBaselineRef.current;
      dispatch({ type: 'gameOver', isNewBest: beatBest });

      // Soft prompt only — native Store Review waits for a positive tap.
      if (shouldShowReviewPrompt(next, { isNewHighScore: beatBest })) {
        if (reviewPromptTimer.current) clearTimeout(reviewPromptTimer.current);
        reviewPromptTimer.current = setTimeout(() => {
          reviewPromptTimer.current = null;
          setReviewPromptVisible(true);
        }, TIMING.reviewPromptDelay);
      }
    },
    [applyPersist, dispatch, flushCoachWrite, stateRef],
  );

  useEffect(() => {
    return () => {
      if (reviewPromptTimer.current) clearTimeout(reviewPromptTimer.current);
    };
  }, []);

  const onReviewAccept = useCallback(() => {
    setReviewPromptVisible(false);
    // Persist before native UI so we never re-prompt even if they bounce.
    void markReviewAccepted().then(applyPersist);
  }, [applyPersist]);

  const onReviewDecline = useCallback(() => {
    setReviewPromptVisible(false);
    void recordReviewPromptDecline().then(applyPersist);
  }, [applyPersist]);

  /**
   * Queue the move to the next meter. If the menu opens before it fires, the
   * advance is parked on the run state and replayed when the sheet closes.
   */
  const scheduleAdvance = useCallback(
    (delayMs: number) => {
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
    },
    [dispatch, stateRef],
  );

  const finishRound = useCallback(
    (value: number) => {
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
    },
    [
      announceNewBest,
      dispatch,
      endRun,
      isFilling,
      play,
      endFill,
      scheduleAdvance,
      showFeedback,
      stateRef,
    ],
  );

  const startFill = useCallback(() => {
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
    syncZoneMotion(current);
    fill.set(0);
    play('start');
    void gameHaptics.start();
    fill.set(
      withTiming(
        1,
        {
          duration: current.fillMs,
          easing: Easing.bezier(0.2, 0.05, 0.35, 1),
        },
        (finished) => {
          if (finished) runOnJS(finishRound)(1);
        },
      ),
    );
  }, [
    beginFill,
    dispatch,
    fill,
    feedbackOpacity,
    finishRound,
    isFilling,
    play,
    stateRef,
    syncZoneMotion,
  ]);

  useEffect(() => {
    startFillRef.current = startFill;
  }, [startFill]);

  const runCountdownFrom = useCallback(
    (current: number) => {
      if (countTimer.current) clearTimeout(countTimer.current);

      if (current <= 0) {
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
    },
    [dispatch, play, stateRef],
  );

  useEffect(() => {
    runCountdownFromRef.current = runCountdownFrom;
  }, [runCountdownFrom]);

  const beginRound = useCallback(
    (next: RoundConfig, animateIn: boolean) => {
      dispatch({ type: 'beginRound', round: next });
      fill.set(0);
      syncZoneMotion(next);

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
      const startAfterReadPause = () => {
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
              if (done) runOnJS(startAfterReadPause)();
            },
          ),
        );
      } else {
        meterX.set(0);
        startAfterReadPause();
      }
    },
    [dispatch, fill, meterX, play, stateRef, syncZoneMotion],
  );

  const spawnNextLevel = useCallback(() => {
    const current = stateRef.current.round;
    const next = makeRound(current.level + 1, {
      previousTarget: current.target,
      rng: rngRef.current,
    });
    beginRound(next, true);
  }, [beginRound, stateRef]);

  const onMeterSlidOut = useCallback(() => {
    if (stateRef.current.paused) {
      dispatch({ type: 'park', resume: { kind: 'advance' } });
      return;
    }
    spawnNextLevel();
  }, [dispatch, spawnNextLevel, stateRef]);

  const advanceLevel = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    dispatch({ type: 'pendingTimer', pending: null });
    // Slide current meter out, then bring next in
    meterX.set(
      withTiming(
        METER_EXIT_X,
        { duration: TIMING.meterSlideOut, easing: Easing.in(Easing.cubic) },
        (done) => {
          if (done) runOnJS(onMeterSlidOut)();
        },
      ),
    );
  }, [dispatch, meterX, onMeterSlidOut]);

  useEffect(() => {
    advanceRef.current = advanceLevel;
  }, [advanceLevel]);

  const onZoneEnter = useCallback(() => {
    void gameHaptics.zoneEnter();
  }, []);

  useAnimatedReaction(
    () => fill.value,
    (value, prev) => {
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
  const haltRun = useCallback(() => {
    haltCoach();
    if (countTimer.current) clearTimeout(countTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    countTimer.current = null;
    autoTimer.current = null;
    // Drops the pause, the parked resume and the pending timer in one step.
    dispatch({ type: 'resume' });
    dispatch({ type: 'pendingTimer', pending: null });
    cancelAnimation(meterX);
    meterX.set(0);
    cancelAnimation(fill);
  }, [dispatch, fill, haltCoach, meterX]);

  /** Reset the animation layer that sits alongside run state. */
  const resetRunVisuals = useCallback(() => {
    comboIntroShownRef.current = false;
    comboLabelOpacity.set(0);
    newBestPulse.set(1);
    feedbackOpacity.set(0);
    isFilling.set(0);
    meterX.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Back to the home screen with a fresh idle meter. */
  const resetToIdle = useCallback(() => {
    haltRun();
    resetRunVisuals();
    fill.set(0);
    rngRef.current = Math.random;
    const idle = makeRound(1);
    dispatch({ type: 'idle', round: idle });
    syncZoneMotion(idle);
  }, [dispatch, fill, haltRun, resetRunVisuals, syncZoneMotion]);

  const startRun = (daily: boolean) => {
    haltRun();
    resetRunVisuals();
    beginCoachRun(persistRef.current?.totalRuns ?? persist?.totalRuns ?? 0);
    dispatch({ type: 'startRun', daily });
    rngRef.current = daily ? createRng(dailySeed()) : Math.random;
    runBestBaselineRef.current = daily
      ? persist?.dailyBest.date === todayKey()
        ? persist.dailyBest.score
        : 0
      : (persist?.highScore ?? 0);
    beginRound(makeRound(1, { rng: rngRef.current }), false);
  };

  const resumeFillFrom = useCallback(
    (from: number) => {
      const current = stateRef.current.round;
      const remaining = Math.max(90, Math.round(current.fillMs * (1 - from)));
      dispatch({ type: 'phase', phase: 'filling' });
      isFilling.set(1);
      fill.set(from);
      fill.set(
        withTiming(
          1,
          { duration: remaining, easing: Easing.bezier(0.2, 0.05, 0.35, 1) },
          (finished) => {
            if (finished) runOnJS(finishRound)(1);
          },
        ),
      );
    },
    [dispatch, fill, finishRound, isFilling, stateRef],
  );

  const openMenu = useCallback(() => {
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
  }, [dispatch, fill, isFilling, meterX, stateRef]);

  const openScores = useCallback(() => {
    setMenuInitialView('highscores');
    openMenu();
  }, [openMenu]);

  const closeMenu = useCallback(() => {
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
  }, [dispatch, meterX, resumeFillFrom, stateRef]);

  const toggleSound = async () => {
    const next = await setSoundMuted(!(persist?.soundMuted ?? false));
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
      Alert.alert('Feedback', `Email us at ${FEEDBACK_EMAIL}`);
    }
  };

  const deleteData = async () => {
    void gameHaptics.next();
    const next = await clearPersist();
    applyPersist(next);
    setGameHapticsEnabled(next.hapticsEnabled !== false);
    resetToIdle();
  };

  const onTap = () => {
    if (lockingTap.current) return;
    const { phase: p, paused } = stateRef.current;
    if (paused || p !== 'filling') return;

    lockingTap.current = true;
    // Freeze fill exactly where it is — zone is derived from fill, so it matches
    const stoppedAt = fill.value;
    cancelAnimation(fill);
    fill.set(stoppedAt);
    // Snap zone to the scored position (same as zoneAt)
    if (zoneMoves.value) {
      zoneTarget.set(
        zoneFrom.value + (zoneTo.value - zoneFrom.value) * stoppedAt,
      );
    }
    if (zoneShrinks.value) {
      zoneHalf.set(
        halfFrom.value + (halfTo.value - halfFrom.value) * stoppedAt,
      );
    }
    isFilling.set(0);
    play('tap');
    void gameHaptics.stop();
    finishRound(stoppedAt);
    requestAnimationFrame(() => {
      lockingTap.current = false;
    });
  };

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
  const homeDailyScore = dailyPlayedToday ? (persist?.dailyBest.score ?? 0) : 0;
  const homeDailyLevel = dailyPlayedToday ? (persist?.dailyBest.level ?? 0) : 0;
  // Results-screen best summary (for the mode that was just played).
  const scoreGap = persistedBest - score;

  const shareScoreImage = useCallback(async () => {
    if (capturingShare || !shareRef.current) return;
    // Re-renders without the Share/Retry/settings chrome before the capture.
    setCapturingShare(true);
    try {
      await captureAndShare(shareRef.current, {
        message: SHARE_SCORE_CAPTION,
        dialogTitle: 'Share your score',
      });
    } catch {
      Alert.alert('Share failed', 'Could not create the score image.');
    } finally {
      setCapturingShare(false);
    }
  }, [capturingShare]);

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
  const meterH = METER_BASE_H * meterScale;
  const innerH = meterH - METER_INNER_INSET;
  // Pin meter base to the yellow pad in the background art
  const meterBottom =
    Math.max(insets.bottom + 4, windowH * (1 - PAD_SURFACE_Y)) + METER_LIFT;
  const menuBottom = meterBottom + meterWrapH * 0.42;
  const tapBallX = windowW / 2 + meterW / 2 + TAP_BALL_GAP;
  const tapBallBottom =
    meterBottom + METER_GLASS_BOTTOM(meterScale) + round.target * innerH;
  return (
    <View ref={shareRef} style={styles.root} collapsable={false}>
      <View style={styles.backdrop} pointerEvents="none">
        <Image
          source={GAME_BG}
          style={styles.backdropImage}
          contentFit="cover"
          contentPosition="center"
          priority="high"
          cachePolicy="memory-disk"
          recyclingKey="game-bg-v2"
        />
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
            perfectRatio={
              round.zoneHalf > 0 ? round.perfectHalf / round.zoneHalf : 0.18
            }
            greatRatio={
              round.zoneHalf > 0 ? round.greatHalf / round.zoneHalf : 0.48
            }
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
        <View style={styles.topBlock} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <View style={styles.topLeft} pointerEvents="none">
              <Image
                source={LOGO}
                style={styles.logoHud}
                contentFit="contain"
              />
            </View>

            {phase === 'ready' ? (
              <ScoreModule
                best={persist?.highScore ?? 0}
                bestLevel={persist?.bestLevel ?? 0}
                dailyScore={homeDailyScore}
                dailyLevel={homeDailyLevel}
                dailyPlayed={Boolean(dailyPlayedToday)}
                onOpen={openScores}
              />
            ) : phase === 'gameover' ? null : (
              <View
                style={[styles.bestPill, isNewBest && styles.bestPillHot]}
                pointerEvents="none"
              >
                <Text
                  style={[styles.bestLabel, isNewBest && styles.bestLabelHot]}
                >
                  {isNewBest ? 'NEW BEST' : dailyMode ? 'DAILY' : 'BEST'}
                </Text>
                <Text
                  style={[styles.bestValue, isNewBest && styles.bestValueHot]}
                >
                  {formatScore(displayedBest)}
                </Text>
                {!isNewBest ? (
                  <View style={styles.scoreLevelPill}>
                    <Text style={styles.scoreLevelText}>
                      Level{' '}
                      {dailyMode
                        ? persist?.dailyBest.date === todayKey()
                          ? (persist.dailyBest.level ?? 0)
                          : 0
                        : (persist?.bestLevel ?? 0)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {phase !== 'ready' ? (
          <View style={styles.statsBlock} pointerEvents="none">
            {phase !== 'gameover' ? (
              <View style={styles.heartsAboveScore}>
                <Hearts lives={lives} max={STARTING_LIVES} />
              </View>
            ) : null}
            <Text style={[styles.bigScore, isNewBest && styles.bigScoreHot]}>
              {formatScore(score)}
            </Text>
            {phase === 'gameover' ? (
              <View style={styles.runStats}>
                <View style={styles.runStat}>
                  <Text style={styles.runStatLabel}>ACC</Text>
                  <Text style={styles.runStatValue}>{accuracy}%</Text>
                </View>
                <View style={styles.runStatDivider} />
                <View style={styles.runStat}>
                  <Text style={styles.runStatLabel}>COMBO</Text>
                  <Text style={styles.runStatValue}>{stats.bestCombo}</Text>
                </View>
                <View style={styles.runStatDivider} />
                <View style={styles.runStat}>
                  <Text style={styles.runStatLabel}>LVL</Text>
                  <Text style={styles.runStatValue}>{round.level}</Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.metaLine}>LVL {round.level}</Text>
                <TapHowToLine visible={showTapHowTo} />
                {isNewBest ? (
                  <Animated.Text style={[styles.newBestTag, newBestStyle]}>
                    NEW BEST
                  </Animated.Text>
                ) : null}
              </>
            )}
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
              <Text style={styles.comboFloatLabel}>COMBO</Text>
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
                {feedback.label.toUpperCase()}!
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
                  COMBO x{feedback.combo}
                </Text>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        <CountdownBurst value={countdown} visible={phase === 'countdown'} />

        {phase === 'gameover' ? (
          <View
            style={[styles.gameOverPanel, { paddingTop: insets.top + 176 }]}
            pointerEvents="box-none"
          >
            {dailyMode ? (
              <Text style={styles.dailyShareDate} pointerEvents="none">
                DAILY ·{' '}
                {new Date(todayKey() + 'T12:00:00').toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric', year: 'numeric' },
                )}
              </Text>
            ) : null}
            {isNewBest ? (
              <Image
                source={TROPHY}
                style={styles.resultTrophy}
                contentFit="contain"
              />
            ) : null}
            <Text
              style={[
                styles.gameOverTitle,
                isNewBest && styles.gameOverTitleBest,
              ]}
              pointerEvents="none"
            >
              {isNewBest ? 'NEW BEST!' : 'GAME OVER'}
            </Text>
            {!capturingShare ? (
              <View style={styles.resultSummary} pointerEvents="none">
                {isNewBest ? (
                  previousBest > 0 ? (
                    <>
                      <Text style={styles.resultSummaryLabel}>
                        PREVIOUS BEST
                      </Text>
                      <Text style={styles.resultSummaryValue}>
                        {formatScore(previousBest)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.resultSummaryValue}>
                      Your first record!
                    </Text>
                  )
                ) : (
                  <>
                    <View style={styles.resultBestRow}>
                      <Text style={styles.resultSummaryLabel}>BEST</Text>
                      <Text style={styles.resultSummaryValue}>
                        {formatScore(persistedBest)}
                      </Text>
                    </View>
                    {scoreGap > 0 ? (
                      <Text style={styles.resultGap}>
                        −{formatScore(scoreGap)} from your best
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}
            {!capturingShare ? (
              <View style={styles.gameOverActions} pointerEvents="box-none">
                <GameCta
                  label="RETRY"
                  face={GameColors.xpGold}
                  depth="#D97706"
                  onPress={() => {
                    void gameHaptics.next();
                    startRun(dailyMode);
                  }}
                />
                <GameCta
                  label="SHARE"
                  face={GameColors.bubble}
                  depth={GameColors.bubbleDark}
                  onPress={() => {
                    void gameHaptics.next();
                    void shareScoreImage();
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {phase === 'ready' ? (
          <View
            style={[styles.menuCol, { bottom: menuBottom }]}
            pointerEvents="box-none"
          >
            <GameCta
              label="PLAY"
              subtitle="TAP THE ZONE"
              face="#FFC800"
              depth="#D97706"
              onPress={() => startRun(false)}
            />
          </View>
        ) : null}

        <View
          style={[
            styles.bottomBar,
            { bottom: insets.bottom + 16 },
            capturingShare && styles.hidden,
          ]}
          pointerEvents={capturingShare ? 'none' : 'box-none'}
        >
          <Pressable
            style={styles.menuBtn}
            onPress={() => {
              setMenuInitialView('menu');
              openMenu();
            }}
            hitSlop={10}
            accessibilityLabel="Menu"
          >
            <SymbolView
              name={{
                ios: 'line.3.horizontal',
                android: 'menu',
                web: 'menu',
              }}
              size={22}
              tintColor={GameColors.white}
              weight="bold"
            />
          </Pressable>
          {phase === 'ready' ? (
            <SecondaryCta
              label="Daily challenge"
              onPress={() => startRun(true)}
            />
          ) : null}
        </View>
      </View>

      {hitEnabled ? (
        <Pressable
          style={styles.hitLayer}
          onPressIn={onTap}
          accessibilityRole="button"
          accessibilityLabel="Tap to stop the meter"
          android_ripple={{ color: 'transparent' }}
        />
      ) : null}

      <MenuSheet
        visible={menuOpen}
        soundOn={!muted}
        hapticsOn={persist?.hapticsEnabled !== false}
        canGoBack={phase !== 'ready'}
        dailyMode={dailyMode}
        initialView={menuInitialView}
        highScore={persist?.highScore ?? 0}
        bestLevel={persist?.bestLevel ?? 0}
        dailyTodayScore={
          persist?.dailyBest.date === todayKey() ? persist.dailyBest.score : 0
        }
        dailyTodayLevel={
          persist?.dailyBest.date === todayKey() ? persist.dailyBest.level : 0
        }
        dailyRecordScore={persist?.dailyRecord.score ?? 0}
        dailyRecordLevel={persist?.dailyRecord.level ?? 0}
        dailyRecordDate={persist?.dailyRecord.date ?? ''}
        onClose={closeMenu}
        onToggleSound={() => void toggleSound()}
        onToggleHaptics={() => void toggleHaptics()}
        onGoBack={goBackFromMenu}
        onStartMode={startModeFromMenu}
        onSendFeedback={() => void sendFeedback()}
        onDeleteData={() => void deleteData()}
      />

      <ReviewPromptModal
        visible={reviewPromptVisible}
        onAccept={onReviewAccept}
        onDecline={onReviewDecline}
      />
    </View>
  );
}
