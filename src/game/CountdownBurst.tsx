import { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGT } from 'gt-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type Props = {
  value: number; // 3,2,1,0=GO
  visible: boolean;
};

/** Warm high-contrast colors — avoid blues that disappear on the sky bg */
const COLORS: Record<number, string> = {
  3: '#FFE14A',
  2: '#FF8A00',
  1: '#FF4B4B',
  0: '#FFFFFF',
};

const POP_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function CountdownBurst({ value, visible }: Props) {
  const gt = useGT();
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const wobble = useSharedValue(0);

  useLayoutEffect(() => {
    if (!visible) {
      opacity.set(
        withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) }),
      );
      scale.set(
        withTiming(1.06, { duration: 140, easing: Easing.in(Easing.quad) }),
      );
      return;
    }

    const isGo = value === 0;
    scale.set(0.88);
    opacity.set(0);
    wobble.set(isGo ? -6 : 0);
    opacity.set(withTiming(1, { duration: 60 }));
    scale.set(
      withSequence(
        withTiming(isGo ? 1.42 : 1.16, {
          duration: 150,
          easing: POP_OUT,
        }),
        withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    if (isGo) {
      wobble.set(
        withSequence(
          withTiming(7, { duration: 60 }),
          withTiming(-5, { duration: 70 }),
          withTiming(0, { duration: 80 }),
        ),
      );
    }
  }, [opacity, scale, value, visible, wobble]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${wobble.value}deg` }],
  }));

  const label = value > 0 ? String(value) : gt('GO!');
  const color = COLORS[value] ?? GameColors.ink;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.burst, style]}>
        <Text style={[styles.text, value === 0 && styles.goText, { color }]}>
          {label}
        </Text>
        {value === 0 ? <Text style={styles.sub}>{gt("LET'S GO")}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  burst: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  text: {
    fontFamily: GameFonts.display,
    fontSize: 96,
    lineHeight: 100,
    textAlign: 'center',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  goText: {
    fontSize: 92,
    lineHeight: 96,
  },
  sub: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 18,
    color: GameColors.lemon,
    letterSpacing: 1,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
