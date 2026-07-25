# Zone Meter website

Static marketing site for Zone Meter — built with [Astro](https://astro.build). Live URL for now: **https://zonemeter.pages.dev** (swap to your domain in [`src/site.ts`](src/site.ts) after purchase).

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

Attach a custom domain in Cloudflare Pages when ready. Until then, the site uses `https://zonemeter.pages.dev` (set in [`src/site.ts`](src/site.ts)).

## Configuration

Edit [`src/site.ts`](src/site.ts) for store URLs, contact email, taglines, and hero media. Set `APP_STORE_URL` and `PLAY_STORE_URL` when the app is live — until then, CTAs show “Coming soon”.

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
