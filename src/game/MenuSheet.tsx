import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors } from '@/constants/gameTheme';
import {
  ActionRow,
  HighscoreCard,
  ModeRow,
  SupportCard,
  ToggleRow,
  type HighscoreKind,
} from '@/game/menuRows';
import { styles } from '@/game/menuSheetStyles';
import { captureAndShare } from '@/game/share';

const LOGO = require('../../assets/images/zone-meter-logo.png');

type MenuView = 'menu' | 'mode' | 'highscores' | 'howto' | 'settings';

type MenuSheetProps = {
  visible: boolean;
  soundOn: boolean;
  hapticsOn: boolean;
  /** Show go-back when a run is in progress or finished */
  canGoBack: boolean;
  dailyMode: boolean;
  /** View to show when the sheet opens (defaults to the menu root). */
  initialView?: MenuView;
  highScore: number;
  bestLevel: number;
  dailyTodayScore: number;
  dailyTodayLevel: number;
  dailyRecordScore: number;
  dailyRecordLevel: number;
  dailyRecordDate: string;
  onClose: () => void;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onGoBack: () => void;
  onStartMode: (daily: boolean) => void;
  onSendFeedback: () => void;
  onDeleteData: () => void;
};

export function MenuSheet({
  visible,
  soundOn,
  hapticsOn,
  canGoBack,
  dailyMode,
  initialView = 'menu',
  highScore,
  bestLevel,
  dailyTodayScore,
  dailyTodayLevel,
  dailyRecordScore,
  dailyRecordLevel,
  dailyRecordDate,
  onClose,
  onToggleSound,
  onToggleHaptics,
  onGoBack,
  onStartMode,
  onSendFeedback,
  onDeleteData,
}: MenuSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetH = Math.round(windowH * 0.78);
  const translateY = useSharedValue(sheetH);
  const overlayOpacity = useSharedValue(0);
  const [view, setView] = useState<MenuView>('menu');
  const [sharingKind, setSharingKind] = useState<HighscoreKind | null>(null);
  const normalShareRef = useRef<View>(null);
  const todayShareRef = useRef<View>(null);
  const recordShareRef = useRef<View>(null);
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  // Reset to the requested view when the sheet opens. Done during render rather than
  // in an effect so the first painted frame already shows the right view.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setView(initialView);
  }

  useEffect(() => {
    if (visible) {
      // Park off-screen + invisible before springing in so Modal mount can't flash.
      translateY.set(sheetH);
      overlayOpacity.set(0);
      overlayOpacity.set(withTiming(1, { duration: 180 }));
      translateY.set(withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 }));
    } else {
      translateY.set(sheetH);
      overlayOpacity.set(0);
    }
  }, [visible, sheetH, translateY, overlayOpacity]);

  const dismiss = () => {
    overlayOpacity.set(withTiming(0, { duration: 180 }));
    translateY.set(
      withTiming(sheetH, { duration: 220 }, (finished) => {
        if (finished) runOnJS(onClose)();
      }),
    );
  };

  const confirmDeleteData = () => {
    Alert.alert(
      'Delete all data?',
      'This clears high score, best level, coins, and unlocks. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDeleteData,
        },
      ],
    );
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const title =
    view === 'menu'
      ? 'MENU'
      : view === 'mode'
        ? 'PLAY MODE'
        : view === 'highscores'
          ? 'HALL OF FAME'
          : view === 'howto'
            ? 'HOW TO PLAY'
            : 'SETTINGS';

  const formatDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const recordMeta =
    dailyRecordDate.length > 0 ? formatDay(dailyRecordDate) : undefined;

  const shareCaption = 'Can you top that?';

  const shareHighscore = async (kind: HighscoreKind) => {
    if (sharingKind) return;
    const target =
      kind === 'normal'
        ? normalShareRef.current
        : kind === 'today'
          ? todayShareRef.current
          : recordShareRef.current;

    // Re-renders the card with its logo and without the share button, so the
    // capture below picks up the shareable framing.
    setSharingKind(kind);
    try {
      await captureAndShare(target, { message: shareCaption });
    } catch {
      Alert.alert('Share failed', 'Could not create the share image.');
    } finally {
      setSharingKind(null);
    }
  };

  // Handle + header only. Wrapping the whole sheet in a Pan gesture steals
  // vertical movement from ScrollView on a lot of Android devices.
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
      overlayOpacity.set(Math.max(0, 1 - e.translationY / sheetH));
    })
    .onEnd((e) => {
      const shouldClose = e.translationY > 110 || e.velocityY > 900;
      if (shouldClose) {
        overlayOpacity.set(withTiming(0, { duration: 160 }));
        translateY.set(
          withTiming(sheetH, { duration: 200 }, (finished) => {
            if (finished) runOnJS(onClose)();
          }),
        );
      } else {
        overlayOpacity.set(withTiming(1, { duration: 160 }));
        translateY.set(withSpring(0, { damping: 22, stiffness: 240 }));
      }
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={view === 'menu' ? dismiss : () => setView('menu')}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.overlayRoot}>
        <Animated.View
          style={[styles.overlay, styles.overlayHidden, overlayStyle]}
        >
          <Pressable
            style={styles.dismissArea}
            onPress={dismiss}
            accessibilityLabel="Dismiss menu"
          />
          <Animated.View
            collapsable={false}
            style={[
              styles.sheet,
              {
                height: sheetH,
                paddingBottom: Math.max(insets.bottom, 18) + 10,
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View collapsable={false}>
                <View style={styles.handleHit}>
                  <View style={styles.handle} />
                </View>

                <View style={styles.header}>
                  {view !== 'menu' ? (
                    <Pressable
                      onPress={() => setView('menu')}
                      style={({ pressed }) => [
                        styles.backBtn,
                        pressed && styles.closeBtnPressed,
                      ]}
                      hitSlop={10}
                      accessibilityLabel="Back"
                    >
                      <Text style={styles.backBtnText}>‹</Text>
                    </Pressable>
                  ) : null}
                  <Text
                    style={[styles.title, view === 'menu' && styles.titleRoot]}
                  >
                    {title}
                  </Text>
                  <Pressable
                    onPress={dismiss}
                    style={({ pressed }) => [
                      styles.closeBtn,
                      pressed && styles.closeBtnPressed,
                    ]}
                    hitSlop={10}
                    accessibilityLabel="Close"
                  >
                    <Text style={styles.closeBtnText}>DONE</Text>
                  </Pressable>
                </View>
              </View>
            </GestureDetector>

            <View style={styles.body}>
              {view === 'menu' ? (
                <ScrollView
                  style={styles.menuScroll}
                  contentContainerStyle={styles.menuScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {canGoBack ? (
                    <Pressable
                      onPress={onGoBack}
                      style={({ pressed }) => [
                        styles.startOverBtn,
                        pressed && styles.closeBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                    >
                      <Text style={styles.startOverBtnText}>GO BACK</Text>
                    </Pressable>
                  ) : null}

                  <SupportCard />

                  <View style={styles.card}>
                    <ActionRow
                      label="Play mode"
                      subtitle={dailyMode ? 'Daily challenge' : 'Normal run'}
                      onPress={() => setView('mode')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="Hall of fame"
                      subtitle="Normal, today & best daily"
                      onPress={() => setView('highscores')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="Settings"
                      subtitle="Sound, haptics & data"
                      onPress={() => setView('settings')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="How to play"
                      subtitle="Goal, Normal & Daily"
                      onPress={() => setView('howto')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="Send feedback"
                      subtitle="Ideas, bugs, or love notes"
                      onPress={onSendFeedback}
                    />
                  </View>
                </ScrollView>
              ) : null}

              {view === 'mode' ? (
                <View style={styles.card}>
                  <ModeRow
                    label="Normal"
                    subtitle="Classic endless run"
                    selected={!dailyMode}
                    onPress={() => onStartMode(false)}
                  />
                  <View style={styles.divider} />
                  <ModeRow
                    label="Daily"
                    subtitle="Same sequence for everyone · updates daily"
                    selected={dailyMode}
                    onPress={() => onStartMode(true)}
                  />
                </View>
              ) : null}

              {view === 'highscores' ? (
                <ScrollView
                  style={styles.hsScroll}
                  contentContainerStyle={styles.hsList}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <View
                    ref={normalShareRef}
                    collapsable={false}
                    style={[
                      styles.hsCapture,
                      sharingKind === 'normal' && styles.hsCaptureShot,
                    ]}
                  >
                    {sharingKind === 'normal' ? (
                      <Image
                        source={LOGO}
                        style={styles.hsLogo}
                        contentFit="contain"
                      />
                    ) : null}
                    <HighscoreCard
                      badge="NORMAL"
                      accent={GameColors.xpGold}
                      accentDeep="#D97706"
                      score={highScore}
                      level={bestLevel}
                      emptyHint="Beat the meter. Own the board."
                      hideShare={sharingKind === 'normal'}
                      onShare={() => void shareHighscore('normal')}
                    />
                  </View>
                  <View
                    ref={todayShareRef}
                    collapsable={false}
                    style={[
                      styles.hsCapture,
                      sharingKind === 'today' && styles.hsCaptureShot,
                    ]}
                  >
                    {sharingKind === 'today' ? (
                      <Image
                        source={LOGO}
                        style={styles.hsLogo}
                        contentFit="contain"
                      />
                    ) : null}
                    <HighscoreCard
                      badge="TODAY"
                      accent={GameColors.playBlue}
                      accentDeep={GameColors.playBlueDark}
                      score={dailyTodayScore}
                      level={dailyTodayLevel}
                      emptyHint="Same challenge for everyone. Go!"
                      hideShare={sharingKind === 'today'}
                      onShare={() => void shareHighscore('today')}
                    />
                  </View>
                  <View
                    ref={recordShareRef}
                    collapsable={false}
                    style={[
                      styles.hsCapture,
                      sharingKind === 'record' && styles.hsCaptureShot,
                    ]}
                  >
                    {sharingKind === 'record' ? (
                      <Image
                        source={LOGO}
                        style={styles.hsLogo}
                        contentFit="contain"
                      />
                    ) : null}
                    <HighscoreCard
                      badge="BEST DAILY"
                      accent={GameColors.bubble}
                      accentDeep={GameColors.bubbleDark}
                      score={dailyRecordScore}
                      level={dailyRecordLevel}
                      meta={recordMeta}
                      emptyHint="Your greatest daily still awaits."
                      hideShare={sharingKind === 'record'}
                      onShare={() => void shareHighscore('record')}
                    />
                  </View>
                </ScrollView>
              ) : null}

              {view === 'howto' ? (
                <ScrollView
                  style={styles.menuScroll}
                  contentContainerStyle={styles.menuScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.card}>
                    <View style={styles.infoBlock}>
                      <Text style={styles.rowLabel}>The goal</Text>
                      <Text style={styles.rowSub}>
                        Watch the meter rise, then tap once to stop it inside
                        the zone. Perfect, Great, and Nice keep you going and
                        stack combos. Miss and you lose a heart.
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoBlock}>
                      <Text style={styles.rowLabel}>Normal</Text>
                      <Text style={styles.rowSub}>
                        A classic endless run. Levels get tougher as you climb —
                        chase your all-time high score.
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoBlock}>
                      <Text style={styles.rowLabel}>Daily</Text>
                      <Text style={styles.rowSub}>
                        The same sequence for everyone that day, so scores are
                        fair to compare. A fresh challenge every day.
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              ) : null}

              {view === 'settings' ? (
                <ScrollView
                  style={styles.menuScroll}
                  contentContainerStyle={styles.menuScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.card}>
                    <ToggleRow
                      label="Sound"
                      subtitle="Effects & countdown ticks"
                      value={soundOn}
                      onPress={onToggleSound}
                    />
                    <View style={styles.divider} />
                    <ToggleRow
                      label="Haptics"
                      subtitle="Vibration on taps & results"
                      value={hapticsOn}
                      onPress={onToggleHaptics}
                    />
                  </View>

                  <View style={styles.card}>
                    <ActionRow
                      label="Delete data"
                      subtitle="High score, progress & unlocks"
                      onPress={confirmDeleteData}
                      destructive
                    />
                  </View>
                </ScrollView>
              ) : null}
            </View>

            <Text style={styles.version}>MeterZone · v{version}</Text>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
