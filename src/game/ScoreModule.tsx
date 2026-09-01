import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { formatScore } from '@/game/format';
import { styles } from '@/game/gameScreenStyles';

const TROPHY = require('../../assets/images/trophy.png');

type ScoreModuleProps = {
  best: number;
  bestLevel: number;
  dailyScore: number;
  dailyLevel: number;
  dailyPlayed: boolean;
  onOpen: () => void;
};

/** Home-screen score module: dominant all-time BEST over a shorter Daily Best. */
export function ScoreModule({
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
