#!/bin/bash
set -e

ISO_URL="https://software-static.download.prss.microsoft.com/dbazure/888969d5-f34g-4e03-ac9d-1f9786c66749/26100.1.240331-1435.ge_release_CLIENT_IOT_LTSC_EVAL_x64FRE_en-us.iso"
ISO="win11_iot.iso"

VIRTIO_URL="https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"
VIRTIO="virtio-win.iso"

ANSWER_ISO="autounattend.iso"
DISK="win11.qcow2"

[ -f "$ISO" ]    || wget -c -O "$ISO" "$ISO_URL"
[ -f "$VIRTIO" ] || wget -c -O "$VIRTIO" "$VIRTIO_URL"

genisoimage -o "$ANSWER_ISO" -V "ADK" -J -r autounattend.xml

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
