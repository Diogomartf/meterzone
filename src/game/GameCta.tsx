import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';
import { styles } from '@/game/gameScreenStyles';

type GameCtaProps = {
  label: string;
  subtitle?: string;
  face: string;
  depth: string;
  /** Smaller lettering for longer labels in tighter spots, like the menu. */
  compact?: boolean;
  /** Spinner + a sweeping sheen, and presses ignored, while work is pending. */
  loading?: boolean;
  /** Drawn play triangle before the label. */
  icon?: 'play';
  /** Stretch to the container instead of capping at the home-screen width. */
  fullWidth?: boolean;
  onPress: () => void;
};

/** Chunky casual-game CTA — 3D lip + press squash */
export function GameCta({
  label,
  subtitle,
  face,
  depth,
  compact,
  loading,
  icon,
  fullWidth,
  onPress,
}: GameCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      style={({ pressed }) => [
        styles.ctaPressable,
        fullWidth && styles.ctaPressableFull,
        pressed && styles.ctaPressableDown,
      ]}
    >
      {({ pressed }) => (
        <View style={[styles.ctaShell, { backgroundColor: depth }]}>
          <View
            style={[
              styles.ctaFace,
              { backgroundColor: face },
              compact && styles.ctaFaceCompact,
              pressed ? styles.ctaFaceDown : styles.ctaFaceUp,
            ]}
          >
            <View style={styles.ctaShine} />
            {loading ? <LoadingSheen /> : null}
            <View style={styles.ctaLabelRow}>
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={compact ? GameColors.ink : GameColors.white}
                />
              ) : icon === 'play' ? (
                <View
                  style={[
                    styles.ctaPlayIcon,
                    compact && styles.ctaPlayIconCompact,
                  ]}
                />
              ) : null}
              <Text
                style={[
                  styles.ctaText,
                  compact && styles.ctaTextCompact,
                  loading && styles.ctaTextLoading,
                ]}
                numberOfLines={compact ? 1 : undefined}
                adjustsFontSizeToFit={compact}
                minimumFontScale={0.75}
              >
                {label}
              </Text>
            </View>
            {subtitle ? <Text style={styles.ctaSub}>{subtitle}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** A band of light sweeping across the face — skipped under Reduce Motion. */
function LoadingSheen() {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-SHEEN_WIDTH);

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    x.set(-SHEEN_WIDTH);
    x.set(
      withRepeat(
        withTiming(width + SHEEN_WIDTH, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
      ),
    );
  }, [reduceMotion, width, x]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { skewX: '-20deg' }],
  }));

  return (
    <View
      style={styles.ctaSheenTrack}
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {reduceMotion ? null : (
        <Animated.View style={[styles.ctaSheen, sheenStyle]} />
      )}
    </View>
  );
}

const SHEEN_WIDTH = 56;

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
