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
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useGT } from 'gt-react-native';

import { GameColors } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import { GameCta } from '@/game/GameCta';
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
  refreshRankingSignIn,
  signInToRankingInteractive,
  subscribeToRankingSignIn,
  type RankBoard,
  type RankEntry,
  type RankingKind,
} from '@/game/ranking';

const COIN = require('../../assets/images/coin.webp');

const SERVICE_NAME =
  Platform.OS === 'ios' ? 'Game Center' : 'Google Play Games';

/** Podium blocks: #1 in the middle with the most headroom, then #2 and #3. */
const PODIUM = {
  1: { color: GameColors.lemon, lift: 26 },
  2: { color: GameColors.playBlue, lift: 12 },
  3: { color: '#FF9F5A', lift: 0 },
} as const;

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
  const [kind, setKind] = useState<RankingKind>('daily');
  const [signedIn, setSignedIn] = useState(isSignedInToRanking);
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
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    loadRanking(kind).then(
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
  }, [signedIn, kind, reloadKey, day]);

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
              <GameCta
                compact
                loading={signingIn}
                label={
                  signingIn
                    ? gt('Connecting…')
                    : gt('Continue with {service}', { service: SERVICE_NAME })
                }
                face="#FFC800"
                depth="#D97706"
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
            <Pressable
              onPress={retry}
              style={({ pressed }) => [
                styles.startOverBtn,
                pressed && styles.closeBtnPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.startOverBtnText}>{gt('TRY AGAIN')}</Text>
            </Pressable>
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
      {kind === 'daily' ? <Podium entries={top} /> : null}
      {top.length > 0 || youBelow ? (
        <View style={styles.card}>
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
        <GameCta
          fullWidth
          compact
          label={gt('PLAY DAILY')}
          face="#FFC800"
          depth="#D97706"
          onPress={onPlay}
        />
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

/** Compact top three — #2, #1 (crowned, tallest), #3. Daily board only. */
function Podium({ entries }: { entries: RankEntry[] }) {
  return (
    <View>
      <View style={styles.rankPodium}>
        {([2, 1, 3] as const).map((place) => (
          <PodiumSpot
            key={place}
            place={place}
            entry={entries.find((e) => e.rank === place)}
          />
        ))}
      </View>
      <View style={styles.rankPodiumBase} />
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
  const { color, lift } = PODIUM[place];

  return (
    <View style={styles.rankSpot}>
      {place === 1 ? (
        <Text style={styles.rankCrown}>
          <Text style={styles.rankStar}>★ </Text>👑
          <Text style={styles.rankStar}> ★</Text>
        </Text>
      ) : null}
      <Avatar
        name={entry?.name}
        isYou={entry?.isYou}
        size={place === 1 ? 48 : 42}
        overlap
      />
      <View
        style={[
          styles.rankBlock,
          { backgroundColor: color, paddingTop: 24 + lift },
        ]}
      >
        <Text style={styles.rankBlockNumber}>{place}</Text>
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
  overlap,
}: {
  name: string | undefined;
  isYou?: boolean;
  size: number;
  /** Sits half over the podium block below it. */
  overlap?: boolean;
}) {
  const mine = use(MyAvatarContext);
  const avatar = isYou && mine ? mine : name != null ? avatarFor(name) : null;
  return (
    <View
      style={[
        styles.rankAvatarRing,
        overlap && { marginBottom: -size / 2 },
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
      {kind === 'daily' ? (
        <View>
          <View style={styles.rankPodium}>
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
                    { height: place === 1 ? 104 : place === 2 ? 90 : 78 },
                  ]}
                >
                  <View style={[styles.skelBar, styles.skelBarNumber]} />
                  <View style={[styles.skelBar, styles.skelBarName]} />
                  <View style={[styles.skelBar, styles.skelBarPill]} />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.skelBase} />
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
