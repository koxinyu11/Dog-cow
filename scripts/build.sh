#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
VERSION="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
BUILD_DIR="$REPO_DIR/build"
DIST_DIR="$REPO_DIR/dist"
APP_DIR="$BUILD_DIR/狗牛.app"

rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources" "$DIST_DIR"
xcrun clang -fobjc-arc -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 \
  -framework Cocoa -framework WebKit -framework Security \
  "$REPO_DIR/native/DogCowApp.m" -o "$APP_DIR/Contents/MacOS/狗牛"
cp "$REPO_DIR/app/index.html" "$APP_DIR/Contents/Resources/index.html"
cp "$REPO_DIR/app/app.js" "$APP_DIR/Contents/Resources/app.js"
cp "$REPO_DIR/assets/狗牛.icns" "$APP_DIR/Contents/Resources/狗牛.icns"
/usr/libexec/PlistBuddy -c "Add :CFBundleExecutable string 狗牛" \
  -c "Add :CFBundleIdentifier string app.dogcow.desktop" \
  -c "Add :CFBundleName string 狗牛" \
  -c "Add :CFBundleDisplayName string 狗牛" \
  -c "Add :CFBundlePackageType string APPL" \
  -c "Add :CFBundleIconFile string 狗牛.icns" \
  -c "Add :CFBundleShortVersionString string $VERSION" \
  -c "Add :CFBundleVersion string ${GITHUB_RUN_NUMBER:-1}" \
  -c "Add :LSMinimumSystemVersion string 11.0" \
  -c "Add :NSHighResolutionCapable bool true" "$APP_DIR/Contents/Info.plist"
codesign --force --deep --sign - "$APP_DIR"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$DIST_DIR/狗牛-通用版-Mac安装包.zip"
echo "Built $DIST_DIR/狗牛-通用版-Mac安装包.zip"
