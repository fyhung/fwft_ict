$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceDir = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "outputs\win-unpacked"))
$stageDir = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "work\iexpress"))
$outputExe = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "outputs\SQL-Run-1.0.0-portable-x64.exe"))

if (-not $sourceDir.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe source path." }
if (-not $stageDir.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe stage path." }
if (-not (Test-Path -LiteralPath (Join-Path $sourceDir "SQL Run.exe") -PathType Leaf)) { throw "Run electron-builder --dir before creating the portable package." }

if (Test-Path -LiteralPath $stageDir) { Remove-Item -LiteralPath $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null
$payload = Join-Path $stageDir "payload.zip"
Compress-Archive -Path (Join-Path $sourceDir "*") -DestinationPath $payload -CompressionLevel Optimal
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "portable-launch.ps1") -Destination (Join-Path $stageDir "portable-launch.ps1")

$escapedStage = $stageDir.TrimEnd('\') + '\'
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$outputExe
FriendlyName=SQL Run 1.0.0 Portable
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File portable-launch.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="payload.zip"
FILE1="portable-launch.ps1"
[SourceFiles]
SourceFiles0=$escapedStage
[SourceFiles0]
%FILE0%=
%FILE1%=
"@
$sedPath = Join-Path $stageDir "sql-run-portable.sed"
Set-Content -LiteralPath $sedPath -Value $sed -Encoding ASCII
& "$env:WINDIR\System32\iexpress.exe" /N $sedPath
if (-not (Test-Path -LiteralPath $outputExe -PathType Leaf)) { throw "IExpress portable packaging failed." }
Get-Item -LiteralPath $outputExe | Select-Object FullName, Length, LastWriteTime
