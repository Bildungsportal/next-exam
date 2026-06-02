#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# assessment-helper MUST be a .app bundle carrying its OWN embedded.provisionprofile:
# automatic-assessment-configuration is a restricted entitlement -> AMFI kills a bare CLI that
# requests it ("no matching profile", error 413). Bundle layout (executable + embedded profile +
# Info.plist with CFBundleIdentifier == App-ID in the profile) is what authorizes the entitlement.
APP="$DIR/assessment-helper.app"
PROFILE="$DIR/nextexamstudent.provisionprofile"
BUNDLE_ID="com.nextexam.student"   # must equal App-ID in profile (89V82RD7XY.com.nextexam.student)

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
swiftc "$DIR/assessment.swift" \
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
  -o "$DIR/wifi-helper" \
  -framework CoreWLAN \
  -framework CoreLocation
echo "Built: $DIR/wifi-helper"
