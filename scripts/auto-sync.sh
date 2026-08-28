#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
LOCK_DIR="$REPO_DIR/.autosync.lock"
mkdir "$LOCK_DIR" 2>/dev/null || exit 0
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
cd "$REPO_DIR"
git add --all
git diff --cached --quiet && exit 0
git commit -m "chore: auto-sync $(date '+%Y-%m-%d %H:%M')"
git push origin HEAD:main
