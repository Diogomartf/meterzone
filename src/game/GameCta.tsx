import { Pressable, Text, View } from 'react-native';

import { GameColors } from '@/constants/gameTheme';
import { styles } from '@/game/gameScreenStyles';

type GameCtaProps = {
  label: string;
  subtitle?: string;
  face: string;
  depth: string;
  onPress: () => void;
};

/** Chunky casual-game CTA — 3D lip + press squash */
export function GameCta({
  label,
  subtitle,
  face,
  depth,
  onPress,
}: GameCtaProps) {
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

type SecondaryCtaProps = {
  label: string;
  onPress: () => void;
};

/**
 * Compact home-screen alternate, paired with the menu button.
 * Full-opacity 3D chrome like PLAY, but shorter so PLAY stays the default.
 */
export function SecondaryCta({ label, onPress }: SecondaryCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryCtaPressable,
        pressed && styles.ctaPressableDown,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.secondaryCtaShell,
            { backgroundColor: GameColors.bubbleDark },
          ]}
        >
          <View
            style={[
              styles.secondaryCtaFace,
              pressed ? styles.secondaryCtaFaceDown : styles.secondaryCtaFaceUp,
            ]}
          >
            <Text style={styles.secondaryCtaLabel}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
