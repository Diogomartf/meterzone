import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGT } from 'gt-react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import type { DailyFinish } from '@/game/ranking';

const COIN = require('../../assets/images/coin.webp');

const MEDALS = ['🥇', '🥈', '🥉'];

type DailyRewardModalProps = {
  /** The paid finish to celebrate — the coins are already in the bank. */
  reward: DailyFinish | null;
  onClose: () => void;
};

/** Celebrates yesterday's top-ten daily finish and the coins it paid. */
export function DailyRewardModal({ reward, onClose }: DailyRewardModalProps) {
  const gt = useGT();

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
          onPress={onClose}
          accessibilityLabel={gt('Dismiss')}
        />
        {reward ? (
          <View style={styles.card}>
            <Text style={styles.medal} accessibilityElementsHidden>
              {MEDALS[reward.rank - 1] ?? '🏅'}
            </Text>
            <Text style={styles.title}>
              {gt('#{rank} in yesterday’s daily!', { rank: reward.rank })}
            </Text>
            <Text style={styles.body}>
              {gt('You finished in the top 10. Here’s your prize:')}
            </Text>
            <View style={styles.prize}>
              <Image source={COIN} style={styles.coin} contentFit="contain" />
              <Text style={styles.prizeText}>
                +{formatScore(reward.coins)}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{gt('Collect')}</Text>
            </Pressable>
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
    paddingHorizontal: 28,
    backgroundColor: 'rgba(26,28,44,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    zIndex: 1,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: GameColors.ink,
    backgroundColor: GameColors.xpGold,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 10,
    alignItems: 'center',
  },
  medal: {
    fontSize: 54,
    lineHeight: 64,
  },
  title: {
    fontFamily: GameFonts.display,
    fontSize: 26,
    lineHeight: 30,
    color: GameColors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: GameFonts.soft,
    fontSize: 16,
    lineHeight: 22,
    color: GameColors.ink,
    textAlign: 'center',
  },
  prize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  coin: {
    width: 40,
    height: 40,
  },
  prizeText: {
    fontFamily: GameFonts.display,
    fontSize: 40,
    lineHeight: 46,
    color: GameColors.ink,
    fontVariant: ['tabular-nums'],
  },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: GameColors.ink,
  },
  buttonPressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
  buttonText: {
    fontFamily: GameFonts.body,
    fontSize: 18,
    lineHeight: 22,
    color: GameColors.white,
  },
});
