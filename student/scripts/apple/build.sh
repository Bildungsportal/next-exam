#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# assessment-helper MUST be a .app bundle carrying its OWN embedded.provisionprofile:
# automatic-assessment-configuration is a restricted entitlement -> AMFI kills a bare CLI that
# requests it ("no matching profile", error 413). Bundle layout (executable + embedded profile +
# Info.plist with CFBundleIdentifier == App-ID in the profile) is what authorizes the entitlement.
APP="$DIR/assessment-helper.app"
PROFILE="$DIR/nextexamstudent.provisionprofile"
BUNDLE_ID="com.nextexam.student"   # must equal App-ID suffix in embedded.provisionprofile

TEAM_ID=""
if [ -f "$PROFILE" ]; then
  TEAM_ID=$(security cms -D -i "$PROFILE" 2>/dev/null | plutil -extract TeamIdentifier.0 raw - 2>/dev/null || true)
fi
if [ -z "$TEAM_ID" ]; then
  echo "ERROR: TeamIdentifier missing in $PROFILE" >&2
  exit 1
fi

# Helpers must run on older macOS than the build runner (macos-15/-latest). Without an explicit
# target swiftc stamps the runner's version (minos 15.0), which skips the back-deployment dylibs
# -> on macOS 12 dyld aborts with SIGABRT (missing /usr/lib/swift libs) before any output.
SWIFT_TARGET="$(uname -m)-apple-macos12"

GENERATED="$DIR/.assessment.generated.swift"
sed "s/__APPLE_TEAM_ID__/$TEAM_ID/g" "$DIR/assessment.swift" > "$GENERATED"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
swiftc "$GENERATED" \
  -target "$SWIFT_TARGET" \
  -o "$APP/Contents/MacOS/assessment-helper" \
  -framework AutomaticAssessmentConfiguration
if [ -f "$PROFILE" ]; then
  cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"
fi
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
<key>CFBundleExecutable</key><string>assessment-helper</string>
<key>CFBundleName</key><string>assessment-helper</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>LSUIElement</key><true/>
</dict></plist>
EOF
echo "Built: $APP"

# wifi-helper stays a plain CLI (no restricted entitlement, no profile needed)
swiftc "$DIR/wifi.swift" \
  -target "$SWIFT_TARGET" \
  -o "$DIR/wifi-helper" \
  -framework CoreWLAN
echo "Built: $DIR/wifi-helper"
