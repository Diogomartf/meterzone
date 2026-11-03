import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGT } from 'gt-react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { FlatButton } from '@/game/FlatButton';
import { MainButton } from '@/game/MainButton';

const INFINITY = require('../../assets/images/howto-infinity.webp');
const CALENDAR = require('../../assets/images/howto-calendar.webp');

const CLOSE_ICON = { ios: 'xmark', android: 'close', web: 'close' } as const;
const PLAY_ICON = {
  ios: 'play.fill',
  android: 'play_arrow',
  web: 'play_arrow',
} as const;
const CHECK_ICON = {
  ios: 'checkmark',
  android: 'check',
  web: 'check',
} as const;

/** Parked below the screen; taller than the sheet ever gets. */
const OFFSCREEN = 700;

type Mode = {
  daily: boolean;
  label: string;
  description: string;
  art: number;
  artStyle: object;
  face: readonly [string, string];
  border: string;
  borderSelected: string;
};

type PlayModeSheetProps = {
  /** The mode played last, selected when the sheet opens. */
  daily: boolean;
  onPlay: (daily: boolean) => void;
  onClose: () => void;
};

/**
 * Short bottom sheet for picking Normal or Daily, then starting it. Rendered
 * only while open (inside the menu's modal); it animates in on mount and out
 * before calling `onClose`.
 */
export function PlayModeSheet({ daily, onPlay, onClose }: PlayModeSheetProps) {
  const gt = useGT();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(daily);
  const translateY = useSharedValue(OFFSCREEN);
  const dim = useSharedValue(0);

  useEffect(() => {
    dim.set(withTiming(1, { duration: 180 }));
    translateY.set(withSpring(0, { damping: 24, stiffness: 240, mass: 0.9 }));
  }, [dim, translateY]);

  const close = () => {
    dim.set(withTiming(0, { duration: 180 }));
    translateY.set(
      withTiming(OFFSCREEN, { duration: 220 }, (finished) => {
        if (finished) runOnJS(onClose)();
      }),
    );
  };

  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 900) {
        dim.set(withTiming(0, { duration: 160 }));
        translateY.set(
          withTiming(OFFSCREEN, { duration: 200 }, (finished) => {
            if (finished) runOnJS(onClose)();
          }),
        );
      } else {
        translateY.set(withSpring(0, { damping: 24, stiffness: 260 }));
      }
    });

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const modes: Mode[] = [
    {
      daily: false,
      label: gt('Normal'),
      description: gt('An endless run. Beat your personal best.'),
      art: INFINITY,
      artStyle: styles.artInfinity,
      face: ['#FFF7D1', '#FFE88F'],
      border: '#F5D66B',
      borderSelected: '#F2B705',
    },
    {
      daily: true,
      label: gt('Daily'),
      description: gt('Same challenge for everyone. A fresh start every day.'),
      art: CALENDAR,
      artStyle: styles.artCalendar,
      // Teal: leans toward the home screen's green Daily challenge button.
      face: ['#E9FBF6', '#BDEFE2'],
      border: '#94DCC9',
      borderSelected: '#14B394',
    },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.dim, dimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel={gt('Close')}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View collapsable={false}>
            <View style={styles.handleHit}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title} accessibilityRole="header">
                  {gt('PLAY MODE')}
                </Text>
                <Text style={styles.subtitle}>
                  {gt('Choose your next challenge.')}
                </Text>
              </View>
              <FlatButton
                onPress={close}
                icon={CLOSE_ICON}
                hitSlop={10}
                accessibilityLabel={gt('Close')}
              />
            </View>
          </View>
        </GestureDetector>

        <View style={styles.options} accessibilityRole="radiogroup">
          {modes.map((mode) => {
            const on = mode.daily === selected;
            return (
              <Pressable
                key={mode.label}
                onPress={() => setSelected(mode.daily)}
                style={({ pressed }) => [pressed && styles.optionPressed]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${mode.label}. ${mode.description}`}
              >
                <LinearGradient
                  colors={mode.face}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.option,
                    {
                      borderColor: on ? mode.borderSelected : mode.border,
                    },
                    on && styles.optionSelected,
                  ]}
                >
                  <View style={styles.artSlot}>
                    <Image
                      source={mode.art}
                      style={mode.artStyle}
                      contentFit="contain"
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{mode.label}</Text>
                    <Text style={styles.optionDescription}>
                      {mode.description}
                    </Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? (
                      <SymbolView
                        name={CHECK_ICON}
                        size={16}
                        tintColor={GameColors.white}
                        weight="black"
                      />
                    ) : null}
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <MainButton
          // Daily matches the home screen's green Daily challenge button.
          tone={selected ? 'green' : 'gold'}
          size="large"
          icon={PLAY_ICON}
          label={selected ? gt('PLAY DAILY') : gt('PLAY NORMAL')}
          // Silent like the home PLAY: it drops straight into the countdown.
          clickSound={false}
          onPress={() => onPlay(selected)}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26,28,44,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E8F7FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: GameColors.ink,
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 18,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 52,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26,28,44,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 4,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: GameFonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: GameColors.ink,
  },
  subtitle: {
    fontFamily: GameFonts.soft,
    fontSize: 16,
    lineHeight: 21,
    color: 'rgba(26,28,44,0.7)',
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 104,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 22,
    borderWidth: 2,
  },
  optionSelected: {
    borderWidth: 3,
  },
  optionPressed: {
    transform: [{ scale: 0.98 }],
  },
  artSlot: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artInfinity: {
    width: 86,
    height: 44,
  },
  artCalendar: {
    width: 72,
    height: 72,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: GameColors.ink,
  },
  optionDescription: {
    fontFamily: GameFonts.soft,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(26,28,44,0.78)',
  },
  radio: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: 'rgba(26,28,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: GameColors.ink,
    backgroundColor: GameColors.ink,
  },
});
