import { Image } from 'expo-image';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';

const BADGE = require('../../assets/images/rank-badge.webp');

/** 102×120 source: the ribbons hang below a round face. */
const ASPECT = 120 / 102;
/** Where the round face sits, as a share of the badge's height. */
const FACE_TOP = 0.08;
const FACE_HEIGHT = 0.64;

type RankBadgeProps = {
  rank: number;
  /** Width; the height follows the art. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Blue rosette with a place number on its face, for podiums and lists. */
export function RankBadge({ rank, size = 30, style }: RankBadgeProps) {
  const height = size * ASPECT;
  // Two digits need a smaller size to stay inside the face.
  const fontSize = size * (rank >= 10 ? 0.4 : 0.5);

  return (
    <View
      style={[{ width: size, height }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={BADGE}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
      <View
        style={[
          styles.face,
          { top: height * FACE_TOP, height: height * FACE_HEIGHT },
        ]}
      >
        <Text
          style={[styles.number, { fontSize, lineHeight: fontSize * 1.15 }]}
          numberOfLines={1}
        >
          {rank}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: GameFonts.display,
    color: GameColors.white,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,18,120,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});
