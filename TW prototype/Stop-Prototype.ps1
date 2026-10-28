$ErrorActionPreference = 'Stop'
$taskRecord = Join-Path $PSScriptRoot '.tw-server.json'
if (Test-Path -LiteralPath $taskRecord) {
    try {
        $taskInfo = Get-Content -LiteralPath $taskRecord -Raw | ConvertFrom-Json
        Invoke-RestMethod -Method Post -Uri ("http://127.0.0.1:{0}/__tw_stop" -f $taskInfo.port) -Headers @{'X-TW-Token'=$taskInfo.token} -TimeoutSec 3 | Out-Null
        Write-Output 'Prototype server stopped.'
    } catch { Write-Output 'Prototype server is not running.' }
} else { Write-Output 'Prototype server is not running.' }
