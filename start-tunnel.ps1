# start-tunnel.ps1
# Starts a Cloudflare quick tunnel to MCS (localhost:7700), detects the new
# public URL, writes it into MCS .env as TELNYX_WEBHOOK_URL, then keeps the
# tunnel running. Close this window to stop the tunnel.

$ErrorActionPreference = 'Stop'

$EnvPath = 'D:\momentum-creation-system-v2\.env'
$Port    = 7700
$Path    = '/api/telnyx/webhook'

# --- locate cloudflared ---
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = 'D:\voice-lead-app-v2\cloudflared.exe' }
if (-not (Test-Path $cf)) {
    Write-Host "cloudflared not found. Edit the script and set `$cf to its full path." -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

$out = Join-Path $env:TEMP 'mcs-tunnel.out.log'
$err = Join-Path $env:TEMP 'mcs-tunnel.err.log'
Remove-Item $out, $err -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Starting Cloudflare tunnel -> http://localhost:$Port" -ForegroundColor Cyan
$proc = Start-Process -FilePath $cf -ArgumentList @('tunnel','--url',"http://localhost:$Port") -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow -PassThru

# --- wait for the public URL ---
$url = $null
$deadline = (Get-Date).AddSeconds(40)
while (-not $url -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $text = (Get-Content $out, $err -ErrorAction SilentlyContinue) -join "`n"
    $m = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { $url = $m.Value }
}

if (-not $url) {
    Write-Host 'Could not detect the tunnel URL in 40s. Showing logs:' -ForegroundColor Red
    Get-Content $err -Wait
    exit 1
}

$webhook = "$url$Path"
Write-Host ''
Write-Host "  Tunnel URL : $url"     -ForegroundColor Green
Write-Host "  Webhook    : $webhook" -ForegroundColor Green
Write-Host ''

# --- update TELNYX_WEBHOOK_URL in MCS .env ---
try {
    $envText = Get-Content $EnvPath -Raw
    if ($envText -match '(?m)^TELNYX_WEBHOOK_URL=') {
        $envText = [regex]::Replace($envText, '(?m)^TELNYX_WEBHOOK_URL=.*$', "TELNYX_WEBHOOK_URL=$webhook")
    } else {
        $envText = $envText.TrimEnd() + "`r`nTELNYX_WEBHOOK_URL=$webhook`r`n"
    }
    [System.IO.File]::WriteAllText($EnvPath, $envText)
    Write-Host "  Updated TELNYX_WEBHOOK_URL in $EnvPath" -ForegroundColor Green
} catch {
    Write-Host "  Could not update .env: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ''
Write-Host '  ==================================================' -ForegroundColor Yellow
Write-Host '   NEXT: restart MCS so it loads the new webhook URL' -ForegroundColor Yellow
Write-Host '   KEEP THIS WINDOW OPEN - closing it stops the tunnel' -ForegroundColor Yellow
Write-Host '  ==================================================' -ForegroundColor Yellow
Write-Host ''
Write-Host '--- cloudflared live log (Ctrl+C to stop) ---' -ForegroundColor DarkGray

try {
    Get-Content $err -Wait
} finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}
