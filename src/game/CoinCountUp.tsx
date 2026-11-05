import { Image } from 'expo-image';
import { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { formatScore } from '@/game/format';
import { useCountUp } from '@/game/useCountUp';

const SPARKLE = require('../../assets/images/sparkle.webp');

type CountUpTextProps = {
  value: number;
  delay?: number;
  /** Text around the number, e.g. "+" for coins or "%" for accuracy. */
  prefix?: string;
  suffix?: string;
  /** Where the digits sit while the number is still shorter than the total. */
  align?: 'left' | 'center';
  style: StyleProp<TextStyle>;
};

/**
 * A number rolling up to its value with the shared count-up motion
 * (`useCountUp`). An invisible copy of the final text holds the width, so
 * nothing around it reflows as the digits grow.
 */
export function CountUpText({
  value,
  delay,
  prefix = '',
  suffix = '',
  align = 'center',
  style,
}: CountUpTextProps) {
  const { shown, popStyle } = useCountUp({ to: value, delay });

  return (
    <View>
      <Text style={[style, styles.digits, styles.ghost]} numberOfLines={1}>
        {prefix}
        {formatScore(value)}
        {suffix}
      </Text>
      <Animated.Text
        style={[
          style,
          styles.digits,
          styles.live,
          { textAlign: align },
          popStyle,
        ]}
        numberOfLines={1}
      >
        {prefix}
        {formatScore(shown)}
        {suffix}
      </Animated.Text>
    </View>
  );
}

/** Coins earned, as "+N" rolling up. Reward card and game over. */
export function CoinCountUp(props: Omit<CountUpTextProps, 'prefix'>) {
  return <CountUpText {...props} prefix="+" />;
}

/**
 * A sparkle bobbing gently up and down with a slight twinkle. Each one gets
 * its own delay so a pair drifts out of step. Still under Reduce Motion.
 */
export function FloatingSparkle({
  delay,
  style: placement,
}: {
  delay: number;
  /** Size and position. */
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.set(
      withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      ),
    );
  }, [delay, reduceMotion, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -5 * t.value },
      { scale: 1 + 0.08 * t.value },
      { rotate: `${8 * t.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.sparkle, placement, style]}>
      <Image
        source={SPARKLE}
        style={styles.sparkleImage}
        contentFit="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Every digit the same width, so the number doesn't wobble as it counts. */
  digits: {
    fontVariant: ['tabular-nums'],
  },
  ghost: {
    opacity: 0,
  },
  live: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  sparkle: {
    width: 26,
    height: 28,
  },
  sparkleImage: {
    width: '100%',
    height: '100%',
  },
});
