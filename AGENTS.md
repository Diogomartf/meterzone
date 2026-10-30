# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Buttons

Use only the two button components, never a one-off `Pressable` styled as a button:

- `MainButton` (`src/game/MainButton.tsx`): the 3D pill that drops onto its lip when pressed, for the main action of a screen or card (PLAY, RETRY, Collect, PLAY DAILY). Tones `blue` / `green` / `gold`, sizes `small` / `regular` / `large`. Add a tone to `TONES` rather than overriding colours.
- `FlatButton` (`src/game/FlatButton.tsx`): flat and outlined, for everything else. With `label` it's a text button (GO HOME, Not now); without, a square icon button (back, close, share). Tones `white` / `blue` / `glass` (on coloured cards).

Rows, tabs, cards and swatches that happen to be tappable aren't buttons and keep their own styles. Neither are value badges, like the coin balance in the menu header: they show a number first and only open something second.

# Dev menu previews

Any card, modal or sheet that only appears behind a hard-to-reach condition (a real top-ten finish, a streak of good runs, a network result…) gets a dev-menu entry so it can be opened on demand in the simulator. Register it with `registerDevMenuItems` from `expo-dev-menu` inside the existing `__DEV__` effect in `src/game/GameScreen.tsx`, next to the "Reward card" and "Review prompt" items. Open the menu with Cmd+D (iOS simulator) or Cmd+M (Android emulator).

- Previews only show UI: never pay coins, save progress or call services from a preview callback. Expose a separate `preview` setter (see `useDailyReward`) rather than reusing the real trigger.
- `registerDevMenuItems` replaces the whole list, so keep every item in that one call.
- Keep `expo-dev-menu` on the same version `expo-dev-client` bundles (check `node_modules/expo-dev-client/package.json`); `expo install` may pick a newer SDK's release.

# Performance

Measure before and after any change made for speed, on the same runs, and put both numbers in the PR. Guessing has been wrong here before.

- **Keep React Compiler on every file.** Run `bun run check:compiler`; a skipped file re-renders all its children (see the script header for what triggers a skip).
- **Keep per-frame work on the UI thread.** Taps, the fill and zone motion are worklets reading shared values. Don't move them to JS state, and animate transforms, not layout.
- **Don't re-render GameScreen for state nothing draws.** Run-state fields read only by callbacks go in `UNRENDERED_KEYS` (`src/game/runState.ts`).
- **Unmount hidden overlays** (`if (!visible) return null`) unless they fade out.

## Measuring renders (simulator)

1. Wrap `<GameScreen />` in `src/app/index.tsx` with `<Profiler id="game" onRender={(_, phase, ms) => console.log(`[perf] ${phase} ${ms.toFixed(2)}`)}>`. Temporary: never commit it.
2. Run `scripts/sim-play.sh` (see "Simulator gameplay") twice. Each run is the same 17 rounds, and the script prints the run's GameScreen commits and total render time.
3. For the "before" side, `git show master:<file> > <file>` for the changed files, run it twice more, then restore them. The script bundles fresh each time, so there's nothing to restart.
4. Remove the Profiler wrapper afterwards.

Dev-build times are inflated: compare runs with each other, never against a frame budget. Dropped frames and UI-thread time can only be judged in a release build on a real iPhone with Instruments (Animation Hitches, Time Profiler).

## Baseline

GameScreen during one autoplay run, measured as above (two runs each). Add a row when a change moves these.

| Date | Commit | React commits per run | Render time per run |
|------|--------|-----------------------|---------------------|
| 2026-10-30 | `8cecf79` (before #20) | 146, 153 | 853 ms, 958 ms |
| 2026-10-30 | `f8bb4a3` (#20) | 118, 123 | 675 ms, 667 ms |

# Simulator gameplay

`scripts/sim-play.sh` plays one run on the iOS simulator by itself. Use it for gameplay videos and quick screenshots, to check that a change still plays through, and for render profiling. Simulator taps land about 1.3 s late, so nobody can play by hand there. The script starts its own Metro with `EXPO_PUBLIC_SCREENSHOT_AUTOPLAY` (dev builds only, in `src/game/useMeterTap.ts`): the meter stops itself on the zone for 14 rounds, about half of them Perfect, then misses three times so the run ends. When the run ends, the script stops Metro. A run takes about 3 minutes, most of it bundling from a clean cache. `bun run sim:play -- <flags>` runs the same script.

```bash
scripts/sim-play.sh                                  # play one run: does it still work?
scripts/sim-play.sh --video <dir>/gameplay.mp4       # record it, PLAY tap to game over
scripts/sim-play.sh --shots <dir>                    # home.png before, game-over.png after
scripts/sim-play.sh --daily --hits 20 --log <dir>/metro.log
```

**Setup, once per machine:**

1. Tools: `brew install cameroncooke/axe/axe ffmpeg imagemagick`.
2. The dev build on an `iPhone 18 Pro Max` simulator (the 6.9" App Store size): `bun run build:ios:simulator:local`, then `tar -xzf build/meterzone-simulator.tar.gz -C build` and `xcrun simctl install <udid> build/*.app`. The script boots the simulator if it isn't running.

**Gotchas:**

- The simulator must be free. Another app or agent driving the same simulator swallows the taps. Set `DEVICE=` or `UDID=` to use a different simulator, and `METRO_PORT=` if 8082 is taken.
- If `axe` taps stop registering, reboot the simulator (`xcrun simctl shutdown <udid> && xcrun simctl boot <udid>`).
- Runs change the simulator's saved bests and coins. That's fine; it stays on the simulator.

For the full App Store set (every screen, every language, video and stills), use the `app-screenshots` skill in `.claude/skills/app-screenshots/`.

# App Store Connect (`asc` CLI)

## App

| Field | Value |
|-------|--------|
| Name | MeterZone |
| App ID | `6794744179` |
| Bundle ID | `com.diogomartf.meterzone` |
| Platform | iOS |

Default env for commands: `ASC_APP_ID=6794744179` (optional).

## Auth (do not commit secrets)

Private keys live **outside git** under `credentials/` (entire folder is gitignored).

| Field | Value |
|-------|--------|
| Profile name | `MeterZone` |
| Key ID | `86PN76RHGA` |
| Issuer ID | `20e24fc6-045e-460c-975c-be8f7fa924cf` |
| Private key (local only) | `credentials/asc-cli/AuthKey_86PN76RHGA.p8` |
| Key role | App Manager (screenshots / previews / version metadata) |
| Preferred storage | macOS keychain via `asc auth login` |

Re-login if keychain is empty or auth fails:

```bash
chmod 600 credentials/asc-cli/AuthKey_86PN76RHGA.p8
asc auth login \
  --name "MeterZone" \
  --key-id "86PN76RHGA" \
  --issuer-id "20e24fc6-045e-460c-975c-be8f7fa924cf" \
  --private-key "./credentials/asc-cli/AuthKey_86PN76RHGA.p8" \
  --network

asc auth status
asc apps view --id "6794744179" --output table
```

Sanity checks:

```bash
asc auth doctor
asc versions list --app "6794744179" --output table
```

**Never** commit `.p8` files, put key material in this file, or force-add `credentials/`.

Apple API key console (Issuer ID + keys):  
https://appstoreconnect.apple.com/access/integrations/api

## Screenshots & app previews

Common workflow:

```bash
# sizes + local validation
asc screenshots sizes --output table
asc screenshots sizes --all --output table
asc screenshots validate --path "./screenshots/iphone" --device-type "IPHONE_65" --output table

# resolve version localization id (not locale code)
asc versions list --app "6794744179" --output table
asc localizations list --version "VERSION_ID" --output table

# screenshots
asc screenshots list --version-localization "LOC_ID" --output table
asc screenshots upload --version-localization "LOC_ID" --path "./screenshots" --device-type "IPHONE_65" --dry-run
asc screenshots upload --app "6794744179" --version "1.0" --path "./screenshots" --device-type "IPHONE_65"

# app preview videos
asc video-previews list --version-localization "LOC_ID" --output table
asc video-previews upload --version-localization "LOC_ID" --path "./previews" --device-type "IPHONE_65" --dry-run
```

Typical device types: `IPHONE_65` (iPhone), `IPAD_PRO_3GEN_129` (iPad). App does not support tablet (`supportsTablet: false` in app.json) — iPhone set is enough for most submissions.

## Where to find `asc` docs

1. **CLI itself (authoritative for flags)**
   - `asc --help`
   - `asc screenshots --help` / `asc video-previews --help` / `asc auth --help`
   - `asc search "upload screenshots"` / `asc search "preview"`
   - `asc schema --pretty "GET /v1/apps"`
   - `asc capabilities --area release --output table`

2. **Agent skills** (read `SKILL.md` before non-trivial workflows) at `~/.agents/skills/`:
   - `asc-cli-usage` — flags, output, auth, discovery
   - `asc-screenshot-resize` — sizes, sips, validate before upload
   - `asc-shots-pipeline` — capture / frame / review / plan / apply
   - `asc-metadata-sync` — App Store metadata
   - `asc-id-resolver` — resolve app/version/localization IDs
   - `asc-release-flow` / `asc-submission-health` — release & review
   - `asc-testflight-orchestration` — TestFlight
   - `asc-signing-setup` / `asc-xcode-build` — signing & archives

3. **Apple**
   - App Store Connect: https://appstoreconnect.apple.com
   - API keys: https://appstoreconnect.apple.com/access/integrations/api
   - ASC API docs: https://developer.apple.com/documentation/appstoreconnectapi

4. **asc CLI project / feedback**
   - https://github.com/rorkai/App-Store-Connect-CLI (issues for experimental screenshot automation)

Always re-check command paths with `--help` before mutating live App Store data. Prefer `--dry-run` on upload/replace flows first.
