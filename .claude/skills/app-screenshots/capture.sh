#!/bin/zsh
# Capture the MeterZone screenshot set for one or more locales.
#   capture.sh [--video-only] [locale...]   locales: en-US pt-PT pt-BR es-ES (default: all)
#   --video-only re-records just gameplay.mp4 and keeps the saved screenshots and stills.
# Output per locale in screenshots/raw/<locale>/: NN-name.png, gameplay.mp4, and _burst/ frames
# from the gameplay run to pick the best hits from.
# Everything is captured into a temp dir and moved into the repo at the end of each locale:
# Metro watches the repo, and files appearing there mid-capture make the app reload and
# flash the blue "Refreshing…" banner over the shot.
# Requires: the app installed on the "iPhone 18 Pro Max" simulator, axe, ffmpeg, and MeterZone
# Metro on METRO_PORT (default 8082) started with autoplay, so runs score on their own:
#   EXPO_PUBLIC_SCREENSHOT_AUTOPLAY=14 bunx expo start --dev-client --port 8082 --clear
set -u
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
source "$(dirname "$0")/sim.sh"
: ${METRO_PORT:=8082}
ROOT=./screenshots/raw
STAGE=$(mktemp -d -t meterzone-shots)

# Language picker rows start with the flag, so they match in any UI language.
typeset -A FLAG=( en-US 🇺🇸 pt-PT 🇵🇹 pt-BR 🇧🇷 es-ES 🇪🇸 )
VIDEO_ONLY=0
[[ ${1:-} == --video-only ]] && { VIDEO_ONLY=1; shift; }
LOCALES=($@)
(( $# )) || LOCALES=(en-US pt-PT pt-BR es-ES)

# Fixed controls (points, iPhone 18 Pro Max). Their labels are translated, so tap by position.
# Taps sometimes land mid-animation and do nothing, so retry until the on-screen labels change.
tap_at() {
  local before=$(sim_ui | cut -f1 | md5)
  for i in 1 2 3; do
    axe tap -x $1 -y $2 --tap-style physical --udid $UDID >/dev/null
    sleep ${3:-1.5}
    [[ $(sim_ui | cut -f1 | md5) != $before ]] && return 0
  done
  echo "tap_at $1,$2: screen did not change" >&2; return 1
}
language_button() { tap_at 92 884; }
sheet_back() { tap_at 49 133; }
avatar_tab() { tap_at 316 290; }
scores_card() { tap_at 359 120; }

# Menu rows end in "›" in every language: 1 Play mode, 2 Hall of fame, 3 Ranking,
# 4 Avatar & skins, 5 Settings, 6 How to play, 7 Send feedback.
menu_row() {
  local hit=$(sim_ui | awk -F'\t' -v n=$1 '$1 ~ /›$/ && ++i == n { print; exit }')
  [[ -z $hit ]] && { echo "menu_row: no row $1" >&2; return 1; }
  tap_at ${hit[(ws:	:)2]} ${hit[(ws:	:)3]} ${2:-1.5}
}

# Fail loudly if the dev-menu gear is on screen; screenshots must show only app UI.
assert_no_fab() {
  sim_ui | grep -q "^Gear Shape" && { echo "Dev-menu gear is visible; run sim_prepare and relaunch" >&2; exit 1; }
}

BUNDLE_SCHEME=meterzone
# Launch from the home screen: opened from inside another app, iOS adds a "◀ <app>" back
# link to the status bar, which spoils every shot.
open_app() {
  xcrun simctl terminate $UDID $BUNDLE 2>/dev/null
  axe button home --udid $UDID >/dev/null 2>&1; sleep 1
  xcrun simctl openurl $UDID "$BUNDLE_SCHEME://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$METRO_PORT"
}

# Wait for the home screen (Play button on screen) with no reload banner, then let it settle.
# Matched within 15pt: the button sits at y 653 or 655 depending on the status bar.
wait_home() {
  local probe=$STAGE/probe.png
  for i in {1..40}; do
    xcrun simctl io $UDID screenshot --mask=ignored $probe >/dev/null 2>&1
    if ! sim_has_banner $probe && sim_ui | awk -F'\t' '($2 - 220) ^ 2 + ($3 - 653) ^ 2 < 225 { ok = 1 } END { exit !ok }'; then
      sleep 2; return 0
    fi
    sleep 1
  done
  echo "wait_home: home screen never settled" >&2; return 1
}

# Relaunch and shoot the splash: the first frame that is the bright splash blue, not the
# banner and not yet home.
shoot_splash() {
  open_app
  local f=$OUT/00-splash.png
  for i in {1..40}; do
    xcrun simctl io $UDID screenshot --mask=ignored $f >/dev/null 2>&1
    if ! sim_has_banner $f; then
      local b=$(magick $f -format '%[fx:int(255*p{40,240}.b)]' info:)
      (( b > 235 )) && { echo $f; return 0; }
    fi
    sleep 0.3
  done
  echo "shoot_splash: never caught a clean splash" >&2; return 1
}

# Open a dev-menu preview (AGENTS.md "Dev menu previews"). A simulated shake opens the menu;
# Cmd+D through axe doesn't. Item names are English in every language.
# The menu slides up, so wait for it to settle (a tap mid-slide lands on another row), then
# tap until it closes: picking an item closes the menu.
dev_menu() {
  xcrun simctl notify_post $UDID com.apple.UIKit.SimulatorShake
  sim_wait "$1" || return 1
  sleep 1.5
  for i in 1 2 3; do
    sim_tap "$1" ${2:-3} || return 1
    sim_ui | grep -qF "$1" || return 0
  done
  echo "dev_menu: '$1' didn't open" >&2; return 1
}

play_button() { tap_at 220 653 0.3; }
daily_button() { tap_at 354 884 0.3; }

# Records a normal autoplay run from the countdown through ~12 levels to $OUT/gameplay.mp4,
# then pulls full-resolution frames from it into $OUT/_burst to pick the stills from.
# (simctl can't take screenshots while it records.) Re-records if any frame shows the banner or
# the Dynamic Island, which the encode paints out ($SIM_ISLAND_FILTER in sim.sh).
record_run() {
  for attempt in 1 2 3; do
    open_app; wait_home
    sim_record_start $STAGE || return 1
    sleep 1.5
    play_button
    sleep 31
    sim_record_stop
    sim_record_encode $STAGE $OUT/gameplay.mp4 30 || return 1
    rm -f $STAGE/raw.mp4 $STAGE/raw.wav
    rm -rf $OUT/_burst; mkdir -p $OUT/_burst
    ffmpeg -v error -i $OUT/gameplay.mp4 -vf fps=3 $OUT/_burst/%03d.png
    local dirty=0
    for f in $OUT/_burst/*.png; do sim_has_banner $f || sim_has_island $f && { dirty=1; break; }; done
    (( dirty )) || return 0
    echo "record_run: reload banner or Dynamic Island in the video, recording again" >&2
    sleep 16  # let this run end first
  done
  echo "record_run: every take had the reload banner" >&2; return 1
}

curl -s localhost:$METRO_PORT/status | grep -q running || { echo "Metro not running on :$METRO_PORT (bunx expo start --dev-client --port $METRO_PORT)" >&2; exit 1; }
sim_prepare

# One daily run first, so the Daily card and Hall of fame show a score instead of a dash.
{ open_app && wait_home && daily_button; } || { echo "Couldn't start the warm-up daily run" >&2; exit 1; }
sleep 50  # 14 autoplay hits, then three misses end the run

# Every file a finished locale must have. _burst/ is checked separately.
EXPECTED=(00-splash 01-home 02-hall-of-fame 03-menu 04-play-mode 05-ranking 06-skins
  07-avatar 08-settings 09-how-to-play 11-game-over 14-reward-card 15-ranking-you-5th)

# Switch the app's language, from whatever language it is in.
set_language() {
  open_app && wait_home || return 1
  language_button || return 1
  sim_tap "${FLAG[$1]}" 2 || return 1
  sheet_back && tap_at 391 133  # Back to menu, then Close
}

# Capture one locale into $OUT. Any failed step stops it, so a broken set is never saved.
capture_locale() {
  local loc=$1
  set_language $loc || return 1

  # Splash: relaunch and catch it while the bundle loads.
  shoot_splash && wait_home || return 1
  assert_no_fab
  sim_shot 01-home || return 1

  # Hall of fame opens inside the menu sheet, so Back lands on the menu.
  scores_card && sim_shot 02-hall-of-fame || return 1
  sheet_back && sim_shot 03-menu || return 1
  menu_row 1 && sim_shot 04-play-mode && sheet_back || return 1
  menu_row 3 2.5 && sim_shot 05-ranking && sheet_back || return 1
  menu_row 4 && sim_shot 06-skins || return 1
  avatar_tab && sim_shot 07-avatar && sheet_back || return 1
  menu_row 5 && sim_shot 08-settings && sheet_back || return 1
  menu_row 6 && sim_shot 09-how-to-play && sheet_back || return 1
  tap_at 391 133 || return 1  # Close menu

  # Cards that need a real podium finish, opened from the dev menu with sample data.
  dev_menu "Reward card · #2" && sim_shot 14-reward-card || return 1
  tap_at 220 638 || return 1  # Collect: a preview pays nothing
  dev_menu "Ranking · 8 players, you #5" && sim_shot 15-ranking-you-5th || return 1
  sheet_back && tap_at 391 133 || return 1  # Back to menu, then Close

  # Gameplay: the countdown frame comes from the burst (first frames), the rest from autoplay.
  record_run || return 1
  sleep 16  # autoplay stops after 14 hits; three misses end the run
  sim_shot 11-game-over || return 1
}

# The whole set is there and nothing in it shows the reload banner or the Dynamic Island.
check_locale() {
  local name f ok=0
  for name in $EXPECTED; do
    [[ -s $OUT/$name.png ]] || { echo "missing $name.png" >&2; ok=1; }
  done
  [[ -s $OUT/gameplay.mp4 ]] || { echo "missing gameplay.mp4" >&2; ok=1; }
  [[ -n $(print -l $OUT/_burst/*.png(N)) ]] || { echo "missing _burst/ frames" >&2; ok=1; }
  for f in $OUT/*.png(N); do
    sim_has_banner $f && { echo "reload banner in ${f:t}" >&2; ok=1; }
    sim_has_island $f && { echo "Dynamic Island in ${f:t}" >&2; ok=1; }
  done
  return $ok
}

for loc in $LOCALES; do
  OUT=$STAGE/$loc
  mkdir -p $OUT
  echo "== $loc"
  if (( VIDEO_ONLY )); then
    if ! set_language $loc || ! record_run; then
      echo "$loc failed; kept the previous $ROOT/$loc/gameplay.mp4" >&2
      exit 1
    fi
    sleep 14  # let the run end before the next locale
    mkdir -p $ROOT/$loc; mv $OUT/gameplay.mp4 $ROOT/$loc/gameplay.mp4
    continue
  fi
  if ! capture_locale $loc || ! check_locale; then
    echo "$loc failed; kept the previous $ROOT/$loc. Partial capture: $OUT" >&2
    exit 1
  fi
  # Only a complete, checked set replaces the saved one.
  rm -rf $ROOT/$loc; mkdir -p $ROOT; mv $OUT $ROOT/$loc
done
rm -rf $STAGE

xcrun simctl status_bar $UDID clear
if (( VIDEO_ONLY )); then echo "Done. New gameplay.mp4 in $ROOT/<locale>/."
else echo "Done. Pick gameplay stills from $ROOT/<locale>/_burst/ (see SKILL.md), then delete _burst/."; fi
