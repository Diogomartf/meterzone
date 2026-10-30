import { useCallback, useRef, useState } from 'react';

import {
  changesRender,
  initialRunState,
  runReducer,
  type RunAction,
  type RunState,
} from '@/game/runState';

/**
 * Run state plus a ref that always holds the latest value.
 *
 * Timers and Reanimated callbacks fire outside render and would otherwise read
 * a stale closure, so the ref is the source of truth: every action is folded
 * into it by the pure `runReducer`, and `state` is a snapshot of it for render.
 *
 * The snapshot is only taken when something drawn changes. Arming or clearing
 * a timer (`pendingTimer`) and parking a resume (`pauseResume`) are read by
 * callbacks alone, and used to cost a full GameScreen render twice per round:
 * once as the next meter landed, once as the previous one left.
 */
export function useRunState() {
  const [state, setState] = useState(() => initialRunState());
  const stateRef = useRef<RunState>(state);

  const dispatch = useCallback((action: RunAction) => {
    const prev = stateRef.current;
    const next = runReducer(prev, action);
    stateRef.current = next;
    if (changesRender(prev, next)) setState(next);
  }, []);

  return [state, dispatch, stateRef] as const;
}
