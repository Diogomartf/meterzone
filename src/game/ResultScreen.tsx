import { Image } from 'expo-image';
import { useGT, useLocale } from 'gt-react-native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors, GameFonts, fillParent } from '@/constants/gameTheme';
import { FlatButton } from '@/game/FlatButton';
import { formatScore } from '@/game/format';
import { MainButton } from '@/game/MainButton';
import { MenuIcon } from '@/game/MenuIcon';
import { ArchedText } from '@/game/ArchedText';

const BG = require('../../assets/images/record-bg.webp');
const LOGO = require('../../assets/images/zone-meter-logo.webp');
const TROPHY = require('../../assets/images/trophy-record.webp');
const CALENDAR = require('../../assets/images/daily-calendar.webp');
const COINS = require('../../assets/images/coins-stack.webp');
/** Width over height of the trophy art, confetti included. */
const TROPHY_ASPECT = 600 / 416;

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

type ResultScreenProps = {
  result: RunResult;
  onRetry: () => void;
  onShare: () => void;
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
  onRetry,
  onShare,
  onMenu,
  capturing = false,
}: ResultScreenProps) {
  const gt = useGT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Shorter phones (SE, mini) shrink the trophy and score to keep it on one screen.
  const compact = height < 800;
  const trophySize = compact ? 100 : 136;

  // Sized from the digit count: `adjustsFontSizeToFit` sometimes shrinks a
  // short score to a few points on iOS.
  const scoreText = formatScore(record.score);
  const scoreSize =
    (scoreText.length <= 4 ? 128 : scoreText.length <= 5 ? 108 : 90) *
    (compact ? 0.78 : 1);

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
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        {!capturing ? (
          <MainButton
            tone="quiet"
            size="small"
            onPress={onMenu}
            accessibilityLabel={gt('Menu')}
          >
            <MenuIcon />
          </MainButton>
        ) : null}
      </View>

      <View style={styles.body} pointerEvents="box-none">
        {record.daily ? (
          <>
            <View style={styles.titleRow}>
              <Image
                source={CALENDAR}
                style={compact ? styles.calendarCompact : styles.calendar}
                contentFit="contain"
              />
              <Text style={styles.title}>{gt('DAILY\nCHALLENGE')}</Text>
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
                  marginVertical: compact ? 0 : 4,
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
              text={gt('GAME OVER')}
              style={[
                styles.newBest,
                styles.gameOver,
                compact && styles.newBestCompact,
              ]}
            />
          </Animated.View>
        )}
        <Text
          style={[
            styles.score,
            { fontSize: scoreSize, lineHeight: Math.round(scoreSize * 1.08) },
          ]}
          numberOfLines={1}
        >
          {scoreText}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <Animated.View
          entering={FadeIn.delay(250)}
          style={[styles.stats, compact && styles.statsCompact]}
        >
          <View style={styles.stat}>
            <Text style={styles.statValue}>{record.accuracy}%</Text>
            <Text style={styles.statLabel}>{gt('Accuracy')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{record.combo}</Text>
            <Text style={styles.statLabel}>{gt('Combo')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{record.level}</Text>
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
            <Text style={styles.coinsText}>
              <Text style={styles.coinsAmount}>
                +{formatScore(record.coinsEarned)}
              </Text>{' '}
              {gt('coins earned')}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.actions,
          // Lifted off the yellow pad at the bottom of the art, so Share stays
          // on the sky.
          { paddingBottom: Math.max(insets.bottom + 16, height * 0.095) },
          capturing && styles.hidden,
        ]}
        pointerEvents={capturing ? 'none' : 'box-none'}
      >
        <MainButton
          tone="gold"
          size="large"
          icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
          label={gt('RETRY')}
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
  logo: {
    width: 104,
    height: 75,
    marginLeft: -4,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendar: { width: 46, height: 46 },
  calendarCompact: { width: 36, height: 36 },
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
    marginTop: 6,
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
    fontSize: 50,
    lineHeight: 58,
    color: GameColors.lemon,
    textShadowColor: ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  gameOver: {
    color: '#FF5A5A',
  },
  newBestCompact: { fontSize: 40, lineHeight: 46 },
  score: {
    fontFamily: GameFonts.display,
    color: GameColors.white,
    textShadowColor: ink,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 0,
    marginTop: -14,
    marginBottom: -6,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: GameColors.white,
    textShadowColor: 'rgba(0,10,80,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 2.5,
    // A pale cyan rim that glows a little into the sky around it.
    borderColor: 'rgba(185,240,255,0.9)',
    backgroundColor: 'rgba(130,215,252,0.8)',
    shadowColor: '#9FE8FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  statsCompact: { marginTop: 12, paddingVertical: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: GameFonts.display,
    fontSize: 38,
    lineHeight: 42,
    color: STAT_INK,
  },
  statLabel: {
    fontFamily: GameFonts.display,
    fontSize: 17,
    lineHeight: 20,
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
    gap: 10,
    marginTop: 10,
  },
  coins: { width: 44, height: 34 },
  coinsText: {
    fontFamily: GameFonts.display,
    fontSize: 19,
    lineHeight: 23,
    color: GameColors.white,
    textShadowColor: 'rgba(0,10,80,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  coinsAmount: { color: GameColors.lemon },
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
});
