param([ValidateSet('Open','Stop')][string]$Action = 'Open')
$ErrorActionPreference = 'Stop'
$port = 51827
$baseUrl = "http://127.0.0.1:$port/"
$root = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSScriptRoot) 'web-dist'))
# A stable identity separates launchers from different folders using the same port.
$sha = [System.Security.Cryptography.SHA256]::Create()
try { $identity = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant())))).Replace('-', '') }
finally { $sha.Dispose() }
$tokenDir = Join-Path ([System.IO.Path]::GetTempPath()) 'life-tracker-launcher'
$tokenPath = Join-Path $tokenDir ($identity + '.token')
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Show-Message([string]$message) {
  try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($message, 'Life Tracker') | Out-Null }
  catch { [Console]::Error.WriteLine($message) }
}
function Request-Local([string]$path) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.ReceiveTimeout = 1500; $client.SendTimeout = 1500
    $client.Connect([System.Net.IPAddress]::Loopback, $port)
    $stream = $client.GetStream()
    $request = [Text.Encoding]::ASCII.GetBytes("GET $path HTTP/1.1`r`nHost: 127.0.0.1`r`nConnection: close`r`n`r`n")
    $stream.Write($request, 0, $request.Length)
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::UTF8)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
  } finally { $client.Close() }
}
function Get-Identity {
  try {
    $response = Request-Local '/__life_tracker_health'
    if ($response -match "`r`n`r`n([A-F0-9]{64})$") { return $Matches[1] }
  } catch {}
  return ''
}
function Open-Browser {
  if ($env:LIFE_TRACKER_TEST_NO_BROWSER -ne '1') { Start-Process $baseUrl | Out-Null }
}
function Send-Response($stream, [int]$status, [string]$mime, [byte[]]$body, [bool]$isHead = $false) {
  $reason = switch ($status) { 200 {'OK'} 400 {'Bad Request'} 403 {'Forbidden'} 404 {'Not Found'} 405 {'Method Not Allowed'} default {'Error'} }
  $head = "HTTP/1.1 $status $reason`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
  $header = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($header, 0, $header.Length)
  if (!$isHead -and $body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

try {
  $current = Get-Identity
  if ($Action -eq 'Stop') {
    if ($current -ne $identity) { Show-Message 'Локальное приложение из этой папки не запущено.'; exit 0 }
    if (!(Test-Path -LiteralPath $tokenPath -PathType Leaf)) { throw 'Не найден ключ остановки. Перезагрузите компьютер, чтобы завершить фоновый процесс.' }
    $stopToken = [IO.File]::ReadAllText($tokenPath).Trim()
    if ($stopToken -notmatch '^[a-f0-9]{64}$') { throw 'Ключ остановки повреждён.' }
    $response = Request-Local ("/__life_tracker_stop?token=" + $stopToken)
    if ($response -notmatch '^HTTP/1\.1 200 ') { throw 'Не удалось остановить локальное приложение.' }
    Show-Message 'Локальное приложение остановлено. Чтобы открыть его снова, запустите START.vbs.'
    exit 0
  }
  if (!(Test-Path -LiteralPath (Join-Path $root 'index.html') -PathType Leaf)) { throw 'Не найдена папка web-dist. Сначала извлеките весь архив, сохранив структуру папок.' }
  if ($current -eq $identity) { Open-Browser; exit 0 }
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
  try { $listener.Start() } catch { throw 'Порт 51827 уже занят. Закройте другую копию приложения или другое приложение, использующее этот порт.' }
  $token = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
  try {
    [IO.Directory]::CreateDirectory($tokenDir) | Out-Null
    [IO.File]::WriteAllText($tokenPath, $token, $utf8)
    Open-Browser
    $running = $true
    $rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    while ($running) {
      $client = $listener.AcceptTcpClient()
      $client.ReceiveTimeout = 2500; $client.SendTimeout = 5000
      try {
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
        $line = $reader.ReadLine()
        if (!$line -or $line.Length -gt 8192) { continue }
        do { $h = $reader.ReadLine() } while ($h -and $h.Length -le 8192)
        $parts = $line.Split(' ')
        if ($parts.Length -lt 3) { Send-Response $stream 400 'text/plain' ($utf8.GetBytes('Bad request')); continue }
        $method = $parts[0]; $target = $parts[1]
        if ($method -ne 'GET' -and $method -ne 'HEAD') { Send-Response $stream 405 'text/plain' ($utf8.GetBytes('Method not allowed')); continue }
        $isHead = $method -eq 'HEAD'
        if ($target -eq '/__life_tracker_health') { Send-Response $stream 200 'text/plain' ($utf8.GetBytes($identity)) $isHead; continue }
        if ($target -eq ("/__life_tracker_stop?token=" + $token) -and $method -eq 'GET') {
          Send-Response $stream 200 'text/plain' ($utf8.GetBytes('Stopped'))
          $running = $false; continue
        }
        $urlPath = ($target -split '\?', 2)[0]
        if (!$urlPath.StartsWith('/')) { Send-Response $stream 400 'text/plain' ($utf8.GetBytes('Bad request')); continue }
        $relative = [Uri]::UnescapeDataString($urlPath).TrimStart('/')
        if (!$relative) { $relative = 'index.html' }
        $relative = $relative.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\', [IO.Path]::DirectorySeparatorChar)
        $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
        if (!$file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Send-Response $stream 403 'text/plain' ($utf8.GetBytes('Forbidden')); continue }
        if (!(Test-Path -LiteralPath $file -PathType Leaf)) { Send-Response $stream 404 'text/plain' ($utf8.GetBytes('Not found')); continue }
        $mime = switch ([IO.Path]::GetExtension($file).ToLowerInvariant()) {
          '.html' {'text/html; charset=utf-8'} '.js' {'text/javascript; charset=utf-8'} '.css' {'text/css; charset=utf-8'}
          '.json' {'application/json; charset=utf-8'} '.webmanifest' {'application/manifest+json; charset=utf-8'}
          '.svg' {'image/svg+xml'} '.png' {'image/png'} '.ico' {'image/x-icon'} default {'application/octet-stream'}
        }
        $bytes = [IO.File]::ReadAllBytes($file)
        Send-Response $stream 200 $mime $bytes $isHead
      } catch {
        # A client can disconnect or send a malformed request; keep the local server running.
      } finally { $client.Close() }
    }
  } finally {
    $listener.Stop()
    if ((Test-Path -LiteralPath $tokenPath) -and [IO.File]::ReadAllText($tokenPath).Trim() -eq $token) { Remove-Item -LiteralPath $tokenPath -Force }
  }
} catch { Show-Message ("Не удалось запустить Life Tracker.`n`n" + $_.Exception.Message) }
