#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
LABEL="app.dogcow.autosync"
AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST="$AGENT_DIR/$LABEL.plist"
mkdir -p "$AGENT_DIR"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
plutil -create xml1 "$PLIST"
/usr/libexec/PlistBuddy -c "Add :Label string $LABEL" \
  -c "Add :ProgramArguments array" \
  -c "Add :ProgramArguments:0 string /bin/zsh" \
  -c "Add :ProgramArguments:1 string $REPO_DIR/scripts/auto-sync.sh" \
  -c "Add :StartInterval integer 120" \
  -c "Add :RunAtLoad bool true" \
  -c "Add :StandardOutPath string /tmp/dogcow-autosync.log" \
  -c "Add :StandardErrorPath string /tmp/dogcow-autosync-error.log" "$PLIST"
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Auto-sync installed: $PLIST"
