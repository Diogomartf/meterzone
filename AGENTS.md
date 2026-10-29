# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Buttons

Use only the two button components, never a one-off `Pressable` styled as a button:

- `MainButton` (`src/game/MainButton.tsx`): the 3D pill that drops onto its lip when pressed, for the main action of a screen or card (PLAY, RETRY, Collect, PLAY DAILY). Tones `blue` / `green` / `gold`, sizes `small` / `regular` / `large`. Add a tone to `TONES` rather than overriding colours.
- `FlatButton` (`src/game/FlatButton.tsx`): flat and outlined, for everything else. With `label` it's a text button (GO HOME, Not now); without, a square icon button (back, close, share). Tones `white` / `blue` / `glass` (on coloured cards).

Rows, tabs, cards and swatches that happen to be tappable aren't buttons and keep their own styles.

# Dev menu previews

Any card, modal or sheet that only appears behind a hard-to-reach condition (a real top-ten finish, a streak of good runs, a network result…) gets a dev-menu entry so it can be opened on demand in the simulator. Register it with `registerDevMenuItems` from `expo-dev-menu` inside the existing `__DEV__` effect in `src/game/GameScreen.tsx`, next to the "Reward card" and "Review prompt" items. Open the menu with Cmd+D (iOS simulator) or Cmd+M (Android emulator).

- Previews only show UI: never pay coins, save progress or call services from a preview callback. Expose a separate `preview` setter (see `useDailyReward`) rather than reusing the real trigger.
- `registerDevMenuItems` replaces the whole list, so keep every item in that one call.
- Keep `expo-dev-menu` on the same version `expo-dev-client` bundles (check `node_modules/expo-dev-client/package.json`); `expo install` may pick a newer SDK's release.

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
