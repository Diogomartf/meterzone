import { useEffect } from 'react';

import { encodeAvatar } from '@/game/avatars';
import { publishAvatar, subscribeToRankingSignIn } from '@/game/ranking';
import { loadPersist, markAvatarPublished } from '@/game/storage';
import type { PersistState } from '@/game/types';

let syncing = false;
/** A sync was asked for mid-upload: run again after, with the newest save. */
let again = false;

/**
 * Puts the saved avatar on Game Center. A pick made on this device stays
 * pending until the upload succeeds, so a signed-out or offline player's pick
 * goes out on a later sync.
 */
async function syncAvatar() {
  if (syncing) {
    again = true;
    return;
  }
  syncing = true;
  try {
    do {
      again = false;
      const { avatar, avatarPending } = await loadPersist();
      if (avatar && (await publishAvatar(avatar, avatarPending))) {
        if (avatarPending) await markAvatarPublished(avatar);
      }
    } while (again);
  } catch {
    // Still pending, so the next sync sends it.
  } finally {
    syncing = false;
  }
}

/**
 * Shares the player's avatar once the launch sign-in is done, on later
 * sign-ins (like from Settings), and whenever they pick a new one.
 */
export function useAvatarSync(
  persist: PersistState | null,
  signInDone: boolean,
) {
  const avatarCode = encodeAvatar(persist?.avatar);

  useEffect(() => {
    if (signInDone && avatarCode !== 0) void syncAvatar();
  }, [avatarCode, signInDone]);

  useEffect(() => {
    if (!signInDone) return;
    return subscribeToRankingSignIn((signedIn) => {
      if (signedIn) void syncAvatar();
    });
  }, [signInDone]);
}
