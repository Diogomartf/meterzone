import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { startTransition, useEffect, useRef, useState } from 'react';
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
import { useGT, useLocaleSelector, useMessages } from 'gt-react-native';

import { GameColors } from '@/constants/gameTheme';
import {
  ActionRow,
  RecordCard,
  TodayStrip,
  ModeRow,
  SupportCard,
  TabSwitch,
  ToggleRow,
  type HighscoreKind,
} from '@/game/menuRows';
import { AvatarPicker } from '@/game/AvatarPicker';
import { FlatButton } from '@/game/FlatButton';
import { HowToPlay } from '@/game/HowToPlay';
import { styles } from '@/game/menuSheetStyles';
import { rankingAvailable } from '@/game/ranking';
import { RankingScreen } from '@/game/RankingScreen';
import { CoinBank, SkinShop } from '@/game/SkinShop';
import { captureAndShare, shareScoreCaption } from '@/game/share';
import { formatScore } from '@/game/format';
import type { AvatarPackId, PlayerAvatar, SkinId } from '@/game/types';
import { todayKey } from '@/game/storage';
import { useSheetBottomPad } from '@/game/useSheetBottomPad';
import gtConfig from '../../gt.config.json';

const LOGO = require('../../assets/images/zone-meter-logo.webp');
const COIN = require('../../assets/images/coin.webp');
const CROWN = require('../../assets/images/hof-crown.webp');
const MEDAL = require('../../assets/images/hof-medal.webp');

const BACK_ICON = {
  ios: 'chevron.left',
  android: 'chevron_left',
  web: 'chevron_left',
} as const;
const CLOSE_ICON = { ios: 'xmark', android: 'close', web: 'close' } as const;

/**
 * Display order for the picker. `useLocaleSelector` otherwise sorts locales
 * alphabetically by native name, which buries Portugal under Brasil; passing an
 * explicit list keeps gt.config.json the one place that order is decided.
 */
const LOCALE_ORDER = [gtConfig.defaultLocale, ...gtConfig.locales];

type MenuView =
  | 'menu'
  | 'mode'
  | 'highscores'
  | 'ranking'
  | 'howto'
  | 'settings'
  | 'language'
  | 'skins';

type MenuSheetProps = {
  visible: boolean;
  soundOn: boolean;
  buttonSoundsOn: boolean;
  hapticsOn: boolean;
  /** Show go-back when a run is in progress or finished */
  canGoBack: boolean;
  dailyMode: boolean;
  /** View to show when the sheet opens (defaults to the menu root). */
  initialView?: MenuView;
  highScore: number;
  bestLevel: number;
  /** A daily run finished today, even one that scored zero. */
  dailyPlayedToday: boolean;
  dailyTodayScore: number;
  dailyTodayLevel: number;
  dailyRecordScore: number;
  dailyRecordLevel: number;
  dailyRecordDate: string;
  coins: number;
  unlockedSkins: readonly SkinId[];
  equippedSkin: SkinId;
  avatar: PlayerAvatar | null;
  unlockedAvatarPacks: readonly AvatarPackId[];
  onClose: () => void;
  onToggleSound: () => void;
  onToggleButtonSounds: () => void;
  onToggleHaptics: () => void;
  onGoBack: () => void;
  onStartMode: (daily: boolean) => void;
  onSendFeedback: () => void;
  onDeleteData: () => void;
  onUnlockSkin: (id: SkinId) => void;
  onEquipSkin: (id: SkinId) => void;
  onSelectAvatar: (avatar: PlayerAvatar) => void;
  onUnlockAvatarPack: (id: AvatarPackId) => void;
};

export function MenuSheet({
  visible,
  soundOn,
  buttonSoundsOn,
  hapticsOn,
  canGoBack,
  dailyMode,
  initialView = 'menu',
  highScore,
  bestLevel,
  dailyPlayedToday,
  dailyTodayScore,
  dailyTodayLevel,
  dailyRecordScore,
  dailyRecordLevel,
  dailyRecordDate,
  coins,
  unlockedSkins,
  equippedSkin,
  avatar,
  unlockedAvatarPacks,
  onClose,
  onToggleSound,
  onToggleButtonSounds,
  onToggleHaptics,
  onGoBack,
  onStartMode,
  onSendFeedback,
  onDeleteData,
  onUnlockSkin,
  onEquipSkin,
  onSelectAvatar,
  onUnlockAvatarPack,
}: MenuSheetProps) {
  const gt = useGT();
  const m = useMessages();
  const {
    locale,
    locales: availableLocales,
    setLocale,
    getLocaleProperties,
  } = useLocaleSelector(LOCALE_ORDER);
  const bottomPad = useSheetBottomPad();
  const { height: windowH } = useWindowDimensions();
  const sheetH = Math.round(windowH * 0.92);
  const translateY = useSharedValue(sheetH);
  const overlayOpacity = useSharedValue(0);
  const bodyX = useSharedValue(0);
  const [view, setView] = useState<MenuView>('menu');
  const [shopTab, setShopTab] = useState<'skins' | 'avatar'>('skins');

  const [sharingKind, setSharingKind] = useState<HighscoreKind | null>(null);
  const normalShareRef = useRef<View>(null);
  const dailyShareRef = useRef<View>(null);
  const sharingDaily = sharingKind === 'today' || sharingKind === 'record';
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

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bodyX.value }],
  }));

  // `Modal` renders nothing while closed, but everything below — 60-odd
  // translation lookups, the locale list, a fresh Pan gesture, the element tree
  // for all seven views — is built by *this* render first. The sheet is shut
  // for almost every GameScreen render, so stop before paying for it. Every
  // hook above still runs, so the open/close animation is untouched.
  if (!visible) return null;

  const title =
    view === 'menu'
      ? gt('MENU')
      : view === 'mode'
        ? gt('PLAY MODE')
        : view === 'highscores'
          ? gt('HALL OF FAME')
          : view === 'ranking'
            ? gt('RANKING')
            : view === 'howto'
              ? gt('HOW TO PLAY')
              : view === 'language'
                ? gt('LANGUAGE')
                : view === 'skins'
                  ? gt('AVATAR & SKINS')
                  : gt('SETTINGS');

  const formatDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const recordMeta =
    dailyRecordDate.length > 0 ? formatDay(dailyRecordDate) : undefined;

  /**
   * Each language named in its own tongue. Both Portuguese entries read
   * "Português" — the flag and the region subtitle are what tell them apart,
   * the way the platform's own language settings present them.
   */
  const nativeName = (code: string) => {
    const { nativeLanguageName } = getLocaleProperties(code);
    const name = nativeLanguageName || code;
    // Portuguese and Spanish lowercase their language names; a list of options
    // reads better capitalized, the way the platform's own settings show them.
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  /** Flag of the region the locale resolves to — en → 🇺🇸, pt → 🇧🇷, pt-PT → 🇵🇹. */
  const flagged = (code: string) =>
    `${getLocaleProperties(code).emoji}  ${nativeName(code)}`;

  const currentLanguageName = flagged(locale);

  /**
   * GTProvider loads the new locale's file behind a Suspense boundary. Without
   * a transition React swaps in that boundary's fallback, blanking the app to
   * the root background and re-revealing the first screen; inside one, the
   * current screen stays put until the translations are ready.
   */
  const switchLocale = (code: string) => {
    if (code === locale) return;
    startTransition(() => setLocale(code));
  };

  const shareHighscore = async (kind: HighscoreKind) => {
    if (sharingKind) return;
    const target =
      kind === 'normal' ? normalShareRef.current : dailyShareRef.current;

    // Re-renders the card with its logo and without the share button (and,
    // for today, with today's score in the record's place), so the capture
    // below picks up the shareable framing.
    setSharingKind(kind);
    // `finally` would read better, but React Compiler cannot lower a try block
    // with a finalizer and would skip optimizing this whole file.
    await captureAndShare(target, { message: shareScoreCaption(m) }).catch(
      () => {
        Alert.alert(
          gt('Share failed'),
          gt('Could not create the share image.'),
        );
      },
    );
    setSharingKind(null);
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

  const goToMenu = () => {
    setView('menu');
    bodyX.set(0);
  };

  // Swipe right on a nested view to go back, like a navigation stack. Only
  // horizontal drags activate it; vertical ones fail it so lists still scroll.
  const swipeBack = Gesture.Pan()
    .enabled(view !== 'menu')
    .activeOffsetX(16)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      bodyX.set(Math.max(0, e.translationX * 0.6));
    })
    .onEnd((e) => {
      if (e.translationX > 90 || e.velocityX > 700) {
        runOnJS(goToMenu)();
      } else {
        bodyX.set(withSpring(0, { damping: 22, stiffness: 260 }));
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
        {/* Only the dim layer fades on drag — the sheet stays opaque. */}
        <Animated.View
          style={[styles.backdrop, styles.overlayHidden, overlayStyle]}
        >
          <Pressable
            style={styles.dismissArea}
            onPress={dismiss}
            accessibilityLabel={gt('Dismiss menu')}
          />
        </Animated.View>
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <Animated.View
            collapsable={false}
            style={[styles.sheet, { height: sheetH }, sheetStyle]}
          >
            <GestureDetector gesture={pan}>
              <View collapsable={false}>
                <View style={styles.handleHit}>
                  <View style={styles.handle} />
                </View>

                <View style={styles.header}>
                  {view !== 'menu' ? (
                    <FlatButton
                      onPress={() => setView('menu')}
                      icon={BACK_ICON}
                      hitSlop={10}
                      accessibilityLabel={gt('Back')}
                    />
                  ) : null}
                  <Text
                    style={[styles.title, view === 'menu' && styles.titleRoot]}
                  >
                    {title}
                  </Text>
                  {view === 'menu' ? (
                    <View style={styles.coinPillSlot} pointerEvents="box-none">
                      <Pressable
                        onPress={() => setView('skins')}
                        style={({ pressed }) => [
                          styles.coinPill,
                          pressed && styles.closeBtnPressed,
                        ]}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={gt('{count} coins', {
                          count: formatScore(coins),
                        })}
                      >
                        <Image
                          source={COIN}
                          style={styles.coinPillIcon}
                          contentFit="contain"
                        />
                        <Text style={styles.coinPillText}>
                          {formatScore(coins)}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {view === 'menu' ? (
                    <FlatButton
                      onPress={dismiss}
                      icon={CLOSE_ICON}
                      hitSlop={10}
                      accessibilityLabel={gt('Close')}
                    />
                  ) : null}
                </View>
              </View>
            </GestureDetector>

            <GestureDetector gesture={swipeBack}>
              <Animated.View style={[styles.body, bodyStyle]}>
                {view === 'menu' ? (
                  <ScrollView
                    style={styles.menuScroll}
                    contentContainerStyle={[
                      styles.menuScrollContent,
                      bottomPad,
                    ]}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    <SupportCard />

                    {canGoBack ? (
                      <FlatButton
                        tone="blue"
                        onPress={onGoBack}
                        label={gt('GO HOME')}
                        accessibilityLabel={gt('Go home')}
                      />
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
                      {rankingAvailable ? (
                        <>
                          <View style={styles.divider} />
                          <ActionRow
                            label={gt('Ranking')}
                            subtitle={gt('Compete with players worldwide')}
                            onPress={() => setView('ranking')}
                          />
                        </>
                      ) : null}
                      <View style={styles.divider} />
                      <ActionRow
                        label={gt('Avatar & skins')}
                        subtitle={gt('{count} coins', {
                          count: formatScore(coins),
                        })}
                        onPress={() => setView('skins')}
                      />
                      <View style={styles.divider} />
                      <ActionRow
                        label={gt('Settings')}
                        subtitle={gt('Sound, haptics & language')}
                        onPress={() => setView('settings')}
                      />
                      <View style={styles.divider} />
                      <ActionRow
                        label={gt('How to play')}
                        subtitle={gt('Goal, modes & skins')}
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

                {view === 'ranking' ? (
                  <RankingScreen
                    myAvatar={avatar}
                    highScore={highScore}
                    dailyTodayScore={dailyTodayScore}
                    onPlay={(kind) => onStartMode(kind === 'daily')}
                  />
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
                      subtitle={gt(
                        'Same sequence for everyone · updates daily',
                      )}
                      selected={dailyMode}
                      onPress={() => onStartMode(true)}
                    />
                  </View>
                ) : null}

                {view === 'highscores' ? (
                  <ScrollView
                    style={styles.hsScroll}
                    contentContainerStyle={[styles.hsList, bottomPad]}
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
                      <RecordCard
                        title={gt('Normal')}
                        art={CROWN}
                        sunburst
                        accent={GameColors.xpGold}
                        accentDeep="#E07B00"
                        score={highScore}
                        level={bestLevel}
                        emptyHint={gt('Beat the meter. Own the board.')}
                        hideShare={sharingKind === 'normal'}
                        onShare={() => void shareHighscore('normal')}
                      />
                    </View>
                    <View
                      ref={dailyShareRef}
                      collapsable={false}
                      style={[
                        styles.hsCapture,
                        sharingDaily && styles.hsCaptureShot,
                      ]}
                    >
                      {sharingDaily ? (
                        <Image
                          source={LOGO}
                          style={styles.hsLogo}
                          contentFit="contain"
                        />
                      ) : null}
                      {sharingKind === 'today' ? (
                        // The shared image is today's score alone, laid out
                        // like the record so it reads as the same card.
                        <RecordCard
                          title={gt('Daily challenge')}
                          art={MEDAL}
                          accent={GameColors.playBlue}
                          accentDeep={GameColors.playBlueDark}
                          score={dailyTodayScore}
                          level={dailyTodayLevel}
                          meta={formatDay(todayKey())}
                          emptyHint=""
                          hideShare
                        />
                      ) : (
                        <RecordCard
                          title={gt('Daily challenge')}
                          art={MEDAL}
                          accent={GameColors.playBlue}
                          accentDeep={GameColors.playBlueDark}
                          score={dailyRecordScore}
                          level={dailyRecordLevel}
                          meta={recordMeta}
                          emptyHint={gt('Same challenge for everyone. Go!')}
                          hideShare={sharingKind === 'record'}
                          onShare={() => void shareHighscore('record')}
                        >
                          {dailyRecordScore > 0 && sharingKind !== 'record' ? (
                            <TodayStrip
                              played={dailyPlayedToday}
                              score={dailyTodayScore}
                              level={dailyTodayLevel}
                              emptyHint={gt('Not played yet')}
                              onShare={() => void shareHighscore('today')}
                            />
                          ) : null}
                        </RecordCard>
                      )}
                    </View>
                  </ScrollView>
                ) : null}

                {view === 'howto' ? (
                  <HowToPlay
                    contentStyle={bottomPad}
                    onPlay={() => onStartMode(dailyMode)}
                  />
                ) : null}

                {view === 'language' ? (
                  <ScrollView
                    style={styles.menuScroll}
                    contentContainerStyle={[
                      styles.menuScrollContent,
                      bottomPad,
                    ]}
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
                            label={flagged(code)}
                            subtitle={
                              getLocaleProperties(code).nativeRegionName
                            }
                            selected={code === locale}
                            onPress={() => switchLocale(code)}
                          />
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}

                {view === 'skins' ? (
                  <View style={styles.shopBody}>
                    <CoinBank coins={coins} />
                    <TabSwitch
                      style={styles.shopTabs}
                      value={shopTab}
                      onChange={setShopTab}
                      tabs={[
                        { value: 'skins', label: gt('SKINS') },
                        { value: 'avatar', label: gt('AVATAR') },
                      ]}
                    />
                    {shopTab === 'skins' ? (
                      <SkinShop
                        coins={coins}
                        unlockedSkins={unlockedSkins}
                        equippedSkin={equippedSkin}
                        onUnlock={onUnlockSkin}
                        onEquip={onEquipSkin}
                      />
                    ) : (
                      <AvatarPicker
                        avatar={avatar}
                        unlockedPacks={unlockedAvatarPacks}
                        coins={coins}
                        onSelect={onSelectAvatar}
                        onUnlock={onUnlockAvatarPack}
                      />
                    )}
                  </View>
                ) : null}

                {view === 'settings' ? (
                  <ScrollView
                    style={styles.menuScroll}
                    contentContainerStyle={[
                      styles.menuScrollContent,
                      bottomPad,
                    ]}
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
                        label={gt('Button sounds')}
                        subtitle={gt('A click on the big buttons')}
                        value={buttonSoundsOn}
                        onPress={onToggleButtonSounds}
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
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
