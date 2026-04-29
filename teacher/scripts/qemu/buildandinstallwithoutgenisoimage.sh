set -e

ISO_URL="https://software-static.download.prss.microsoft.com/dbazure/888969d5-f34g-4e03-ac9d-1f9786c66749/26100.1.240331-1435.ge_release_CLIENT_IOT_LTSC_EVAL_x64FRE_en-us.iso"
ISO="win11_iot.iso"

VIRTIO_URL="https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"
VIRTIO="virtio-win.iso"

ANSWER_ISO="autounattend.iso"
DISK="win11-1.qcow2"

# download if missing
[ -f "$ISO" ]    || wget -c -O "$ISO" "$ISO_URL"
[ -f "$VIRTIO" ] || wget -c -O "$VIRTIO" "$VIRTIO_URL"

# create disk if missing
[ -f "$DISK" ] || qemu-img create -f qcow2 "$DISK" 64G

qemu-system-x86_64 \
  -enable-kvm \
  -m 8192 \
  -smp 4 \
  -cpu host \
  -machine q35 \
  -drive file="$DISK",if=virtio,cache=none,aio=native \
  -drive file="$ISO",media=cdrom,if=none,id=winiso,readonly=on \
  -device ide-cd,bus=ide.0,drive=winiso \
  -drive file="$VIRTIO",media=cdrom,if=none,id=virtiocd,readonly=on \
  -device ide-cd,bus=ide.1,drive=virtiocd \
  -drive file="$ANSWER_ISO",media=cdrom,if=none,id=answercd,readonly=on \
  -device ide-cd,bus=ide.2,drive=answercd \
  -vga std \
  -boot once=d \
  -device usb-ehci \
  -device usb-tablet \
  -device virtio-net-pci,netdev=n0 \
  -netdev user,id=n0
