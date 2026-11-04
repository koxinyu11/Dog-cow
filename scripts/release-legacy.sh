#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
VERSION="2.8.0"
cd "$REPO_DIR"
"$REPO_DIR/scripts/build-legacy.sh"
git tag -a "v$VERSION" -m "狗牛 v$VERSION"
git push origin "v$VERSION"
