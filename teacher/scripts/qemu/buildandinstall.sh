#!/bin/bash
set -e

ISO_ONLY=0
if [ "${1:-}" = "--iso-only" ]; then
  ISO_ONLY=1
fi

# No static Microsoft links exist: resolve a fresh (~24h valid) Windows 11 consumer ISO
# link via the microsoft.com API (Education edition is selected by the GVLK in autounattend.xml).
ISO="win11.iso"

VIRTIO_URL="https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"
VIRTIO="virtio-win.iso"

RCLONE_URL="https://downloads.rclone.org/rclone-current-windows-amd64.zip"
RCLONE_ZIP="rclone-current-windows-amd64.zip"
RCLONE_EXE="rclone.exe"

ANSWER_ISO="autounattend.iso"
DISK="win11.qcow2"

rm -rf ./autounattend-iso-root
mkdir -p ./autounattend-iso-root
cp ./autounattend.xml ./autounattend-iso-root/autounattend.xml
cp ./nx-disable-animations.ps1 ./autounattend-iso-root/nx-disable-animations.ps1
cp ./setup-rclone.cmd ./autounattend-iso-root/setup-rclone.cmd
cp ./mount-rclone.cmd ./autounattend-iso-root/mount-rclone.cmd

if [ "$ISO_ONLY" -eq 0 ]; then
  if [ ! -f "$ISO" ]; then
    ISO_URL="$(node ../../../shared/qemuWindowsIsoUrl.js)"
    wget -c -O "$ISO" "$ISO_URL"
  fi
  [ -f "$VIRTIO" ] || wget -c -O "$VIRTIO" "$VIRTIO_URL"
fi

# ISO payloads (needed even for --iso-only)
[ -f "$RCLONE_ZIP" ] || wget -c -O "$RCLONE_ZIP" "$RCLONE_URL"
[ -f "$RCLONE_EXE" ] || unzip -p "$RCLONE_ZIP" "*/$RCLONE_EXE" > "$RCLONE_EXE"

# Download stable WinFsp MSI into the QEMU workdir (same dir as this script)
if ! ls ./winfsp-*.msi >/dev/null 2>&1; then
  node ./download-winfsp.mjs .
fi

cp ./rclone.exe ./autounattend-iso-root/rclone.exe
cp ./winfsp-*.msi ./autounattend-iso-root/
test -f ./rclone.conf && cp ./rclone.conf ./autounattend-iso-root/rclone.conf || true

mkisofs -o "$ANSWER_ISO" -V "ADK" -J -r ./autounattend-iso-root

# Also place the ISO under teacher/public so packaged builds can find it via resourcesPath/app.asar.unpacked/public/.
mkdir -p ../../public/qemu
cp -f "$ANSWER_ISO" ../../public/qemu/autounattend.iso

if [ "$ISO_ONLY" -eq 1 ]; then
  echo "built $ANSWER_ISO (iso-only)"
  exit 0
fi

[ -f "$DISK" ] || qemu-img create -f qcow2 "$DISK" 64G



  qemu-system-x86_64 \
  -enable-kvm \
  -m 8192 \
  -smp 4 \
  -cpu host \
  -drive file=win11.qcow2,if=virtio \
  -cdrom "$ISO" \
  -drive file=virtio-win.iso,media=cdrom \
  -drive file=autounattend.iso,media=cdrom \
  -boot once=d \
  -device virtio-net-pci,netdev=n0 \
  -netdev user,id=n0 \
  -device usb-ehci \
  -device usb-tablet
