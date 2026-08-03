/** Production site URL (also attach this custom domain in Cloudflare Pages). */
export const SITE_URL = 'https://meterzone.net';
export const CONTACT_EMAIL = 'hello@meterzone.net';
export const APP_NAME = 'MeterZone';

/** Default SEO copy — keep under ~155 chars for meta descriptions. */
export const SITE_TAGLINE = 'One-tap timing challenge';
export const SITE_DESCRIPTION =
  'MeterZone is a free casual one-tap timing game. Stop the rising meter in the zone, stack combos, chase high scores, and beat the daily challenge.';
export const SITE_TITLE = `${APP_NAME} — One-Tap Timing Game | Casual Arcade`;

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

/** Set real store URLs when available; null shows "Coming soon" CTAs. */
export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

export const HERO_HEADLINE = {
  lead: 'Can you tap',
  zone: 'THE ZONE',
} as const;

export const HERO_KICKER = SITE_TAGLINE;

/** Hero phone preview — optimized from App Store preview for landing. */
export const HERO_MEDIA = {
  type: 'video' as 'image' | 'video',
  src: '/videos/gameplay.mp4',
  /** Used when type is 'video' (and as img fallback poster). */
  poster: '/images/game-preview.png',
  alt: 'MeterZone gameplay: one-tap timing — stop the rising meter inside the zone',
} satisfies {
  type: 'image' | 'video';
  src: string;
  poster: string;
  alt: string;
};
