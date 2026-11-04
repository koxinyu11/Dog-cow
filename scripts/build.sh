#!/bin/zsh
set -euo pipefail
REPO_DIR="${0:A:h:h}"
cd "$REPO_DIR"
npm run make:mac
