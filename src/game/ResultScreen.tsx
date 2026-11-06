import { Image } from 'expo-image';
import { useGT, useLocale } from 'gt-react-native';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackTap } from '@/analytics';
import {
  GameColors,
  GameFonts,
  fillParent,
  headerLogo,
} from '@/constants/gameTheme';
import { FlatButton } from '@/game/FlatButton';
import { formatScore } from '@/game/format';
import { MainButton } from '@/game/MainButton';
import { MenuIcon } from '@/game/MenuIcon';
import { ArchedText } from '@/game/ArchedText';
import { CoinCountUp, CountUpText } from '@/game/CoinCountUp';

const BG = require('../../assets/images/record-bg.webp');
const LOGO = require('../../assets/images/zone-meter-logo.webp');
const HOME_ICON = {
  ios: 'house.fill',
  android: 'home',
  web: 'home',
} as const;
const TROPHY = require('../../assets/images/trophy-record.webp');
const CALENDAR = require('../../assets/images/daily-calendar.webp');
const COINS = require('../../assets/images/coins-stack.webp');
/** Width over height of the trophy art, confetti included. */
const TROPHY_ASPECT = 600 / 416;

/** The record ticks up from the old best while the trophy lands. */
const RECORD_COUNT_DELAY = 300;

/** Side padding of the body. */
const BODY_GUTTER = 24;
/** Width of an average display-font capital, as a share of font size. */
const HEADLINE_LETTER_WIDTH = 0.62;

/**
 * The trophy settles in: a small, eased-out grow from 88% with a fade, no
 * overshoot, so it reads as a reveal rather than a bounce.
 */
function trophyEntering() {
  'worklet';
  const easing = Easing.out(Easing.cubic);
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.88 }] },
    animations: {
      opacity: withDelay(80, withTiming(1, { duration: 260, easing })),
      transform: [
        { scale: withDelay(80, withTiming(1, { duration: 480, easing })) },
      ],
    },
  };
}

export type RunResult = {
  /** A daily challenge run, which gets the calendar header. */
  daily: boolean;
  /** `YYYY-MM-DD` of the daily that was played. */
  day: string;
  score: number;
  /** The run beat (or tied) the best for its mode. */
  isNewBest: boolean;
  /**
   * The best for the mode before this run: the record just beaten on a new
   * best (0 when it's the first), the one still standing otherwise.
   */
  best: number;
  accuracy: number;
  combo: number;
  level: number;
  coinsEarned: number;
};

/** Today's daily place for the game-over line; null shows no line. */
export type DailyRank =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  /** `toNext`: points to pass the player above, null at #1 or unknown. */
  | { kind: 'placed'; rank: number; toNext: number | null };

const RANK_ICON = {
  ios: 'trophy.fill',
  android: 'emoji_events',
  web: 'emoji_events',
} as const;
const CHEVRON_ICON = {
  ios: 'chevron.right',
  android: 'chevron_right',
  web: 'chevron_right',
} as const;

/**
 * One tappable line under a daily score: the player's place today and the gap
 * to the next spot, or an invite to see the board. Opens the ranking.
 */
function DailyRankLine({
  rank,
  onPress,
}: {
  rank: DailyRank;
  onPress: () => void;
}) {
  const gt = useGT();
  const text =
    rank.kind === 'checking'
      ? gt('Checking your rank…')
      : rank.kind === 'signedOut'
        ? gt('See where you rank today')
        : rank.rank === 1
          ? gt('#1 today! Hold on to it.')
          : rank.toNext != null
            ? gt('#{rank} today · {points} points to #{next}', {
                rank: rank.rank,
                points: formatScore(rank.toNext),
                next: rank.rank - 1,
              })
            : gt('#{rank} today', { rank: rank.rank });
  return (
    <Pressable
      onPress={() => {
        trackTap('game_over.ranking');
        onPress();
      }}
      style={({ pressed }) => [styles.rankLine, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={gt('Opens the ranking')}
    >
      <SymbolView
        name={RANK_ICON}
        size={16}
        tintColor={GameColors.lemon}
        weight="bold"
      />
      <Text style={styles.rankLineText} numberOfLines={1}>
        {text}
      </Text>
      <SymbolView
        name={CHEVRON_ICON}
        size={13}
        tintColor={GameColors.white}
        weight="heavy"
      />
    </Pressable>
  );
}

type ResultScreenProps = {
  result: RunResult;
  /** Today's daily place, shown under the score; null hides the line. */
  dailyRank?: DailyRank | null;
  onOpenRanking: () => void;
  onRetry: () => void;
  onShare: () => void;
  onHome: () => void;
  onMenu: () => void;
  /** Hides the buttons while the screen is captured for sharing. */
  capturing?: boolean;
};

/**
 * Full-screen result at the end of every run. A new best gets the trophy and
 * NEW BEST!, any other run GAME OVER and its gap to the best; a daily adds the
 * calendar header with the date. Then the score, the run's stats and coins,
 * and RETRY and share.
 */
export function ResultScreen({
  result: record,
  dailyRank = null,
  onOpenRanking,
  onRetry,
  onShare,
  onHome,
  onMenu,
  capturing = false,
}: ResultScreenProps) {
  const gt = useGT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  // Shorter phones (SE, mini) shrink the trophy and score.
  const compact = height < 830;
  // A daily also carries the calendar header, which takes the room of the
  // bigger logo and stats on anything short of a Pro Max.
  const snug = compact || (record.daily && height < 900);
  const trophySize = compact ? 58 : snug ? 65 : record.daily ? 83 : 122;

  // Sized from the digit count: `adjustsFontSizeToFit` sometimes shrinks a
  // short score to a few points on iOS.
  const scoreText = formatScore(record.score);
  const scoreSize =
    (scoreText.length <= 4 ? 71 : scoreText.length <= 5 ? 61 : 53) *
    (compact ? 0.64 : 1);

  // Translations run long ("FIN DE LA PARTIDA"), so it never outgrows the row.
  const gameOverText = gt('GAME OVER');
  const gameOverSize = Math.min(
    compact ? 34 : 42,
    Math.floor(
      (width - BODY_GUTTER * 2) / (gameOverText.length * HEADLINE_LETTER_WIDTH),
    ),
  );

  const gap = record.best - record.score;
  const subtitle = record.isNewBest
    ? record.best > 0
      ? gt('Previous best: {score}', { score: formatScore(record.best) })
      : record.daily
        ? gt('Your first daily record!')
        : gt('Your first record!')
    : gap > 0
      ? gt('−{gap} from your best', { gap: formatScore(gap) })
      : null;

  // Nothing here may ever be cut, and it's also the shared image, so a body
  // that still doesn't fit (an SE leaves ~350pt) shrinks as a whole. It's
  // hidden until measured, so it never shows at the wrong size.
  const [bodyHeight, setBodyHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const measured = bodyHeight > 0 && contentHeight > 0;
  const bodyScale = measured ? Math.min(1, bodyHeight / contentHeight) : 1;

  const date = new Date(record.day + 'T12:00:00').toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.root}>
      <Image
        source={BG}
        style={styles.bg}
        contentFit="cover"
        contentPosition="bottom"
      />

      <View
        style={[styles.header, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <Image
          source={LOGO}
          style={[styles.logo, snug && styles.logoCompact]}
          contentFit="contain"
        />
        {!capturing ? (
          <View style={styles.headerActions}>
            <MainButton
              tone="white"
              size="small"
              icon={HOME_ICON}
              track="game_over.home"
              onPress={onHome}
              accessibilityLabel={gt('Go home')}
            />
            <MainButton
              tone="cyan"
              size="small"
              track="game_over.menu"
              onPress={onMenu}
              accessibilityLabel={gt('Menu')}
            >
              <MenuIcon />
            </MainButton>
          </View>
        ) : null}
      </View>

      <View
        style={styles.body}
        onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}
      >
        <View
          style={[
            styles.bodyContent,
            { opacity: measured ? 1 : 0, transform: [{ scale: bodyScale }] },
          ]}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          {record.daily ? (
            <>
              <View style={styles.titleRow}>
                <Image
                  source={CALENDAR}
                  style={compact ? styles.calendarCompact : styles.calendar}
                  contentFit="contain"
                />
                <Text style={[styles.title, compact && styles.titleCompact]}>
                  {gt('DAILY\nCHALLENGE')}
                </Text>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateLine} />
                <Text style={styles.date}>{date}</Text>
                <View style={styles.dateLine} />
              </View>
            </>
          ) : null}

          {record.isNewBest ? (
            <>
              <Animated.View entering={trophyEntering}>
                <Image
                  source={TROPHY}
                  style={{
                    width: trophySize * TROPHY_ASPECT,
                    height: trophySize,
                    marginTop: compact ? 0 : -2,
                    marginBottom: compact ? 0 : 10,
                  }}
                  contentFit="contain"
                />
              </Animated.View>
              <ArchedText
                text={gt('NEW BEST!')}
                style={[styles.newBest, compact && styles.newBestCompact]}
              />
            </>
          ) : (
            <Animated.View entering={trophyEntering}>
              <ArchedText
                text={gameOverText}
                style={[
                  styles.newBest,
                  styles.gameOver,
                  {
                    fontSize: gameOverSize,
                    lineHeight: Math.round(gameOverSize * 1.16),
                  },
                ]}
              />
            </Animated.View>
          )}
          {record.isNewBest ? (
            // Captures show the final score, never a number mid-count.
            <CountUpText
              from={record.best}
              value={record.score}
              delay={RECORD_COUNT_DELAY}
              settled={capturing}
              style={[
                styles.score,
                {
                  fontSize: scoreSize,
                  lineHeight: Math.round(scoreSize * 1.08),
                },
              ]}
            />
          ) : (
            <Text
              style={[
                styles.score,
                {
                  fontSize: scoreSize,
                  lineHeight: Math.round(scoreSize * 1.08),
                },
              ]}
              numberOfLines={1}
            >
              {scoreText}
            </Text>
          )}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {record.daily && dailyRank ? (
            // Left out of the shared image: a place on today's board goes stale.
            <View
              style={[styles.rankSlot, capturing && styles.hidden]}
              pointerEvents={capturing ? 'none' : 'box-none'}
            >
              <DailyRankLine rank={dailyRank} onPress={onOpenRanking} />
            </View>
          ) : null}

          <Animated.View
            entering={FadeIn.delay(250)}
            style={[styles.stats, snug && styles.statsCompact]}
          >
            <View style={styles.stat}>
              <Text style={[styles.statValue, snug && styles.statValueCompact]}>
                {record.accuracy}%
              </Text>
              <Text style={styles.statLabel}>{gt('Accuracy')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, snug && styles.statValueCompact]}>
                {record.combo}
              </Text>
              <Text style={styles.statLabel}>{gt('Combo')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, snug && styles.statValueCompact]}>
                {record.level}
              </Text>
              <Text style={styles.statLabel}>{gt('Level')}</Text>
            </View>
          </Animated.View>

          {record.coinsEarned > 0 ? (
            <View
              style={styles.coinsRow}
              accessible
              accessibilityLabel={gt('+{earned} coins', {
                earned: record.coinsEarned,
              })}
            >
              <Image source={COINS} style={styles.coins} contentFit="contain" />
              {/* Only the amount moves: it rolls up after the score's turn. */}
              <CoinCountUp
                value={record.coinsEarned}
                delay={record.isNewBest ? 1500 : 450}
                align="left"
                settled={capturing}
                style={[styles.coinsText, styles.coinsAmount]}
              />
              <Text style={styles.coinsText}>{gt('coins earned')}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.actions,
          { paddingBottom: insets.bottom + 28 },
          compact && styles.actionsCompact,
          capturing && styles.hidden,
        ]}
        pointerEvents={capturing ? 'none' : 'box-none'}
      >
        <MainButton
          tone="gold"
          size="large"
          icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
          label={gt('RETRY')}
          track="game_over.retry"
          trackProps={{ mode: record.daily ? 'daily' : 'normal' }}
          onPress={onRetry}
        />
        <FlatButton
          tone="sky"
          big
          icon={{
            ios: 'square.and.arrow.up',
            android: 'share',
            web: 'share',
          }}
          label={gt('Share score')}
          accessibilityLabel={gt('Share score')}
          track="game_over.share"
          onPress={onShare}
          style={styles.share}
        />
      </View>
    </View>
  );
}

const ink = GameColors.ink;
/** Deep navy for the stats card, a touch bluer than ink to sit on cyan. */
const STAT_INK = '#121845';

const styles = StyleSheet.create({
  root: {
    ...fillParent,
    zIndex: 50,
    elevation: 50,
    backgroundColor: '#0A2BD0',
  },
  bg: {
    ...fillParent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  // Same top-edge rule as `headerLogo`, with the margin scaled to the size.
  logoCompact: { width: 80, height: 58, marginTop: -5 },
  logo: headerLogo,
  // Taller content overflows evenly both ways, so scaling it about its centre
  // lands it exactly inside the body.
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  bodyContent: {
    alignItems: 'center',
    paddingHorizontal: BODY_GUTTER,
    paddingVertical: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendar: { width: 46, height: 46 },
  calendarCompact: { width: 30, height: 30 },
  titleCompact: { fontSize: 19, lineHeight: 20 },
  title: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 25,
    color: GameColors.white,
    textShadowColor: 'rgba(0,10,80,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  dateLine: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(170,225,255,0.7)',
  },
  date: {
    fontFamily: GameFonts.body,
    fontSize: 16,
    lineHeight: 20,
    color: '#AEE6FF',
  },
  newBest: {
    fontFamily: GameFonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: GameColors.lemon,
    textShadowColor: ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  gameOver: {
    color: '#FF5A5A',
  },
  newBestCompact: { fontSize: 28, lineHeight: 33 },
  score: {
    fontFamily: GameFonts.display,
    color: GameColors.white,
    textShadowColor: ink,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 0,
    marginTop: -2,
    marginBottom: -6,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: '#CDEBFF',
    textShadowColor: 'rgba(0,10,80,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2.5,
    // A pale cyan rim that glows a little into the sky around it.
    borderColor: 'rgba(185,240,255,0.9)',
    backgroundColor: 'rgba(130,215,252,0.8)',
    shadowColor: '#9FE8FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  statValueCompact: { fontSize: 26, lineHeight: 29 },
  statsCompact: { marginTop: 10, paddingVertical: 6, borderRadius: 18 },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: GameFonts.display,
    fontSize: 30,
    lineHeight: 33,
    color: STAT_INK,
  },
  statLabel: {
    fontFamily: GameFonts.display,
    fontSize: 14,
    lineHeight: 17,
    color: STAT_INK,
  },
  statDivider: {
    width: 2,
    alignSelf: 'stretch',
    marginVertical: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(205,245,255,0.85)',
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    // The coin stack and text shadow overhang their boxes.
    paddingBottom: 6,
  },
  coins: { width: 47, height: 36 },
  coinsText: {
    fontFamily: GameFonts.display,
    fontSize: 21,
    lineHeight: 26,
    color: GameColors.white,
    textShadowColor: 'rgba(0,10,80,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  coinsAmount: { color: GameColors.lemon },
  actionsCompact: { paddingTop: 12 },
  actions: {
    paddingTop: 24,
    paddingHorizontal: 24,
    gap: 12,
    alignItems: 'center',
  },
  share: {
    alignSelf: 'stretch',
    marginHorizontal: 28,
    borderRadius: 999,
  },
  hidden: { opacity: 0 },
  // Fixed height, so "Checking…" turning into the rank never moves the stats.
  rankSlot: {
    height: 40,
    marginTop: 10,
    justifyContent: 'center',
  },
  rankLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(185,240,255,0.7)',
    backgroundColor: 'rgba(0,20,110,0.35)',
  },
  rankLineText: {
    flexShrink: 1,
    fontFamily: GameFonts.body,
    fontSize: 16,
    lineHeight: 20,
    color: GameColors.white,
  },
  pressed: { opacity: 0.7 },
});
