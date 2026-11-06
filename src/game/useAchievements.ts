import { useEffect, useRef } from 'react';

import { track } from '@/analytics';
import { pendingAchievements } from '@/game/achievements';
import { reportAchievements, subscribeToRankingSignIn } from '@/game/ranking';
import { loadPersist, markAchievementsReported } from '@/game/storage';
import type { PersistState } from '@/game/types';

/** More than this at once means catching up on old progress, not a moment. */
const MAX_BANNERS = 3;

let syncing = false;

/**
 * Sends Game Center everything earned but not yet accepted. Nothing is marked
 * until it succeeds, so signed-out or offline players catch up on a later sync.
 */
async function syncAchievements() {
  if (syncing) return;
  syncing = true;
  try {
    const pending = pendingAchievements(await loadPersist());
    if (
      pending.length > 0 &&
      (await reportAchievements(pending, pending.length <= MAX_BANNERS))
    ) {
      await markAchievementsReported(pending);
    }
  } catch {
    // Still pending, so the next sync sends it.
  } finally {
    syncing = false;
  }
}

/**
 * Tracks new achievements and reports them once the launch sign-in is done, on
 * later sign-ins, and whenever more are earned.
 */
export function useAchievements(
  persist: PersistState | null,
  signInDone: boolean,
) {
  const earned = persist?.earnedAchievements;
  // What the save already held isn't an unlock happening now.
  const seen = useRef<readonly string[] | null>(null);

  useEffect(() => {
    if (!earned) return;
    if (seen.current) {
      for (const id of earned) {
        if (!seen.current.includes(id)) {
          track('achievement_unlocked', { achievement: id });
        }
      }
    }
    seen.current = earned;
    if (signInDone) void syncAchievements();
  }, [earned, signInDone]);

  useEffect(() => {
    if (!signInDone) return;
    return subscribeToRankingSignIn((signedIn) => {
      if (signedIn) void syncAchievements();
    });
  }, [signInDone]);
}
