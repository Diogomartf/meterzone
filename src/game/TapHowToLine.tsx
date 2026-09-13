import { useEffect, useState } from 'react';
import { useMessages } from 'gt-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { styles } from '@/game/gameScreenStyles';
import { TAP_HOW_TO } from '@/game/tapCoach';

const HOW_TO_HOME_DELAY = 500;
const HOW_TO_FADE_IN = 180;
const HOW_TO_HOLD = 4000;
const HOW_TO_FADE_OUT = 400;

/**
 * First-play how-to. On home (`persistent`) it fades in and stays so the
 * tip can be read before PLAY. In a run it is visible on the first frame
 * after PLAY, then fades out 4s later. Stays mounted across levels so
 * that timer is not reset.
 */
export function TapHowToLine({
  visible,
  persistent = false,
}: {
  visible: boolean;
  persistent?: boolean;
}) {
  const m = useMessages();
  // In-run starts fully visible so the tip is there on the first frame after PLAY.
  const opacity = useSharedValue(persistent ? 0 : 1);
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

    if (persistent) {
      opacity.value = 0;
      opacity.value = withDelay(
        HOW_TO_HOME_DELAY,
        withTiming(1, {
          duration: HOW_TO_FADE_IN,
          easing: Easing.out(Easing.cubic),
        }),
      );
      return;
    }

    // In a run: on-screen immediately after PLAY, then hold and fade.
    opacity.value = 1;
    opacity.value = withDelay(
      HOW_TO_HOLD,
      withTiming(0, {
        duration: HOW_TO_FADE_OUT,
        easing: Easing.in(Easing.quad),
      }),
    );
    const done = HOW_TO_HOLD + HOW_TO_FADE_OUT;
    const hide = setTimeout(() => setHeld(false), done);
    return () => clearTimeout(hide);
  }, [opacity, persistent, visible]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!held) return null;
  return (
    <Animated.Text
      style={[styles.tapHowTo, persistent && styles.tapHowToHome, fadeStyle]}
    >
      {m(TAP_HOW_TO)}
    </Animated.Text>
  );
}
