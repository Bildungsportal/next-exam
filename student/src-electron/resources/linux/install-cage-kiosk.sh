#!/bin/sh
# Installs Next-Exam Student AppImage and Cage kiosk desktop entry (run via pkexec).
set -e
SRC="$1"
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
    echo "Missing AppImage path: $SRC" >&2
    exit 1
fi
install -d /opt/next-exam
install -m 755 "$SRC" /opt/next-exam/next-exam.AppImage
cat > /usr/share/applications/next-exam-kiosk.desktop << 'EOF'
[Desktop Entry]
Name=Next Exam Kiosk
Comment=Next Exam in Cage Kiosk Mode
Exec=cage -s -- /opt/next-exam/next-exam.AppImage
Type=Application
DesktopNames=Cage
Categories=Education;
EOF
echo "Installed /opt/next-exam/next-exam.AppImage and next-exam-kiosk.desktop"
