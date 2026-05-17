#!/bin/sh
# Installs cage (if missing), Next-Exam AppImage and kiosk desktop entry (run via pkexec).
set -e

if ! command -v cage >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        DEBIAN_FRONTEND=noninteractive apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y cage
    elif command -v pacman >/dev/null 2>&1; then
        pacman -Sy --noconfirm --needed cage
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y cage
    elif command -v zypper >/dev/null 2>&1; then
        zypper -n in cage
    elif command -v apk >/dev/null 2>&1; then
        apk add --no-cache cage
    else
        echo "No supported package manager (apt, pacman, dnf, zypper, apk)." >&2
        exit 1
    fi
fi
command -v cage >/dev/null 2>&1 || { echo "cage not available after install." >&2; exit 1; }

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
echo "Installed cage (if needed), /opt/next-exam/next-exam.AppImage and next-exam-kiosk.desktop"
