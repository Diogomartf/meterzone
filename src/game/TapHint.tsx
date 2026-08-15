import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameColors, GameFonts } from '@/constants/gameTheme';

const TAP_HAND = require('../../assets/images/tap-hand.png');
/** 30% transparent — the meter stays readable underneath. */
const HAND_OPACITY = 0.7;

type Props = {
  visible: boolean;
  /** Distance from the bottom of the screen to sit beside the meter. */
  bottom: number;
  /** Nudge right so the hand sits beside the meter, not on the zone. */
  shift?: number;
};

/**
 * First-play coach: pointing hand + TAP, bouncing like a finger on the glass.
 * Decorative — taps fall through to the full-screen hit layer.
 */
export function TapHint({ visible, bottom, shift = 108 }: Props) {
  const opacity = useSharedValue(0);
  const tap = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      cancelAnimation(tap);
      tap.value = 0;
      return;
    }

    opacity.value = withTiming(1, { duration: 160 });
    tap.value = 0;
    tap.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
        withTiming(0, {
          duration: 480,
          easing: Easing.out(Easing.cubic),
        }),
      ),
      -1,
      false,
    );
  }, [opacity, tap, visible]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: tap.value * 16 },
      { scale: 1 - tap.value * 0.06 },
    ],
  }));

  if (!visible) return null;

  return (
    <View
      style={[styles.wrap, { bottom }]}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <Animated.View style={[styles.stack, { marginLeft: shift }, motionStyle]}>
        <Image
          source={TAP_HAND}
          style={styles.hand}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
        <TapLabel />
      </Animated.View>
    </View>
  );
}

/** Cardinal + diagonal copies so the white outline stays even around the word. */
const STROKE_OFFSETS = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
  [-2, -2],
  [2, -2],
  [-2, 2],
  [2, 2],
] as const;

/** Black fill with a thin white outline — same sticker treatment as the hand. */
function TapLabel() {
  return (
    <View style={styles.labelWrap}>
      {STROKE_OFFSETS.map(([x, y], i) => (
        <Text
          key={i}
          style={[styles.label, styles.labelStroke, { left: x, top: y }]}
        >
          TAP
        </Text>
      ))}
      <Text style={[styles.label, styles.labelFill]}>TAP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 32,
  },
  stack: {
    alignItems: 'center',
  },
  hand: {
    width: 92,
    height: 112,
    opacity: HAND_OPACITY,
  },
  labelWrap: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: GameFonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: 2,
  },
  labelStroke: {
    position: 'absolute',
    color: GameColors.white,
  },
  labelFill: {
    color: GameColors.ink,
  },
});
