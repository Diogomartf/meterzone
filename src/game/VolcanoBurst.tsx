import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';

const LAVA = {
  foam: '#FFF6A8',
  hot: '#FFE94A',
  mid: '#FF8A00',
  deep: '#FF3B1F',
  ember: '#E11D48',
} as const;

type BlobSpec = {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  dur: number;
  spin: number;
  color: string;
};

const BLOBS: BlobSpec[] = [
  { dx: 0, dy: -118, size: 28, delay: 0, dur: 720, spin: 16, color: LAVA.hot },
  {
    dx: -22,
    dy: -96,
    size: 22,
    delay: 20,
    dur: 680,
    spin: -24,
    color: LAVA.mid,
  },
  {
    dx: 26,
    dy: -100,
    size: 20,
    delay: 28,
    dur: 660,
    spin: 28,
    color: LAVA.deep,
  },
  {
    dx: -48,
    dy: -62,
    size: 18,
    delay: 40,
    dur: 620,
    spin: -36,
    color: LAVA.hot,
  },
  { dx: 46, dy: -68, size: 18, delay: 46, dur: 640, spin: 34, color: LAVA.mid },
  {
    dx: -12,
    dy: -138,
    size: 14,
    delay: 30,
    dur: 760,
    spin: 20,
    color: LAVA.foam,
  },
  {
    dx: 14,
    dy: -132,
    size: 13,
    delay: 36,
    dur: 740,
    spin: -16,
    color: LAVA.hot,
  },
  {
    dx: -36,
    dy: -88,
    size: 12,
    delay: 55,
    dur: 600,
    spin: -22,
    color: LAVA.ember,
  },
  {
    dx: 38,
    dy: -84,
    size: 12,
    delay: 60,
    dur: 600,
    spin: 26,
    color: LAVA.ember,
  },
  { dx: 0, dy: -72, size: 24, delay: 8, dur: 560, spin: 8, color: LAVA.deep },
];

function Blob({
  spec,
  burstKey,
  scale,
}: {
  spec: BlobSpec;
  burstKey: number;
  scale: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (burstKey <= 0) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      spec.delay,
      withTiming(1, { duration: spec.dur, easing: Easing.out(Easing.cubic) }),
    );
  }, [burstKey, spec.delay, spec.dur, t]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    const rise = 1 - (1 - p) * (1 - p);
    const fade = p < 0.58 ? 1 : Math.max(0, 1 - (p - 0.58) / 0.42);
    return {
      opacity: fade,
      transform: [
        { translateX: spec.dx * rise * scale },
        { translateY: spec.dy * rise * scale },
        { scale: (0.7 + 0.55 * (1 - p * 0.35)) * scale },
        { rotate: `${spec.spin * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          width: spec.size,
          height: spec.size,
          marginLeft: -spec.size / 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

type Props = {
  burstKey: number;
  /** Distance from the screen bottom to the meter cap. */
  bottom: number;
  scale?: number;
};

/**
 * Cartoon volcano gush from the meter rim when the fill tops out —
 * a lava dome, a column, and hot blobs, independent of the equipped skin.
 */
export function VolcanoBurst({ burstKey, bottom, scale = 1 }: Props) {
  const glow = useSharedValue(0);
  const dome = useSharedValue(0);
  const column = useSharedValue(0);

  useEffect(() => {
    if (burstKey <= 0) {
      glow.value = 0;
      dome.value = 0;
      column.value = 0;
      return;
    }
    glow.value = 0;
    dome.value = 0;
    column.value = 0;
    glow.value = withTiming(1, {
      duration: 820,
      easing: Easing.out(Easing.quad),
    });
    dome.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withDelay(
        280,
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
      ),
    );
    column.value = withSequence(
      withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withDelay(
        220,
        withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [burstKey, column, dome, glow]);

  const glowStyle = useAnimatedStyle(() => {
    const p = glow.value;
    const fade = p < 0.2 ? p / 0.2 : Math.max(0, 1 - (p - 0.2) / 0.8);
    return {
      opacity: fade,
      transform: [{ scale: (0.7 + p * 1.15) * scale }],
    };
  });

  const domeStyle = useAnimatedStyle(() => {
    const p = dome.value;
    return {
      opacity: p,
      transform: [
        { translateY: -10 * p * scale },
        { scaleX: (0.7 + 0.55 * p) * scale },
        { scaleY: (0.45 + 0.9 * p) * scale },
      ],
    };
  });

  const columnStyle = useAnimatedStyle(() => {
    const p = column.value;
    return {
      opacity: Math.min(1, p * 1.4) * (p > 0.75 ? (1 - p) / 0.25 : 1),
      transform: [
        { translateY: -36 * p * scale },
        { scaleX: (0.85 + 0.2 * (1 - p)) * scale },
        { scaleY: (0.35 + 1.15 * p) * scale },
      ],
    };
  });

  if (burstKey <= 0) return null;

  return (
    <View pointerEvents="none" style={[styles.anchor, { bottom }]}>
      <View style={styles.origin}>
        <Animated.View style={[styles.glow, glowStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,233,74,0)',
              '#FFE94A',
              '#FF8A00',
              'rgba(255,59,31,0)',
            ]}
            locations={[0, 0.28, 0.62, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.column, columnStyle]}>
          <LinearGradient
            colors={[LAVA.foam, LAVA.hot, LAVA.mid, LAVA.deep]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.dome, domeStyle]}>
          <LinearGradient
            colors={[LAVA.foam, LAVA.hot, LAVA.mid]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {BLOBS.map((spec, i) => (
          <Blob
            key={`${burstKey}-${i}`}
            spec={spec}
            burstKey={burstKey}
            scale={scale}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 28,
  },
  origin: {
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    marginLeft: -80,
    marginTop: -80,
    borderRadius: 80,
  },
  column: {
    position: 'absolute',
    width: 28,
    height: 72,
    marginLeft: -14,
    marginTop: -72,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  dome: {
    position: 'absolute',
    width: 72,
    height: 40,
    marginLeft: -36,
    marginTop: -28,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
  },
});
