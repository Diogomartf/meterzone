import { useCallback, useEffect, useRef, useState } from 'react';

import { setGameHapticsEnabled } from '@/game/haptics';
import { loadPersist } from '@/game/storage';
import type { PersistState } from '@/game/types';

/**
 * The persisted snapshot, loaded once on mount.
 *
 * `persistRef` mirrors `persist` so callbacks that fire outside render — timers,
 * Reanimated callbacks, awaited writes — can read the current snapshot instead
 * of a stale closure. Always update through `applyPersist` so the two stay in
 * step; writing `setPersist` directly would let the ref drift.
 */
export function usePersistState() {
  const [persist, setPersist] = useState<PersistState | null>(null);
  const persistRef = useRef<PersistState | null>(null);

  const applyPersist = useCallback((next: PersistState) => {
    persistRef.current = next;
    setPersist(next);
  }, []);

  useEffect(() => {
    void loadPersist().then((state) => {
      applyPersist(state);
      setGameHapticsEnabled(state.hapticsEnabled !== false);
    });
  }, [applyPersist]);

  return { persist, persistRef, applyPersist };
}
