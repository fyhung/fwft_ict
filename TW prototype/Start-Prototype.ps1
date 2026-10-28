param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$taskRecord = Join-Path $taskRoot '.tw-server.json'
$taskApp = 'TW-URBAN-PULSE-V1'

# Only reuse a running instance started from this same folder.
if (Test-Path -LiteralPath $taskRecord) {
    try {
        $taskPrevious = Get-Content -LiteralPath $taskRecord -Raw | ConvertFrom-Json
        $taskHealth = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/__tw_health" -f $taskPrevious.port) -TimeoutSec 2
        if ($taskHealth.app -eq $taskApp -and $taskHealth.instance -eq $taskPrevious.instance) {
            if (-not $NoBrowser) { Start-Process ("http://127.0.0.1:{0}/" -f $taskPrevious.port) }
            Write-Output ("Already running: http://127.0.0.1:{0}/" -f $taskPrevious.port)
            exit 0
        }
    } catch { }
}

$taskListener = $null
foreach ($taskPort in 4186..4196) {
    try {
        $taskCandidate = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $taskPort)
        $taskCandidate.Start()
        $taskListener = $taskCandidate
        break
    } catch { }
}
if ($null -eq $taskListener) { throw 'No free local port between 4186 and 4196.' }
$taskInstance = [Guid]::NewGuid().ToString('N')
$taskToken = [Guid]::NewGuid().ToString('N')
@{port=$taskPort; instance=$taskInstance; token=$taskToken} | ConvertTo-Json | Set-Content -LiteralPath $taskRecord -Encoding UTF8
$taskUrl = "http://127.0.0.1:$taskPort/"
Write-Output "Prototype ready: $taskUrl"
if (-not $NoBrowser) { Start-Process $taskUrl }
$taskRunning = $true
try {
    while ($taskRunning) {
        $taskClient = $taskListener.AcceptTcpClient()
        try {
            $taskClient.ReceiveTimeout = 3000
            $taskClient.SendTimeout = 3000
            $taskStream = $taskClient.GetStream()
            $taskReader = [IO.StreamReader]::new($taskStream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $taskRequest = $taskReader.ReadLine()
            if (-not $taskRequest) { continue }
            $taskParts = $taskRequest.Split(' ')
            $taskHeaders = @{}
            for ($taskHeaderCount = 0; $taskHeaderCount -lt 100; $taskHeaderCount++) {
                $taskLine = $taskReader.ReadLine()
                if ([string]::IsNullOrEmpty($taskLine)) { break }
                $taskColon = $taskLine.IndexOf(':')
                if ($taskColon -gt 0) { $taskHeaders[$taskLine.Substring(0,$taskColon).ToLowerInvariant()] = $taskLine.Substring($taskColon+1).Trim() }
            }
            $taskPath = [Uri]::UnescapeDataString(($taskParts[1] -split '\?')[0])
            $taskStatus = '200 OK'
            $taskType = 'text/plain; charset=utf-8'
            $taskBody = [Text.Encoding]::UTF8.GetBytes('Not found')
            if ($taskPath -eq '/__tw_health' -and $taskParts[0] -eq 'GET') {
                $taskType = 'application/json'
                $taskBody = [Text.Encoding]::UTF8.GetBytes((@{app=$taskApp;instance=$taskInstance} | ConvertTo-Json -Compress))
            } elseif ($taskPath -eq '/__tw_stop' -and $taskParts[0] -eq 'POST' -and $taskHeaders['x-tw-token'] -eq $taskToken) {
                $taskBody = [Text.Encoding]::UTF8.GetBytes('Stopped')
                $taskRunning = $false
            } elseif ($taskParts[0] -in @('GET','HEAD') -and ($taskPath -in @('/','/index.html') -or $taskPath -match '^/assets/[A-Za-z0-9._-]+$')) {
                $taskRelative = if ($taskPath -eq '/') { 'index.html' } else { $taskPath.TrimStart('/') }
                $taskFile = [IO.Path]::GetFullPath((Join-Path $taskRoot $taskRelative))
                if ($taskFile.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $taskFile -PathType Leaf)) {
                    $taskTypes = @{'.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.png'='image/png';'.jpg'='image/jpeg';'.svg'='image/svg+xml'}
                    $taskType = $taskTypes[[IO.Path]::GetExtension($taskFile).ToLowerInvariant()]
                    if (-not $taskType) { $taskType = 'application/octet-stream' }
                    $taskBody = [IO.File]::ReadAllBytes($taskFile)
                } else { $taskStatus = '404 Not Found' }
            } else { $taskStatus = '404 Not Found' }
            $taskResponse = "HTTP/1.1 $taskStatus`r`nContent-Type: $taskType`r`nContent-Length: $($taskBody.Length)`r`nConnection: close`r`nReferrer-Policy: strict-origin-when-cross-origin`r`nX-Content-Type-Options: nosniff`r`n`r`n"
            $taskBytes = [Text.Encoding]::ASCII.GetBytes($taskResponse)
            $taskStream.Write($taskBytes,0,$taskBytes.Length)
            if ($taskParts[0] -ne 'HEAD') { $taskStream.Write($taskBody,0,$taskBody.Length) }
        } catch {
            Write-Warning $_.Exception.Message
        } finally {
            $taskClient.Close()
        }
    }
} finally {
    $taskListener.Stop()
    if (Test-Path -LiteralPath $taskRecord) {
        $taskCurrent = Get-Content -LiteralPath $taskRecord -Raw | ConvertFrom-Json
        if ($taskCurrent.instance -eq $taskInstance) { Remove-Item -LiteralPath $taskRecord }
    }
}
