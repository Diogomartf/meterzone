import { useEffect, useState } from 'react';
import { useMessages } from 'gt-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { styles } from '@/game/gameScreenStyles';
import { TAP_HOW_TO } from '@/game/tapCoach';

const HOW_TO_DELAY = 500;
const HOW_TO_FADE_IN = 400;
const HOW_TO_HOLD = 4000;
const HOW_TO_FADE_OUT = 400;

/**
 * First-play how-to under LVL. Waits 0.5s after the game starts, fades in,
 * then fades out 4s later. Stays mounted across levels so the timer is not reset.
 */
export function TapHowToLine({ visible }: { visible: boolean }) {
  const m = useMessages();
  const opacity = useSharedValue(0);
  // Mount is adjusted during render when `visible` turns on, so the line is on
  // screen before the effect animates it. Unmounting is always timer-driven,
  // which keeps the fade-out visible after `visible` goes back off.
  const [held, setHeld] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setHeld(true);
  }

  useEffect(() => {
    if (!visible) {
      cancelAnimation(opacity);
      opacity.value = withTiming(0, {
        duration: HOW_TO_FADE_OUT,
        easing: Easing.in(Easing.quad),
      });
      const hide = setTimeout(() => setHeld(false), HOW_TO_FADE_OUT);
      return () => clearTimeout(hide);
    }

    opacity.value = 0;
    opacity.value = withDelay(
      HOW_TO_DELAY,
      withSequence(
        withTiming(1, {
          duration: HOW_TO_FADE_IN,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(
          HOW_TO_HOLD,
          withTiming(0, {
            duration: HOW_TO_FADE_OUT,
            easing: Easing.in(Easing.quad),
          }),
        ),
      ),
    );
    const done = HOW_TO_DELAY + HOW_TO_FADE_IN + HOW_TO_HOLD + HOW_TO_FADE_OUT;
    const hide = setTimeout(() => setHeld(false), done);
    return () => clearTimeout(hide);
  }, [opacity, visible]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!held) return null;
  return (
    <Animated.Text style={[styles.tapHowTo, fadeStyle]}>
      {m(TAP_HOW_TO)}
    </Animated.Text>
  );
}
