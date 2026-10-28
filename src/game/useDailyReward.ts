import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  type DailyFinish,
  loadDailyFinish,
  subscribeToRankingSignIn,
} from '@/game/ranking';
import { claimDailyReward } from '@/game/storage';
import type { PersistState } from '@/game/types';

/**
 * Pays yesterday's top-ten daily finish and holds it for the reward card.
 * Checks once the launch sign-in is done, on later sign-ins, and whenever the app
 * comes back to the foreground — a board can close while the app is open.
 */
export function useDailyReward(
  signInDone: boolean,
  applyPersist: (next: PersistState) => void,
) {
  const [reward, setReward] = useState<DailyFinish | null>(null);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const finish = await loadDailyFinish();
      if (!finish) return;
      const next = await claimDailyReward(finish.day, finish.coins);
      if (!next) return;
      applyPersist(next);
      setReward(finish);
    } finally {
      checking.current = false;
    }
  }, [applyPersist]);

  useEffect(() => {
    if (!signInDone) return;
    void check();
    const unsubscribe = subscribeToRankingSignIn((signedIn) => {
      if (signedIn) void check();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [signInDone, check]);

  const dismiss = useCallback(() => setReward(null), []);

  return { reward, dismiss };
}
