$skillRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = (Get-Command python.exe).Source
Start-Process -FilePath $pythonExe `
    -ArgumentList @('-m', 'http.server', '8765', '--bind', '127.0.0.1') `
    -WorkingDirectory $skillRoot `
    -WindowStyle Hidden
Start-Process 'http://127.0.0.1:8765/ui/'
