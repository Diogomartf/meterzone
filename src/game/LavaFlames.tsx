import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Hot core at the base, fading to nothing at the tip. */
const FLAME = [
  'rgba(255,60,20,0.15)',
  '#FF4A1A',
  '#FF8A1A',
  '#FFC93A',
] as const;
const FLAME_AT = [0, 0.25, 0.6, 1] as const;
const HEAT = ['rgba(255,120,30,0)', 'rgba(255,120,30,0.55)'] as const;

/** Small licks every few px across the surface. */
const TONGUE_COUNT = 16;
const TONGUE_W = 5;
/** Uneven resting heights, so the edge is ragged before it even moves. */
const HEIGHTS = [6, 4, 5, 3, 6, 5, 4, 6, 3, 5, 6, 4, 5, 3, 6, 4] as const;

/**
 * Four flicker groups, each with its own beat. Tongues are dealt to them in
 * a scrambled order, so neighbours never share a beat and the row looks
 * random, while the whole fire costs only four style updates a frame.
 * Beats are whole flickers per loop, so the loop restarts without a jump.
 */
const GROUPS = [
  { beat: 6, wobble: 13, crackle: 29, phase: 0 },
  { beat: 8, wobble: 17, crackle: 31, phase: 0.37 },
  { beat: 10, wobble: 19, crackle: 37, phase: 0.71 },
  { beat: 13, wobble: 23, crackle: 41, phase: 0.18 },
] as const;
const DEAL = [0, 2, 1, 3, 2, 0, 3, 1, 3, 0, 2, 1, 0, 3, 1, 2] as const;
const TONGUES = Array.from({ length: TONGUE_COUNT }, (_, i) => ({
  x: (i + 0.5) / TONGUE_COUNT,
  h: HEIGHTS[i],
  group: DEAL[i],
}));
const GROUP_TONGUES = GROUPS.map((_, g) =>
  TONGUES.filter((t) => t.group === g),
);

/** Long loop, so the pattern takes a while to repeat. */
const LOOP_MS = 4800;

/** One flicker group: its tongues share a single animated style. */
function TongueSet({
  clock,
  tongues,
  beat,
  wobble,
  crackle,
  phase,
  scale,
}: {
  clock: SharedValue<number>;
  tongues: readonly { x: number; h: number }[];
  beat: number;
  wobble: number;
  crackle: number;
  phase: number;
  scale: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.PI * 2 * (clock.value + phase);
    // Three unrelated beats summed: a slow lick, a wobble and a fast crackle.
    // They rarely line up, so the flicker looks random, like real fire.
    const lick =
      0.5 * Math.sin(t * beat) +
      0.3 * Math.sin(t * wobble + 1.3) +
      0.2 * Math.sin(t * crackle + 2.1);
    return {
      opacity: 0.75 + 0.25 * Math.sin(t * crackle),
      // Dips to about a third and jumps past full height.
      transform: [{ scaleY: 0.8 + 0.5 * lick }],
    };
  });
  const w = TONGUE_W * scale;
  return (
    <Animated.View style={[styles.set, style]} pointerEvents="none">
      {tongues.map(({ x, h }) => (
        <View
          key={x}
          style={[
            styles.tongue,
            {
              left: `${x * 100}%`,
              width: w,
              height: h * scale,
              marginLeft: -w / 2,
              borderTopLeftRadius: w,
              borderTopRightRadius: w,
            },
          ]}
        >
          <LinearGradient
            colors={FLAME}
            locations={FLAME_AT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * Flickering flames and heat haze riding on the lava's surface. They only
 * move while `active` (a round is filling) and hold still otherwise.
 */
export function LavaFlames({
  scale,
  active,
}: {
  scale: number;
  active: boolean;
}) {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [active, clock]);

  return (
    <View
      style={[styles.wrap, { height: 9 * scale, top: -9 * scale }]}
      pointerEvents="none"
    >
      <LinearGradient colors={HEAT} style={styles.heat} />
      {GROUPS.map((g, i) => (
        <TongueSet
          key={i}
          clock={clock}
          tongues={GROUP_TONGUES[i]}
          beat={g.beat}
          wobble={g.wobble}
          crackle={g.crackle}
          phase={g.phase}
          scale={scale}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  heat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  set: {
    ...StyleSheet.absoluteFill,
    // Scale from the surface, so the tongues stay rooted in the lava.
    transformOrigin: 'bottom',
  },
  tongue: {
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
  },
});
