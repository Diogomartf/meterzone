/** Production site URL (also attach this custom domain in Cloudflare Pages). */
export const SITE_URL = 'https://meterzone.net';
export const CONTACT_EMAIL = 'hello@meterzone.net';
export const APP_NAME = 'MeterZone';
/** The developer, as on the App Store listing. */
export const DEVELOPER_NAME = 'Diogo Ferreira';
export const DEVELOPER_X_URL = 'https://x.com/diogomartf';

/** Default SEO copy — keep under ~155 chars for meta descriptions. */
export const SITE_DESCRIPTION =
  'Play MeterZone, a free timing game for iPhone. Tap to stop the meter, stack combos, beat the daily challenge, and climb the Game Center leaderboards.';
export const SITE_TITLE = `${APP_NAME} — Free Offline Timing Game for iPhone`;

/** Social share image (1200×630). */
export const OG_IMAGE = {
  path: '/images/og.png',
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: `${APP_NAME} — free one-tap timing game. Stop the meter in the zone and stack combos.`,
} as const;

/** Matches top of hero `web-bg.png` — tints mobile browser chrome / status bar. */
export const THEME_COLOR = '#0009C1';

/** Set store URLs when live. Null App Store shows "Coming soon"; Play Store button only appears when set. */
export const APP_STORE_URL: string | null =
  'https://apps.apple.com/pt/app/meterzone/id6794744179';
export const PLAY_STORE_URL: string | null = null;

/** Hero phone preview — optimized from App Store preview for landing. */
export const HERO_MEDIA = {
  type: 'video' as 'image' | 'video',
  src: '/videos/gameplay.mp4',
  /** Used when type is 'video' (and as img fallback poster). */
  poster: '/images/game-preview.webp',
  alt: 'MeterZone gameplay: one-tap timing — stop the rising meter inside the zone',
} satisfies {
  type: 'image' | 'video';
  src: string;
  poster: string;
  alt: string;
};
