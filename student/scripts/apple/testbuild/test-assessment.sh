#!/bin/bash
# Isolierter macOS-Test fuer den AAC-Helper, OHNE 20-Min Electron-Build.
# Baut assessment-helper.app via build.sh (Bundle + embedded.provisionprofile), signiert es mit
# der echten Developer-ID und startet es. AAC (AEAssessmentSession) sperrt systemweit -> bei
# {"event":"begin"} wird der Bildschirm grau/gesperrt; mit Ctrl-C beenden = session.end().
#
# Hintergrund: automatic-assessment-configuration ist ein restricted entitlement. Ein nacktes CLI
# damit wird von AMFI gekillt ("no matching profile", 413). Erst das .app-Bundle mit eigenem
# embedded.provisionprofile + CFBundleIdentifier == App-ID im Profil autorisiert das entitlement.
#
# NUR auf macOS. Vom Linux-Repo zum Mac kopieren: bash scripts/apple/testbuild/test-assessment.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APPLE_DIR="$(cd "$HERE/.." && pwd)"            # student/scripts/apple
SCRIPTS_DIR="$(cd "$APPLE_DIR/.." && pwd)"     # student/scripts
STUDENT_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"   # student

APP="$APPLE_DIR/assessment-helper.app"
ENTITLEMENTS="$SCRIPTS_DIR/entitlements.mac.assessment.plist"

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

# 1) Bundle bauen (gleiche Struktur wie im echten Build)
echo "== [1/3] build.sh -> assessment-helper.app"
bash "$APPLE_DIR/build.sh"

# 2) Bundle signieren (hardened runtime + AAC entitlements)
echo "== [2/3] codesign assessment-helper.app"
codesign --force --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" -s "$IDENTITY" "$APP"
echo "-- Signatur:"; codesign -vvv --strict "$APP" && echo "   OK" || echo "   INVALID"
echo "-- entitlements:"; codesign -d --entitlements - "$APP" 2>/dev/null || true

# 2b) Next-Exam (permitted app) finden + nach vorne holen, damit der permitted-app-Effekt
#     realistisch testbar ist. AAC verlangt gueltige Signatur + Notarisierung der permitted app.
NEXEXAM_BUNDLE="$(mdfind "kMDItemCFBundleIdentifier == 'com.nextexam.student'" 2>/dev/null | head -1)"
if [ -n "$NEXEXAM_BUNDLE" ]; then
  echo "== Next-Exam gefunden: $NEXEXAM_BUNDLE"
  echo "-- Signatur/Notarisierung der permitted app (AAC verlangt valid+notarized):"
  codesign -dv --verbose=2 "$NEXEXAM_BUNDLE" 2>&1 | grep -Ei "Authority|TeamIdentifier|Identifier=" || true
  spctl -a -vv "$NEXEXAM_BUNDLE" 2>&1 | head -3 || true
  echo "-- oeffne Next-Exam (muss beim begin() laufen + erlaubt sein)"
  open "$NEXEXAM_BUNDLE" || true
  sleep 2
else
  echo "WARN: keine installierte Next-Exam-App (bundleId com.nextexam.student) gefunden." >&2
  echo "      Ohne notarisierte Next-Exam-App testet das nur ob begin() ueberhaupt durchlaeuft," >&2
  echo "      NICHT ob die permitted app den grauen Schirm vermeidet." >&2
fi

# 2b) Next-Exam (permitted app) finden + nach vorne holen, damit der permitted-app-Effekt
#     realistisch testbar ist. AAC verlangt gueltige Signatur + Notarisierung der permitted app.
NEXEXAM_BUNDLE="$(mdfind "kMDItemCFBundleIdentifier == 'com.nextexam.student'" 2>/dev/null | head -1)"
if [ -n "$NEXEXAM_BUNDLE" ]; then
  echo "== Next-Exam gefunden: $NEXEXAM_BUNDLE"
  echo "-- Signatur/Notarisierung der permitted app (AAC verlangt valid+notarized):"
  codesign -dv --verbose=2 "$NEXEXAM_BUNDLE" 2>&1 | grep -Ei "Authority|TeamIdentifier|Identifier=" || true
  spctl -a -vv "$NEXEXAM_BUNDLE" 2>&1 | head -3 || true
  echo "-- oeffne Next-Exam (muss beim begin() laufen + erlaubt sein)"
  open "$NEXEXAM_BUNDLE" || true
  sleep 2
else
  echo "WARN: keine installierte Next-Exam-App (bundleId com.nextexam.student) gefunden." >&2
  echo "      Ohne notarisierte Next-Exam-App testet das nur ob begin() ueberhaupt durchlaeuft," >&2
  echo "      NICHT ob die permitted app den grauen Schirm vermeidet." >&2
fi

# 3) Starten + Outcome
EXE="$APP/Contents/MacOS/assessment-helper"
echo "== [3/3] Start: $EXE start   (Ctrl-C beendet die Session)"
echo "   -------- helper output --------"
set +e
"$EXE" start
RC=$?
set -e
echo "   -------- exit code: $RC --------"

if [ "$RC" -ne 0 ]; then
  echo "== AMFI / Integrity Log (letzte 2 min):"
  log show --last 2m --predicate \
    'eventMessage CONTAINS "assessment-helper" OR eventMessage CONTAINS "AMFI" OR eventMessage CONTAINS "Mobile File Integrity"' \
    2>/dev/null | tail -40 || true
fi
