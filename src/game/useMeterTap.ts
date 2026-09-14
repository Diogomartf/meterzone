import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  runOnUI,
  type SharedValue,
} from 'react-native-reanimated';

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
