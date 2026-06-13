$ErrorActionPreference = "Stop"

$toolchainBin = "C:\Users\xiaoming\tools\winlibs-x86_64-posix-seh-gcc-16.1.0\bin"
$rustSelfContainedBin = "C:\Users\xiaoming\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained"
$vitePort = 1420

$prepend = @()
if (Test-Path $toolchainBin) {
  $prepend += $toolchainBin
}
if (Test-Path $rustSelfContainedBin) {
  $prepend += $rustSelfContainedBin
}

if ($prepend.Count -gt 0) {
  $env:Path = ($prepend -join ";") + ";" + $env:Path
}

$portOwner = Get-NetTCPConnection -LocalPort $vitePort -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty OwningProcess
if ($portOwner) {
  $ownerInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $portOwner" |
    Select-Object -First 1 ProcessId, CommandLine
  if ($ownerInfo -and $ownerInfo.CommandLine -like "*learn-anything-desktop*" -and $ownerInfo.CommandLine -like "*vite*") {
    Stop-Process -Id $ownerInfo.ProcessId -Force
    Start-Sleep -Seconds 1
  }
}

$tauriCli = Join-Path $PSScriptRoot "..\\node_modules\\.bin\\tauri.cmd"
if (-not (Test-Path $tauriCli)) {
  throw "Missing local Tauri CLI: $tauriCli"
}

& $tauriCli @args
exit $LASTEXITCODE
