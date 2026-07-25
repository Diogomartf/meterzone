/** Production site URL (also attach this custom domain in Cloudflare Pages). */
export const SITE_URL = 'https://meterzone.net';
export const CONTACT_EMAIL = 'hello@meterzone.net';
export const APP_NAME = 'MeterZone';

/** Default SEO copy — keep under ~155 chars for descriptions. */
export const SITE_TAGLINE = 'One tap. Perfect timing.';
export const SITE_DESCRIPTION =
  'MeterZone is a casual timing game — stop the rising meter in the zone, build combos, and climb the daily challenge. Coming soon on iOS and Android.';
export const SITE_TITLE = `${APP_NAME} — ${SITE_TAGLINE}`;

/** Social share image (1200×630). */
export const OG_IMAGE = {
  path: '/images/og.png',
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: `${APP_NAME} — Tap, beat the score, stack x2 combos. Download now.`,
} as const;

export const THEME_COLOR = '#4ec0ca';

/** Set real store URLs when available; null shows "Coming soon" CTAs. */
export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

export const HERO_HEADLINE = {
  lead: 'Can you tap',
  zone: 'THE ZONE',
} as const;

export const HERO_KICKER = SITE_TAGLINE;

/** Hero phone preview — swap to video when ready. */
export const HERO_MEDIA = {
  type: 'video' as 'image' | 'video',
  src: '/videos/gameplay.mp4',
  /** Used when type is 'video' (and as img fallback poster). */
  poster: '/images/game-preview.png',
  alt: 'MeterZone gameplay: tap when the meter hits the zone',
} satisfies {
  type: 'image' | 'video';
  src: string;
  poster: string;
  alt: string;
};
