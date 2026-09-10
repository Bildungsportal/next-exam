# qemu-system-x86_64 \
#   -enable-kvm \
#   -cpu host \
#   -m 8192 \
#   -smp 4 \
#   -drive file=win11.qcow2,if=virtio,cache=none,discard=unmap \
#   -vga std \
#   -display none \
#   -vnc :1 \
#   -netdev user,id=n0 \
#   -device virtio-net-pci,netdev=n0 \
#   -boot order=c
#
#
#
qemu-system-x86_64 \
  -enable-kvm \
  -cpu host \
  -m 8192 \
  -smp 4 \
  -drive file=win11.qcow2,if=virtio,cache=none,aio=native \
  -vga std \
  -display none \
  -vnc :1 \
  -netdev user,id=n0 \
  -device virtio-net-pci,netdev=n0 \
  -device usb-ehci \
  -device usb-tablet \
  -boot order=c
