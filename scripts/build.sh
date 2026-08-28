#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h:h}"
VERSION="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
BUILD_DIR="$REPO_DIR/build"
DIST_DIR="$REPO_DIR/dist"
APP_DIR="$BUILD_DIR/狗牛.app"
SPARKLE_DIR="$REPO_DIR/.build-dependencies/Sparkle-2.9.6"
SPARKLE_FRAMEWORK="$SPARKLE_DIR/Sparkle.framework"

"$REPO_DIR/scripts/fetch-sparkle.sh" "$SPARKLE_DIR"

rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources" "$APP_DIR/Contents/Frameworks" "$DIST_DIR"
xcrun clang -fobjc-arc -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 \
  -F"$SPARKLE_DIR" -framework Cocoa -framework WebKit -framework Security -framework Sparkle \
  -Wl,-rpath,@loader_path/../Frameworks \
  "$REPO_DIR/native/DogCowApp.m" -o "$APP_DIR/Contents/MacOS/狗牛"
cp "$REPO_DIR/app/index.html" "$APP_DIR/Contents/Resources/index.html"
cp "$REPO_DIR/app/app.js" "$APP_DIR/Contents/Resources/app.js"
cp "$REPO_DIR/assets/狗牛.icns" "$APP_DIR/Contents/Resources/狗牛.icns"
ditto "$SPARKLE_FRAMEWORK" "$APP_DIR/Contents/Frameworks/Sparkle.framework"
/usr/libexec/PlistBuddy -c "Add :CFBundleExecutable string 狗牛" \
  -c "Add :CFBundleIdentifier string app.dogcow.desktop" \
  -c "Add :CFBundleName string 狗牛" \
  -c "Add :CFBundleDisplayName string 狗牛" \
  -c "Add :CFBundlePackageType string APPL" \
  -c "Add :CFBundleIconFile string 狗牛.icns" \
  -c "Add :CFBundleShortVersionString string $VERSION" \
  -c "Add :CFBundleVersion string $VERSION" \
  -c "Add :LSMinimumSystemVersion string 11.0" \
  -c "Add :SUEnableAutomaticChecks bool false" \
  -c "Add :NSHighResolutionCapable bool true" "$APP_DIR/Contents/Info.plist"
if [[ -n "${SPARKLE_PUBLIC_ED_KEY:-}" ]]; then
  /usr/libexec/PlistBuddy \
    -c "Add :SUFeedURL string https://koxinyu11.github.io/Dog-cow/appcast.xml" \
    -c "Add :SUPublicEDKey string $SPARKLE_PUBLIC_ED_KEY" \
    "$APP_DIR/Contents/Info.plist"
fi
xattr -cr "$APP_DIR"
codesign --force --deep --sign - "$APP_DIR"
xattr -cr "$APP_DIR"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$DIST_DIR/狗牛-通用版-Mac安装包.zip"
echo "Built $DIST_DIR/狗牛-通用版-Mac安装包.zip"
