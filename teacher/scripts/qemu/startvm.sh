qemu-system-x86_64 \
  -enable-kvm \
  -m 8192 \
  -smp 4 \
  -cpu host \
  -drive file=win11.qcow2,if=virtio \
  -vga virtio \
  -device qemu-xhci \
  -device usb-tablet \
  -boot order=c
