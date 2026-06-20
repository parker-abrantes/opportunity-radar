$ErrorActionPreference = "Stop"

$dashboardRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dashboardRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required to run Opportunity Radar."
  Write-Host "Install Node.js from https://nodejs.org/ and run this launcher again."
  Read-Host "Press Enter to close"
  exit 1
}

$port = 4173
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Host "Something is already using port $port. Close existing Opportunity Radar windows first."
  Read-Host "Press Enter to close"
  exit 1
}

$localIp = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $localIp) {
  Write-Host "Could not identify a local Wi-Fi/LAN IP address."
  Write-Host "Starting locally at http://127.0.0.1:$port instead."
  $localIp = "127.0.0.1"
  $env:HOST = "127.0.0.1"
} else {
  $env:HOST = "0.0.0.0"
}

$env:PORT = "$port"
$phoneUrl = "http://$localIp`:$port"

Write-Host "Starting Opportunity Radar in phone mode."
Write-Host "Laptop URL: http://127.0.0.1:$port"
Write-Host "Phone URL:  $phoneUrl"
Write-Host ""
Write-Host "Keep this window open. Your phone must be on the same Wi-Fi network."
Write-Host "On iPhone: open the Phone URL in Safari, then Share -> Add to Home Screen."
Write-Host "On Android: open the Phone URL in Chrome, then menu -> Install app or Add to Home screen."
Write-Host ""

Start-Job -ScriptBlock {
  param($url)
  Start-Sleep -Milliseconds 900
  Start-Process $url
} -ArgumentList "http://127.0.0.1:$port" | Out-Null

node server.js
