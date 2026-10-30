import { Image } from 'expo-image';
import { useGT } from 'gt-react-native';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { MainButton } from '@/game/MainButton';

const METER = require('../../assets/images/howto-meter.webp');
const HEART = require('../../assets/images/howto-heart.webp');
const INFINITY = require('../../assets/images/howto-infinity.webp');
const CALENDAR = require('../../assets/images/howto-calendar.webp');
/** Flat blue silhouette of the calendar, for the faint one behind the text. */
const CALENDAR_GHOST = require('../../assets/images/howto-calendar-ghost.webp');
const COINS = require('../../assets/images/howto-coins.webp');
const SKINS = [
  { source: require('../../assets/images/skin-lava.webp'), spark: '#FF8A1F' },
  { source: require('../../assets/images/skin-ice.webp'), spark: '#1CB0F6' },
  { source: require('../../assets/images/skin-gold.webp'), spark: '#FFC800' },
] as const;

/** Heights of the faint bars rising behind the Normal card's text. */
const CLIMB_BARS = [14, 24, 36, 50, 66] as const;

/** The menu's "How to play" page: the tap, the two modes, and skins. */
export function HowToPlay({
  contentStyle,
  onPlay,
}: {
  /** Bottom padding for the home indicator, from the sheet. */
  contentStyle?: StyleProp<ViewStyle>;
  onPlay: () => void;
}) {
  const gt = useGT();
  const steps = [
    gt('Watch the meter rise.'),
    gt('Tap to stop it in the zone.'),
    gt('Hit it and stack combos.'),
  ];
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <ArcHeadline text={gt('One tap. Right in the zone.')} />

      <View style={styles.tapRow}>
        <Image source={METER} style={styles.meter} contentFit="contain" />
        <View style={styles.tapSide}>
          {steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <View style={styles.miss}>
            <Image
              source={HEART}
              style={styles.missHeart}
              contentFit="contain"
            />
            <Text style={styles.missText}>{gt('Miss? You lose a heart.')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.modes}>
        <View style={[styles.modeCard, styles.normalCard]}>
          <View style={styles.climb} pointerEvents="none">
            {CLIMB_BARS.map((h) => (
              <View key={h} style={[styles.climbBar, { height: h }]} />
            ))}
          </View>
          <Image
            source={INFINITY}
            style={styles.modeIcon}
            contentFit="contain"
          />
          <Text style={styles.modeTitle}>{gt('NORMAL')}</Text>
          <Text style={styles.modeBody}>
            {gt('Beat tougher and tougher levels and chase your record.')}
          </Text>
        </View>
        <View style={[styles.modeCard, styles.dailyCard]}>
          <Image
            source={CALENDAR_GHOST}
            style={styles.dailyWatermark}
            contentFit="contain"
          />
          <Image
            source={CALENDAR}
            style={styles.calendarIcon}
            contentFit="contain"
          />
          <Text style={styles.modeTitle}>{gt('DAILY')}</Text>
          <Text style={styles.modeBody}>
            {gt('The same sequence for everyone. A new challenge every day.')}
          </Text>
        </View>
      </View>

      <View style={styles.skinsCard}>
        <View style={styles.skinsText}>
          <Text
            style={styles.skinsTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {gt('STYLE YOUR METER')}
          </Text>
          <Text style={styles.skinsBody}>
            {gt('Earn coins on every hit and unlock Lava, Ice, and Gold.')}
          </Text>
          <View style={styles.coinsSlot}>
            <View style={styles.coinsAmbient} />
            <View style={styles.coinsContact} />
            <Image source={COINS} style={styles.coins} contentFit="contain" />
          </View>
        </View>
        <View style={styles.skins}>
          {SKINS.map((skin) => (
            <SkinPreview
              key={skin.spark}
              source={skin.source}
              spark={skin.spark}
            />
          ))}
        </View>
      </View>

      <MainButton label={gt("LET'S PLAY!")} size="large" onPress={onPlay} />
    </ScrollView>
  );
}

/** How far the outermost words of the headline tilt and drop. */
const ARC_TILT_DEG = 5;
const ARC_DROP = 7;
/** Lilita One's average advance, as a share of the font size. */
const PUNCH_CHAR_WIDTH = 0.5;

/**
 * One line bowed into a gentle arc: each word tilts and drops a little more
 * the further it sits from the middle. Sized from the measured width so a
 * longer translation still fits on one line.
 */
function ArcHeadline({ text }: { text: string }) {
  const [width, setWidth] = useState(0);
  const words = text.split(' ');
  const half = Math.max(1, (words.length - 1) / 2);
  const fontSize = Math.min(38, width / (text.length * PUNCH_CHAR_WIDTH) || 0);
  return (
    <View
      style={styles.headlineRow}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
    >
      {fontSize > 0
        ? words.map((word, i) => {
            const t = (i - (words.length - 1) / 2) / half;
            return (
              <Text
                key={i}
                style={[
                  styles.headline,
                  {
                    fontSize,
                    lineHeight: fontSize * 1.25,
                    transform: [
                      { translateY: t * t * ARC_DROP },
                      { rotate: `${t * ARC_TILT_DEG}deg` },
                    ],
                  },
                ]}
              >
                {word}
              </Text>
            );
          })
        : null}
    </View>
  );
}

/** Tilt of each spark flaring off a skin's ring, top to bottom. */
const SPARK_ANGLES = [35, 0, -35] as const;

/** A skin on a soft blue floor shadow, with sparks flaring off its ring. */
function SkinPreview({ source, spark }: { source: number; spark: string }) {
  return (
    <View style={styles.skinSlot}>
      <View style={styles.skinAmbient} />
      <View style={styles.skinContact} />
      <Image source={source} style={styles.skin} contentFit="contain" />
      {([1, -1] as const).map((side) => (
        <View
          key={side}
          style={[
            styles.sparks,
            side === 1 ? styles.sparksLeft : styles.sparksRight,
          ]}
        >
          {SPARK_ANGLES.map((angle) => (
            <View
              key={angle}
              style={[
                styles.spark,
                {
                  backgroundColor: spark,
                  transform: [{ rotate: `${angle * side}deg` }],
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: 7,
    minHeight: 48,
    // Pulls the meter and steps up under the arc's dipped ends.
    marginBottom: -16,
  },
  headline: {
    fontFamily: GameFonts.punch,
    color: GameColors.ink,
  },
  tapRow: {
    flexDirection: 'row',
    gap: 12,
  },
  meter: {
    width: 162,
    height: 236,
  },
  tapSide: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 8,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,176,246,0.18)',
  },
  stepNumber: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: '#1565D8',
  },
  stepText: {
    flex: 1,
    fontFamily: GameFonts.display,
    fontSize: 17,
    lineHeight: 21,
    color: GameColors.ink,
  },
  miss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,75,75,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  missHeart: {
    width: 28,
    height: 26,
  },
  missText: {
    flex: 1,
    fontFamily: GameFonts.body,
    fontSize: 15,
    lineHeight: 18,
    color: GameColors.ink,
  },
  modes: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    gap: 4,
    overflow: 'hidden',
  },
  normalCard: {
    backgroundColor: '#FFF3C4',
  },
  dailyCard: {
    backgroundColor: 'rgba(28,176,246,0.12)',
  },
  modeIcon: {
    width: 56,
    height: 40,
  },
  modeTitle: {
    fontFamily: GameFonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: GameColors.ink,
  },
  modeBody: {
    fontFamily: GameFonts.soft,
    fontSize: 15,
    lineHeight: 20,
    color: GameColors.panelInk,
  },
  climb: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  climbBar: {
    width: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(255,200,0,0.22)',
  },
  calendarIcon: {
    width: 40,
    height: 40,
  },
  dailyWatermark: {
    position: 'absolute',
    right: -26,
    top: 22,
    width: 112,
    height: 112,
    opacity: 0.18,
    transform: [{ rotate: '-12deg' }],
  },
  skinsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 10,
    backgroundColor: 'rgba(28,176,246,0.1)',
  },
  skinsText: {
    flex: 1,
    gap: 4,
  },
  skinsTitle: {
    fontFamily: GameFonts.punch,
    fontSize: 23,
    lineHeight: 27,
    color: GameColors.ink,
  },
  skinsBody: {
    fontFamily: GameFonts.soft,
    fontSize: 15,
    lineHeight: 20,
    color: GameColors.panelInk,
  },
  coinsSlot: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  coinsAmbient: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 124,
    height: 14,
    borderRadius: 62,
    transform: [{ scaleY: 0.6 }],
    backgroundColor: 'rgba(21,101,216,0.14)',
    boxShadow: '0 0 10px 5px rgba(21,101,216,0.18)',
  },
  coinsContact: {
    position: 'absolute',
    left: 12,
    bottom: 3,
    width: 100,
    height: 9,
    borderRadius: 50,
    transform: [{ scaleY: 0.6 }],
    backgroundColor: 'rgba(16,60,140,0.28)',
    boxShadow: '0 0 3px 2px rgba(16,60,140,0.24)',
  },
  coins: {
    width: 124,
    height: 80,
  },
  // Stands on the same floor as the coins.
  skins: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 0,
    marginBottom: 2,
  },
  skinSlot: {
    width: 54,
    height: 136,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // Two blurred ovals under each skin: a wide, faint ambient shadow and a
  // tight, darker one where the capsule touches the floor.
  skinAmbient: {
    position: 'absolute',
    bottom: -3,
    width: 52,
    height: 8,
    borderRadius: 26,
    transform: [{ scaleY: 0.6 }],
    backgroundColor: 'rgba(21,101,216,0.14)',
    boxShadow: '0 0 8px 4px rgba(21,101,216,0.18)',
  },
  skinContact: {
    position: 'absolute',
    bottom: -1,
    width: 34,
    height: 6,
    borderRadius: 17,
    transform: [{ scaleY: 0.6 }],
    backgroundColor: 'rgba(16,60,140,0.3)',
    boxShadow: '0 0 3px 2px rgba(16,60,140,0.26)',
  },
  skin: {
    width: 52,
    height: 130,
  },
  // Centred on the ring, halfway up the skin.
  sparks: {
    position: 'absolute',
    bottom: 65 - 9,
    gap: 3,
  },
  sparksLeft: {
    left: -4,
  },
  sparksRight: {
    right: -4,
  },
  spark: {
    width: 7,
    height: 3,
    borderRadius: 1.5,
  },
});
