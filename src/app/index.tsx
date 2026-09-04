import { useObserve } from 'expo-observe';
import { useEffect } from 'react';

import { GameScreen } from '@/game/GameScreen';

export default function HomeScreen() {
  const { markInteractive } = useObserve();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  return <GameScreen />;
}
