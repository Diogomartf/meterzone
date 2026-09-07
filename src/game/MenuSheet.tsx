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
import { useGT, useLocaleSelector, useMessages } from 'gt-react-native';

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
import { captureAndShare, shareScoreCaption } from '@/game/share';

const LOGO = require('../../assets/images/zone-meter-logo.png');

type MenuView =
  'menu' | 'mode' | 'highscores' | 'howto' | 'settings' | 'language';

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
  const gt = useGT();
  const m = useMessages();
  const {
    locale,
    locales: availableLocales,
    setLocale,
    getLocaleProperties,
  } = useLocaleSelector();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetH = Math.round(windowH * 0.92);
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
      gt('Delete all data?'),
      gt(
        'This clears high score, best level, coins, and unlocks. This cannot be undone.',
      ),
      [
        { text: gt('Cancel'), style: 'cancel' },
        {
          text: gt('Delete'),
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
      ? gt('MENU')
      : view === 'mode'
        ? gt('PLAY MODE')
        : view === 'highscores'
          ? gt('HALL OF FAME')
          : view === 'howto'
            ? gt('HOW TO PLAY')
            : view === 'language'
              ? gt('LANGUAGE')
              : gt('SETTINGS');

  const formatDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const recordMeta =
    dailyRecordDate.length > 0 ? formatDay(dailyRecordDate) : undefined;

  /** Each language is named in its own tongue, so it reads for its speaker. */
  const nativeName = (code: string) => {
    const { nativeLanguageName, languageName } = getLocaleProperties(code);
    return nativeLanguageName || languageName || code;
  };
  const currentLanguageName = nativeName(locale);

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
      await captureAndShare(target, { message: shareScoreCaption(m) });
    } catch {
      Alert.alert(gt('Share failed'), gt('Could not create the share image.'));
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
            accessibilityLabel={gt('Dismiss menu')}
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
                      accessibilityLabel={gt('Back')}
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
                    accessibilityLabel={gt('Close')}
                  >
                    <Text style={styles.closeBtnText}>{gt('DONE')}</Text>
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
                  <SupportCard />

                  {canGoBack ? (
                    <Pressable
                      onPress={onGoBack}
                      style={({ pressed }) => [
                        styles.startOverBtn,
                        pressed && styles.closeBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={gt('Go back')}
                    >
                      <Text style={styles.startOverBtnText}>
                        {gt('GO BACK')}
                      </Text>
                    </Pressable>
                  ) : null}

                  <View style={styles.card}>
                    <ActionRow
                      label={gt('Play mode')}
                      subtitle={
                        dailyMode ? gt('Daily challenge') : gt('Normal run')
                      }
                      onPress={() => setView('mode')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label={gt('Hall of fame')}
                      subtitle={gt('Normal, today & best daily')}
                      onPress={() => setView('highscores')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label={gt('Settings')}
                      subtitle={gt('Sound, haptics, language & data')}
                      onPress={() => setView('settings')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label={gt('How to play')}
                      subtitle={gt('Goal, Normal & Daily')}
                      onPress={() => setView('howto')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label={gt('Send feedback')}
                      subtitle={gt('Ideas, bugs, or love notes')}
                      onPress={onSendFeedback}
                    />
                  </View>

                  <Text style={styles.version}>MeterZone · v{version}</Text>
                </ScrollView>
              ) : null}

              {view === 'mode' ? (
                <View style={styles.card}>
                  <ModeRow
                    label={gt('Normal')}
                    subtitle={gt('Classic endless run')}
                    selected={!dailyMode}
                    onPress={() => onStartMode(false)}
                  />
                  <View style={styles.divider} />
                  <ModeRow
                    label={gt('Daily')}
                    subtitle={gt('Same sequence for everyone · updates daily')}
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
                  <Text style={styles.hsIntro}>
                    {gt(
                      "Your personal records — the best you've ever scored in each mode.",
                    )}
                  </Text>
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
                      badge={gt('NORMAL')}
                      mode={gt('NORMAL')}
                      modeColor="#D97706"
                      caption={gt('All-time best')}
                      accent={GameColors.xpGold}
                      accentDeep="#D97706"
                      score={highScore}
                      level={bestLevel}
                      emptyHint={gt('Beat the meter. Own the board.')}
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
                      badge={gt('TODAY')}
                      mode={gt('DAILY')}
                      modeColor={GameColors.bubbleDark}
                      caption={gt("Today's best")}
                      accent={GameColors.playBlue}
                      accentDeep={GameColors.playBlueDark}
                      score={dailyTodayScore}
                      level={dailyTodayLevel}
                      emptyHint={gt('Same challenge for everyone. Go!')}
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
                      badge={gt('BEST DAILY')}
                      mode={gt('DAILY')}
                      modeColor={GameColors.bubbleDark}
                      caption={gt('Best ever')}
                      accent={GameColors.bubble}
                      accentDeep={GameColors.bubbleDark}
                      score={dailyRecordScore}
                      level={dailyRecordLevel}
                      meta={recordMeta}
                      emptyHint={gt('Your greatest daily still awaits.')}
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
                      <Text style={styles.rowLabel}>{gt('The goal')}</Text>
                      <Text style={styles.rowSub}>
                        {gt(
                          'Watch the meter rise, then tap once to stop it inside the zone. Perfect, Great, and Nice keep you going and stack combos. Miss and you lose a heart.',
                        )}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoBlock}>
                      <Text style={styles.rowLabel}>{gt('Normal')}</Text>
                      <Text style={styles.rowSub}>
                        {gt(
                          'A classic endless run. Levels get tougher as you climb — chase your all-time high score.',
                        )}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoBlock}>
                      <Text style={styles.rowLabel}>{gt('Daily')}</Text>
                      <Text style={styles.rowSub}>
                        {gt(
                          'The same sequence for everyone that day, so scores are fair to compare. A fresh challenge every day.',
                        )}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              ) : null}

              {view === 'language' ? (
                <ScrollView
                  style={styles.menuScroll}
                  contentContainerStyle={styles.menuScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.card}>
                    {availableLocales.map((code, i) => (
                      <View key={code}>
                        {i > 0 ? <View style={styles.divider} /> : null}
                        <ModeRow
                          label={nativeName(code)}
                          subtitle={getLocaleProperties(code).languageName}
                          selected={code === locale}
                          onPress={() => setLocale(code)}
                        />
                      </View>
                    ))}
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
                      label={gt('Sound')}
                      subtitle={gt('Effects & countdown ticks')}
                      value={soundOn}
                      onPress={onToggleSound}
                    />
                    <View style={styles.divider} />
                    <ToggleRow
                      label={gt('Haptics')}
                      subtitle={gt('Vibration on taps & results')}
                      value={hapticsOn}
                      onPress={onToggleHaptics}
                    />
                  </View>

                  <View style={styles.card}>
                    <ActionRow
                      label={gt('Language')}
                      subtitle={currentLanguageName}
                      onPress={() => setView('language')}
                    />
                  </View>

                  <View style={styles.card}>
                    <ActionRow
                      label={gt('Delete data')}
                      subtitle={gt('High score, progress & unlocks')}
                      onPress={confirmDeleteData}
                      destructive
                    />
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
