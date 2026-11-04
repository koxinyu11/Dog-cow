#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
LOCK_DIR="$REPO_DIR/.autosync.lock"
mkdir "$LOCK_DIR" 2>/dev/null || exit 0
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
cd "$REPO_DIR"
fail() { print -u2 -- "DogCow auto-sync: $1"; exit 1; }
[[ "$(git symbolic-ref --quiet --short HEAD)" == main ]] || fail "only main may sync"
git fetch origin main || fail "fetch failed; local files and commits retained"
git show-ref --verify --quiet refs/remotes/origin/main || fail "origin/main is missing"
git merge-base --is-ancestor origin/main HEAD || fail "main is behind or diverged; manual synchronization required"
git add --all
if ! git diff --cached --quiet; then
  git commit -m "chore: auto-sync $(date '+%Y-%m-%d %H:%M')"
fi
if [[ "$(git rev-list --count origin/main..HEAD)" != 0 ]]; then
  git push origin HEAD:refs/heads/main || fail "push failed; commits retained for next retry"
fi
