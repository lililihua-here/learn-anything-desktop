$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$devLauncherSource = Join-Path $PSScriptRoot "launcher\\DevLauncher.cs"
$devLauncherExe = Join-Path $projectRoot "Start Learn Anything Desktop Dev.exe"
$releaseExe = Join-Path $projectRoot "Learn Anything Tool Desktop.exe"

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"

$cargoTargetDir = [Environment]::GetEnvironmentVariable("CARGO_TARGET_DIR", "User")
if ([string]::IsNullOrWhiteSpace($cargoTargetDir)) {
  $cargoTargetDir = Join-Path $env:TEMP "cargo-target"
}
$env:CARGO_TARGET_DIR = $cargoTargetDir
$releaseDir = Join-Path $cargoTargetDir "release"

Write-Host "Building release executable (no bundle)..."
Push-Location $projectRoot
try {
  npm.cmd run tauri -- build --no-bundle
} finally {
  Pop-Location
}

$builtReleaseExe = Join-Path $releaseDir "learn-anything-tool-desktop.exe"
if (-not (Test-Path $builtReleaseExe)) {
  throw "Built release exe not found: $builtReleaseExe"
}

Copy-Item $builtReleaseExe $releaseExe -Force
Write-Host "Copied release exe to: $releaseExe"

$runtimeDlls = Get-ChildItem $releaseDir -Filter *.dll -File -ErrorAction SilentlyContinue
foreach ($dll in $runtimeDlls) {
  Copy-Item $dll.FullName (Join-Path $projectRoot $dll.Name) -Force
  Write-Host "Copied runtime dll: $($dll.Name)"
}

if (-not (Test-Path $devLauncherSource)) {
  throw "Dev launcher source not found: $devLauncherSource"
}

Add-Type `
  -TypeDefinition (Get-Content $devLauncherSource -Raw) `
  -ReferencedAssemblies @("System.dll", "System.Windows.Forms.dll") `
  -OutputAssembly $devLauncherExe `
  -OutputType WindowsApplication

Write-Host "Built dev launcher exe: $devLauncherExe"
