import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  type DailyFinish,
  loadDailyFinish,
  subscribeToRankingSignIn,
} from '@/game/ranking';
import { claimDailyReward } from '@/game/storage';
import type { PersistState } from '@/game/types';

type Payout = { finish: DailyFinish; next: PersistState };

let checking = false;

/**
 * Pays yesterday's top-ten daily finish, if any and not yet paid. One check
 * at a time, so overlapping triggers can't race to the same day.
 */
async function payDailyReward(): Promise<Payout | null> {
  if (checking) return null;
  checking = true;
  try {
    const finish = await loadDailyFinish();
    const next = finish && (await claimDailyReward(finish.day, finish.coins));
    checking = false;
    return finish && next ? { finish, next } : null;
  } catch {
    // A failed save pays nothing yet; the next check tries again.
    checking = false;
    return null;
  }
}

/**
 * Pays yesterday's top-ten daily finish and holds it for the reward card.
 * Checks once the launch sign-in is done, on later sign-ins, and whenever the
 * app comes back to the foreground — a board can close while the app is open.
 */
export function useDailyReward(
  signInDone: boolean,
  applyPersist: (next: PersistState) => void,
) {
  const [reward, setReward] = useState<DailyFinish | null>(null);

  useEffect(() => {
    if (!signInDone) return;
    const check = () =>
      void payDailyReward().then((payout) => {
        if (!payout) return;
        applyPersist(payout.next);
        setReward(payout.finish);
      });
    check();
    const unsubscribe = subscribeToRankingSignIn((signedIn) => {
      if (signedIn) check();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [signInDone, applyPersist]);

  const dismiss = useCallback(() => setReward(null), []);

  /** Shows the card for a made-up finish without paying anything — dev only. */
  const preview = useCallback((finish: DailyFinish) => setReward(finish), []);

  return { reward, dismiss, preview };
}
