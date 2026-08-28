#!/bin/zsh
set -euo pipefail

# Keep the framework out of Git; this script pins the exact upstream release used
# by the external build script.
SPARKLE_VERSION="2.9.6"
DESTINATION="${1:?usage: fetch-sparkle.sh <destination>}"
ARCHIVE_DIR="${DESTINATION:h}"
ARCHIVE="$ARCHIVE_DIR/Sparkle-$SPARKLE_VERSION.tar.xz"
URL="https://github.com/sparkle-project/Sparkle/releases/download/$SPARKLE_VERSION/Sparkle-$SPARKLE_VERSION.tar.xz"
EXPECTED_SHA256="52bf9e88cdd972fc0c81501377a880e90d47031bd8ca5462488f843e2609e192"

if [[ -d "$DESTINATION/Sparkle.framework" ]]; then
  exit 0
fi

mkdir -p "$ARCHIVE_DIR"
curl --continue-at - --fail --location --retry 3 --retry-delay 2 --output "$ARCHIVE" "$URL"
ACTUAL_SHA256="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "Sparkle archive checksum mismatch" >&2
  exit 1
fi
TEMP_DIR="$(mktemp -d "$ARCHIVE_DIR/.sparkle.XXXXXX")"
trap 'rmdir "$TEMP_DIR" 2>/dev/null || true' EXIT
tar -xJf "$ARCHIVE" -C "$TEMP_DIR"
test -d "$TEMP_DIR/Sparkle.framework"
mv "$TEMP_DIR" "$DESTINATION"
trap - EXIT
