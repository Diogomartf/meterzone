---
name: app-screenshots
description: Capture MeterZone screenshots and a gameplay video from the iOS simulator in every app language (en-US, pt-PT, pt-BR, es-ES), app UI only. Use when asked to take, refresh or redo app screenshots, store screenshots, or a gameplay recording.
---

# MeterZone app screenshots

Captures every screen, a splash shot, gameplay stills and a 30s gameplay video with sound for each app language, into `screenshots/raw/<locale>/`. Screenshots and video show only the app UI. Never the Expo dev-menu gear, never the dev client's blue "Refreshing…"/"Downloading…" reload banner, never system prompts.

## Never capture during a reload

- **Let the app finish reloading before any screenshot or recording.** `wait_home` waits until the Play button is on screen with no banner. `sim_shot` re-shoots while the banner is up. `record_run` scans every video frame and records again if the banner shows anywhere.
- **Don't write into the repo while capturing.** Metro watches the repo, and new files there (screenshots, videos) trigger a reload mid-shot. `capture.sh` works in a temp dir and moves each locale into `screenshots/raw/` only when that locale is done. Don't edit project files during a run either.
- `sim_has_banner <png>` checks any image. Run it over the final set before handing it over.

## Files

- `sim.sh`: simulator helpers (`sim_prepare`, `sim_ui`, `sim_tap`, `sim_wait`, `sim_shot`, `sim_sheet`, and `sim_record_start` / `sim_record_stop` / `sim_record_encode` for video with sound). Source it to drive the app by hand.
- `sim-audio.swift`: records the running app's sound, since simctl records none. `sim.sh` builds it on first use.
- `capture.sh [--video-only] [locale...]`: the full run. With no locales it captures all four. `--video-only` re-records just `gameplay.mp4` and keeps the screenshots and picked stills.

## Before you run it

1. **Simulator.** Boot the `iPhone 18 Pro Max` (6.9", 1320×2868) with the MeterZone dev build installed. Other simulators may also be booted, so `sim.sh` resolves the device by name (override with `DEVICE=` or `UDID=`).
2. **Metro with autoplay.** Simulator taps land ~1.3s late, so nobody can play by hand. A dev-only flag in `src/game/useMeterTap.ts` plays for you: it hits the zone for N rounds (about half of them Perfect), then misses three times so the run ends. Stop any running MeterZone Metro, then start:
   ```bash
   EXPO_PUBLIC_SCREENSHOT_AUTOPLAY=14 bunx expo start --dev-client --port 8082 --clear
   ```
   Check the port isn't another project's Metro first (`lsof -iTCP:8082 -sTCP:LISTEN`). The flag is compiled out of release builds (`__DEV__`).
3. **Tools.** `axe` (`brew install cameroncooke/axe/axe`), `ffmpeg`, ImageMagick (`magick`) and the Xcode command-line tools (`swiftc`).
4. **Sound permission.** Your terminal app needs "Screen & System Audio Recording" in System Settings > Privacy & Security, or the recording stops with a permission error.

## Run

```bash
.claude/skills/app-screenshots/capture.sh              # all locales
.claude/skills/app-screenshots/capture.sh en-US es-ES  # some locales
.claude/skills/app-screenshots/capture.sh --video-only  # just the gameplay videos
```

It runs in the background for about 3 minutes per locale. `sim_prepare` hides the dev-menu gear (`EXDevMenuShowFloatingActionButton` user default) and pins the status bar to 9:41. The script plays one daily run first so the Daily card and Hall of fame aren't empty. For each locale it then:

| File | Screen |
|---|---|
| `00-splash.png` | Splash, caught while the bundle loads |
| `01-home.png` | Home |
| `02-hall-of-fame.png` | Hall of fame |
| `03-menu.png` | Menu |
| `04-play-mode.png` | Play mode |
| `05-ranking.png` | Ranking |
| `06-skins.png` / `07-avatar.png` | Avatar & skins, both tabs |
| `08-settings.png` | Settings |
| `09-how-to-play.png` | How to play |
| `gameplay.mp4` | 30s with sound, from the PLAY press through ~11 levels with Perfect/Great/Nice hits (App Store previews run 15 to 30s) |
| `11-game-over.png` | Game over |
| `14-reward-card.png` | Daily reward card for 2nd place, a dev-menu preview |
| `15-ranking-you-5th.png` | Ranking with 8 players and you 5th, a dev-menu preview |
| `_burst/NNN.png` | Full-resolution frames from `gameplay.mp4`, 3 per second (simctl can't screenshot while recording) |

## After the run: pick gameplay stills

Make labelled contact sheets of `_burst/` and look at them, about 72 frames per sheet:

```bash
cd screenshots/raw/<locale>/_burst
magick montage -font /System/Library/Fonts/Supplemental/Arial.ttf -label '%t' $(ls | head -72) \
  -tile 18x4 -geometry 105x228+2+2 -pointsize 14 /path/to/scratchpad/sheet.png
```

Popups stay up for about 3 frames. For each locale, copy into the locale folder:

- `10-gameplay-countdown.png`: the big "3" or "GO!"
- `12-gameplay-perfect.png`: PERFECT! (PERFEITO!, ¡PERFECTO!) with a combo, the higher the better
- `13-gameplay-hit.png`: a Great or Nice popup (pt-PT: ÓTIMO!/FIXE!, pt-BR: ÓTIMO!/LEGAL!)

Then delete `_burst/`. Review every final image and re-shoot anything with the gear, the reload banner, a system alert, a stuck screen, or the wrong language.

## Gotchas

- Plain `axe tap` doesn't reach React Native buttons; `--tap-style physical` does. Taps can land mid-animation and do nothing, so `tap_at` retries until the screen changes.
- Labels are translated, so the script taps fixed controls by position and menu rows by order (rows end in "›" in every language). Language picker rows start with a flag emoji.
- Hall of fame, ranking and the rest open inside the menu sheet: Back returns to the menu, and Close is the X at (391,133). The home Menu button doesn't respond to simulated taps, so reach the menu through the scores card, then Back.
- If `axe` starts timing out ("Timed out creating the simulator remote automation session") or taps stop registering, reboot the simulator (`xcrun simctl shutdown/boot $UDID`) and rerun the affected locale.
- `simctl launch` can fail with `FBSOpenApplicationServiceErrorDomain code=4` after a reboot. `open_app` instead opens the dev client deep link to Metro.
- Dev-menu previews (the reward card and the sample ranking) open through `dev_menu`, which shakes the simulator (`xcrun simctl notify_post $UDID com.apple.UIKit.SimulatorShake`). Cmd+D sent through `axe key-combo` doesn't open the menu. Item names are English in every language, so they're tapped by label. The shake can flash the Dynamic Island in for a moment; `sim_shot` retakes the shot until it's gone (`sim_has_island`).
- Recordings draw the Dynamic Island as a black pill in every frame, whatever `--mask` says (simctl and `axe record-video` both). Screenshots don't. The encode paints it out with `SIM_ISLAND_FILTER` (an ffmpeg `delogo` over the pill, in `sim.sh`), and `record_run` retakes a video whose frames still show it.
- simctl records no sound and writes frames only when the screen changes, so a raw recording starts late, has gaps and is silent. `sim_record_start` runs `sim-audio` beside it: a Core Audio process tap on the app's own Mac process, which needs no audio driver and leaves your speakers alone. Both log their wall-clock start, and `sim_record_encode` lines them up (within about 50 ms), resamples to a constant 30 fps, and starts 0.3s before the first change on screen, so the video never opens on a still or blank screen.
- `open_app` presses Home before launching. Launched from inside another app, iOS adds a "◀ <app>" back link to the status bar.
- A bare `xcrun simctl ... booted` picks any booted simulator. Always pass the resolved `$UDID`.
- Playing runs changes the simulator's saved bests and coins. That's fine for screenshots and stays on the simulator.
