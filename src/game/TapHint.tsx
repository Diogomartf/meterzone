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

/** Displayed size of the pointing-hand asset. */
export const TAP_HAND_SIZE = { width: 92, height: 112 } as const;
/**
 * Tap-circle center in the PNG (finger + ball), as a fraction of displayed size.
 * Measured from the baked asset: circle mid ≈ (151, 70) in a 430×512 image.
 */
const TAP_BALL = { x: 151 / 430, y: 70 / 512 } as const;
/** Gap from the meter’s right edge to the tap-circle center. */
export const TAP_BALL_GAP = 32;

type Props = {
  visible: boolean;
  /** Screen X of the tap-circle center. */
  ballX: number;
  /** Distance from the bottom of the screen to the tap-circle center. */
  ballBottom: number;
};

/**
 * First-play coach: pointing hand + TAP, bouncing like a finger on the glass.
 * The tap-circle sits on the Perfect line, 32px off the meter — taps work
 * anywhere, so the hint stays out of the tube.
 * Decorative — taps fall through to the full-screen hit layer.
 */
export function TapHint({ visible, ballX, ballBottom }: Props) {
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

  const originX = TAP_HAND_SIZE.width * TAP_BALL.x;

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 1 - tap.value * 0.08 }],
  }));

  if (!visible) return null;

  const left = ballX - originX;
  const bottom = ballBottom - TAP_HAND_SIZE.height * (1 - TAP_BALL.y);

  return (
    <View
      style={[styles.wrap, { left, bottom }]}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <Animated.View style={[styles.stack, motionStyle]}>
        <Image
          source={TAP_HAND}
          style={styles.hand}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
        <View style={styles.labelSlot}>
          <TapLabel />
        </View>
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
    width: TAP_HAND_SIZE.width,
    height: TAP_HAND_SIZE.height,
    zIndex: 32,
  },
  stack: {
    width: TAP_HAND_SIZE.width,
    height: TAP_HAND_SIZE.height,
    transformOrigin: `${TAP_HAND_SIZE.width * TAP_BALL.x}px ${TAP_HAND_SIZE.height * TAP_BALL.y}px`,
  },
  hand: {
    width: TAP_HAND_SIZE.width,
    height: TAP_HAND_SIZE.height,
    opacity: HAND_OPACITY,
  },
  labelSlot: {
    position: 'absolute',
    top: TAP_HAND_SIZE.height,
    left: 0,
    right: 0,
    alignItems: 'center',
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
