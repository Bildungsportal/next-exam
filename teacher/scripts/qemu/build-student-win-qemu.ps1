# Build minimal student/public/qemu/win from teacher/public/qemu/winbak (PE imports + runtime smoke test).
param(
    [string]$Source = (Join-Path $PSScriptRoot "..\..\public\qemu\winbak"),
    [string]$Dest = (Join-Path $PSScriptRoot "..\..\..\student\public\qemu\win"),
    [string]$KeymapSource = (Join-Path $PSScriptRoot "..\..\..\student\public\qemu\lin"),
    [switch]$AlsoTeacherWin
)

$ErrorActionPreference = "Stop"
$Source = (Resolve-Path $Source).Path
$Dest = $Dest -replace '/', '\'
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Dest, "$Dest\share\keymaps" | Out-Null

$keepShare = @("edk2-x86_64-code.fd", "edk2-i386-vars.fd")
foreach ($f in $keepShare) {
    Copy-Item (Join-Path $Source "share\$f") (Join-Path $Dest "share\$f")
}
foreach ($exe in @("qemu-system-x86_64.exe", "qemu-img.exe")) {
    Copy-Item (Join-Path $Source $exe) (Join-Path $Dest $exe)
}
foreach ($map in @("en-us", "de")) {
    $src = Join-Path $KeymapSource $map
    if (-not (Test-Path $src)) { throw "Missing keymap $src" }
    Copy-Item $src (Join-Path $Dest "share\keymaps\$map")
}

$py = @'
import json, pefile, subprocess, sys, time
from pathlib import Path

def pe_imports(path: Path):
    pe = pefile.PE(str(path), fast_load=True)
    pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"]])
    return [e.dll.decode().lower() for e in pe.DIRECTORY_ENTRY_IMPORT]

def dll_closure(root: Path, seeds):
    needed = set()
    stack = [root / s for s in seeds]
    seen = set()
    while stack:
        p = stack.pop()
        key = str(p.resolve()).lower()
        if key in seen or not p.exists():
            continue
        seen.add(key)
        if p.suffix.lower() == ".dll":
            needed.add(p.name.lower())
        for dll in pe_imports(p):
            needed.add(dll)
            cand = root / dll
            if cand.exists():
                ckey = str(cand.resolve()).lower()
                if ckey not in seen:
                    stack.append(cand)
    return needed

def copy_dlls(root: Path, dest: Path, names):
    for name in sorted(names):
        src = root / name
        if src.exists():
            (dest / name).write_bytes(src.read_bytes())

def run_smoke(dest: Path, work: Path) -> tuple[bool, str]:
    exe = dest / "qemu-system-x86_64.exe"
    share = dest / "share"
    nvram = work / "nvram.vars"
    if not nvram.exists():
        import shutil
        shutil.copy2(share / "edk2-i386-vars.fd", nvram)
    args = [
        str(exe),
        "-accel", "whpx",
        "-m", "512",
        "-machine", "q35",
        "-cpu", "Skylake-Client,vendor=GenuineIntel,+nx,+popcnt",
        "-drive", f"if=pflash,format=raw,readonly=on,file={share / 'edk2-x86_64-code.fd'}",
        "-drive", f"if=pflash,format=raw,file={nvram}",
        "-vga", "none",
        "-device", "virtio-vga",
        "-display", "none",
        "-vnc", ":99",
        "-netdev", "user,id=n0",
        "-device", "virtio-net-pci,netdev=n0",
        "-device", "qemu-xhci",
        "-device", "usb-tablet",
    ]
    proc = subprocess.Popen(args, cwd=str(dest), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    time.sleep(1.2)
    if proc.poll() is None:
        proc.kill()
        return True, ""
    err = proc.stderr.read().decode("utf-8", "replace")
    return False, err

src = Path(sys.argv[1])
dest = Path(sys.argv[2])
work = Path(sys.argv[3])
optional_skip = {
    "libegl.dll", "libegl_vulkan_secondaries.dll", "libfeature_support.dll",
    "libglesv1_cm.dll", "libglesv2.dll", "libglesv2_vulkan_secondaries.dll",
    "libglesv2_with_capture.dll", "libjsoncpp-26.dll", "libvk_swiftshader.dll",
    "libvkicd_mock_icd.dll",
}
names = dll_closure(src, ["qemu-system-x86_64.exe", "qemu-img.exe"])
bak_dlls = {p.name.lower() for p in src.glob("*.dll")}
to_copy = sorted((names & bak_dlls) - optional_skip)
copy_dlls(src, dest, to_copy)
ok, err = run_smoke(dest, work)
extra = []
have = {p.name.lower() for p in dest.glob("*.dll")}
if not ok:
  missing = sorted((bak_dlls - have) | (optional_skip & bak_dlls))
  if missing:
    copy_dlls(src, dest, missing)
    extra = missing
    ok, err = run_smoke(dest, work)
lib_src = src / "lib"
if lib_src.exists() and not ok:
  import shutil
  shutil.copytree(lib_src, dest / "lib", dirs_exist_ok=True)
  ok, err = run_smoke(dest, work)
print(json.dumps({
  "dllCount": len(list(dest.glob("*.dll"))),
  "smokeOk": ok,
  "stderr": err[-500:] if err else "",
  "extraDll": extra,
}))
'@

$work = Join-Path $env:TEMP "qemu-student-slim-test"
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force -Path $work | Out-Null

$pyFile = Join-Path $env:TEMP "build-student-qemu.py"
Set-Content -Path $pyFile -Value $py -Encoding UTF8
$result = python $pyFile $Source $Dest $work | ConvertFrom-Json
Write-Host "DLLs copied:" $result.dllCount
Write-Host "Smoke test:" $result.smokeOk
if ($result.stderr) { Write-Host "stderr tail:" $result.stderr }
if ($result.extraDll.Count) { Write-Host "Extra DLL needed:" ($result.extraDll -join ', ') }

$mb = [math]::Round((Get-ChildItem $Dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "Bundle: $Dest (~${mb} MB)"

if ($AlsoTeacherWin) {
    $teacherWin = Join-Path $PSScriptRoot "..\..\public\qemu\win"
    if (Test-Path $teacherWin) { Remove-Item $teacherWin -Recurse -Force }
    Copy-Item $Dest $teacherWin -Recurse
    Write-Host "Copied to teacher/public/qemu/win"
}

if (-not $result.smokeOk) { exit 1 }
