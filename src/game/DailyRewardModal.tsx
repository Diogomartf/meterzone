import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGT } from 'gt-react-native';

import { trackTap } from '@/analytics';
import { GameColors, GameFonts } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import { CoinCountUp, FloatingSparkle } from '@/game/CoinCountUp';
import { MainButton } from '@/game/MainButton';
import type { DailyFinish } from '@/game/ranking';

const COINS = require('../../assets/images/coins-stack.webp');

const SUNBURST = require('../../assets/images/reward-sunburst.webp');

/** Medal per final place: the podium, then one brass medal for 4th–10th. */
const PODIUM_MEDALS = [
  require('../../assets/images/medal-gold.webp'),
  require('../../assets/images/medal-silver.webp'),
  require('../../assets/images/medal-bronze.webp'),
];
const TOP_TEN_MEDAL = require('../../assets/images/medal-brass.webp');

type DailyRewardModalProps = {
  /** The paid finish to celebrate — the coins are already in the bank. */
  reward: DailyFinish | null;
  onClose: () => void;
};

/** Celebrates yesterday's top-ten daily finish and the coins it paid. */
export function DailyRewardModal({ reward, onClose }: DailyRewardModalProps) {
  const gt = useGT();

  const tagline = (rank: number) =>
    rank === 1
      ? gt('The top is yours.')
      : rank <= 3
        ? gt('A spot on the podium.')
        : gt('A top 10 finish.');

  return (
    <Modal
      visible={reward != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            trackTap('daily_reward.dismiss');
            onClose();
          }}
          accessibilityLabel={gt('Dismiss')}
        />
        {reward ? (
          // A darker shell under the face gives the card the same chunky lip
          // as the game's buttons.
          <View style={styles.cardShell}>
            <View style={styles.card}>
              <Image
                source={SUNBURST}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                // The rays meet near the top, behind the medal.
                contentPosition="top"
              />
              <Text style={styles.eyebrow}>
                {gt('DAILY CHALLENGE · YESTERDAY')}
              </Text>

              <View style={styles.medalRow} accessibilityElementsHidden>
                <FloatingSparkle delay={0} style={styles.sparkle} />
                <Image
                  source={PODIUM_MEDALS[reward.rank - 1] ?? TOP_TEN_MEDAL}
                  style={[
                    styles.medal,
                    // The brass art is narrower than the podium medals.
                    reward.rank > 3 && styles.medalBrass,
                  ]}
                  contentFit="contain"
                />
                <FloatingSparkle delay={700} style={styles.sparkle} />
              </View>

              <Text
                style={styles.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {gt(
                  '{rank, selectordinal, one {You placed #st!} two {You placed #nd!} few {You placed #rd!} other {You placed #th!}}',
                  { rank: reward.rank },
                )}
              </Text>
              <Text style={styles.tagline}>{tagline(reward.rank)}</Text>

              <View
                style={styles.prize}
                accessible
                accessibilityLabel={gt('+{earned} coins', {
                  earned: formatScore(reward.coins),
                })}
              >
                {/* The sparkles sit where the art's own ones were drawn. */}
                <View>
                  <Image
                    source={COINS}
                    style={styles.coins}
                    contentFit="contain"
                  />
                  <FloatingSparkle delay={300} style={styles.coinSparkleLeft} />
                  <FloatingSparkle
                    delay={1000}
                    style={styles.coinSparkleRight}
                  />
                </View>
                <View style={styles.prizeAmount}>
                  <CoinCountUp value={reward.coins} style={styles.prizeText} />
                  <Text style={styles.prizeUnit}>
                    {gt('{count, plural, one {coin} other {coins}}', {
                      count: reward.coins,
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.cta}>
                <MainButton
                  label={gt('Collect {count} coins', {
                    count: formatScore(reward.coins),
                  })}
                  track="daily_reward.collect"
                  onPress={onClose}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(26,28,44,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  cardShell: {
    zIndex: 1,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: GameColors.ink,
    backgroundColor: '#C98A00',
    overflow: 'hidden',
  },
  card: {
    marginBottom: 7,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: GameColors.xpGold,
  },
  eyebrow: {
    fontFamily: GameFonts.display,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.8,
    color: GameColors.ink,
    textAlign: 'center',
  },
  medalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  // 219×300 source.
  medal: {
    width: 66,
    height: 90,
  },
  // 188×300 source.
  medalBrass: {
    width: 56,
  },
  // 110×120 source.
  sparkle: {
    marginTop: 18,
  },
  title: {
    alignSelf: 'stretch',
    fontFamily: GameFonts.display,
    fontSize: 42,
    lineHeight: 48,
    color: GameColors.ink,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: GameFonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: GameColors.ink,
    textAlign: 'center',
  },
  prize: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  // 480×364 source, so the stack keeps its proportions.
  coins: {
    width: 108,
    height: 82,
  },
  coinSparkleLeft: {
    position: 'absolute',
    left: 10,
    top: -2,
    width: 16,
    height: 17,
    marginTop: 0,
  },
  coinSparkleRight: {
    position: 'absolute',
    left: 94,
    top: 12,
    width: 15,
    height: 16,
    marginTop: 0,
  },
  prizeAmount: {
    alignItems: 'center',
  },
  // Fixed size, no auto-shrink: inside an auto-width row it collapsed the
  // number to a sliver. The largest prize, "+500", fits at this size.
  prizeText: {
    fontFamily: GameFonts.display,
    fontSize: 60,
    lineHeight: 66,
    color: GameColors.ink,
    fontVariant: ['tabular-nums'],
  },
  prizeUnit: {
    marginTop: -8,
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: GameColors.ink,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
});
