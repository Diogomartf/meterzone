import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useGT } from 'gt-react-native';

import { formatScore } from '@/game/format';
import { styles } from '@/game/gameScreenStyles';

const TROPHY = require('../../assets/images/trophy.png');
const COIN = require('../../assets/images/coins.png');

type ScoreModuleProps = {
  best: number;
  bestLevel: number;
  dailyScore: number;
  dailyLevel: number;
  dailyPlayed: boolean;
  coins: number;
  onOpen: () => void;
  onOpenSkins: () => void;
};

/** Home-screen score module: dominant all-time BEST over Daily Best and coins. */
export function ScoreModule({
  best,
  bestLevel,
  dailyScore,
  dailyLevel,
  dailyPlayed,
  coins,
  onOpen,
  onOpenSkins,
}: ScoreModuleProps) {
  const gt = useGT();
  return (
    <View style={styles.scoreModule}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.scoreMain,
          pressed && styles.scoreSectionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={gt(
          'All-time best {score}, level {level}. Open scores.',
          { score: best, level: bestLevel },
        )}
      >
        <View style={styles.scoreMainHead}>
          <Image
            source={TROPHY}
            style={styles.trophyIcon}
            contentFit="contain"
          />
          <Text style={styles.scoreBestLabel}>{gt('BEST')}</Text>
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
          <Text style={styles.scoreLevelText}>
            {gt('Level {level}', { level: bestLevel })}
          </Text>
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
            ? gt('Daily best {score}, level {level}. Open scores.', {
                score: dailyScore,
                level: dailyLevel,
              })
            : gt('Daily best not set yet. Play today.')
        }
      >
        <Text style={styles.scoreDailyLabel}>{gt('DAILY')}</Text>
        {dailyPlayed ? (
          <Text style={styles.scoreDailyValue} numberOfLines={1}>
            {formatScore(dailyScore)}
          </Text>
        ) : (
          <View style={styles.scoreDailyRow}>
            <Text style={styles.scoreDailyValue}>—</Text>
            <Text style={styles.scoreDailyEmpty}>{gt('Play today')}</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.scoreDivider} />
      <Pressable
        onPress={onOpenSkins}
        style={({ pressed }) => [
          styles.scoreCoins,
          pressed && styles.scoreSectionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={gt('{count} coins. Open skins.', { count: coins })}
      >
        <View style={styles.scoreCoinsHead}>
          <Image source={COIN} style={styles.coinIcon} contentFit="contain" />
          <Text style={styles.scoreCoinsLabel}>{gt('COINS')}</Text>
        </View>
        <Text style={styles.scoreCoinsValue} numberOfLines={1}>
          {formatScore(coins)}
        </Text>
      </Pressable>
    </View>
  );
}
