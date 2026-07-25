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

Edit [`src/site.ts`](src/site.ts) for store URLs, contact email, taglines, SEO copy, and hero media. Set `APP_STORE_URL` and `PLAY_STORE_URL` when the app is live — until then, CTAs show “Coming soon”.

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
