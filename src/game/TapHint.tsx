import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - tap.value * 0.08 }],
  }));

  if (!visible) return null;

  const left = ballX - originX;
  const bottom = ballBottom - TAP_HAND_SIZE.height * (1 - TAP_BALL.y);

  return (
    <Animated.View
      style={[styles.wrap, { left, bottom }, fadeStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <View style={styles.ringAnchor} pointerEvents="none">
        <TapRing visible={visible} delay={0} />
        <TapRing visible={visible} delay={420} />
      </View>
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
    </Animated.View>
  );
}

const RING_SIZE = 22;

/** Expanding circle lines from the fingertip ball — reads as a tap. */
function TapRing({ visible, delay }: { visible: boolean; delay: number }) {
  const wave = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(wave);
      wave.value = 0;
      return;
    }
    wave.value = 0;
    wave.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
  }, [delay, visible, wave]);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - wave.value) * 0.5,
    transform: [{ scale: 0.65 + wave.value * 1.85 }],
  }));

  return <Animated.View style={[styles.ring, style]} />;
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

/** Gray fill + thin white outline, same 70% opacity as the hand. */
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
    overflow: 'visible',
  },
  ringAnchor: {
    position: 'absolute',
    left: TAP_HAND_SIZE.width * TAP_BALL.x - RING_SIZE / 2,
    top: TAP_HAND_SIZE.height * TAP_BALL.y - RING_SIZE / 2,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(200, 206, 214, 0.95)',
  },
  stack: {
    width: TAP_HAND_SIZE.width,
    height: TAP_HAND_SIZE.height,
    zIndex: 2,
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
    opacity: HAND_OPACITY,
  },
  label: {
    fontFamily: GameFonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: 2,
  },
  labelStroke: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.85)',
  },
  labelFill: {
    color: '#7A828C',
  },
});
