import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameFonts } from '@/constants/gameTheme';

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

/** One appearance per coached meter: fade in, hold ~1s, fade out. */
const PULSE = {
  fadeIn: 400,
  hold: 1200,
  fadeOut: 450,
  pressIn: 260,
  pressOut: 380,
} as const;

type Props = {
  visible: boolean;
  /** Changes each fill so the gesture plays once per level, never on pause/resume. */
  cycleKey: number;
  /** Wait this many ms after the fill starts (timed to land 1.5s before the zone). */
  appearDelay: number;
  /** Screen X of the tap-circle center. */
  ballX: number;
  /** Distance from the bottom of the screen to the tap-circle center. */
  ballBottom: number;
  /** Fires when the fade actually starts — not when the fill begins. */
  onPlay?: () => void;
};

/**
 * First-play coach: pointing hand + TAP.
 * The tap-circle sits on the Perfect line, 32px off the meter — taps work
 * anywhere, so the hint stays out of the tube.
 * The hand and TAP label fade in and out together, once per meter.
 */
export function TapHint({
  visible,
  cycleKey,
  appearDelay,
  ballX,
  ballBottom,
  onPlay,
}: Props) {
  const pulse = useSharedValue(0);
  const press = useSharedValue(0);
  const playedKey = useRef<number | null>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  useEffect(() => {
    if (!visible) {
      cancelAnimation(pulse);
      cancelAnimation(press);
      pulse.value = 0;
      press.value = 0;
      return;
    }
    if (playedKey.current === cycleKey) return;

    const timer = setTimeout(() => {
      if (playedKey.current === cycleKey) return;
      playedKey.current = cycleKey;
      onPlayRef.current?.();
      pulse.value = 0;
      press.value = 0;
      pulse.value = withSequence(
        withTiming(1, {
          duration: PULSE.fadeIn,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, { duration: PULSE.hold }),
        withTiming(0, {
          duration: PULSE.fadeOut,
          easing: Easing.in(Easing.quad),
        }),
      );
      press.value = withDelay(
        PULSE.fadeIn,
        withSequence(
          withTiming(1, {
            duration: PULSE.pressIn,
            easing: Easing.in(Easing.quad),
          }),
          withTiming(0, {
            duration: PULSE.pressOut,
            easing: Easing.out(Easing.cubic),
          }),
        ),
      );
    }, appearDelay);

    return () => clearTimeout(timer);
  }, [appearDelay, cycleKey, press, pulse, visible]);

  const originX = TAP_HAND_SIZE.width * TAP_BALL.x;
  const left = ballX - originX;
  const bottom = ballBottom - TAP_HAND_SIZE.height * (1 - TAP_BALL.y);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * HAND_OPACITY,
    transform: [{ scale: 1 - press.value * 0.1 }],
  }));

  return (
    <Animated.View
      style={[styles.wrap, { left, bottom }, iconStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      collapsable={false}
    >
      <View style={styles.iconGroup} collapsable={false}>
        <View style={styles.handLayer}>
          <View style={styles.ringAnchor} pointerEvents="none">
            <TapRing
              playKey={cycleKey}
              active={visible}
              delay={appearDelay + PULSE.fadeIn}
            />
            <TapRing
              playKey={cycleKey}
              active={visible}
              delay={appearDelay + PULSE.fadeIn + 400}
            />
          </View>
          <Image
            source={TAP_HAND}
            style={styles.hand}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
        <View style={styles.labelSlot}>
          <TapLabel />
        </View>
      </View>
    </Animated.View>
  );
}

const RING_SIZE = 22;

/** Expanding circle lines from the fingertip ball — reads as a tap. */
function TapRing({
  playKey,
  active,
  delay,
}: {
  playKey: number;
  active: boolean;
  delay: number;
}) {
  const wave = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(wave);
      wave.value = 0;
      return;
    }
    wave.value = 0;
    wave.value = withDelay(
      delay,
      withTiming(1, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [active, delay, playKey, wave]);

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
    zIndex: 50,
    elevation: 50,
    overflow: 'visible',
  },
  iconGroup: {
    alignItems: 'center',
    transformOrigin: `${TAP_HAND_SIZE.width * TAP_BALL.x}px ${TAP_HAND_SIZE.height * TAP_BALL.y}px`,
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
  handLayer: {
    width: TAP_HAND_SIZE.width,
    height: TAP_HAND_SIZE.height,
  },
  hand: {
    width: TAP_HAND_SIZE.width,
    height: TAP_HAND_SIZE.height,
  },
  labelSlot: {
    marginTop: 6,
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
    color: 'rgba(255,255,255,0.85)',
  },
  labelFill: {
    color: '#7A828C',
  },
});
