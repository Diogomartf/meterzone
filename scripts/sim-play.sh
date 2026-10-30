#!/bin/zsh
# Play one MeterZone run on the iOS simulator by itself, for gameplay videos, quick
# screenshots, smoke tests and render profiling. See "Simulator gameplay" in AGENTS.md.
#
#   scripts/sim-play.sh [--daily] [--hits N] [--video out.mp4] [--shots dir] [--log out.log]
#
#   --daily        play the daily challenge instead of a normal run
#   --hits N       autoplay hits before it misses out (default 14, so 17 rounds)
#   --video FILE   record the run, from the tap on PLAY to game over, as H.264 MP4
#   --shots DIR    save home.png before the run and game-over.png after it
#   --log FILE     keep Metro's output, including the app's console.log lines
#
# It starts its own Metro with EXPO_PUBLIC_SCREENSHOT_AUTOPLAY, so the meter stops itself
# on the zone (simulator taps land ~1.3s late; nobody can play by hand there), and stops
# it again on exit. Needs the dev build installed on the "iPhone 18 Pro Max" simulator,
# plus axe (brew install cameroncooke/axe/axe) and, for --video, ffmpeg.
set -u
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

zparseopts -D -E -F -- -daily=daily -hits:=hits -video:=video -shots:=shots -log:=log || exit 2
HITS=${hits[-1]:-14}
VIDEO=${video[-1]:-}
SHOTS=${shots[-1]:-}
: ${METRO_PORT:=8082}
: ${DEVICE:="iPhone 18 Pro Max"}
BUNDLE=com.diogomartf.meterzone
STAGE=$(mktemp -d -t meterzone-play)
LOG=${log[-1]:-$STAGE/metro.log}

die() { echo "sim-play: $*" >&2; exit 1; }

command -v axe >/dev/null || die "axe is missing: brew install cameroncooke/axe/axe"
[[ -z $VIDEO ]] || command -v ffmpeg >/dev/null || die "ffmpeg is missing: brew install ffmpeg"
lsof -iTCP:$METRO_PORT -sTCP:LISTEN >/dev/null 2>&1 &&
  die "port $METRO_PORT is taken; stop that server or set METRO_PORT"

if ! xcrun simctl list devices booted | grep -qF "$DEVICE ("; then
  echo "Booting $DEVICE…"
  xcrun simctl boot "$DEVICE" || die "no simulator named '$DEVICE'"
  open -a Simulator
fi
OUT=$STAGE source .claude/skills/app-screenshots/sim.sh
[[ -n $UDID ]] || exit 1
xcrun simctl get_app_container $UDID $BUNDLE >/dev/null 2>&1 ||
  die "MeterZone isn't installed on $DEVICE; see \"Simulator gameplay\" in AGENTS.md"

# CI=1: no file watching, so writing the video or shots into the repo can't reload the app.
# --clear: EXPO_PUBLIC_ values are inlined at bundle time, so a cached bundle would keep
# an old autoplay setting.
mkdir -p "$(dirname $LOG)"
echo "Starting Metro on :$METRO_PORT with autoplay ($HITS hits)…"
EXPO_PUBLIC_SCREENSHOT_AUTOPLAY=$HITS CI=1 bunx expo start --dev-client \
  --port $METRO_PORT --clear >$LOG 2>&1 &
rec=""
cleanup() {
  [[ -n $rec ]] && kill -INT $rec 2>/dev/null
  pkill -f "expo start --dev-client --port $METRO_PORT" 2>/dev/null
  xcrun simctl status_bar $UDID clear 2>/dev/null
  rm -rf $STAGE/raw.mp4
}
trap cleanup EXIT INT TERM
for i in {1..60}; do
  curl -s localhost:$METRO_PORT/status | grep -q running && break
  sleep 1
done
curl -s localhost:$METRO_PORT/status | grep -q running || die "Metro never started; see $LOG"

# Center of the element whose center is within 15pt of ($1, $2). Labels are translated,
# so home controls are found by position (points, iPhone 18 Pro Max).
element_at() {
  sim_ui | awk -F'\t' -v x=$1 -v y=$2 '
    ($2 - x) ^ 2 + ($3 - y) ^ 2 < 225 { print $2, $3; exit }'
}

sim_prepare
# Launch from the home screen, or iOS puts a "◀ <app>" back link in the status bar.
axe button home --udid $UDID >/dev/null 2>&1; sleep 1
xcrun simctl openurl $UDID \
  "meterzone://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$METRO_PORT"
echo "Waiting for the home screen (the first bundle takes up to a minute)…"
if (( ${#daily} )); then start=(354 883); else start=(220 653); fi
target=""
for i in {1..90}; do
  target=$(element_at $start)
  [[ -n $target ]] && break
  sleep 1
done
[[ -n $target ]] || die "the home screen never appeared"
sleep 2

if [[ -n $SHOTS ]]; then
  mkdir -p $SHOTS
  xcrun simctl io $UDID screenshot --mask=ignored $SHOTS/home.png >/dev/null 2>&1
fi
if [[ -n $VIDEO ]]; then
  xcrun simctl io $UDID recordVideo --codec=h264 --mask=ignored --force $STAGE/raw.mp4 >/dev/null 2>&1 &
  rec=$!
  sleep 1.5
fi

log_from=$(wc -l <$LOG)
# A tap can land mid-animation and do nothing, so retry until the home screen is gone.
home=$(sim_ui | cut -f1 | md5)
for i in 1 2 3 4 5; do
  axe tap -x ${target% *} -y ${target#* } --tap-style physical --udid $UDID >/dev/null
  sleep 1
  [[ $(sim_ui | cut -f1 | md5) != $home ]] && break
done
[[ $(sim_ui | cut -f1 | md5) != $home ]] || die "tapping PLAY didn't start a run"
echo "Playing…"

# The run is over once the screen stops changing: during play the score, level and
# callouts change every few seconds, and the game-over screen is static.
sleep 20
last="" still=0
for i in {1..120}; do
  now=$(sim_ui | cut -f1 | md5)
  if [[ $now == $last ]]; then (( still++ )); else still=0; last=$now; fi
  (( still >= 4 )) && break
  sleep 1.5
done
(( still >= 4 )) || echo "sim-play: the run never seemed to end; stopping anyway" >&2

if [[ -n $VIDEO ]]; then
  kill -INT $rec; wait $rec; rec=""
  mkdir -p "$(dirname $VIDEO)"
  # Drop the second of home screen before the tap, and paint out the Dynamic Island.
  ffmpeg -v error -y -ss 1.4 -i $STAGE/raw.mp4 -vf "$SIM_ISLAND_FILTER" -c:v libx264 -crf 18 -pix_fmt yuv420p -an $VIDEO
  echo "Video: $VIDEO"
fi
if [[ -n $SHOTS ]]; then
  xcrun simctl io $UDID screenshot --mask=ignored $SHOTS/game-over.png >/dev/null 2>&1
  echo "Screenshots: $SHOTS/home.png, $SHOTS/game-over.png"
fi

# Render profiling: with the temporary <Profiler> from AGENTS.md in place, sum this run's commits.
perf=$(tail -n +$((log_from + 1)) $LOG | grep -o '\[perf\] update [0-9.]*')
if [[ -n $perf ]]; then
  print -r -- $perf | awk '{ n++; ms += $3 } END {
    printf "GameScreen: %d commits, %.0f ms render\n", n, ms }'
fi
[[ -n ${log[-1]:-} ]] && echo "Metro log: $LOG"
exit 0
