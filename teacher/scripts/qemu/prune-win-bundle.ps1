# Trim teacher/public/qemu/win to Next-Exam LocalVM minimum (run from repo root or any cwd).
param(
    [string]$BundleRoot = (Join-Path $PSScriptRoot "..\..\public\qemu\win"),
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$BundleRoot = (Resolve-Path $BundleRoot).Path

$requiredShareFirmware = @(
    "edk2-x86_64-code.fd",
    "edk2-i386-vars.fd"
)

$requiredExes = @(
    "qemu-system-x86_64.exe",
    "qemu-img.exe"
)

function Remove-IfExists([string]$target) {
    if (-not (Test-Path $target)) { return }
    if ($WhatIf) {
        Write-Host "[WhatIf] Remove $target"
        return
    }
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host "Removed $target"
}

Write-Host "Bundle: $BundleRoot"

# --- share/: docs, man, icons, unused UEFI blobs (~300+ MB) ---
$share = Join-Path $BundleRoot "share"
if (Test-Path $share) {
    Get-ChildItem $share -Directory | ForEach-Object { Remove-IfExists $_.FullName }
    Get-ChildItem $share -File | ForEach-Object {
        if ($requiredShareFirmware -contains $_.Name) { return }
        Remove-IfExists $_.FullName
    }
}

# --- not used by teacher/student qemuService ---
foreach ($name in @("qemu-ga.exe", "qemu-uninstall.exe", "README.rst")) {
    Remove-IfExists (Join-Path $BundleRoot $name)
}

foreach ($exe in $requiredExes) {
    if (-not (Test-Path (Join-Path $BundleRoot $exe))) {
        throw "Missing required $exe under $BundleRoot"
    }
}

$mb = [math]::Round((Get-ChildItem $BundleRoot -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "Done. Bundle size now ~${mb} MB (DLLs unchanged; see README in script comments)."
if ($WhatIf) { Write-Host "Re-run without -WhatIf to apply." }
