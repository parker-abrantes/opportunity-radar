$ErrorActionPreference = "Stop"

$dashboardRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dashboardRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required to run Opportunity Radar."
  Write-Host "Install Node.js from https://nodejs.org/ and run this launcher again."
  Read-Host "Press Enter to close"
  exit 1
}

$url = "http://127.0.0.1:4173"
$isDashboardRunning = $false

try {
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
  $isDashboardRunning = $response.StatusCode -eq 200
} catch {
  $isDashboardRunning = $false
}

if ($isDashboardRunning) {
  Write-Host "Opportunity Radar is already running. Opening $url"
  Start-Process $url
  exit 0
}

$listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Host "Something is already using port 4173. Opening $url in case it is Opportunity Radar."
  Start-Process $url
  Read-Host "If the page does not load, close old Opportunity Radar windows and press Enter"
  exit 1
}

Write-Host "Starting Opportunity Radar at $url"
Write-Host "Keep this window open while using the dashboard. Close it to stop the app."
Start-Job -ScriptBlock {
  Start-Sleep -Milliseconds 900
  Start-Process "http://127.0.0.1:4173"
} | Out-Null

node server.js
