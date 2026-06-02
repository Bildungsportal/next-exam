#!/bin/bash
# Klaert die entscheidende Frage: bindet AAC den Lockdown an die aktuelle FOREGROUND-App
# oder an den (unsichtbaren) aufrufenden Helper-Prozess?
#
# Vorher test-assessment.sh laufen lassen (baut+signiert assessment-helper.app).
# Dann DIESES script aus dem Terminal starten, aber WAEHREND der 6s Countdown laeuft
# SOFORT eine ANDERE App in den Vordergrund klicken (z.B. Safari/Finder) und dort bleiben.
#
# Auswertung nach begin():
#  - bleibt die ANDERE App (Safari/Finder) vorne + Rest gesperrt  -> AAC sperrt die Foreground-App
#    => Next-Exam muss vor begin() nur sein Fenster fokussieren. Helper-Ansatz tragfaehig.
#  - grauer/leerer Screen, nichts vorne                            -> AAC bindet an den Helper
#    => Background-Helper-Ansatz ist Sackgasse.
#
# Ctrl-C beendet die Session (oder Power-Button am Mac).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APPLE_DIR="$(cd "$HERE/.." && pwd)"
EXE="$APPLE_DIR/assessment-helper.app/Contents/MacOS/assessment-helper"

[ -x "$EXE" ] || { echo "FEHLER: $EXE fehlt - erst test-assessment.sh laufen lassen" >&2; exit 1; }

echo "JETZT eine ANDERE App (Safari/Finder) anklicken und dort bleiben!"
for i in 6 5 4 3 2 1; do echo "  begin() in $i ..."; sleep 1; done
echo "-- starte AAC --"
exec "$EXE" start
