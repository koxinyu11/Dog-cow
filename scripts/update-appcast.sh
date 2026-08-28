#!/bin/zsh
set -euo pipefail

VERSION="${1:?usage: update-appcast.sh <version> <url> <length> <signature>}"
DOWNLOAD_URL="${2:?missing download url}"
LENGTH="${3:?missing file length}"
SIGNATURE="${4:?missing EdDSA signature}"
REPO_DIR="${0:A:h:h}"
APPCAST="$REPO_DIR/docs/appcast.xml"
TEMP_FILE="$(mktemp "$REPO_DIR/docs/.appcast.XXXXXX")"
trap 'rm -f "$TEMP_FILE"' EXIT

printf '%s\n' \
  '<?xml version="1.0" encoding="utf-8"?>' \
  '<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">' \
  '  <channel>' \
  '    <title>狗牛 updates</title>' \
  '    <link>https://github.com/koxinyu11/Dog-cow/releases</link>' \
  '    <description>Application updates for 狗牛.</description>' \
  '    <item>' \
  "      <title>狗牛 $VERSION</title>" \
  "      <sparkle:version>$VERSION</sparkle:version>" \
  "      <sparkle:shortVersionString>$VERSION</sparkle:shortVersionString>" \
  '      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>' \
  "      <pubDate>$(LC_ALL=C date -R)</pubDate>" \
  "      <enclosure url=\"$DOWNLOAD_URL\" length=\"$LENGTH\" type=\"application/octet-stream\" sparkle:edSignature=\"$SIGNATURE\" />" \
  '    </item>' \
  '  </channel>' \
  '</rss>' > "$TEMP_FILE"
xmllint --noout "$TEMP_FILE"
mv "$TEMP_FILE" "$APPCAST"
trap - EXIT
