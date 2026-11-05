import { useEffect, useState } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** How long every count-up runs. */
const COUNT_DURATION = 1100;

/** Ease-out cubic: races through the low numbers, slows onto the total. */
const easeOut = (p: number) => 1 - (1 - p) ** 3;

/**
 * The one count-up motion for numbers that land on screen (a new record,
 * coins earned, a reward): rolls from `from` to `to` after `delay` ms, then
 * a quick swell and settle. Returns the number to show and the pop style for
 * an `Animated.Text`. Reduce Motion shows `to` straight away.
 *
 * Use it in a small component of its own, so the per-digit re-renders stay
 * out of the screen around it.
 */
export function useCountUp({
  from = 0,
  to,
  delay = 250,
}: {
  from?: number;
  to: number;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? to : from);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let start: number | null = null;
    let last = from;
    const tick = (now: number) => {
      // Plain `if`: React Compiler can't lower `??=` and would skip this file.
      if (start === null) start = now + delay;
      const p = Math.min(1, Math.max(0, (now - start) / COUNT_DURATION));
      const next = Math.round(from + (to - from) * easeOut(p));
      // Only re-render when the digits actually change.
      if (next !== last) {
        last = next;
        setShown(next);
      }
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        // Landed: a quick swell and settle, on the UI thread.
        scale.set(
          withSequence(
            withTiming(1.14, {
              duration: 110,
              easing: Easing.out(Easing.quad),
            }),
            withSpring(1, { damping: 7, stiffness: 220 }),
          ),
        );
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, delay, reduceMotion, scale]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { shown, popStyle };
}
