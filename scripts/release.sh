#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
VERSION="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
cd "$REPO_DIR"
"$REPO_DIR/scripts/build.sh"
git tag -a "v$VERSION" -m "狗牛 v$VERSION"
git push origin "v$VERSION"
