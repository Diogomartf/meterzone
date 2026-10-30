import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  makeMutable,
  runOnUI,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Store screenshots only: with EXPO_PUBLIC_SCREENSHOT_AUTOPLAY=<hits> in a dev
 * build, the meter stops itself on the zone for that many rounds, then lets
 * the run miss out so it ends. Simulator taps land far too late to play by hand.
 */
const AUTOPLAY_HITS = __DEV__
  ? Number(process.env.EXPO_PUBLIC_SCREENSHOT_AUTOPLAY) || 0
  : 0;

/** Autoplay's progress through the current run. Module-level so a new run can reset it. */
const autoplayHits = makeMutable(0);
const autoplayMisses = makeMutable(0);
/** Aim off-center on about half the rounds so the run mixes Perfect, Great and Nice. */
const autoplayAim = makeMutable(0);

/** Start the autoplay over, so every run plays its full set of hits. No-op when it's off. */
export function resetScreenshotAutoplay() {
  if (!AUTOPLAY_HITS) return;
  autoplayHits.set(0);
  autoplayMisses.set(0);
}

type Params = {
  fill: SharedValue<number>;
  /** 1 while a fill is running. Also the re-entrancy lock (see below). */
  isFilling: SharedValue<number>;
  zoneTarget: SharedValue<number>;
  zoneHalf: SharedValue<number>;
  zoneFrom: SharedValue<number>;
  zoneTo: SharedValue<number>;
  zoneMoves: SharedValue<number>;
  halfFrom: SharedValue<number>;
  halfTo: SharedValue<number>;
  zoneShrinks: SharedValue<number>;
  /** Sound, haptics and scoring — everything after the meter is already frozen. */
  onSettled: (stoppedAt: number) => void;
};

/**
 * The player's tap, handled on the UI thread.
 *
 * NOTE ON THE NAME: this must not be called `useTapGesture`. The worklets babel
 * plugin keeps a list of gesture hook names — useTapGesture, usePanGesture,
 * usePinchGesture and friends — and auto-workletizes the object passed to any
 * call matching one. Under that name `onSettled` was compiled into a worklet,
 * and `runOnJS` then rejected it at runtime: "Locally defined function passed
 * to scheduleOnRN". Renaming the hook is the whole fix; keep it renamed.
 *
 * Routed through `Pressable` the touch had to reach the JS thread first, so
 * anything in flight there — a re-render, a settled AsyncStorage write — meant
 * `fill` was sampled later than the frame the player actually saw. In a timing
 * game that is a wrong score, not just a slow one. As a gesture worklet the
 * meter is sampled and frozen on the frame the finger lands, whatever the JS
 * thread is doing, and only the aftermath is handed back with `runOnJS`.
 *
 * `use no memo` keeps this one hook out of React Compiler: a worklet that reads
 * shared values is indistinguishable from reading a ref during render, which
 * would make the compiler skip all of GameScreen. Nothing here re-renders, and
 * the gesture is memoized by hand below, so the opt-out costs nothing.
 */
export function useMeterTap({
  fill,
  isFilling,
  zoneTarget,
  zoneHalf,
  zoneFrom,
  zoneTo,
  zoneMoves,
  halfFrom,
  halfTo,
  zoneShrinks,
  onSettled,
}: Params) {
  'use no memo';

  /**
   * Freeze the meter where it stands and hand the round to JS. Runs on the UI
   * thread, from the gesture below and from the accessibility action alike.
   */
  const freezeMeter = useCallback(() => {
    'worklet';
    // `isFilling` doubles as the re-entrancy lock: it is cleared below on the
    // UI thread before a second tap can be dispatched, which is what the old
    // JS-side ref guard and its requestAnimationFrame release were for. The
    // fill's own completion callback clears it too, so a tap that lands in the
    // gap before `finishRound` runs cannot score the round again.
    if (isFilling.value !== 1) return;

    // Freeze fill exactly where it is — zone is derived from fill, so it matches
    const stoppedAt = fill.value;
    cancelAnimation(fill);
    fill.set(stoppedAt);
    // Snap zone to the scored position (same as zoneAt)
    if (zoneMoves.value) {
      zoneTarget.set(
        zoneFrom.value + (zoneTo.value - zoneFrom.value) * stoppedAt,
      );
    }
    if (zoneShrinks.value) {
      zoneHalf.set(
        halfFrom.value + (halfTo.value - halfFrom.value) * stoppedAt,
      );
    }
    isFilling.set(0);
    runOnJS(onSettled)(stoppedAt);
  }, [
    fill,
    halfFrom,
    halfTo,
    isFilling,
    onSettled,
    zoneFrom,
    zoneHalf,
    zoneMoves,
    zoneShrinks,
    zoneTarget,
    zoneTo,
  ]);

  /**
   * VoiceOver and TalkBack activate a control without ever producing a touch,
   * so the gesture never sees them. They get the same settlement, just hopped
   * onto the UI thread explicitly; frame accuracy is not the point here.
   */
  const activate = useCallback(() => {
    runOnUI(freezeMeter)();
  }, [freezeMeter]);

  useAutoplay(
    { fill, isFilling, zoneTarget, zoneHalf, zoneFrom, zoneTo, zoneMoves },
    freezeMeter,
  );

  const gesture = useMemo(
    () =>
      Gesture.Tap()
        // The meter stops the instant a finger lands; a tap that is held or
        // dragged must not be discarded as a failed tap.
        .maxDuration(Number.MAX_SAFE_INTEGER)
        .maxDistance(Number.MAX_SAFE_INTEGER)
        .onBegin(freezeMeter),
    [freezeMeter],
  );

  return { gesture, activate };
}

type AutoplayParams = Pick<
  Params,
  | 'fill'
  | 'isFilling'
  | 'zoneTarget'
  | 'zoneHalf'
  | 'zoneFrom'
  | 'zoneTo'
  | 'zoneMoves'
>;

function useScreenshotAutoplay(
  {
    fill,
    isFilling,
    zoneTarget,
    zoneHalf,
    zoneFrom,
    zoneTo,
    zoneMoves,
  }: AutoplayParams,
  freezeMeter: () => void,
) {
  'use no memo';

  useAnimatedReaction(
    () => fill.value,
    (now, before) => {
      if (autoplayHits.value >= AUTOPLAY_HITS) {
        // Each full fill is a miss; three of them end the run, so start over.
        if (now >= 1 && (before ?? 0) < 1) {
          autoplayMisses.set(autoplayMisses.value + 1);
          if (autoplayMisses.value >= 3) {
            autoplayHits.set(0);
            autoplayMisses.set(0);
          }
        }
        return;
      }
      // The fill drops back between rounds, while isFilling is still off.
      if (now < (before ?? 0)) {
        autoplayAim.set(
          Math.random() < 0.5
            ? 0
            : (Math.random() - 0.6) * zoneHalf.value * 1.4,
        );
      }
      if (isFilling.value !== 1) return;
      const zone = zoneMoves.value
        ? zoneFrom.value + (zoneTo.value - zoneFrom.value) * now
        : zoneTarget.value;
      if (now < zone + autoplayAim.value) return;
      autoplayHits.set(autoplayHits.value + 1);
      freezeMeter();
    },
  );
}

/**
 * Picked once at load, so every render calls the same hook. Release builds and
 * dev builds without the env var get a no-op, not a reaction that runs on every
 * frame of every fill only to return early.
 */
const useAutoplay: typeof useScreenshotAutoplay = AUTOPLAY_HITS
  ? useScreenshotAutoplay
  : () => {};
