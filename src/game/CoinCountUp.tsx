import { Image } from 'expo-image';
import { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
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
  /** Where the count starts, e.g. the previous best for a new record. */
  from?: number;
  delay?: number;
  /** Show the final number at once, e.g. while the screen is captured. */
  settled?: boolean;
  /** Text around the number, e.g. "+" for coins or "%" for accuracy. */
  prefix?: string;
  suffix?: string;
  /** Where the digits sit while the number is still shorter than the total. */
  align?: 'left' | 'center';
  style: StyleProp<TextStyle>;
};

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Style keys that place the box; they go on the wrapper, not the text. */
const BOX_KEYS = [
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'alignSelf',
  'flexShrink',
  'flexGrow',
  'flex',
] as const;

/** Splits a text style into box placement, the text itself and its shadow. */
function splitStyle(style: StyleProp<TextStyle>) {
  const flat = { ...(StyleSheet.flatten(style) ?? {}) };
  const box: Record<string, unknown> = {};
  for (const key of BOX_KEYS) {
    if (flat[key] !== undefined) {
      box[key] = flat[key];
      delete flat[key];
    }
  }
  const shadow =
    flat.textShadowColor != null
      ? {
          color: flat.textShadowColor,
          x: flat.textShadowOffset?.width ?? 0,
          y: flat.textShadowOffset?.height ?? 0,
        }
      : null;
  delete flat.textShadowColor;
  delete flat.textShadowOffset;
  delete flat.textShadowRadius;
  return { box: box as ViewStyle, text: flat, shadow };
}

/**
 * A number rolling up to its value with the shared count-up motion
 * (`useCountUp`). The changing number is drawn on the UI thread through an
 * animated, read-only TextInput, so React never re-renders while it counts.
 * TextInput can't draw `textShadow`, so a hard shadow is drawn as an offset
 * copy. An invisible copy of the final text holds the size, so nothing
 * around it reflows as the digits grow.
 */
export function CountUpText({
  value,
  from = 0,
  delay,
  prefix = '',
  suffix = '',
  align = 'center',
  settled,
  style,
}: CountUpTextProps) {
  const { count, popStyle } = useCountUp({ from, to: value, delay, settled });
  const { box, text, shadow } = splitStyle(style);
  const finalText = `${prefix}${formatScore(value)}${suffix}`;
  const startText = `${prefix}${formatScore(settled ? value : from)}${suffix}`;

  const liveProps = useAnimatedProps(() => {
    const label = `${prefix}${formatScore(count.value)}${suffix}`;
    // `text` is a native prop TextInput accepts but its types don't list.
    return { text: label, defaultValue: label } as object;
  });
  const shadowProps = useAnimatedProps(() => {
    const label = `${prefix}${formatScore(count.value)}${suffix}`;
    return { text: label, defaultValue: label } as object;
  });

  const inputStyle = [text, styles.digits, styles.input, { textAlign: align }];

  return (
    <View style={box}>
      <Text style={[text, styles.digits, styles.ghost]} numberOfLines={1}>
        {finalText}
      </Text>
      <Animated.View
        style={[styles.live, popStyle]}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {shadow ? (
          <AnimatedTextInput
            {...READ_ONLY}
            defaultValue={startText}
            animatedProps={shadowProps}
            style={[
              inputStyle,
              styles.layer,
              {
                color: shadow.color,
                transform: [{ translateX: shadow.x }, { translateY: shadow.y }],
              },
            ]}
          />
        ) : null}
        <AnimatedTextInput
          {...READ_ONLY}
          defaultValue={startText}
          animatedProps={liveProps}
          style={[inputStyle, styles.layer]}
        />
      </Animated.View>
    </View>
  );
}

/** A TextInput used only to draw text: no editing, caret or menu. */
const READ_ONLY = {
  editable: false,
  caretHidden: true,
  contextMenuHidden: true,
  scrollEnabled: false,
  underlineColorAndroid: 'transparent',
} as const;

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
    ...StyleSheet.absoluteFill,
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
  input: {
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
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
