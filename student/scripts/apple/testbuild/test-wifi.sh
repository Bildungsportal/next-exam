#!/bin/bash
# Isolierter macOS-Test fuer den wifi-Helper, OHNE Electron-Build.
# Baut wifi.swift, signiert es mit der echten Developer-ID und ruft es einmal auf.
# Erwarteter Output: {"ssid":...,"bssid":...,"rssi":...,"message":...}
#
# Hintergrund: SSID/BSSID via CoreWLAN sind auf macOS 14+ nur sichtbar wenn der Prozess
# das restricted entitlement com.apple.developer.networking.wifi-info traegt UND Location
# autorisiert ist. Developer-ID-Profile schreiben das networking-entitlement aber nicht raus
# -> auf einem Dev-ID-Build bleibt ssid=null (message=nopermissions). Dieses Script testet
# beide Faelle: Signatur OHNE und (falls plist vorhanden) MIT wifi-info entitlement.
#
# NUR auf macOS. Vom Linux-Repo zum Mac kopieren: bash scripts/apple/testbuild/test-wifi.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APPLE_DIR="$(cd "$HERE/.." && pwd)"            # student/scripts/apple
SCRIPTS_DIR="$(cd "$APPLE_DIR/.." && pwd)"     # student/scripts
STUDENT_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"   # student

EXE="$HERE/wifi-helper"
WIFI_PLIST="$SCRIPTS_DIR/entitlements.mac.wifi.plist"   # optional: nur wenn vorhanden

# Signing-Identity aus student/.env (SHAID) laden, falls nicht im env gesetzt
if [ -z "${SHAID:-}" ] && [ -f "$STUDENT_DIR/.env" ]; then
  set -a; . "$STUDENT_DIR/.env"; set +a
fi
IDENTITY="${SHAID:-${CSC_NAME:-${NXE_APPLE_SIGN_IDENTITY:-}}}"
if [ -z "$IDENTITY" ]; then
  echo "FEHLER: keine Signing-Identity (SHAID in student/.env)." >&2
  echo "verfuegbare Identities:" >&2
  security find-identity -p codesigning -v >&2 || true
  exit 1
fi

[ "$(uname)" = "Darwin" ] || { echo "FEHLER: nur auf macOS" >&2; exit 1; }
command -v swiftc >/dev/null || { echo "FEHLER: swiftc fehlt (Xcode CLT)" >&2; exit 1; }

echo "== Identity: $IDENTITY"

# 1) bauen (gleiche frameworks wie build.sh)
echo "== [1/3] swiftc wifi.swift -> wifi-helper"
swiftc "$APPLE_DIR/wifi.swift" -o "$EXE" \
  -framework CoreWLAN -framework CoreLocation

# 2) signieren (hardened runtime). entitlements nur wenn plist existiert.
echo "== [2/3] codesign wifi-helper"
if [ -f "$WIFI_PLIST" ]; then
  echo "   mit entitlements: $WIFI_PLIST"
  codesign --force --options runtime --timestamp \
    --entitlements "$WIFI_PLIST" -s "$IDENTITY" "$EXE"
else
  echo "   ohne entitlements (kein $WIFI_PLIST) -> entspricht aktuellem Dev-ID-Build"
  codesign --force --options runtime --timestamp -s "$IDENTITY" "$EXE"
fi
echo "-- Signatur:"; codesign -vvv --strict "$EXE" && echo "   OK" || echo "   INVALID"
echo "-- entitlements:"; codesign -d --entitlements - "$EXE" 2>/dev/null || true

# 3) ausfuehren (one-shot; fragt beim ersten Mal Location-Berechtigung an)
echo "== [3/3] Start: $EXE   (one-shot, ggf. Location-Dialog bestaetigen)"
echo "   -------- helper output --------"
set +e
"$EXE"
RC=$?
set -e
echo "   -------- exit code: $RC --------"
echo "   ssid=null/message=nopermissions => wifi-info fehlt (erwartet auf Dev-ID)."
