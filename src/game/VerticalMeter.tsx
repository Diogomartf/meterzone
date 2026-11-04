import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
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

import { GameColors } from '@/constants/gameTheme';
import { liquidSurface, type SkinDef } from '@/game/skins';

type Props = {
  fill: SharedValue<number>;
  zoneTarget: SharedValue<number>;
  zoneHalf: SharedValue<number>;
  /** Perfect half-band, as a fraction of the tube (same units as fill) */
  perfectHalf: number;
  /** Great half-band, as a fraction of the tube (same units as fill) */
  greatHalf: number;
  skin: SkinDef;
  /** Visual scale of the meter tube */
  scale?: number;
  /** Drive liquid surface wobble only while filling */
  active?: boolean;
};

// One geometry for the shell, the glass and everything inside it, so the
// liquid, the zone and the ticks all measure the same play area.
export const METER_BASE_H = 340;
export const METER_BASE_W = 100;
/** Space the cap and base add around the shell, top and bottom together. */
export const METER_WRAP_EXTRA = 28;
const SHELL_BORDER = 4;
const SHELL_PAD = 9;
const GLASS_BORDER = 3;
/** How far the shell's bottom sits above the wrap's: the base overlaps it. */
const BASE_VISIBLE = 10;

/** Height of the play area inside the glass, where fill 0–1 is drawn. */
export function meterInnerHeight(scale: number) {
  return (
    METER_BASE_H * scale - 2 * (SHELL_BORDER + SHELL_PAD * scale + GLASS_BORDER)
  );
}

/** Distance from the wrap's bottom to fill 0, the floor of the play area. */
export function meterFloor(scale: number) {
  return BASE_VISIBLE + SHELL_BORDER + SHELL_PAD * scale + GLASS_BORDER;
}

const TICK_COUNT = 9;
const MIN_LIQUID_PX = 14;
/** The Perfect band never draws thinner than this, so it stays visible. */
const MIN_PERFECT_PX = 2;

/** Target bands: Nice purple, Great orange, Perfect yellow. */
const EYE = {
  nice: ['#5B1E8C', '#7A32B0', '#5B1E8C'],
  great: ['#E8551F', '#FF7A3D', '#E8551F'],
  perfect: '#FFE44A',
  glow: 'rgba(255,190,90,0.22)',
} as const;

/** Light from the upper left: bright left edge, darker right edge. */
const FRAME_LIGHT = [
  'rgba(255,255,255,0.32)',
  'rgba(255,255,255,0.06)',
  'rgba(0,0,0,0)',
  'rgba(0,0,0,0.22)',
] as const;
const FRAME_LIGHT_STOPS = [0, 0.28, 0.62, 1] as const;

function VerticalMeterComponent({
  fill,
  zoneTarget,
  zoneHalf,
  perfectHalf,
  greatHalf,
  skin,
  scale = 1,
  active = false,
}: Props) {
  const meterH = METER_BASE_H * scale;
  const meterW = METER_BASE_W * scale;
  const innerH = meterInnerHeight(scale);
  const wobble = useSharedValue(0.5);
  const surface = useMemo(() => liquidSurface(skin), [skin]);

  const greatPx = 2 * greatHalf * innerH;
  const perfectPx = Math.max(MIN_PERFECT_PX, 2 * perfectHalf * innerH);

  useEffect(() => {
    if (active) {
      wobble.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      return;
    }
    cancelAnimation(wobble);
    wobble.value = withTiming(0.5, { duration: 180 });
  }, [active, wobble]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => ({
        at: (i + 1) / (TICK_COUNT + 1),
        long: i % 2 === 1,
      })),
    [],
  );

  // Fixed-height liquid slides up via translateY — avoids layout thrash on fill.
  const liquidStyle = useAnimatedStyle(() => {
    const t = Math.max(MIN_LIQUID_PX / innerH, fill.value);
    return {
      transform: [{ translateY: (1 - t) * innerH }],
    };
  });

  // Decorative only: the liquid's top edge stays exactly at the fill.
  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (wobble.value - 0.5) * 2 }],
  }));

  // Each zone layer is a full-height box centred on the target.
  const zoneUnderStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (0.5 - zoneTarget.value) * innerH }],
  }));
  const zoneOverStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (0.5 - zoneTarget.value) * innerH }],
  }));
  // Nice tracks zoneHalf live, since a shrinking zone narrows it mid-fill.
  const niceUnderStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0, zoneHalf.value * 2) }],
  }));
  const niceOverStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0, zoneHalf.value * 2) }],
  }));
  // The glow sits just outside the Nice band, never inside the hit area.
  const glowStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: Math.max(0, zoneHalf.value * 2) + (14 * scale) / innerH },
    ],
  }));

  const centred = (h: number) => ({ top: (innerH - h) / 2, height: h });

  return (
    <View
      style={[
        styles.wrap,
        { width: meterW + 24, height: meterH + METER_WRAP_EXTRA },
      ]}
    >
      <View
        style={[
          styles.pipeCap,
          {
            width: meterW + 16,
            backgroundColor: skin.shell,
            borderRadius: 12 * scale,
          },
        ]}
      >
        <LinearGradient
          colors={FRAME_LIGHT}
          locations={FRAME_LIGHT_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.4 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
      <View
        style={[
          styles.shell,
          {
            width: meterW,
            height: meterH,
            borderRadius: 24 * scale,
            backgroundColor: skin.shell,
            padding: SHELL_PAD * scale,
          },
        ]}
      >
        <LinearGradient
          colors={FRAME_LIGHT}
          locations={FRAME_LIGHT_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.15 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.glass, { borderRadius: 18 * scale }]}>
          {/* Navy interior, darker toward the edges for depth */}
          <LinearGradient
            colors={['#020816', '#0B1D42', '#0B1D42', '#020816']}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Target, under the liquid */}
          <Animated.View
            style={[styles.zone, { height: innerH }, zoneUnderStyle]}
            pointerEvents="none"
          >
            <Animated.View style={[styles.zoneFull, glowStyle]}>
              <LinearGradient
                colors={['rgba(255,190,90,0)', EYE.glow, 'rgba(255,190,90,0)']}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View style={[styles.zoneFull, niceUnderStyle]}>
              <LinearGradient
                colors={EYE.nice}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <LinearGradient
              colors={EYE.great}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.band, centred(greatPx)]}
            />
          </Animated.View>

          <Animated.View
            style={[styles.liquidWrap, { height: innerH }, liquidStyle]}
          >
            <LinearGradient
              colors={[...surface.glow]}
              locations={[0, 0.55, 1]}
              style={styles.surfaceGlow}
              pointerEvents="none"
            />
            <LinearGradient
              colors={[...skin.liquid]}
              locations={[0, 0.18, 0.42, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Bright left, rich centre, slightly darker right */}
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.3)',
                'rgba(255,255,255,0.06)',
                'rgba(0,0,0,0)',
                'rgba(0,0,0,0.2)',
              ]}
              locations={[0, 0.3, 0.6, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Shallow meniscus with a thin bright rim */}
            <Animated.View
              style={[styles.meniscus, rippleStyle]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[...surface.foam]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.meniscusRim} />
            </Animated.View>
          </Animated.View>

          {/* Target again, see-through above the liquid so it never hides */}
          <Animated.View
            style={[
              styles.zone,
              styles.zoneOver,
              { height: innerH },
              zoneOverStyle,
            ]}
            pointerEvents="none"
          >
            <Animated.View
              style={[styles.zoneFull, styles.overlayNice, niceOverStyle]}
            />
            <View
              style={[styles.band, styles.overlayGreat, centred(greatPx)]}
            />
            <View
              style={[
                styles.band,
                styles.perfect,
                centred(perfectPx),
                { shadowRadius: 5 * scale },
              ]}
            />
          </Animated.View>

          <View style={styles.ticks} pointerEvents="none">
            {ticks.map(({ at, long }) => (
              <View
                key={at}
                style={[
                  styles.tick,
                  {
                    bottom: at * innerH,
                    width: (long ? 10 : 6) * scale,
                    height: Math.max(1, 1.5 * scale),
                  },
                ]}
              />
            ))}
          </View>

          {/* Glass: a soft vertical streak and a short curved glint up top */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.2)',
              'rgba(255,255,255,0.2)',
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.2, 0.75, 1]}
            style={[styles.glassStreak, { width: 5 * scale }]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.glassGlint,
              {
                width: 22 * scale,
                height: 22 * scale,
                borderTopLeftRadius: 16 * scale,
              },
            ]}
            pointerEvents="none"
          />
        </View>
      </View>
      <View
        style={[
          styles.pipeBase,
          {
            width: meterW + 22,
            backgroundColor: skin.shellDark,
            borderRadius: 10 * scale,
          },
        ]}
      >
        <LinearGradient
          colors={FRAME_LIGHT}
          locations={FRAME_LIGHT_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.4 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

export const VerticalMeter = memo(VerticalMeterComponent);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pipeCap: {
    height: 20,
    borderWidth: 4,
    borderColor: GameColors.ink,
    marginBottom: -8,
    zIndex: 2,
    overflow: 'hidden',
  },
  shell: {
    borderWidth: SHELL_BORDER,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  glass: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: GameColors.meterInner,
    borderWidth: GLASS_BORDER,
    borderColor: GameColors.ink,
  },
  zone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  zoneOver: {
    zIndex: 4,
  },
  zoneFull: {
    ...StyleSheet.absoluteFill,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  overlayNice: {
    backgroundColor: 'rgba(160,90,230,0.3)',
  },
  overlayGreat: {
    backgroundColor: 'rgba(255,122,61,0.4)',
  },
  perfect: {
    backgroundColor: EYE.perfect,
    shadowColor: EYE.perfect,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  liquidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
    zIndex: 3,
  },
  surfaceGlow: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: -14,
    height: 26,
  },
  meniscus: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: -2,
    height: 8,
    // A wide, flat ellipse: the edges dip, so the surface reads curved.
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    overflow: 'hidden',
  },
  meniscusRim: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  ticks: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
  tick: {
    position: 'absolute',
    right: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  glassStreak: {
    position: 'absolute',
    left: 6,
    top: 14,
    bottom: 14,
    borderRadius: 999,
    zIndex: 6,
  },
  glassGlint: {
    position: 'absolute',
    left: 12,
    top: 8,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.45)',
    zIndex: 6,
  },
  pipeBase: {
    height: 16,
    marginTop: -6,
    borderWidth: 4,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
});
