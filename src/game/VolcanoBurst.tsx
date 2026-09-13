import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';

type BlobSpec = {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  dur: number;
  spin: number;
  color: string;
};

function makeBlobs(colors: readonly string[]): BlobSpec[] {
  const hot = colors[0] ?? '#FFE94A';
  const mid = colors[1] ?? '#FF5A1F';
  const deep = colors[2] ?? '#E11D48';
  return [
    { dx: 0, dy: -92, size: 22, delay: 0, dur: 620, spin: 18, color: hot },
    { dx: -26, dy: -74, size: 16, delay: 20, dur: 560, spin: -28, color: mid },
    { dx: 30, dy: -70, size: 15, delay: 30, dur: 540, spin: 32, color: deep },
    { dx: -44, dy: -48, size: 12, delay: 50, dur: 500, spin: -40, color: hot },
    { dx: 42, dy: -52, size: 13, delay: 55, dur: 520, spin: 36, color: mid },
    { dx: -14, dy: -108, size: 10, delay: 40, dur: 640, spin: 22, color: hot },
    { dx: 16, dy: -102, size: 9, delay: 48, dur: 620, spin: -18, color: mid },
    { dx: 0, dy: -58, size: 18, delay: 10, dur: 480, spin: 8, color: deep },
  ];
}

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
    const fade = p < 0.62 ? 1 : Math.max(0, 1 - (p - 0.62) / 0.38);
    return {
      opacity: fade,
      transform: [
        { translateX: spec.dx * rise * scale },
        { translateY: spec.dy * rise * scale },
        { scale: (0.55 + 0.7 * (1 - p * 0.4)) * scale },
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
          marginTop: -spec.size / 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

type Props = {
  burstKey: number;
  colors: readonly string[];
  /** Distance from the screen bottom to the meter cap. */
  bottom: number;
  scale?: number;
};

/**
 * Cartoon lava gush from the meter rim when the fill tops out.
 * Skin colors drive the blobs so Ice / Gold still feel like a geyser.
 */
export function VolcanoBurst({ burstKey, colors, bottom, scale = 1 }: Props) {
  const glow = useSharedValue(0);
  const blobs = useMemo(() => makeBlobs(colors), [colors]);
  const hot = colors[0] ?? '#FFE94A';
  const mid = colors[2] ?? '#FF5A1F';

  useEffect(() => {
    if (burstKey <= 0) {
      glow.value = 0;
      return;
    }
    glow.value = 0;
    glow.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.quad),
    });
  }, [burstKey, glow]);

  const glowStyle = useAnimatedStyle(() => {
    const p = glow.value;
    const fade = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    return {
      opacity: fade * 0.95,
      transform: [{ scale: (0.55 + p * 1.35) * scale }],
    };
  });

  if (burstKey <= 0) return null;

  return (
    <View pointerEvents="none" style={[styles.anchor, { bottom }]}>
      <Animated.View style={[styles.glow, glowStyle]}>
        <LinearGradient
          colors={[`${hot}00`, `${hot}CC`, `${mid}99`, `${mid}00`]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {blobs.map((spec, i) => (
        <Blob
          key={`${burstKey}-${i}`}
          spec={spec}
          burstKey={burstKey}
          scale={scale}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 28,
  },
  glow: {
    position: 'absolute',
    bottom: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  blob: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
  },
});
