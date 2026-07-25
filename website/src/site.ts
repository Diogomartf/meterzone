/** Replace with your real domain after purchase (also update astro.config / Cloudflare custom domain). */
export const SITE_URL = 'https://zonemeter.pages.dev';
export const CONTACT_EMAIL = 'hello@zonemeter.com';
export const APP_NAME = 'Zone Meter';

/** Set real store URLs when available; null shows "Coming soon" CTAs. */
export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

export const HERO_HEADLINE = {
  lead: 'Can you tap',
  zone: 'THE ZONE',
} as const;

export const HERO_KICKER = 'One tap. Perfect timing.';

/** Hero phone preview — swap to video when ready. */
export const HERO_MEDIA = {
  type: 'video' as 'image' | 'video',
  src: '/videos/gameplay.mp4',
  /** Used when type is 'video' (and as img fallback poster). */
  poster: '/images/game-preview.png',
  alt: 'Zone Meter gameplay',
} satisfies {
  type: 'image' | 'video';
  src: string;
  poster: string;
  alt: string;
};
