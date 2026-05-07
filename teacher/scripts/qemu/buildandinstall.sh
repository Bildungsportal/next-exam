#!/bin/bash
set -e

ISO_URL="https://software-static.download.prss.microsoft.com/dbazure/888969d5-f34g-4e03-ac9d-1f9786c66749/26100.1.240331-1435.ge_release_CLIENT_IOT_LTSC_EVAL_x64FRE_en-us.iso"
ISO="win11_iot.iso"

VIRTIO_URL="https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"
VIRTIO="virtio-win.iso"

RCLONE_URL="https://downloads.rclone.org/rclone-current-windows-amd64.zip"
RCLONE_ZIP="rclone-current-windows-amd64.zip"
RCLONE_EXE="rclone.exe"

ANSWER_ISO="autounattend.iso"
DISK="win11.qcow2"

[ -f "$ISO" ]    || wget -c -O "$ISO" "$ISO_URL"
[ -f "$VIRTIO" ] || wget -c -O "$VIRTIO" "$VIRTIO_URL"

[ -f "$RCLONE_ZIP" ] || wget -c -O "$RCLONE_ZIP" "$RCLONE_URL"
[ -f "$RCLONE_EXE" ] || unzip -p "$RCLONE_ZIP" "*/$RCLONE_EXE" > "$RCLONE_EXE"

# Download stable WinFsp MSI into the QEMU workdir (same dir as this script)
node ./download-winfsp.mjs .

rm -rf ./autounattend-iso-root
mkdir -p ./autounattend-iso-root
cp ./autounattend.xml ./autounattend-iso-root/autounattend.xml
cp ./rclone.exe ./autounattend-iso-root/rclone.exe
cp ./winfsp-*.msi ./autounattend-iso-root/
cp ./setup-rclone.cmd ./autounattend-iso-root/setup-rclone.cmd
test -f ./rclone.conf && cp ./rclone.conf ./autounattend-iso-root/rclone.conf || true

genisoimage -o "$ANSWER_ISO" -V "ADK" -J -r ./autounattend-iso-root

# Also place the ISO under teacher/public so packaged builds can find it via resourcesPath/app.asar.unpacked/public/.
mkdir -p ../../public/qemu
cp -f "$ANSWER_ISO" ../../public/qemu/autounattend.iso

[ -f "$DISK" ] || qemu-img create -f qcow2 "$DISK" 64G



  qemu-system-x86_64 \
  -enable-kvm \
  -m 8192 \
  -smp 4 \
  -cpu host \
  -drive file=win11.qcow2,if=virtio \
  -cdrom win11_iot.iso \
  -drive file=virtio-win.iso,media=cdrom \
  -drive file=autounattend.iso,media=cdrom \
  -boot once=d \
  -device virtio-net,netdev=n0 \
  -netdev user,id=n0
