#!/bin/bash
# Isolierter macOS-Test fuer den wifi-Helper inkl. Location-Berechtigung, OHNE Electron-Build.
#
# Kernfrage: SSID/BSSID/RSSI sind auf macOS 14+ NUR ueber CoreWLAN abrufbar (alle CLI-Tools
# liefern <redacted>), und CoreWLAN gibt sie nur frei wenn der aufrufende Prozess Location-
# Berechtigung hat. Location-Dialog erscheint nur wenn das Binary ein App-Bundle mit
# NSLocationUsageDescription ist. Ein nacktes CLI bekommt nie einen Dialog -> immer nopermissions.
#
# Dieses Script baut wifi-helper als Mini-.app MIT Location-Key, signiert+startet es und
# zeigt das Ergebnis. So sieht man ob der Bundle/Location-Weg ueberhaupt SSID liefert,
# BEVOR wir den echten Build umbauen.
#
# NUR auf macOS. Vom Linux-Repo zum Mac kopieren: bash scripts/apple/testbuild/test-wifi.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APPLE_DIR="$(cd "$HERE/.." && pwd)"            # student/scripts/apple
SCRIPTS_DIR="$(cd "$APPLE_DIR/.." && pwd)"     # student/scripts
STUDENT_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"   # student

APP="$HERE/WifiTest.app"
BUNDLE_ID="com.nextexam.student.wifitest"

# Signing-Identity aus student/.env (SHAID) laden, falls nicht im env gesetzt
if [ -z "${SHAID:-}" ] && [ -f "$STUDENT_DIR/.env" ]; then
  set -a; . "$STUDENT_DIR/.env"; set +a
fi
IDENTITY="${SHAID:-${CSC_NAME:-${NXE_APPLE_SIGN_IDENTITY:-}}}"
if [ -z "$IDENTITY" ]; then
  echo "FEHLER: keine Signing-Identity (SHAID in student/.env)." >&2
  security find-identity -p codesigning -v >&2 || true
  exit 1
fi

[ "$(uname)" = "Darwin" ] || { echo "FEHLER: nur auf macOS" >&2; exit 1; }
command -v swiftc >/dev/null || { echo "FEHLER: swiftc fehlt (Xcode CLT)" >&2; exit 1; }

echo "== Identity: $IDENTITY"

# 1) wifi.swift in ein .app-Bundle bauen (Bundle noetig fuer Location-Dialog/TCC-Identitaet)
echo "== [1/4] build WifiTest.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
swiftc "$APPLE_DIR/wifi.swift" \
  -o "$APP/Contents/MacOS/WifiTest" \
  -framework CoreWLAN -framework CoreLocation
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
<key>CFBundleExecutable</key><string>WifiTest</string>
<key>CFBundleName</key><string>WifiTest</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>LSUIElement</key><true/>
<key>NSLocationUsageDescription</key><string>WLAN-Name zur Pruefungskontrolle anzeigen</string>
<key>NSLocationWhenInUseUsageDescription</key><string>WLAN-Name zur Pruefungskontrolle anzeigen</string>
</dict></plist>
EOF

# 2) signieren (hardened runtime; kein entitlement noetig - wifi-info gibt es auf macOS nicht)
echo "== [2/4] codesign WifiTest.app"
codesign --force --options runtime --timestamp -s "$IDENTITY" "$APP"
codesign -vvv --strict "$APP" && echo "   Signatur OK" || echo "   Signatur INVALID"

# 3) bisheriger TCC-Location-Status fuer dieses Bundle (vor dem Lauf)
echo "== [3/4] aktueller Location-Status (vor Lauf):"
tccutil reset Location "$BUNDLE_ID" 2>/dev/null && echo "   (TCC fuer $BUNDLE_ID zurueckgesetzt -> Dialog sollte erscheinen)" || \
  echo "   (tccutil reset nicht moeglich; ggf. existierende Entscheidung)"

# 4) starten -> beim ersten Mal sollte der Location-Dialog kommen. Bestaetigen!
echo "== [4/4] Start WifiTest  (Location-Dialog bestaetigen, dann erneut starten)"
echo "   -------- output --------"
set +e
"$APP/Contents/MacOS/WifiTest"
RC=$?
set -e
echo "   -------- exit $RC --------"
echo
echo "ERWARTUNG:"
echo "  - 1. Lauf: Dialog erscheint, danach evtl. noch nopermissions (Auth kam zu spaet)."
echo "  - 2. Lauf (Script nochmal): ssid+rssi gefuellt => Bundle+Location reicht, KEIN entitlement noetig."
echo "  - bleibt ssid:null trotz erlaubter Location => CoreWLAN-Abfrage muss in den App-Prozess (Addon)."
