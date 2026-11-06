import PostHog from 'posthog-react-native';

/**
 * Product analytics. Anonymous: there are no accounts, so PostHog only sees a
 * random id it keeps on the device. Debug builds send nothing unless
 * EXPO_PUBLIC_POSTHOG_DEV=1, so simulator runs stay out of the numbers.
 */
const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const enabled = !__DEV__ || process.env.EXPO_PUBLIC_POSTHOG_DEV === '1';

const posthog =
  apiKey && enabled
    ? new PostHog(apiKey, {
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
        captureAppLifecycleEvents: true,
      })
    : null;

type Properties = Record<string, string | number | boolean>;

/** Where a tap happened: a screen, a menu page or a modal. */
export type TapLocation =
  | 'avatar'
  | 'daily_reward'
  | 'game'
  | 'game_over'
  | 'highscores'
  | 'home'
  | 'howto'
  | 'language'
  | 'menu'
  | 'play_mode'
  | 'ranking'
  | 'review_prompt'
  | 'settings'
  | 'skins';

/**
 * `location.button`, like `home.menu` or `game_over.retry`. Labels are
 * translated, so every tap target needs its own stable name.
 */
export type TapTarget = `${TapLocation}.${string}`;

export function track(event: string, properties?: Properties) {
  posthog?.capture(event, properties);
}

export function trackTap(target: TapTarget, properties?: Properties) {
  const [location, button] = target.split('.');
  track('button_tapped', { ...properties, target, location, button });
}

export function trackScreen(name: string) {
  void posthog?.screen(name);
}

/** Sent with every later event, so anything can be broken down by language. */
export function setAnalyticsLanguage(language: string) {
  void posthog?.register({ language });
}

let lastGameCenterState: boolean | undefined;

/**
 * Records whether this player is connected to Game Center: on every later
 * event, and on their PostHog person. Only ever the yes or no, never their
 * Game Center id. `sign_in` is the player asking; the others report changes.
 */
export function trackGameCenter(
  method: 'launch' | 'sign_in' | 'refresh',
  connected: boolean,
) {
  if (method !== 'sign_in' && connected === lastGameCenterState) return;
  lastGameCenterState = connected;
  void posthog?.register({ game_center_connected: connected });
  posthog?.capture('game_center_status', {
    method,
    connected,
    $set: { game_center_connected: connected },
  });
}
