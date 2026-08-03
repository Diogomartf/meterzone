import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Image, type ImageRef } from 'expo-image';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

/** Cross-fade from the native splash to our identical overlay. */
const SPLASH_HANDOFF_MS = 240;
/** How long the branded splash art stays after the app is ready. */
const SPLASH_HOLD_MS = 1100;
const SPLASH_FADE_MS = 380;

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: SPLASH_HANDOFF_MS, fade: true });

type SplashArt = {
  source: number;
  backgroundColor: string;
  /** Logical width of the art; `null` means it covers the whole screen. */
  imageWidth: number | null;
};

/** Mirrors the expo-splash-screen config in app.json so the handoff is invisible. */
const NATIVE_SPLASH: SplashArt =
  Platform.OS === 'android'
    ? {
        source: require('@/assets/images/splash-android.png'),
        backgroundColor: '#000000',
        imageWidth: 200,
      }
    : {
        source: require('@/assets/images/splash.png'),
        backgroundColor: '#000BB2',
        imageWidth: null,
      };

/** Everything the first screen paints — warmed while the splash is up. */
const FIRST_SCREEN_IMAGES: number[] = [
  require('@/assets/images/game-bg.png'),
  require('@/assets/images/zone-meter-logo.png'),
];

/** Decodes an image up front so it paints on its very first frame. */
function useDecodedImage(source: number) {
  const [state, setState] = useState<{
    image: ImageRef | null;
    settled: boolean;
  }>({
    image: null,
    settled: false,
  });

  useEffect(() => {
    let cancelled = false;
    // Settles on failure too, so a broken asset can never strand the splash.
    const settle = (image: ImageRef | null) => {
      if (!cancelled) setState({ image, settled: true });
    };
    void Image.loadAsync(source).then(settle, () => settle(null));
    return () => {
      cancelled = true;
    };
  }, [source]);

  return state;
}

/** True once every source is decoded, so the reveal lands on a fully painted screen. */
function useWarmedImages(sources: number[]) {
  const [warmed, setWarmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled(
      sources.map((source) => Image.loadAsync(source)),
    ).then(() => {
      if (!cancelled) setWarmed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sources]);

  return warmed;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const splashArt = useDecodedImage(NATIVE_SPLASH.source);
  const firstScreenWarmed = useWarmedImages(FIRST_SCREEN_IMAGES);
  const [handedOff, setHandedOff] = useState(false);
  const [holdElapsed, setHoldElapsed] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(true);
  const overlayOpacity = useSharedValue(1);

  const fontsReady = fontsLoaded || fontError != null;

  useEffect(() => {
    if (!fontsReady || !splashArt.settled || handedOff) return;

    // Dismiss the native splash only once our overlay has reached the screen —
    // its cross-fade would otherwise uncover the app rendering behind it.
    let second: number | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        SplashScreen.hide();
        setHandedOff(true);
      });
    });

    return () => {
      cancelAnimationFrame(first);
      if (second != null) cancelAnimationFrame(second);
    };
  }, [fontsReady, handedOff, splashArt.settled]);

  useEffect(() => {
    if (!handedOff) return;
    const timer = setTimeout(() => setHoldElapsed(true), SPLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, [handedOff]);

  useEffect(() => {
    if (!holdElapsed || !firstScreenWarmed) return;
    overlayOpacity.value = withTiming(
      0,
      { duration: SPLASH_FADE_MS },
      (finished) => {
        if (finished) runOnJS(setOverlayMounted)(false);
      },
    );
  }, [firstScreenWarmed, holdElapsed, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const art = splashArt.image;
  const artStyle =
    NATIVE_SPLASH.imageWidth == null || art == null
      ? StyleSheet.absoluteFill
      : {
          width: NATIVE_SPLASH.imageWidth,
          height: (NATIVE_SPLASH.imageWidth * art.height) / art.width,
        };

  return (
    <View
      style={[styles.root, { backgroundColor: NATIVE_SPLASH.backgroundColor }]}
    >
      <StatusBar style="dark" />
      {fontsReady ? (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      ) : null}
      {overlayMounted ? (
        <Animated.View
          style={[
            styles.splash,
            { backgroundColor: NATIVE_SPLASH.backgroundColor },
            overlayStyle,
          ]}
          pointerEvents="none"
        >
          {art ? (
            <Image
              source={art}
              style={artStyle}
              contentFit={
                NATIVE_SPLASH.imageWidth == null ? 'cover' : 'contain'
              }
            />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
