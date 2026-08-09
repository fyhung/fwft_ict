$ErrorActionPreference = "Stop"
$extractRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("SQL-Run-1.0.0-" + [guid]::NewGuid().ToString("N"))
$resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$resolvedExtract = [System.IO.Path]::GetFullPath($extractRoot)
if (-not $resolvedExtract.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe temporary extraction path."
}

try {
  Expand-Archive -LiteralPath (Join-Path $PSScriptRoot "payload.zip") -DestinationPath $resolvedExtract -Force
  $appPath = Join-Path $resolvedExtract "SQL Run.exe"
  if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) { throw "SQL Run executable is missing from the portable payload." }
  $process = Start-Process -FilePath $appPath -WorkingDirectory $resolvedExtract -PassThru
  $process.WaitForExit()
  exit $process.ExitCode
} finally {
  if (Test-Path -LiteralPath $resolvedExtract) {
    Remove-Item -LiteralPath $resolvedExtract -Recurse -Force -ErrorAction SilentlyContinue
  }
}
