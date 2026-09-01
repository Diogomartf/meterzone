import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { MutableRefObject } from 'react';

import {
  mergeLiveTapHintPlays,
  nextTapHintPlays,
  rollbackLiveTapHintPlays,
  TAP_HINT_GAMES,
  TAP_HINT_PER_GAME,
  TAP_HINT_PLAYS,
  TAP_HOW_TO_PLAYS,
} from '@/game/tapCoach';
import type { Phase } from '@/game/runState';
import { loadPersist, recordTapHintPlay } from '@/game/storage';
import type { PersistState } from '@/game/types';

type Params = {
  persist: PersistState | null;
  persistRef: MutableRefObject<PersistState | null>;
  applyPersist: (next: PersistState) => void;
  phase: Phase;
  paused: boolean;
};

/**
 * Onboarding coach state: which fills show the tap hint, which runs show the
 * how-to line, and the accounting that spends a player's limited hint slots.
 *
 * A slot is only charged once the hint is actually on screen, and every write
 * goes through a single chained promise so a halt, a backgrounded app or an
 * unmount can never drop one. Writes are stamped with the fill generation that
 * started them, so a failed write rolls back only when that fill still owns the
 * live count — a newer fill is never lowered.
 */
export function useTapCoach({
  persist,
  persistRef,
  applyPersist,
  phase,
  paused,
}: Params) {
  const [coachThisFill, setCoachThisFill] = useState(false);
  const [howToThisRun, setHowToThisRun] = useState(false);
  const [hintThisRun, setHintThisRun] = useState(false);

  const fillStartGen = useRef(0);
  // Mirrors fillStartGen for render. The ref stays the source of truth for the
  // async staleness checks below, which must not wait for a re-render.
  const [fillCycle, setFillCycle] = useState(0);
  const tapHintsThisRunRef = useRef(0);
  const hintThisRunRef = useRef(false);
  const coachRecordedGenRef = useRef<number | null>(null);
  const coachWriteRef = useRef<Promise<unknown>>(Promise.resolve());

  const bumpFillGen = useCallback(() => {
    fillStartGen.current += 1;
    setFillCycle(fillStartGen.current);
  }, []);

  const flushCoachWrite = useCallback(
    () => coachWriteRef.current.catch(() => undefined),
    [],
  );

  const enqueueCoachWrite = useCallback((write: () => Promise<unknown>) => {
    const chained = coachWriteRef.current.catch(() => undefined).then(write);
    coachWriteRef.current = chained;
    return chained;
  }, []);

  /** Overlay only tapHintPlays — never replace the live persist snapshot. */
  const mergeTapHintPlays = useCallback(
    (plays: number) => {
      const current = persistRef.current;
      if (!current) return;
      const next = mergeLiveTapHintPlays(current.tapHintPlays, plays);
      if (next === current.tapHintPlays) return;
      applyPersist({ ...current, tapHintPlays: next });
    },
    [applyPersist, persistRef],
  );

  /**
   * Persist a displayed hint only after it is on screen (this effect runs
   * after paint). Counting earlier charged a slot the player never saw.
   */
  useEffect(() => {
    if (!persist || !coachThisFill || phase !== 'filling' || paused) return;
    const gen = fillStartGen.current;
    if (coachRecordedGenRef.current === gen) return;
    const shown =
      persist?.tapHintPlays ?? persistRef.current?.tapHintPlays ?? 0;
    if (shown >= TAP_HINT_PLAYS) return;
    coachRecordedGenRef.current = gen;
    const nextPlays = nextTapHintPlays(shown, 1);
    mergeTapHintPlays(nextPlays);
    void enqueueCoachWrite(async () => {
      try {
        const saved = await recordTapHintPlay(nextPlays);
        mergeTapHintPlays(saved.tapHintPlays);
      } catch {
        // A newer fill may have already raised the live count. Never lower it.
        if (fillStartGen.current !== gen) return;
        let diskPlays = Math.max(0, nextPlays - 1);
        try {
          diskPlays = (await loadPersist()).tapHintPlays;
        } catch {
          // Keep the local fallback when disk cannot be read.
        }
        if (fillStartGen.current !== gen) return;
        const current = persistRef.current;
        if (!current) return;
        const rolled = rollbackLiveTapHintPlays(
          current.tapHintPlays,
          nextPlays,
          diskPlays,
        );
        if (rolled === current.tapHintPlays) return;
        applyPersist({ ...current, tapHintPlays: rolled });
        if (coachRecordedGenRef.current === gen) {
          coachRecordedGenRef.current = null;
        }
      }
    });
  }, [
    applyPersist,
    coachThisFill,
    enqueueCoachWrite,
    mergeTapHintPlays,
    paused,
    persist,
    persistRef,
    phase,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'background' || status === 'inactive') {
        void flushCoachWrite();
      }
    });
    return () => {
      sub.remove();
      void flushCoachWrite();
    };
  }, [flushCoachWrite]);

  /** A new fill is starting: open a generation and decide if it coaches. */
  const beginFill = useCallback(() => {
    bumpFillGen();
    // Count a play only after the hand actually fades in (see onHintPlayed).
    setCoachThisFill(
      hintThisRunRef.current && tapHintsThisRunRef.current < TAP_HINT_PER_GAME,
    );
  }, [bumpFillGen]);

  /** A new run is starting. `finishedGames` decides who still gets coached. */
  const beginRun = useCallback((finishedGames: number) => {
    tapHintsThisRunRef.current = 0;
    const coachThisGame = finishedGames < TAP_HINT_GAMES;
    hintThisRunRef.current = coachThisGame;
    setHintThisRun(coachThisGame);
    setHowToThisRun(finishedGames < TAP_HOW_TO_PLAYS);
  }, []);

  /** The fill is over (the round was judged) — stop coaching this fill. */
  const endFill = useCallback(() => setCoachThisFill(false), []);

  /**
   * The run stopped. Retires the current generation so a late write cannot
   * touch the next run, but never cancels a write already in flight — the
   * player already saw that fill.
   */
  const haltCoach = useCallback(() => {
    bumpFillGen();
    setCoachThisFill(false);
    setHowToThisRun(false);
    hintThisRunRef.current = false;
    setHintThisRun(false);
    tapHintsThisRunRef.current = 0;
    void flushCoachWrite();
  }, [bumpFillGen, flushCoachWrite]);

  /** The hand faded in, so this run has spent one of its hint slots. */
  const onHintPlayed = useCallback(() => {
    if (tapHintsThisRunRef.current < TAP_HINT_PER_GAME) {
      tapHintsThisRunRef.current += 1;
    }
  }, []);

  return {
    coachThisFill,
    howToThisRun,
    hintThisRun,
    fillCycle,
    beginFill,
    endFill,
    beginRun,
    haltCoach,
    onHintPlayed,
    flushCoachWrite,
  };
}
