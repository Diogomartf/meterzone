import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
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
import { captureRef } from 'react-native-view-shot';

import { GameColors, GameFonts, fillParent } from '@/constants/gameTheme';
import { CountdownBurst } from '@/game/CountdownBurst';
import { Hearts } from '@/game/Hearts';
import { MenuSheet } from '@/game/MenuSheet';
import { MissBreak } from '@/game/MissBreak';
import { PerfectSwoosh } from '@/game/PerfectSwoosh';
import { ReviewPromptModal } from '@/game/ReviewPromptModal';
import { VerticalMeter } from '@/game/VerticalMeter';
import { formatScore } from '@/game/format';
import { gameHaptics, setGameHapticsEnabled } from '@/game/haptics';
import { createRng, makeRound } from '@/game/levels';
import { shouldShowReviewPrompt } from '@/game/review';
import { comboMultiplier, scoreFill, STARTING_LIVES } from '@/game/scoring';
import { DEFAULT_SKIN, SKINS } from '@/game/skins';
import {
  clearPersist,
  commitRunResult,
  dailySeed,
  loadPersist,
  markReviewAccepted,
  recordReviewPromptDecline,
  setHapticsEnabled,
  setSoundMuted,
  todayKey,
} from '@/game/storage';
import type {
  PersistState,
  RoundConfig,
  RoundLabel,
  SessionStats,
} from '@/game/types';
import { useSounds } from '@/game/useSounds';

const LOGO = require('../../assets/images/zone-meter-logo.png');
const GAME_BG = require('../../assets/images/game-bg.png');
const TROPHY = require('../../assets/images/trophy.png');
const FEEDBACK_EMAIL = 'hello@meterzone.net';

/** Yellow pad surface in game-bg.png (fraction of image height from top). */
const PAD_SURFACE_Y = 0.905;
const METER_BASE_H = 340;
const METER_WRAP_EXTRA = 28;
/** Brief freeze after the meter lands so short zones can be read before fill. */
const LEVEL_READ_PAUSE_MS = 139;

type Phase = 'ready' | 'countdown' | 'filling' | 'result' | 'gameover';

type PauseResume =
  | { kind: 'fill'; fillAt: number }
  | { kind: 'countdown'; countAt: number }
  | { kind: 'startFill' }
  | { kind: 'advance' };

/** Side chips — fixed per label so Nice / Great don't jump around */
type FeedbackSlot = 'left' | 'right';

type Feedback = {
  label: RoundLabel;
  points: number;
  combo: number;
  comboGrew: boolean;
  slot: FeedbackSlot;
};

function feedbackSlotFor(label: RoundLabel): FeedbackSlot {
  // Great = right, Nice = left — same spot every time
  if (label === 'Great') return 'right';
  return 'left';
}

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

const emptyStats = (): SessionStats => ({
  attempts: 0,
  hits: 0,
  perfects: 0,
  misses: 0,
  bestCombo: 0,
  coinsEarned: 0,
});

const LABEL_COLORS: Record<RoundLabel, string> = {
  Perfect: '#FFE14A',
  Great: '#E24B2D',
  Good: '#58CC02',
  Nice: '#1B3A8C',
  Close: '#FFC800',
  Miss: '#6B7280',
};

type GameCtaProps = {
  label: string;
  subtitle?: string;
  face: string;
  depth: string;
  onPress: () => void;
};

/** Chunky casual-game CTA — 3D lip + press squash */
function GameCta({ label, subtitle, face, depth, onPress }: GameCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.ctaPressable,
        pressed && styles.ctaPressableDown,
      ]}
    >
      {({ pressed }) => (
        <View style={[styles.ctaShell, { backgroundColor: depth }]}>
          <View
            style={[
              styles.ctaFace,
              { backgroundColor: face },
              pressed ? styles.ctaFaceDown : styles.ctaFaceUp,
            ]}
          >
            <View style={styles.ctaShine} />
            <Text style={styles.ctaText}>{label}</Text>
            {subtitle ? <Text style={styles.ctaSub}>{subtitle}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

type ScoreModuleProps = {
  best: number;
  bestLevel: number;
  dailyScore: number;
  dailyLevel: number;
  dailyPlayed: boolean;
  onOpen: () => void;
};

/** Home-screen score module: dominant all-time BEST over a shorter Daily Best. */
function ScoreModule({
  best,
  bestLevel,
  dailyScore,
  dailyLevel,
  dailyPlayed,
  onOpen,
}: ScoreModuleProps) {
  return (
    <View style={styles.scoreModule}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.scoreMain,
          pressed && styles.scoreSectionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`All-time best ${best}, level ${bestLevel}. Open scores.`}
      >
        <View style={styles.scoreMainHead}>
          <Image
            source={TROPHY}
            style={styles.trophyIcon}
            contentFit="contain"
          />
          <Text style={styles.scoreBestLabel}>BEST</Text>
        </View>
        <Text
          style={styles.scoreBestValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatScore(best)}
        </Text>
        <View style={styles.scoreLevelPill}>
          <Text style={styles.scoreLevelText}>Level {bestLevel}</Text>
        </View>
      </Pressable>
      <View style={styles.scoreDivider} />
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.scoreDaily,
          pressed && styles.scoreSectionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          dailyPlayed
            ? `Daily best ${dailyScore}, level ${dailyLevel}. Open scores.`
            : 'Daily best not set yet. Play today.'
        }
      >
        <Text style={styles.scoreDailyLabel}>DAILY</Text>
        {dailyPlayed ? (
          <Text style={styles.scoreDailyValue} numberOfLines={1}>
            {formatScore(dailyScore)}
          </Text>
        ) : (
          <View style={styles.scoreDailyRow}>
            <Text style={styles.scoreDailyValue}>—</Text>
            <Text style={styles.scoreDailyEmpty}>Play today</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowH, width: windowW } = useWindowDimensions();
  const [persist, setPersist] = useState<PersistState | null>(null);
  const muted = Boolean(persist?.soundMuted);
  const { play } = useSounds(muted);

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState<RoundConfig>(() => makeRound(1));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [combo, setCombo] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  /** Best (for the played mode) at the moment a finished run is committed. */
  const [previousBest, setPreviousBest] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [dailyMode, setDailyMode] = useState(false);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [perfectBurstKey, setPerfectBurstKey] = useState(0);
  const [missBurstKey, setMissBurstKey] = useState(0);
  const shareRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const phaseRef = useRef<Phase>('ready');
  const roundRef = useRef(round);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const comboRef = useRef(0);
  /** Best score at run start — used to detect a live / final new high. */
  const runBestBaselineRef = useRef(0);
  /** Fire the mid-run "NEW BEST" cue only once per run. */
  const newBestAnnouncedRef = useRef(false);
  /** "COMBO" label only once per streak, then multiplier alone */
  const comboIntroShownRef = useRef(false);
  const lockingTap = useRef(false);
  const rngRef = useRef<() => number>(Math.random);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});
  /** True while menu sheet is open — game must not progress. */
  const menuPausedRef = useRef(false);
  const countdownRef = useRef(3);
  const pendingTimerRef = useRef<'countdown' | 'startFill' | 'advance' | null>(
    null,
  );
  const pauseResumeRef = useRef<PauseResume | null>(null);
  const startFillRef = useRef<() => void>(() => {});
  const runCountdownFromRef = useRef<(at: number) => void>(() => {});

  const skin = SKINS[persist?.equippedSkin ?? DEFAULT_SKIN];

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roundRef.current = round;
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
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    void loadPersist().then((state) => {
      setPersist(state);
      setGameHapticsEnabled(state.hapticsEnabled !== false);
    });
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (countTimer.current) clearTimeout(countTimer.current);
    };
  }, []);

  const showFeedback = useCallback((next: Omit<Feedback, 'slot'>) => {
    const isPerfect = next.label === 'Perfect';
    const isMiss = next.label === 'Miss';
    setFeedback({ ...next, slot: feedbackSlotFor(next.label) });

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
    if (newBestAnnouncedRef.current) return;
    newBestAnnouncedRef.current = true;
    setIsNewBest(true);
    newBestPulse.set(
      withSequence(
        withTiming(1.22, { duration: 140, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    void gameHaptics.result('Great');
  }, [newBestPulse]);

  const endRun = useCallback(
    async (finalScore: number, session: SessionStats) => {
      // Snapshot the pre-run best so the results screen can show the record
      // that was standing (previous score / difference from it).
      setPreviousBest(runBestBaselineRef.current);
      const next = await commitRunResult({
        score: finalScore,
        coinsEarned: session.coinsEarned,
        bestCombo: session.bestCombo,
        bestLevel: roundRef.current.level,
        isDaily: dailyMode,
      });
      setPersist(next);
      const beatBest =
        finalScore > 0 && finalScore >= runBestBaselineRef.current;
      setIsNewBest(beatBest);
      if (beatBest) newBestAnnouncedRef.current = true;
      setPhase('gameover');
      phaseRef.current = 'gameover';

      // Soft prompt only — native Store Review waits for a positive tap.
      if (shouldShowReviewPrompt(next, { isNewHighScore: beatBest })) {
        if (reviewPromptTimer.current) clearTimeout(reviewPromptTimer.current);
        reviewPromptTimer.current = setTimeout(() => {
          reviewPromptTimer.current = null;
          setReviewPromptVisible(true);
        }, 900);
      }
    },
    [dailyMode],
  );

  useEffect(() => {
    return () => {
      if (reviewPromptTimer.current) clearTimeout(reviewPromptTimer.current);
    };
  }, []);

  const onReviewAccept = useCallback(() => {
    setReviewPromptVisible(false);
    // Persist before native UI so we never re-prompt even if they bounce.
    void markReviewAccepted().then(setPersist);
  }, []);

  const onReviewDecline = useCallback(() => {
    setReviewPromptVisible(false);
    void recordReviewPromptDecline().then(setPersist);
  }, []);

  const finishRound = useCallback(
    (value: number) => {
      const current = roundRef.current;
      const prevCombo = comboRef.current;
      const result = scoreFill(value, current, prevCombo);
      setCombo(result.combo);
      comboRef.current = result.combo;
      isFilling.set(0);
      void gameHaptics.result(result.label === 'Close' ? 'Nice' : result.label);

      showFeedback({
        label: result.label,
        points: result.points,
        combo: result.combo,
        comboGrew: result.combo > prevCombo,
      });

      setStats((s) => {
        const next: SessionStats = {
          ...s,
          attempts: s.attempts + 1,
          hits: result.result === 'miss' ? s.hits : s.hits + 1,
          perfects: result.result === 'perfect' ? s.perfects + 1 : s.perfects,
          misses: result.costsLife ? s.misses + 1 : s.misses,
          bestCombo: Math.max(s.bestCombo, result.combo),
          coinsEarned: s.coinsEarned + result.coins,
        };

        if (result.costsLife) {
          play('miss');
          const livesLeft = livesRef.current - 1;
          setLives(livesLeft);
          livesRef.current = livesLeft;
          setPhase('result');
          phaseRef.current = 'result';
          if (livesLeft <= 0) {
            void endRun(scoreRef.current, next);
          } else {
            // Continue run — next meter
            if (autoTimer.current) clearTimeout(autoTimer.current);
            pendingTimerRef.current = 'advance';
            autoTimer.current = setTimeout(() => {
              pendingTimerRef.current = null;
              if (menuPausedRef.current) {
                pauseResumeRef.current = { kind: 'advance' };
                return;
              }
              advanceRef.current();
            }, 620);
          }
          return next;
        }

        play(result.result === 'perfect' ? 'perfect' : 'zone');
        setScore((sc) => sc + result.points);
        scoreRef.current += result.points;
        if (scoreRef.current > runBestBaselineRef.current) {
          announceNewBest();
        }
        setPhase('result');
        phaseRef.current = 'result';

        if (autoTimer.current) clearTimeout(autoTimer.current);
        pendingTimerRef.current = 'advance';
        autoTimer.current = setTimeout(
          () => {
            pendingTimerRef.current = null;
            if (menuPausedRef.current) {
              pauseResumeRef.current = { kind: 'advance' };
              return;
            }
            advanceRef.current();
          },
          result.result === 'perfect' ? 900 : 480,
        );
        return next;
      });
    },
    [announceNewBest, endRun, isFilling, play, showFeedback],
  );

  const startFill = useCallback(() => {
    if (menuPausedRef.current) {
      pauseResumeRef.current = { kind: 'startFill' };
      return;
    }
    const current = roundRef.current;
    setFeedback(null);
    feedbackOpacity.set(0);
    setPhase('filling');
    phaseRef.current = 'filling';
    isFilling.set(1);
    syncZoneMotion(current);
    fill.set(0);
    play('start');
    void gameHaptics.start();

    // Zone position/size follow fill via useAnimatedReaction (matches scoreFill)
    fill.set(
      withTiming(
        1,
        { duration: current.fillMs, easing: Easing.bezier(0.2, 0.05, 0.35, 1) },
        (finished) => {
          if (finished) runOnJS(finishRound)(1);
        },
      ),
    );
  }, [fill, feedbackOpacity, finishRound, isFilling, play, syncZoneMotion]);

  useEffect(() => {
    startFillRef.current = startFill;
  }, [startFill]);

  const runCountdownFrom = useCallback(
    (current: number) => {
      if (countTimer.current) clearTimeout(countTimer.current);

      if (current <= 0) {
        pendingTimerRef.current = 'startFill';
        countTimer.current = setTimeout(() => {
          pendingTimerRef.current = null;
          if (menuPausedRef.current) {
            pauseResumeRef.current = { kind: 'startFill' };
            return;
          }
          startFillRef.current();
        }, 520);
        return;
      }

      pendingTimerRef.current = 'countdown';
      countTimer.current = setTimeout(() => {
        pendingTimerRef.current = null;
        if (menuPausedRef.current) {
          pauseResumeRef.current = { kind: 'countdown', countAt: current };
          return;
        }
        const next = current - 1;
        setCountdown(next);
        countdownRef.current = next;
        if (next > 0) {
          play('tick');
          void gameHaptics.countdownTick(next);
          runCountdownFromRef.current(next);
        } else {
          play('start');
          void gameHaptics.countdownTick(0);
          runCountdownFromRef.current(0);
        }
      }, 560);
    },
    [play],
  );

  useEffect(() => {
    runCountdownFromRef.current = runCountdownFrom;
  }, [runCountdownFrom]);

  const beginRound = useCallback(
    (next: RoundConfig, animateIn: boolean) => {
      setRound(next);
      roundRef.current = next;
      fill.set(0);
      syncZoneMotion(next);

      // Only countdown on the very first meter of a run
      if (next.level === 1) {
        meterX.set(0);
        setPhase('countdown');
        phaseRef.current = 'countdown';
        setCountdown(3);
        countdownRef.current = 3;
        play('tick');
        void gameHaptics.countdownTick(3);
        runCountdownFromRef.current(3);
        return;
      }

      // Later levels: land the meter, pause so the zone is readable, then fill
      const startAfterReadPause = () => {
        if (menuPausedRef.current) {
          pauseResumeRef.current = { kind: 'startFill' };
          return;
        }
        if (countTimer.current) clearTimeout(countTimer.current);
        pendingTimerRef.current = 'startFill';
        countTimer.current = setTimeout(() => {
          pendingTimerRef.current = null;
          if (menuPausedRef.current) {
            pauseResumeRef.current = { kind: 'startFill' };
            return;
          }
          startFillRef.current();
        }, LEVEL_READ_PAUSE_MS);
      };

      if (animateIn) {
        meterX.set(340);
        meterX.set(
          withTiming(
            0,
            { duration: 340, easing: Easing.out(Easing.cubic) },
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
    [fill, meterX, play, syncZoneMotion],
  );

  const spawnNextLevel = useCallback(() => {
    const next = makeRound(roundRef.current.level + 1, {
      previousTarget: roundRef.current.target,
      rng: rngRef.current,
    });
    beginRound(next, true);
  }, [beginRound]);

  const onMeterSlidOut = useCallback(() => {
    if (menuPausedRef.current) {
      pauseResumeRef.current = { kind: 'advance' };
      return;
    }
    spawnNextLevel();
  }, [spawnNextLevel]);

  const advanceLevel = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    pendingTimerRef.current = null;
    // Slide current meter out, then bring next in
    meterX.set(
      withTiming(
        -360,
        { duration: 220, easing: Easing.in(Easing.cubic) },
        (done) => {
          if (done) runOnJS(onMeterSlidOut)();
        },
      ),
    );
  }, [meterX, onMeterSlidOut]);

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

  const startRun = (daily: boolean) => {
    if (countTimer.current) clearTimeout(countTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    menuPausedRef.current = false;
    pauseResumeRef.current = null;
    pendingTimerRef.current = null;
    setMenuOpen(false);
    cancelAnimation(meterX);
    cancelAnimation(fill);
    setDailyMode(daily);
    rngRef.current = daily ? createRng(dailySeed()) : Math.random;
    setScore(0);
    scoreRef.current = 0;
    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    setCombo(0);
    comboRef.current = 0;
    comboIntroShownRef.current = false;
    comboLabelOpacity.set(0);
    runBestBaselineRef.current = daily
      ? persist?.dailyBest.date === todayKey()
        ? persist.dailyBest.score
        : 0
      : (persist?.highScore ?? 0);
    newBestAnnouncedRef.current = false;
    newBestPulse.set(1);
    setStats(emptyStats());
    setIsNewBest(false);
    setFeedback(null);
    feedbackOpacity.set(0);
    isFilling.set(0);
    beginRound(makeRound(1, { rng: rngRef.current }), false);
  };

  const resumeFillFrom = useCallback(
    (from: number) => {
      const current = roundRef.current;
      const remaining = Math.max(90, Math.round(current.fillMs * (1 - from)));
      setPhase('filling');
      phaseRef.current = 'filling';
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
    [fill, finishRound, isFilling],
  );

  const openMenu = useCallback(() => {
    void gameHaptics.next();
    menuPausedRef.current = true;

    const p = phaseRef.current;
    if (p === 'filling') {
      const at = fill.value;
      cancelAnimation(fill);
      fill.set(at);
      isFilling.set(0);
      pauseResumeRef.current = { kind: 'fill', fillAt: at };
    } else if (p === 'countdown') {
      pauseResumeRef.current = {
        kind: 'countdown',
        countAt: countdownRef.current,
      };
    } else if (pendingTimerRef.current === 'startFill') {
      pauseResumeRef.current = { kind: 'startFill' };
    } else if (pendingTimerRef.current === 'advance' || p === 'result') {
      // Result auto-advance, or mid level-transition
      if (
        pendingTimerRef.current === 'advance' ||
        pauseResumeRef.current == null
      ) {
        if (livesRef.current > 0 && p === 'result') {
          pauseResumeRef.current = { kind: 'advance' };
        }
      }
    }

    if (countTimer.current) {
      clearTimeout(countTimer.current);
      countTimer.current = null;
    }
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    pendingTimerRef.current = null;

    // Freeze any in-flight meter slide
    cancelAnimation(meterX);
    if (pauseResumeRef.current?.kind === 'startFill') {
      meterX.set(0);
    } else if (pauseResumeRef.current?.kind === 'advance') {
      // Keep meter put until resume spawns the next level
      meterX.set(meterX.value);
    }

    setMenuOpen(true);
  }, [fill, isFilling, meterX]);

  const openScores = useCallback(() => {
    setMenuInitialView('highscores');
    openMenu();
  }, [openMenu]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuPausedRef.current = false;
    const resume = pauseResumeRef.current;
    pauseResumeRef.current = null;
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
      autoTimer.current = setTimeout(() => advanceRef.current(), 200);
    }
  }, [meterX, resumeFillFrom]);

  const toggleSound = async () => {
    const next = await setSoundMuted(!(persist?.soundMuted ?? false));
    setPersist(next);
    void gameHaptics.next();
  };

  const toggleHaptics = async () => {
    const enabled = !(persist?.hapticsEnabled !== false);
    setGameHapticsEnabled(enabled);
    const next = await setHapticsEnabled(enabled);
    setPersist(next);
    if (enabled) void gameHaptics.next();
  };

  const goBackFromMenu = () => {
    void gameHaptics.next();
    if (countTimer.current) clearTimeout(countTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    menuPausedRef.current = false;
    pauseResumeRef.current = null;
    pendingTimerRef.current = null;
    setMenuOpen(false);
    cancelAnimation(meterX);
    cancelAnimation(fill);
    isFilling.set(0);
    fill.set(0);
    setDailyMode(false);
    rngRef.current = Math.random;
    setScore(0);
    scoreRef.current = 0;
    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    setCombo(0);
    comboRef.current = 0;
    comboIntroShownRef.current = false;
    comboLabelOpacity.set(0);
    setStats(emptyStats());
    setIsNewBest(false);
    setFeedback(null);
    feedbackOpacity.set(0);
    const idle = makeRound(1);
    setRound(idle);
    roundRef.current = idle;
    syncZoneMotion(idle);
    setPhase('ready');
    phaseRef.current = 'ready';
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
    setPersist(next);
    setGameHapticsEnabled(next.hapticsEnabled !== false);

    if (countTimer.current) clearTimeout(countTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    menuPausedRef.current = false;
    pauseResumeRef.current = null;
    pendingTimerRef.current = null;
    setMenuOpen(false);
    cancelAnimation(meterX);
    cancelAnimation(fill);
    isFilling.set(0);
    fill.set(0);
    setDailyMode(false);
    rngRef.current = Math.random;
    setScore(0);
    scoreRef.current = 0;
    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    setCombo(0);
    comboRef.current = 0;
    comboIntroShownRef.current = false;
    comboLabelOpacity.set(0);
    setStats(emptyStats());
    setIsNewBest(false);
    setFeedback(null);
    feedbackOpacity.set(0);
    const idle = makeRound(1);
    setRound(idle);
    roundRef.current = idle;
    syncZoneMotion(idle);
    setPhase('ready');
    phaseRef.current = 'ready';
  };

  const onTap = () => {
    if (menuOpen || lockingTap.current) return;
    const p = phaseRef.current;
    if (p === 'countdown' || p === 'ready' || p === 'result') return;

    if (p === 'filling') {
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
    }
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
    setCapturingShare(true);
    try {
      // Wait for React to commit + paint without Share/Retry/settings chrome.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const uri = await captureRef(shareRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          'Sharing unavailable',
          'Sharing is not available on this device.',
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your score',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('Share failed', 'Could not create the score image.');
    } finally {
      setCapturingShare(false);
    }
  }, [capturingShare]);

  const hitEnabled = phase === 'filling' && !menuOpen;
  const meterScale = round.meterScale;
  const meterWrapH = METER_BASE_H * meterScale + METER_WRAP_EXTRA;
  // Pin meter base to the yellow pad in the background art
  const meterBottom = Math.max(
    insets.bottom + 4,
    windowH * (1 - PAD_SURFACE_Y),
  );
  const menuBottom = meterBottom + meterWrapH * 0.42;
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
            <View style={styles.resultSummary} pointerEvents="none">
              {isNewBest ? (
                previousBest > 0 ? (
                  <>
                    <Text style={styles.resultSummaryLabel}>PREVIOUS BEST</Text>
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
            <GameCta
              label="DAILY"
              subtitle="Same sequence for everyone · updates daily"
              face={GameColors.bubble}
              depth={GameColors.bubbleDark}
              onPress={() => startRun(true)}
            />
          </View>
        ) : null}

        <Pressable
          style={[
            styles.menuBtn,
            { bottom: insets.bottom + 16 },
            capturingShare && styles.hidden,
          ]}
          onPress={() => {
            setMenuInitialView('menu');
            openMenu();
          }}
          hitSlop={10}
          pointerEvents={capturingShare ? 'none' : 'auto'}
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
      </View>

      {hitEnabled ? (
        <Pressable
          style={styles.hitLayer}
          onPressIn={onTap}
          accessibilityRole="button"
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E8CFF' },
  backdrop: {
    ...fillParent,
    zIndex: 0,
  },
  backdropImage: {
    width: '100%',
    height: '100%',
  },
  hitLayer: {
    ...fillParent,
    zIndex: 20,
  },
  content: {
    ...fillParent,
    paddingHorizontal: 20,
    zIndex: 30,
    elevation: 30,
  },
  topBlock: {
    width: '100%',
    gap: 6,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 40,
  },
  topLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  logoHud: {
    width: 104,
    height: 66,
    marginLeft: -4,
  },
  menuBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 45,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GameColors.playBlue,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    backgroundColor: '#FFF4C2',
    alignItems: 'center',
    minWidth: 64,
    flexShrink: 0,
  },
  bestPillHot: {
    backgroundColor: GameColors.lemon,
  },
  bestLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 12,
    color: GameColors.panelInk,
  },
  bestLabelHot: {
    fontFamily: GameFonts.body,
    color: GameColors.ink,
    letterSpacing: 0.4,
  },
  bestValue: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    lineHeight: 24,
    color: GameColors.ink,
  },
  bestValueHot: {
    fontFamily: GameFonts.display,
  },
  // Home-screen score module — dominant BEST over a shorter tinted Daily.
  scoreModule: {
    width: 122,
    flexShrink: 0,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    backgroundColor: '#FBEFBE',
    overflow: 'hidden',
  },
  scoreMain: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 8,
    gap: 3,
    alignItems: 'stretch',
  },
  scoreSectionPressed: {
    backgroundColor: 'rgba(26,28,44,0.06)',
  },
  scoreMainHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trophyIcon: {
    width: 24,
    height: 24,
  },
  scoreBestLabel: {
    fontFamily: GameFonts.display,
    fontSize: 13,
    lineHeight: 16,
    color: GameColors.ink,
    letterSpacing: 0.4,
  },
  scoreBestValue: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    color: GameColors.ink,
    letterSpacing: -0.5,
  },
  scoreLevelPill: {
    marginTop: 1,
    borderRadius: 10,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: GameColors.lemon,
  },
  scoreLevelText: {
    fontFamily: GameFonts.body,
    fontSize: 12,
    lineHeight: 15,
    color: GameColors.ink,
  },
  scoreDivider: {
    height: 2.5,
    backgroundColor: GameColors.ink,
  },
  scoreDaily: {
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 6,
    gap: 1,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(88,204,2,0.18)',
  },
  scoreDailyLabel: {
    fontFamily: GameFonts.body,
    fontSize: 10,
    letterSpacing: 0.5,
    color: GameColors.bubbleDark,
  },
  scoreDailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreDailyValue: {
    fontFamily: GameFonts.display,
    fontSize: 16,
    lineHeight: 19,
    color: GameColors.ink,
  },
  scoreDailyEmpty: {
    fontFamily: GameFonts.body,
    fontSize: 12,
    color: GameColors.bubbleDark,
  },
  // Results screen — best/difference summary + NEW BEST trophy.
  resultTrophy: {
    width: 64,
    height: 64,
  },
  resultSummary: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    minWidth: 168,
  },
  resultSummaryLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 12,
    letterSpacing: 0.6,
    color: GameColors.panelInk,
  },
  resultSummaryValue: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: GameColors.ink,
  },
  resultBestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultGap: {
    fontFamily: GameFonts.body,
    fontSize: 14,
    color: GameColors.scoreBad,
    marginTop: 2,
  },
  statsBlock: { marginTop: 2, alignItems: 'center' },
  heartsAboveScore: {
    marginBottom: 6,
    alignItems: 'center',
  },
  bigScore: {
    fontFamily: GameFonts.display,
    fontSize: 52,
    lineHeight: 56,
    color: GameColors.white,
    textShadowColor: 'rgba(26,28,44,0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  bigScoreHot: {
    color: GameColors.lemon,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  metaLine: {
    fontFamily: GameFonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: GameColors.ink,
  },
  newBestTag: {
    marginTop: 4,
    fontFamily: GameFonts.display,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 1,
    color: GameColors.lemon,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  runStats: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
  },
  runStat: {
    alignItems: 'center',
    minWidth: 52,
  },
  runStatLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 11,
    color: GameColors.panelInk,
    letterSpacing: 0.6,
  },
  runStatValue: {
    fontFamily: GameFonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: GameColors.ink,
  },
  runStatDivider: {
    width: 2,
    height: 28,
    borderRadius: 1,
    backgroundColor: 'rgba(26,28,44,0.15)',
  },
  comboFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  comboFloatLabel: {
    fontFamily: GameFonts.display,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 2,
    color: GameColors.white,
    textAlign: 'center',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  comboFloatValue: {
    fontFamily: GameFonts.display,
    fontSize: 52,
    lineHeight: 56,
    color: '#FFE96A',
    textAlign: 'center',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  meterAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  meterDimmed: {
    opacity: 0.28,
  },
  hidden: { opacity: 0 },
  gameOverPanel: {
    ...fillParent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    gap: 18,
    paddingHorizontal: 24,
  },
  gameOverActions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  gameOverTitle: {
    fontFamily: GameFonts.display,
    fontSize: 52,
    lineHeight: 56,
    textAlign: 'center',
    color: '#FF4B4B',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  gameOverTitleBest: {
    color: GameColors.lemon,
  },
  dailyShareDate: {
    fontFamily: GameFonts.body,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    color: GameColors.white,
    textShadowColor: 'rgba(26,28,44,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
    marginBottom: -4,
  },
  feedback: {
    position: 'absolute',
    zIndex: 35,
    maxWidth: '52%',
  },
  feedbackAlignStart: { textAlign: 'left' },
  feedbackAlignEnd: { textAlign: 'right' },
  feedbackLabel: {
    fontFamily: GameFonts.display,
    fontSize: 28,
    lineHeight: 32,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  feedbackLabelGreat: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 0.5,
    textShadowOffset: { width: 0, height: 3 },
  },
  feedbackPoints: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 18,
    color: GameColors.white,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  feedbackCombo: {
    marginTop: 3,
    fontFamily: GameFonts.display,
    fontSize: 18,
    lineHeight: 22,
    color: GameColors.lemon,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  menuCol: {
    position: 'absolute',
    left: 28,
    right: 28,
    gap: 14,
    zIndex: 40,
    alignItems: 'center',
  },
  ctaPressable: {
    width: '100%',
    maxWidth: 320,
  },
  ctaPressableDown: {
    transform: [{ scale: 0.97 }],
  },
  ctaShell: {
    borderRadius: 22,
    borderWidth: 4,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  ctaFace: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaFaceUp: {
    marginBottom: 5,
    borderBottomWidth: 0,
  },
  ctaFaceDown: {
    marginBottom: 0,
    marginTop: 5,
  },
  ctaShine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 6,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  ctaText: {
    fontFamily: GameFonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: GameColors.white,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(26,28,44,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  ctaSub: {
    marginTop: 1,
    fontFamily: GameFonts.soft,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.8,
  },
});
