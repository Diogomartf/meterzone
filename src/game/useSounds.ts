import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

type Sfx =
  'click' | 'tap' | 'perfect' | 'zone' | 'miss' | 'start' | 'tick' | 'coins';

const SOURCES: Record<Sfx, number> = {
  click: require('../../assets/sounds/click.wav'),
  tap: require('../../assets/sounds/tap.wav'),
  perfect: require('../../assets/sounds/perfect.wav'),
  zone: require('../../assets/sounds/zone.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  start: require('../../assets/sounds/start.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  coins: require('../../assets/sounds/coins.wav'),
};

/** Per-cue levels so ticks stay quiet and rewards punch through. */
const VOLUME: Record<Sfx, number> = {
  click: 0.55,
  tap: 0.78,
  tick: 0.38,
  start: 0.52,
  zone: 0.82,
  perfect: 0.92,
  miss: 0.68,
  coins: 0.85,
};

/**
 * Voices per cue. A player that is still mid-clip ignores `play()`, so two
 * voices let a cue retrigger before the previous one has finished — and let
 * the idle voice be the one that is already rewound.
 */
const VOICES = 2;

type Voice = { player: AudioPlayer; remove: () => void };

/** The mounted `useSounds` player, for UI sounds outside the game screen. */
let activePlay: ((key: Sfx) => void) | null = null;

/**
 * Button click for MainButton. Goes through the game's players, so it
 * follows the Sound setting; silent until the game screen has mounted.
 */
export function playClick() {
  activePlay?.('click');
}

export function useSounds(muted: boolean, buttonSounds = true) {
  const voices = useRef<Partial<Record<Sfx, Voice[]>>>({});
  const cursor = useRef<Partial<Record<Sfx, number>>>({});
  const mutedRef = useRef(muted);
  const buttonSoundsRef = useRef(buttonSounds);

  useEffect(() => {
    mutedRef.current = muted;
    buttonSoundsRef.current = buttonSounds;
  }, [muted, buttonSounds]);

  useEffect(() => {
    let alive = true;

    const setup = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } catch {
        // best-effort
      }

      if (!alive) return;

      (Object.keys(SOURCES) as Sfx[]).forEach((key) => {
        voices.current[key] = Array.from({ length: VOICES }, () => {
          const player = createAudioPlayer(SOURCES[key], {
            // SFX must not deactivate the session on pause/finish — iOS
            // otherwise drops the next play, especially in the simulator.
            keepAudioSessionActive: true,
          });
          player.volume = VOLUME[key];
          // Rewind as soon as the clip ends, so the next `play()` is a single
          // synchronous call. Seeking on the tap itself cost a native
          // round-trip before the sound could start.
          const sub = player.addListener('playbackStatusUpdate', (status) => {
            if (status.didJustFinish) void player.seekTo(0);
          });
          return { player, remove: () => sub.remove() };
        });
      });
    };

    void setup();

    return () => {
      alive = false;
      Object.values(voices.current).forEach((list) => {
        list?.forEach((voice) => {
          try {
            voice.remove();
            voice.player.remove();
          } catch {
            // ignore
          }
        });
      });
      voices.current = {};
      cursor.current = {};
    };
  }, []);

  const play = useCallback((key: Sfx) => {
    if (mutedRef.current) return;
    if (key === 'click' && !buttonSoundsRef.current) return;
    const list = voices.current[key];
    if (!list || list.length === 0) return;

    // Round-robin so a retrigger lands on the voice that already finished.
    const at = cursor.current[key] ?? 0;
    cursor.current[key] = (at + 1) % list.length;
    const player = list[at].player;

    try {
      player.volume = VOLUME[key];
      if (player.currentTime > 0) {
        // Not yet rewound (still playing, or the finish event was missed).
        void player.seekTo(0).then(() => player.play());
        return;
      }
      player.play();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    activePlay = play;
    return () => {
      if (activePlay === play) activePlay = null;
    };
  }, [play]);

  return { play };
}
