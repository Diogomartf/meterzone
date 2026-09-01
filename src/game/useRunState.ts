import { useCallback, useReducer, useRef } from 'react';

import { initialRunState, runReducer, type RunAction } from '@/game/runState';

/**
 * Run state plus a ref that always holds the latest value.
 *
 * Timers and Reanimated callbacks fire outside render and would otherwise read
 * a stale closure, which is why this component used to carry a hand-written
 * `useRef` mirror beside every piece of state. Here the ref is advanced by the
 * same pure reducer React uses, so the two cannot drift: both are
 * `actions.reduce(runReducer, initial)`.
 *
 * StrictMode caveat: React double-invokes the reducer in development, so
 * `state` and `stateRef.current` briefly hold different object identities for
 * the same logical value while stepping through a dispatch. Production keeps
 * them in lockstep; do not treat the identity mismatch as a drift bug.
 */
export function useRunState() {
  const [state, baseDispatch] = useReducer(runReducer, undefined, () =>
    initialRunState(),
  );
  const stateRef = useRef(state);

  const dispatch = useCallback((action: RunAction) => {
    stateRef.current = runReducer(stateRef.current, action);
    baseDispatch(action);
  }, []);

  return [state, dispatch, stateRef] as const;
}
