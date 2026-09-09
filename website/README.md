# MeterZone website

Static marketing site for MeterZone — built with [Astro](https://astro.build). Production URL: **https://meterzone.net**.

## Develop

```bash
cd website
bun install
bun run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Build

```bash
bun run build
```

Output goes to `dist/`.

## Deploy (Cloudflare Pages)

```bash
bun run deploy
```

Or connect the repo in the Cloudflare dashboard:

- **Build command:** `bun run build`
- **Build output directory:** `dist`
- **Root directory:** `website`

Attach **meterzone.net** as a custom domain on the Cloudflare Pages project (`meterzone`). `SITE_URL` in [`src/site.ts`](src/site.ts) is already set to `https://meterzone.net`.

## Configuration

Edit [`src/site.ts`](src/site.ts) for store URLs, contact email, taglines, SEO copy, and hero media. The iPhone App Store link is live; Android is not currently available.

## Website analytics

Cloudflare Pages Functions records `page_view` and `app_store_click` as daily
aggregate counters in the `meterzone-website-analytics` D1 database, configured
in `wrangler.toml`.
Only `/api/events` invokes a Function; pages and assets remain static.
Production events are enabled only on `meterzone.net`, so previews do not
pollute counts. An unavailable analytics endpoint never blocks download links.

Dimensions: page path, button placement (`hero`, `after-faq`, `gameplay-guide`),
broad source category, and device category. No cookies, browser storage,
persistent visitor identifiers, raw IP addresses, full user-agent strings,
referrer URLs, or query strings are written to the dataset. DNT and GPC opt out.
Recognized `utm_source` values are google, bing, instagram, facebook, tiktok,
reddit, youtube, and newsletter; other values become `other-campaign`.

Use [`analytics.sql`](analytics.sql) with `wrangler d1 execute` to compare clicks
and page views over 28 days. Keep Wrangler credentials local; never put a token
in the site.
These are event counts, not unique visitors or installations. Attribution is
for the current page: a reader moving from the homepage to the guide will have
`internal` as the guide's source. We deliberately do not track visits across pages.

Run `bun run test` for analytics validation and privacy checks. `astro dev`
does not run Pages Functions; use `wrangler pages dev dist` for routing checks.
The production D1 database ID is configured in `wrangler.toml`, and the initial
schema has been applied. For future schema changes, apply migrations with
`bunx wrangler d1 migrations apply meterzone-website-analytics --remote`
using an account with D1 write access before deploying the Functions that need
them. The deployment token does not need permission to create D1 resources.
Analytics ingestion must be verified on the deployed production domain.

## Optimized images

The hero background, logo, and video poster use WebP derivatives. Keep the PNG
originals as source assets and for social/structured-data compatibility. With
`cwebp` installed, regenerate after changing the source images:

```bash
cwebp -q 82 public/images/web-bg.png -o public/images/web-bg.webp
cwebp -q 85 -resize 416 0 public/images/zone-meter-logo.png -o public/images/zone-meter-logo.webp
cwebp -q 82 -resize 600 0 public/images/game-preview.png -o public/images/game-preview.webp
```

WebP assets cache for one day; hashed Astro assets cache immutably for one year.
The video starts automatically unless reduced motion is requested, and its
play/pause and sound controls support keyboard interaction.

The gameplay guide at `/how-to-play/` is linked from home and support and
included in the generated sitemap. Keep its scoring explanation in sync with
`../src/game/scoring.ts` and daily reset wording with `../src/game/storage.ts`.

## SEO

The site ships with:

- Canonical URLs, Open Graph, and Twitter cards (via [`BaseLayout.astro`](src/layouts/BaseLayout.astro))
- JSON-LD for `WebSite`, `WebPage`, and `MobileApplication`
- Auto-generated sitemap (`@astrojs/sitemap`) and `robots.txt`
- Social share image at `public/images/og.png` (1200×630)

Submit `https://meterzone.net/sitemap-index.xml` in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) once DNS is live.

**Hero phone preview** — `HERO_MEDIA` in `site.ts`:
- Image (default): `{ type: 'image', src: '/images/game-preview.png', ... }`
- Video: `{ type: 'video', src: '/videos/gameplay.mp4', poster: '/images/game-preview.png', ... }`

Place media files in `public/images/` or `public/videos/`.

## Assets

**Logo:** `assets/images/zone-meter-logo.png` is the single source of truth. Copy it to the website after updates:

```bash
cp assets/images/zone-meter-logo.png website/public/images/
```

Files in `website/public/`:

| File | Use |
|------|-----|
| `favicon.png` | Site favicon |
| `images/web-bg.png` | Hero background |
| `images/zone-meter-logo.png` | Logo (copy from app assets) |
| `images/game-preview.png` | Video poster / static phone preview |
| `videos/gameplay.mp4` | Hero phone gameplay loop |

To refresh favicon from the app:

```bash
cp assets/images/favicon.png website/public/favicon.png
```
