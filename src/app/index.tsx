import { useEffect } from 'react';

import { GameScreen } from '@/game/GameScreen';
import { useObserveSafe } from '@/observe';

export default function HomeScreen() {
  const { markInteractive } = useObserveSafe();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  return <GameScreen />;
}
