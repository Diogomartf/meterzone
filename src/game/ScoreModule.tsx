import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useGT } from 'gt-react-native';

import { trackTap } from '@/analytics';
import { GameColors } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import { styles } from '@/game/gameScreenStyles';

const TROPHY = require('../../assets/images/trophy.webp');
const COIN = require('../../assets/images/coin.webp');

/** Cream that warms toward the bottom, for a soft glossy face. */
const BEST_CARD_FACE = ['#FFFDF3', '#FFF5D8', '#FFEDC0'] as const;
/** Gold that deepens toward the bottom, like the 3D buttons. */
const COIN_BADGE_FACE = ['#FFE866', '#FFD21F', '#FFBE0B'] as const;

const CHEVRON_ICON = {
  ios: 'chevron.right',
  android: 'chevron_right',
  web: 'chevron_right',
} as const;

/** Home-screen coin balance in the header; opens the skin shop. */
export function CoinBadge({
  coins,
  onPress,
}: {
  coins: number;
  onPress: () => void;
}) {
  const gt = useGT();
  return (
    <Pressable
      onPress={() => {
        trackTap('home.coins');
        onPress();
      }}
      style={({ pressed }) => [
        styles.coinBadgeShell,
        pressed && styles.coinBadgePressed,
      ]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={gt('{count} coins. Open skins.', { count: coins })}
    >
      <LinearGradient colors={COIN_BADGE_FACE} style={styles.coinBadge}>
        <View style={styles.coinBadgeShine} />
        <Image
          source={COIN}
          style={styles.coinBadgeIcon}
          contentFit="contain"
        />
        <Text style={styles.coinBadgeValue} numberOfLines={1}>
          {formatScore(coins)}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

type ScoreModuleProps = {
  best: number;
  bestLevel: number;
  onOpen: () => void;
};

/** Home-screen all-time best card under the header; opens the scores. */
export function ScoreModule({ best, bestLevel, onOpen }: ScoreModuleProps) {
  const gt = useGT();
  return (
    <Pressable
      onPress={() => {
        trackTap('home.stats');
        onOpen();
      }}
      style={({ pressed }) => [
        styles.bestCardShell,
        pressed && styles.bestCardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={gt(
        'All-time best {score}, level {level}. Open scores.',
        { score: best, level: bestLevel },
      )}
    >
      <LinearGradient colors={BEST_CARD_FACE} style={styles.bestCard}>
        <Image
          source={TROPHY}
          style={styles.bestCardIcon}
          contentFit="contain"
        />
        <View style={styles.bestCardBody}>
          <Text style={styles.bestCardLabel}>{gt('BEST')}</Text>
          <Text
            style={styles.bestCardValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatScore(best)}
          </Text>
        </View>
        <View style={styles.bestCardDivider} />
        <View style={styles.bestCardLevel}>
          <Text style={styles.bestCardLevelText} numberOfLines={1}>
            {gt('Level {level}', { level: bestLevel })}
          </Text>
        </View>
        <SymbolView
          name={CHEVRON_ICON}
          size={18}
          tintColor={GameColors.ink}
          weight="heavy"
        />
      </LinearGradient>
    </Pressable>
  );
}
