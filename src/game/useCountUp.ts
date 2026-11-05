import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** How long every count-up runs. */
const COUNT_DURATION = 1100;

/**
 * The one count-up motion for numbers that land on screen (a new record,
 * coins earned, a reward): rolls from `from` to `to` after `delay` ms, racing
 * through the low numbers and slowing onto the total, then a quick swell and
 * settle. Everything runs on the UI thread: `count` is a shared value for an
 * animated text, so React never re-renders while it counts.
 *
 * `settled` jumps straight to `to` with no pop, e.g. while the screen is
 * captured for sharing. Reduce Motion always shows `to`.
 */
export function useCountUp({
  from = 0,
  to,
  delay = 250,
  settled = false,
}: {
  from?: number;
  to: number;
  delay?: number;
  settled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const count = useSharedValue(reduceMotion || settled ? to : from);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      count.set(to);
      return;
    }
    count.set(from);
    count.set(
      withDelay(
        delay,
        withTiming(to, {
          duration: COUNT_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
      ),
    );
    // Landed: a quick swell and settle.
    scale.set(
      withDelay(
        delay + COUNT_DURATION,
        withSequence(
          withTiming(1.14, { duration: 110, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 7, stiffness: 220 }),
        ),
      ),
    );
    // Without `settled`, so ending a capture never replays the count.
  }, [from, to, delay, reduceMotion, count, scale]);

  // A capture shows the total at once and the count never resumes after it.
  useEffect(() => {
    if (!settled) return;
    cancelAnimation(count);
    cancelAnimation(scale);
    count.set(to);
    scale.set(1);
  }, [settled, to, count, scale]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { count, popStyle };
}
