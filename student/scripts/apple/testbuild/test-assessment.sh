#!/bin/bash
# Isolierter macOS-Test: kann ein AAC-Helper (AEAssessmentSession) ueberhaupt eine Session
# halten, wenn das automatic-assessment-configuration entitlement NICHT auf der Electron-App,
# sondern nur am Helper liegt? AMFI verlangt ein eingebettetes Provisioning-Profil fuer dieses
# restricted entitlement -> deshalb wird hier eine minimale .app gebaut, die das Profil als
# Contents/embedded.provisionprofile traegt. CFBundleIdentifier MUSS exakt der App-ID im Profil
# entsprechen (com.nextexam.student), sonst "no matching profile" (AMFI 413).
#
# NUR auf macOS lauffaehig (swiftc + AutomaticAssessmentConfiguration framework + codesign).
# Vom Linux-Repo zum Mac kopieren, dort ausfuehren: bash scripts/apple/testbuild/test-assessment.sh
set -euo pipefail

# --- Pfade (Script liegt in student/scripts/apple/testbuild/) --------------------------------
HERE="$(cd "$(dirname "$0")" && pwd)"
APPLE_DIR="$(cd "$HERE/.." && pwd)"            # student/scripts/apple
SCRIPTS_DIR="$(cd "$APPLE_DIR/.." && pwd)"     # student/scripts
STUDENT_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"   # student

SWIFT_SRC="$APPLE_DIR/assessment.swift"
ENTITLEMENTS="$SCRIPTS_DIR/entitlements.mac.assessment.plist"
PROFILE="$APPLE_DIR/nextexamstudent.provisionprofile"
APP="$HERE/AssessmentTest.app"
BUNDLE_ID="com.nextexam.student"               # MUSS App-ID im Profil sein (89V82RD7XY.com.nextexam.student)

# --- Signing-Identity laden (aus student/.env: SHAID) ----------------------------------------
if [ -z "${SHAID:-}" ]; then
  if [ -f "$STUDENT_DIR/.env" ]; then
    set -a; . "$STUDENT_DIR/.env"; set +a
  fi
fi
IDENTITY="${SHAID:-${CSC_NAME:-${NXE_APPLE_SIGN_IDENTITY:-}}}"
if [ -z "$IDENTITY" ]; then
  echo "FEHLER: keine Signing-Identity. SHAID in student/.env setzen, oder:" >&2
  echo "  export SHAID=\"Developer ID Application: NAME (89V82RD7XY)\"" >&2
  echo "verfuegbare Identities:" >&2
  security find-identity -p codesigning -v >&2 || true
  exit 1
fi

# --- Vorbedingungen pruefen ------------------------------------------------------------------
[ "$(uname)" = "Darwin" ]    || { echo "FEHLER: nur auf macOS lauffaehig (aktuell: $(uname))" >&2; exit 1; }
command -v swiftc >/dev/null  || { echo "FEHLER: swiftc fehlt (Xcode / Command Line Tools)" >&2; exit 1; }
[ -f "$SWIFT_SRC" ]           || { echo "FEHLER: $SWIFT_SRC fehlt" >&2; exit 1; }
[ -f "$ENTITLEMENTS" ]        || { echo "FEHLER: $ENTITLEMENTS fehlt" >&2; exit 1; }
[ -f "$PROFILE" ]            || { echo "FEHLER: $PROFILE fehlt" >&2; exit 1; }

echo "== Identity: $IDENTITY"
echo "== Profil:   $PROFILE"

# --- 1) Swift-Helper bauen -------------------------------------------------------------------
echo "== [1/4] swiftc assessment.swift -> assessment-helper"
swiftc "$SWIFT_SRC" -o "$HERE/assessment-helper" -framework AutomaticAssessmentConfiguration

# --- 2) Minimale .app mit eingebettetem Profil zusammenbauen ----------------------------------
echo "== [2/4] AssessmentTest.app bauen (embedded.provisionprofile)"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$HERE/assessment-helper" "$APP/Contents/MacOS/AssessmentTest"
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
<key>CFBundleExecutable</key><string>AssessmentTest</string>
<key>CFBundleName</key><string>AssessmentTest</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
</dict></plist>
EOF

# --- 3) Signieren (hardened runtime + entitlements) ------------------------------------------
echo "== [3/4] codesign AssessmentTest.app"
codesign --force --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" \
  -s "$IDENTITY" "$APP"

echo "-- Signatur-Pruefung:"
codesign -vvv --strict "$APP" && echo "   signature OK" || echo "   signature INVALID"
echo "-- entitlements am Binary:"
codesign -d --entitlements - "$APP" 2>/dev/null || true

# --- 4) Starten + Outcome beobachten ---------------------------------------------------------
EXE="$APP/Contents/MacOS/AssessmentTest"
echo "== [4/4] Start: $EXE start"
echo "   (bei {\"event\":\"begin\"} laeuft AAC; mit Ctrl-C beenden = session.end())"
echo "   -------- helper output --------"
set +e
"$EXE" start
RC=$?
set -e
echo "   -------- exit code: $RC --------"

# Bei SIGKILL (RC=137) bzw. ohne begin: AMFI-Log zeigen (no matching profile = 413)
if [ "$RC" -eq 137 ] || [ "$RC" -ne 0 ]; then
  echo "== AMFI / taskgated Log (letzte 2 min):"
  log show --last 2m --predicate \
    'process == "AssessmentTest" OR eventMessage CONTAINS "AssessmentTest" OR eventMessage CONTAINS "AMFI" OR eventMessage CONTAINS "Mobile File Integrity"' \
    2>/dev/null | tail -40 || true
fi
