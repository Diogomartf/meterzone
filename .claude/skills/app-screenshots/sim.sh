#!/bin/zsh
# Simulator helpers for MeterZone screenshots. Source this file, then call the functions.
#   DEVICE simulator name (default: iPhone 18 Pro Max, the 6.9" App Store size)
#   UDID   simulator id   (default: the booted simulator named $DEVICE)
#   OUT    output dir     (default: ./screenshots/raw)

BUNDLE=com.diogomartf.meterzone
: ${DEVICE:="iPhone 18 Pro Max"}
# Several simulators can be booted at once, so always resolve by name.
: ${UDID:=$(xcrun simctl list devices booted | grep -F "$DEVICE (" | grep -Eo '[0-9A-F-]{36}' | head -1)}
[[ -z $UDID ]] && echo "sim.sh: no booted simulator named '$DEVICE'" >&2
: ${OUT:=./screenshots/raw}
mkdir -p "$OUT"

# Hide the Expo dev-menu gear, pin the status bar to 9:41, and relaunch the app.
sim_prepare() {
  xcrun simctl spawn $UDID defaults write $BUNDLE EXDevMenuShowFloatingActionButton -bool NO
  xcrun simctl status_bar $UDID override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
  xcrun simctl terminate $UDID $BUNDLE 2>/dev/null
}

# simctl launch sometimes fails with FBSOpenApplicationServiceErrorDomain code=4; retrying works.
sim_launch() {
  for i in {1..5}; do xcrun simctl launch $UDID $BUNDLE >/dev/null 2>&1 && return 0; sleep 2; done
  echo "sim_launch: could not launch $BUNDLE" >&2; return 1
}

# Labelled elements on screen, one per line: label<TAB>centerX<TAB>centerY
# describe-ui sometimes times out creating its automation session; retry before giving up.
sim_ui() {
  local tree
  for i in 1 2 3 4; do
    tree=$(axe describe-ui --udid $UDID 2>/dev/null) && [[ -n $tree ]] && break
    sleep 2
  done
  print -r -- "$tree" | python3 -c '
import json, sys
seen = set()
def walk(n):
    l, f = n.get("AXLabel") or "", n.get("frame") or {}
    if l and f and l not in seen:
        seen.add(l)
        print("%s\t%.0f\t%.0f" % (l, f["x"] + f["width"] / 2, f["y"] + f["height"] / 2))
    for c in n.get("children", []): walk(c)
try: tree = json.load(sys.stdin)
except ValueError: tree = []
for n in tree: walk(n)'
}

# Tap the last on-screen element whose label starts with $1 (the last match is the topmost sheet).
# Labels hold live values ("All-time best 751, …"), so match by prefix.
# Plain `axe tap` doesn't reach React Native buttons, so use physical touches.
sim_tap() {
  local hit=$(sim_ui | awk -F'\t' -v p="$1" 'index($1, p) == 1 { line = $0 } END { print line }')
  if [[ -z $hit ]]; then echo "sim_tap: no element starting with '$1'" >&2; return 1; fi
  axe tap -x ${hit[(ws:	:)2]} -y ${hit[(ws:	:)3]} --tap-style physical --udid $UDID >/dev/null
  sleep ${2:-1.5}
}

# Wait until an element whose label starts with $1 is on screen (up to ~10s).
sim_wait() {
  for i in {1..20}; do sim_ui | grep -q "^$1" && return 0; sleep 0.5; done
  echo "sim_wait: '$1' never appeared" >&2; return 1
}

# True if an image shows the dev client's blue "Refreshing…"/"Downloading…" banner,
# a solid rgb(34,130,231) bar across the top of the screen.
sim_has_banner() {
  local px=$(magick "$1" -format '%[fx:int(255*p{40,100}.r)] %[fx:int(255*p{40,100}.g)] %[fx:int(255*p{40,100}.b)]' info:)
  local rgb=(${=px})
  (( rgb[1] > 20 && rgb[1] < 50 && rgb[2] > 115 && rgb[2] < 145 && rgb[3] > 215 ))
}

# Recordings always draw the Dynamic Island as a black pill: simctl and axe both do, whatever
# --mask says. Screenshots don't. So videos paint it out with this ffmpeg filter, which blends
# in the background around it. Pixels for the 1320x2868 iPhone 18 Pro Max.
SIM_ISLAND_FILTER="delogo=x=500:y=30:w=320:h=136"

# True if an image shows the Dynamic Island, a pure black pill at the top center. It flashes
# in for a moment after a simulated shake (the dev menu) and never belongs in a shot.
sim_has_island() {
  local min=$(magick "$1" -crop 360x110+480+20 -colorspace gray -format '%[fx:minima]' info:)
  (( min < 0.02 ))
}

# Screenshot to $OUT/$1.png, retrying while the reload banner or the Dynamic Island shows.
sim_shot() {
  local f="$OUT/$1.png"
  for i in {1..10}; do
    xcrun simctl io $UDID screenshot --mask=ignored "$f" >/dev/null 2>&1
    sim_has_banner "$f" || sim_has_island "$f" || { echo "$f"; return 0; }
    sleep 1
  done
  echo "sim_shot: $1 still shows the reload banner or the Dynamic Island" >&2; return 1
}

# Record video and sound into dir $1 until sim_record_stop. simctl records no sound, so
# sim-audio.swift taps the running app's own audio next to it (the terminal needs "Screen &
# System Audio Recording" permission). Both log their wall-clock start so sim_record_encode
# can line them up. Start it after the app has launched: the tap follows that one process.
SIM_AUDIO_SRC=${0:A:h}/sim-audio.swift
[[ -f $SIM_AUDIO_SRC ]] || SIM_AUDIO_SRC=$(git rev-parse --show-toplevel)/.claude/skills/app-screenshots/sim-audio.swift
SIM_AUDIO_BIN=${TMPDIR:-/tmp}/meterzone-sim-audio
sim_rec_pids=()
sim_record_start() {
  local dir=$1
  zmodload zsh/datetime
  if [[ ! -x $SIM_AUDIO_BIN || $SIM_AUDIO_SRC -nt $SIM_AUDIO_BIN ]]; then
    swiftc -O $SIM_AUDIO_SRC -o $SIM_AUDIO_BIN || { echo "sim_record_start: couldn't build sim-audio" >&2; return 1; }
  fi
  rm -f $dir/raw.mp4 $dir/raw.wav $dir/audio.log $dir/video.log
  # Simulator apps run as Mac processes from the device's data folder.
  local pid=$(pgrep -n -f "Devices/$UDID/.*/MeterZone\.app/MeterZone")
  [[ -n $pid ]] || { echo "sim_record_start: MeterZone isn't running" >&2; return 1; }
  $SIM_AUDIO_BIN $pid $dir/raw.wav >$dir/audio.log 2>&1 &
  sim_rec_pids=($!)
  for i in {1..50}; do grep -q '^started' $dir/audio.log && break; sleep 0.1; done
  if ! grep -q '^started' $dir/audio.log; then
    echo "sim_record_start: no audio. $(<$dir/audio.log)" >&2
    grep -q permission $dir/audio.log && echo "Give your terminal app Screen & System Audio Recording permission in System Settings > Privacy & Security." >&2
    kill -INT $sim_rec_pids 2>/dev/null; sim_rec_pids=(); return 1
  fi
  # simctl prints "Recording started" once it writes frames; stamp that line.
  xcrun simctl io $UDID recordVideo --codec=h264 --mask=ignored --force $dir/raw.mp4 2>&1 >/dev/null |
    while read -r line; do print -r -- "$EPOCHREALTIME $line"; done >$dir/video.log &
  for i in {1..50}; do grep -q 'Recording started' $dir/video.log && break; sleep 0.1; done
  sim_rec_pids+=($(pgrep -n -f "recordVideo.*$dir/raw.mp4"))
  grep -q 'Recording started' $dir/video.log && return 0
  echo "sim_record_start: simctl never started recording" >&2; sim_record_stop; return 1
}

sim_record_stop() {
  local pid
  for pid in $sim_rec_pids; do kill -INT $pid 2>/dev/null; done
  for pid in $sim_rec_pids; do while kill -0 $pid 2>/dev/null; do sleep 0.2; done; done
  sim_rec_pids=()
}

# Encode dir $1's recording to $2 as an App Store preview: H.264 at a constant 30 fps (simctl
# writes frames only when the screen changes, so its timestamps start late and have gaps),
# AAC sound, Dynamic Island painted out. It starts 0.3s before the first change on screen
# (the PLAY press), however long the tap took to land, so it never opens on a still screen.
# An optional $3 caps the length in seconds (App Store previews run 15 to 30s).
sim_record_encode() {
  local dir=$1 out=$2 length=()
  [[ -n ${3:-} ]] && length=(-t $3)
  local change=$(ffmpeg -i $dir/raw.mp4 -vf "fps=30:start_time=0,select='gt(scene,0.01)',showinfo" \
    -an -f null - 2>&1 | grep -om1 'pts_time:[0-9.]*')
  [[ -n $change ]] || { echo "sim_record_encode: nothing moves in the recording" >&2; return 1; }
  local from=$(( ${change#pts_time:} > 0.3 ? ${change#pts_time:} - 0.3 : 0 ))
  local v0=$(awk '/Recording started/ { print $1; exit }' $dir/video.log)
  local a0=$(awk '/^started/ { print $2; exit }' $dir/audio.log)
  # Where the video's first second sits in the audio file. The audio starts first.
  local afrom=$(( from + v0 - a0 ))
  ffmpeg -v error -y -i $dir/raw.mp4 -i $dir/raw.wav -filter_complex "
    [0:v]fps=30:start_time=0,trim=start=$from,setpts=PTS-STARTPTS,${SIM_ISLAND_FILTER}[v];
    [1:a]atrim=start=$afrom,asetpts=PTS-STARTPTS[a]" \
    -map '[v]' -map '[a]' -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 \
    -shortest $length -movflags +faststart $out
}

# Swipe a sheet down to dismiss it.
sim_dismiss() {
  axe swipe --start-x 220 --start-y 200 --end-x 220 --end-y 900 --udid $UDID >/dev/null
  sleep 1.5
}

# Contact sheet of PNGs for quick visual review: sim_sheet out.png file...
sim_sheet() { local out=$1; shift; magick montage "$@" -tile ${#}x1 -geometry 260x565+4+4 "$out"; }
