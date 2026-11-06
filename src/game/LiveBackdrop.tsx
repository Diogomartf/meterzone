import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const CLOUDS = require('../../assets/images/game-bg-clouds.webp');
const STAR = require('../../assets/images/game-star.webp');
const STAR_FAINT = require('../../assets/images/game-star-faint.webp');

/** How far each cloud bank drifts off-screen and back. */
const CLOUD_DRIFT = 14;
/** Each bank drifts at its own pace, so they never mirror each other. */
const CLOUD_LEFT_MS = 15000;
const CLOUD_RIGHT_MS = 19000;

/** The backdrop art's size, which the star positions below are measured in. */
const ART_W = 852;
const ART_H = 1846;

/** Star sprites' size in the art. */
const STAR_SIZE = 44;
const STAR_FAINT_SIZE = 20;

/** Bright sparkles' centres, top to bottom. */
const STARS: readonly (readonly [number, number])[] = [
  [74, 318],
  [761, 348],
  [212, 390],
  [647, 437],
  [114, 476],
  [730, 546],
  [249, 589],
  [594, 661],
  [116, 722],
  [722, 782],
  [226, 911],
  [627, 960],
  [149, 1128],
  [747, 1155],
  [263, 1262],
  [574, 1265],
];

/** Faint stars' centres, top to bottom. */
const STARS_FAINT: readonly (readonly [number, number])[] = [
  [100, 375],
  [746, 415],
  [155, 455],
  [152, 574],
  [119, 647],
  [683, 651],
  [681, 784],
  [164, 810],
  [728, 835],
  [126, 862],
  [694, 929],
  [137, 958],
  [730, 1002],
  [101, 1059],
  [147, 1120],
  [726, 1151],
  [146, 1184],
  [130, 1282],
  [286, 1359],
  [566, 1362],
  [515, 1393],
];

/**
 * One group of stars per period, dealt in turn, so neighbours never brighten
 * together. The periods share no rhythm, which keeps the groups out of step.
 */
const STAR_PERIODS = [2600, 3400, 4300, 5300];
const STAR_FAINT_PERIODS = [4700, 6100, 7900];
/** How far each kind fades. Faint stars go almost out. */
const STAR_DIMMEST = 0.25;
const STAR_FAINT_DIMMEST = 0.1;

/** Easing back to the rest pose before looping again after a pause. */
const SETTLE_MS = 1200;

/**
 * Runs 0 to 1 and back on the UI thread. 0 is the rest pose: the art as drawn,
 * which is also what reduced motion shows.
 */
function useSway(durationMs: number, paused: boolean) {
  const sway = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const still = paused || reduceMotion;

  useEffect(() => {
    if (still) {
      cancelAnimation(sway);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    sway.value = withSequence(
      withTiming(0, { duration: SETTLE_MS, easing: ease }),
      withRepeat(
        withTiming(1, { duration: durationMs, easing: ease }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(sway);
  }, [durationMs, still, sway]);

  return sway;
}

function CloudBank({
  sway,
  side,
}: {
  sway: SharedValue<number>;
  side: 'left' | 'right';
}) {
  const sign = side === 'left' ? -1 : 1;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: sign * CLOUD_DRIFT * sway.value }],
  }));
  return (
    <Animated.View style={[styles.half, styles[side], style]}>
      {/* Twice the half's width: the full layer, clipped to this bank. */}
      <Image
        source={CLOUDS}
        style={[styles.bankArt, styles[side]]}
        contentFit="cover"
      />
    </Animated.View>
  );
}

function StarGroup({
  source,
  size,
  stars,
  periodMs,
  dimmest,
  paused,
}: {
  source: number;
  size: number;
  stars: readonly (readonly [number, number])[];
  periodMs: number;
  dimmest: number;
  paused: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const sway = useSway(periodMs, paused);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - (1 - dimmest) * sway.value,
  }));
  // The same fit as the backdrop's `cover`, so stars land where the art has
  // room for them on any screen shape.
  const scale = Math.max(width / ART_W, height / ART_H);
  const left = (width - ART_W * scale) / 2;
  const top = (height - ART_H * scale) / 2;
  const side = size * scale;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {stars.map(([x, y]) => (
        <Image
          key={`${x},${y}`}
          source={source}
          style={{
            position: 'absolute',
            left: left + x * scale - side / 2,
            top: top + y * scale - side / 2,
            width: side,
            height: side,
          }}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Slow clouds and twinkling stars over the backdrop. The banks only ever drift
 * outwards, off-screen, so their cut edges never show.
 */
export function LiveBackdrop({ paused }: { paused: boolean }) {
  const cloudLeft = useSway(CLOUD_LEFT_MS, paused);
  const cloudRight = useSway(CLOUD_RIGHT_MS, paused);

  return (
    <>
      <CloudBank sway={cloudLeft} side="left" />
      <CloudBank sway={cloudRight} side="right" />
      {STAR_FAINT_PERIODS.map((periodMs, group, periods) => (
        <StarGroup
          key={periodMs}
          source={STAR_FAINT}
          size={STAR_FAINT_SIZE}
          stars={STARS_FAINT.filter((_, i) => i % periods.length === group)}
          periodMs={periodMs}
          dimmest={STAR_FAINT_DIMMEST}
          paused={paused}
        />
      ))}
      {STAR_PERIODS.map((periodMs, group, periods) => (
        <StarGroup
          key={periodMs}
          source={STAR}
          size={STAR_SIZE}
          stars={STARS.filter((_, i) => i % periods.length === group)}
          periodMs={periodMs}
          dimmest={STAR_DIMMEST}
          paused={paused}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  half: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    overflow: 'hidden',
  },
  left: { left: 0 },
  right: { right: 0 },
  bankArt: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '200%',
  },
});
