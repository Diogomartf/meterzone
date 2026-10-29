import { BlurTargetView, BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useGT } from 'gt-react-native';

import { GameColors } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import { FlatButton } from '@/game/FlatButton';
import { MainButton } from '@/game/MainButton';
import { RankBadge } from '@/game/RankBadge';
import { avatarFor } from '@/game/avatars';
import { styles } from '@/game/menuSheetStyles';
import { TabSwitch } from '@/game/menuRows';
import { todayKey } from '@/game/storage';
import type { PlayerAvatar } from '@/game/types';
import { useSheetBottomPad } from '@/game/useSheetBottomPad';
import {
  formatClock,
  isSignedInToRanking,
  loadRanking,
  msUntilDailyReset,
  openRanking,
  pointsToPass,
  RANKING_SIZE,
  refreshRankingSignIn,
  signInToRankingInteractive,
  subscribeToRankingSignIn,
  type RankBoard,
  type RankEntry,
  type RankingKind,
} from '@/game/ranking';

const COIN = require('../../assets/images/coin.webp');
const CROWN = require('../../assets/images/crown.webp');
const STAR = require('../../assets/images/star.webp');

const SERVICE_NAME =
  Platform.OS === 'ios' ? 'Game Center' : 'Google Play Games';

/**
 * Podium blocks: #1 in the middle with the most headroom, then #2 and #3.
 * `ring` frames the avatar above each block in the block's colour.
 */
const PODIUM = {
  1: { color: '#FFD60A', ring: GameColors.xpGold, lift: 22, avatar: 72 },
  2: {
    color: GameColors.playBlue,
    ring: GameColors.playBlue,
    lift: 8,
    avatar: 62,
  },
  3: { color: '#FF9F5A', ring: '#FF8A3D', lift: 0, avatar: 62 },
} as const;

/** Rank badge width on the podium; its art is a little taller than wide. */
const PODIUM_BADGE = 30;

/**
 * Confetti flecks around the podium: position as a share of its width, plus
 * height in points from the top, a tilt and a colour. Static on purpose.
 */
const CONFETTI = [
  { left: '6%', top: 58, rotate: '-35deg', color: GameColors.playBlue },
  { left: '13%', top: 30, rotate: '40deg', color: GameColors.xpGold },
  { left: '27%', top: 6, rotate: '-50deg', color: GameColors.playBlue },
  { left: '33%', top: 44, rotate: '25deg', color: GameColors.xpGold },
  { left: '63%', top: 46, rotate: '-25deg', color: GameColors.xpGold },
  { left: '70%', top: 8, rotate: '50deg', color: GameColors.playBlue },
  { left: '84%', top: 30, rotate: '-40deg', color: GameColors.xpGold },
  { left: '92%', top: 62, rotate: '35deg', color: GameColors.playBlue },
] as const;

/** Dev only: set by `previewSampleRanking`, read when the page mounts. */
let sampleBoard: RankBoard | null = null;

const SAMPLE_NAMES = [
  'Mia',
  'Leo',
  'Alex',
  'Sofia',
  'Tom',
  'Luna',
  'Kai',
  'Ana',
  'FastThumb',
  'Noah',
  'Zoe',
  'TapKing',
  'Iris',
  'Ben',
  'Maya',
  'Rui',
  'Lea',
  'Max',
  'Inês',
  'Theo',
  'Nina',
  'Hugo',
  'Eva',
  'Sam',
  'Lia',
  'Dani',
  'Olga',
  'Pedro',
  'Yuki',
  'Omar',
];

/**
 * Dev only: the next ranking page shows a made-up board of `players` people
 * with the player at `youRank`, instead of asking Game Center, so the
 * signed-in layout can be checked in the simulator. Like the real board it
 * lists the top ten, plus the player's own row when they're below it.
 */
export function previewSampleRanking(players: number, youRank: number) {
  if (!__DEV__) return;
  const entries = Array.from({ length: players }, (_, i) => ({
    rank: i + 1,
    name: i + 1 === youRank ? 'You' : SAMPLE_NAMES[i % SAMPLE_NAMES.length],
    // Gaps that shrink down the board, like real scores bunching up.
    score: Math.round(1240 - i * 38 + i * i * 0.6),
    isYou: i + 1 === youRank,
  }));
  sampleBoard = {
    top: entries.slice(0, RANKING_SIZE),
    you: entries[youRank - 1] ?? null,
    above: entries[youRank - 2] ?? null,
  };
}

/**
 * Sample rows behind the blur for signed-out players. Never readable — they
 * give the board its shape and invite a sign-in to see who's really there.
 */
const PREVIEW: RankEntry[] = [
  { rank: 1, name: 'TapKing', score: 1240, isYou: false },
  { rank: 2, name: 'Luna', score: 990, isYou: false },
  { rank: 3, name: 'Mia', score: 870, isYou: false },
  { rank: 4, name: 'Kai', score: 760, isYou: false },
  { rank: 5, name: 'Ana', score: 690, isYou: false },
  { rank: 6, name: 'FastThumb', score: 650, isYou: false },
];

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; board: RankBoard }
  | { status: 'error' };

/**
 * The ranking page in the menu, with a daily board (first, the default) and an
 * endless all-time one.
 * Signed in, it shows the live board, the gap to the next spot and a way
 * straight back into a run. Signed out, a blurred preview invites a sign-in.
 */
export function RankingScreen({
  myAvatar,
  highScore,
  dailyTodayScore,
  onPlay,
}: {
  /** The player's chosen avatar, shown on their own entries. */
  myAvatar: PlayerAvatar | null;
  highScore: number;
  dailyTodayScore: number;
  onPlay: (kind: RankingKind) => void;
}) {
  const gt = useGT();
  const bottomPad = useSheetBottomPad();
  const [sample] = useState(() => (__DEV__ ? sampleBoard : null));
  const [kind, setKind] = useState<RankingKind>('daily');
  const [signedInLive, setSignedIn] = useState(isSignedInToRanking);
  const signedIn = signedInLive || sample != null;
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [signInFailed, setSignInFailed] = useState(false);
  /** UTC day the daily board belongs to — reloads when it rolls over. */
  const [day, setDay] = useState(todayKey);
  const dayRef = useRef(day);

  // Keep sign-in and the day current while the page stays open: sign-in can
  // finish after it mounts, or happen in Settings while the app is away.
  useEffect(() => {
    const unsubscribe = subscribeToRankingSignIn(setSignedIn);
    const checkDay = () => {
      const now = todayKey();
      if (now === dayRef.current) return;
      dayRef.current = now;
      setLoad({ status: 'loading' });
      setDay(now);
    };
    const interval = setInterval(checkDay, 15_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      checkDay();
      void refreshRankingSignIn().then(setSignedIn);
    });
    return () => {
      unsubscribe();
      clearInterval(interval);
      appState.remove();
      // A sample preview lasts one visit to the page.
      sampleBoard = null;
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (sample ? Promise.resolve(sample) : loadRanking(kind)).then(
      (board) => {
        if (!cancelled) setLoad({ status: 'ready', board });
      },
      () => {
        if (!cancelled) setLoad({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [signedIn, sample, kind, reloadKey, day]);

  const switchKind = (next: RankingKind) => {
    if (next === kind) return;
    setLoad({ status: 'loading' });
    setKind(next);
  };

  const retry = () => {
    setLoad({ status: 'loading' });
    setReloadKey((key) => key + 1);
  };

  const signIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    const ok = await signInToRankingInteractive({
      highScore,
      dailyTodayScore,
    });
    setSigningIn(false);
    setSignInFailed(!ok);
    if (ok) {
      // The sign-in event may already have flipped `signedIn` and loaded a
      // board before the uploads finished — always load again, after them.
      setLoad({ status: 'loading' });
      setSignedIn(true);
      setReloadKey((key) => key + 1);
    }
  };

  return (
    <MyAvatarContext value={myAvatar}>
      <ScrollView
        style={styles.hsScroll}
        contentContainerStyle={[styles.rankScreen, bottomPad]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <TabSwitch
          value={kind}
          onChange={switchKind}
          tabs={[
            { value: 'daily', label: gt('DAILY') },
            { value: 'endless', label: gt('ENDLESS') },
          ]}
        />

        {kind === 'daily' ? (
          <>
            <DailyCountdown />
            <Text style={styles.rankAim}>
              {gt('Same run for everyone. Top score takes the day!')}
            </Text>
          </>
        ) : (
          <Text style={styles.rankAim}>{gt('AIM FOR THE TOP!')}</Text>
        )}

        {!signedIn ? (
          <>
            <PreviewList />

            <View style={[styles.card, styles.rankJoin]}>
              <Text style={styles.rankJoinTitle}>
                {gt('Join the leaderboard')}
              </Text>
              <Text style={styles.rankJoinBody}>
                {gt('Save your best score and challenge players worldwide.')}
              </Text>
              <MainButton
                tone="gold"
                loading={signingIn}
                label={
                  signingIn
                    ? gt('Connecting…')
                    : gt('Continue with {service}', { service: SERVICE_NAME })
                }
                onPress={() => void signIn()}
              />
              <Text style={styles.rankHint}>
                {signInFailed
                  ? Platform.OS === 'ios'
                    ? gt(
                        'Game Center did not open. Sign in from Settings › Game Center, then come back.',
                      )
                    : gt('Could not sign in to Google Play Games. Try again.')
                  : gt('No email needed — it uses your {service} account.', {
                      service: SERVICE_NAME,
                    })}
              </Text>
            </View>
          </>
        ) : load.status === 'loading' ? (
          <RankingSkeleton kind={kind} label={gt('Loading the ranking…')} />
        ) : load.status === 'error' ? (
          <View style={styles.rankStatus}>
            <Text style={styles.rankStatusText}>
              {gt('Could not load the ranking. Check your connection.')}
            </Text>
            <FlatButton
              tone="blue"
              onPress={retry}
              label={gt('TRY AGAIN')}
              accessibilityLabel={gt('TRY AGAIN')}
            />
          </View>
        ) : (
          <LiveBoard
            kind={kind}
            board={load.board}
            onPlay={() => onPlay(kind)}
          />
        )}
      </ScrollView>
    </MyAvatarContext>
  );
}

/** Last hour of the day turns the countdown red. */
const HURRY_MS = 60 * 60 * 1000;

/** Live "ends in HH:MM:SS" badge for the daily board, ticking every second. */
function DailyCountdown() {
  const gt = useGT();
  const [remaining, setRemaining] = useState(msUntilDailyReset);

  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilDailyReset()), 1000);
    return () => clearInterval(id);
  }, []);

  const hurry = remaining <= HURRY_MS;
  return (
    <View style={styles.rankTimer} accessibilityRole="timer">
      <Text style={styles.rankTimerLabel}>
        {hurry ? gt('HURRY! ENDS IN') : gt('ENDS IN')}
      </Text>
      <Text
        style={[styles.rankTimerValue, hurry && styles.rankTimerValueHurry]}
      >
        {formatClock(remaining)}
      </Text>
    </View>
  );
}

function LiveBoard({
  kind,
  board,
  onPlay,
}: {
  kind: RankingKind;
  board: RankBoard;
  onPlay: () => void;
}) {
  const gt = useGT();
  const { top, you, above } = board;
  const gap = pointsToPass(you, above);
  // Off the top list: show the player's own row after a gap.
  const youBelow = you && !top.some((e) => e.isYou) ? you : null;

  return (
    <>
      {/* The podium blocks stand on the list card's top edge. */}
      <View>
        {kind === 'daily' ? <Podium entries={top} /> : null}
        {top.length > 0 || youBelow ? (
          <View style={styles.card}>
            <View style={styles.rankHeadRow}>
              <Text style={[styles.rankHead, styles.rankHeadPos]}>#</Text>
              <Text style={[styles.rankHead, styles.rankHeadPlayer]}>
                {gt('PLAYER')}
              </Text>
              <Text style={styles.rankHead}>{gt('SCORE')}</Text>
            </View>
            {top.map((entry, i) => (
              <RankRow
                key={entry.rank}
                entry={entry}
                last={!youBelow && i === top.length - 1}
              />
            ))}
            {youBelow ? (
              <>
                <Text style={styles.rankEllipsis}>⋯</Text>
                <RankRow entry={youBelow} last />
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {kind === 'daily' ? (
        <View style={[styles.card, styles.rankPrize]}>
          <View style={styles.rankPrizeCoin}>
            {PRIZE_RAYS.map((rotate) => (
              <View
                key={rotate}
                style={[styles.rankPrizeRay, { transform: [{ rotate }] }]}
              />
            ))}
            <Image source={COIN} style={styles.rankPrizeCoinImage} />
          </View>
          <View style={styles.rankGapText}>
            <Text style={styles.rankGapTitle}>{gt('TOP 10 GET COINS')}</Text>
            <Text style={styles.rankGapSub}>
              {gt('Keep your spot until the timer ends.')}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, styles.rankGap]}>
        <View style={styles.rankGapCoin}>
          <Image source={COIN} style={styles.rankGapCoinImage} />
        </View>
        <View style={styles.rankGapText}>
          <Text style={styles.rankGapTitle}>
            {gap != null && above
              ? gt('{points} POINTS TO #{rank}', {
                  points: formatScore(gap),
                  rank: above.rank,
                })
              : you
                ? gt("YOU'RE #1!")
                : gt('GET ON THE BOARD')}
          </Text>
          <Text style={styles.rankGapSub}>
            {gap != null
              ? gt('Your next run could do it.')
              : you
                ? gt('Defend the crown.')
                : kind === 'daily'
                  ? gt("Play today's run to claim a spot.")
                  : gt('Finish a run to claim a spot.')}
          </Text>
        </View>
      </View>

      {kind === 'daily' ? (
        <MainButton tone="gold" label={gt('PLAY DAILY')} onPress={onPlay} />
      ) : null}

      <Pressable
        onPress={() => void openRanking()}
        style={styles.rankMore}
        accessibilityRole="button"
      >
        <Text style={styles.rankMoreText}>
          {gt('See the full board in {service}', { service: SERVICE_NAME })}
        </Text>
      </Pressable>
    </>
  );
}

/** Rays around the prize coin, as rotations of one bar through its centre. */
const PRIZE_RAYS = ['0deg', '45deg', '90deg', '135deg'] as const;

/**
 * One confetti fleck, drifting a few points and tilting on its own slow
 * loop — gentle, just enough to feel alive. Each one's
 * timing comes from its index so they never move together. Still under
 * Reduce Motion.
 */
function ConfettiFleck({
  fleck,
  index,
}: {
  fleck: (typeof CONFETTI)[number];
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.set(
      withDelay(
        index * 230,
        withRepeat(
          withTiming(1, {
            duration: 2200 + (index % 3) * 450,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        ),
      ),
    );
  }, [index, reduceMotion, t]);

  // Alternate directions so neighbours drift apart and back.
  const dir = index % 2 === 0 ? 1 : -1;
  const baseAngle = parseFloat(fleck.rotate);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -5 * t.value },
      { translateX: dir * 3 * t.value },
      { rotate: `${baseAngle + dir * 14 * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.rankConfetti,
        { left: fleck.left, top: fleck.top, backgroundColor: fleck.color },
        style,
      ]}
    />
  );
}

/** Top three — #2, #1 (crowned, tallest), #3. Daily board only. */
function Podium({ entries }: { entries: RankEntry[] }) {
  return (
    <View style={styles.rankPodiumWrap}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
      >
        {CONFETTI.map((fleck, i) => (
          <ConfettiFleck key={i} fleck={fleck} index={i} />
        ))}
      </View>
      <View style={styles.rankPodium}>
        {([2, 1, 3] as const).map((place) => (
          <PodiumSpot
            key={place}
            place={place}
            entry={entries.find((e) => e.rank === place)}
          />
        ))}
      </View>
    </View>
  );
}

function PodiumSpot({
  place,
  entry,
}: {
  place: 1 | 2 | 3;
  entry: RankEntry | undefined;
}) {
  const gt = useGT();
  const { color, ring, lift, avatar } = PODIUM[place];
  const badgeH = PODIUM_BADGE * (120 / 102);

  return (
    <View style={styles.rankSpot}>
      {place === 1 ? (
        <View style={styles.rankCrownRow} accessibilityElementsHidden>
          <Image source={STAR} style={styles.rankStarSmall} />
          <Image source={CROWN} style={styles.rankCrown} />
          <Image source={STAR} style={styles.rankStarSmall} />
        </View>
      ) : null}
      <Avatar
        name={entry?.name}
        isYou={entry?.isYou}
        size={avatar}
        ring={ring}
      />
      {/* Straddles the avatar's bottom edge and the block's top. */}
      <RankBadge
        rank={place}
        size={PODIUM_BADGE}
        style={[
          styles.rankSpotBadge,
          { marginTop: -badgeH * 0.45, marginBottom: -badgeH * 0.5 },
        ]}
      />
      <View
        style={[
          styles.rankBlock,
          { backgroundColor: color, paddingTop: badgeH * 0.5 + 4 + lift },
        ]}
      >
        {entry ? (
          <PlayerName entry={entry} style={styles.rankBlockName} />
        ) : (
          <Text style={styles.rankBlockName} numberOfLines={1}>
            {gt('Open spot')}
          </Text>
        )}
        <View style={styles.rankScorePill}>
          <Text style={styles.rankScorePillText}>
            {entry ? formatScore(entry.score) : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The player's own avatar, for entries flagged `isYou`. */
const MyAvatarContext = createContext<PlayerAvatar | null>(null);

function Avatar({
  name,
  isYou,
  size,
  ring,
}: {
  name: string | undefined;
  isYou?: boolean;
  size: number;
  /** Colour of the ring around the face; white when unset. */
  ring?: string;
}) {
  const mine = use(MyAvatarContext);
  const avatar = isYou && mine ? mine : name != null ? avatarFor(name) : null;
  return (
    <View
      style={[
        styles.rankAvatarRing,
        ring != null && { backgroundColor: ring, padding: size * 0.06 },
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          styles.rankAvatarFace,
          { backgroundColor: avatar?.color ?? '#E3EAF3' },
        ]}
      >
        <Text style={{ fontSize: size * 0.42 }}>{avatar?.emoji ?? '?'}</Text>
      </View>
    </View>
  );
}

/** Game Center nickname, with a YOU tag on the player's own entry. */
function PlayerName({
  entry,
  style,
}: {
  entry: RankEntry;
  style: StyleProp<TextStyle>;
}) {
  const gt = useGT();
  return (
    <View style={styles.rankNameRow}>
      <Text style={[style, styles.rankNameText]} numberOfLines={1}>
        {entry.name}
      </Text>
      {entry.isYou ? (
        <View style={styles.rankYouTag}>
          <Text style={styles.rankYouTagText}>{gt('YOU')}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RankRow({ entry, last }: { entry: RankEntry; last: boolean }) {
  return (
    <View
      style={[
        styles.rankRow,
        entry.isYou && styles.rankRowYou,
        last && styles.rankRowLast,
      ]}
    >
      <Text style={styles.rankPos}>{formatScore(entry.rank)}</Text>
      <Avatar name={entry.name} isYou={entry.isYou} size={34} />
      <View style={styles.rankNameCell}>
        <PlayerName entry={entry} style={styles.rankNameLabel} />
      </View>
      <Text style={styles.rankScore}>{formatScore(entry.score)}</Text>
    </View>
  );
}

/**
 * Signed-out board: sharp rank numbers, everything else blurred, so it's
 * clearly a real leaderboard you can't read yet.
 */
function PreviewList() {
  const gt = useGT();
  const entries = PREVIEW;
  return (
    <View
      style={styles.card}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {entries.map((entry, i) => (
        <View
          key={entry.rank}
          style={[
            styles.rankRow,
            i === entries.length - 1 && styles.rankRowLast,
          ]}
        >
          <Text style={styles.rankPos}>{entry.rank}</Text>
          <Blurred>
            <Avatar name={entry.name} size={34} />
            <Text style={styles.rankName} numberOfLines={1}>
              {entry.name}
            </Text>
            <Text style={styles.rankScore}>{formatScore(entry.score)}</Text>
          </Blurred>
        </View>
      ))}
      <View style={styles.rankLock} pointerEvents="none">
        <Text style={styles.rankLockText}>{gt("🔒 Who's on top?")}</Text>
      </View>
    </View>
  );
}

/** Blurs its children. Android needs an explicit target; iOS blurs what's behind. */
function Blurred({ children }: { children: ReactNode }) {
  const target = useRef<View | null>(null);
  return (
    <View style={styles.rankBlurred}>
      <BlurTargetView ref={target} style={styles.rankBlurredInner}>
        {children}
      </BlurTargetView>
      <BlurView
        intensity={20}
        tint="light"
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Placeholder board while the live one loads — same shapes as the real thing
 * (podium on daily, then the list), pulsing gently. Still under Reduce Motion.
 */
function RankingSkeleton({
  kind,
  label,
}: {
  kind: RankingKind;
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(
      withRepeat(
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [pulse, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.skelBoard, pulseStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View>
        {kind === 'daily' ? (
          <View style={[styles.rankPodium, styles.rankPodiumWrap]}>
            {([2, 1, 3] as const).map((place) => (
              <View key={place} style={styles.rankSpot}>
                <View
                  style={[
                    styles.skelCircle,
                    place === 1 ? styles.skelAvatarFirst : styles.skelAvatar,
                  ]}
                />
                <View
                  style={[
                    styles.skelBlock,
                    { height: place === 1 ? 96 : place === 2 ? 82 : 74 },
                  ]}
                >
                  <View style={[styles.skelBar, styles.skelBarName]} />
                  <View style={[styles.skelBar, styles.skelBarPill]} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          {SKELETON_ROWS.map((width, i) => (
            <View
              key={i}
              style={[
                styles.rankRow,
                i === SKELETON_ROWS.length - 1 && styles.rankRowLast,
              ]}
            >
              <View style={[styles.skelBar, styles.skelBarRank]} />
              <View style={[styles.skelCircle, styles.skelRowAvatar]} />
              <View style={styles.rankNameCell}>
                <View style={[styles.skelBar, { width }]} />
              </View>
              <View style={[styles.skelBar, styles.skelBarScore]} />
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

/** Name-bar widths — varied so the rows read as different players. */
const SKELETON_ROWS = [
  '62%',
  '48%',
  '70%',
  '40%',
  '56%',
  '66%',
  '44%',
  '58%',
  '50%',
  '36%',
] as const;
