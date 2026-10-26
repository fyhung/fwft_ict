$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) {
    $prototypePython = $bundledPython
} else {
    $prototypePython = (Get-Command python -ErrorAction Stop).Source
}
Write-Host 'Lingo-Pet Story Studio'
Write-Host 'Open http://127.0.0.1:4186 in Chrome or Edge.'
Write-Host 'Press Ctrl+C here to stop the preview.'
& $prototypePython -m http.server 4186 --bind 127.0.0.1
