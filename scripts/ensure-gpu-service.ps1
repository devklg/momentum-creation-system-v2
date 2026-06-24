<#
  Ensures the Maxwell FastAPI GPU embedding service is healthy before MCS V2
  starts. Chroma writes through Universal Gateway V2 depend on this service.
#>

$ErrorActionPreference = 'Stop'

$HealthUrl = 'http://127.0.0.1:8300/health'
$GatewayUrl = 'http://localhost:2526/api'
$Wrapper = 'D:\agents\doc-parser\gpu-embeddings-service\autostart-gpu-service.ps1'

function Test-GpuHealth {
  try {
    $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop
    return ($r.StatusCode -eq 200 -and $r.Content -match '"status"\s*:\s*"healthy"')
  } catch {
    return $false
  }
}

function Enable-GatewayChroma {
  try {
    Invoke-WebRequest -Uri "$GatewayUrl/tools/chromadb/enable" -Method Post -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop | Out-Null
    Write-Host "[mcs-v2] Gateway 2526 chromadb active"
  } catch {
    Write-Host "[mcs-v2] Gateway 2526 chromadb enable skipped: $($_.Exception.Message)"
  }
}

if (Test-GpuHealth) {
  Write-Host '[mcs-v2] GPU embedding service healthy on 8300'
  Enable-GatewayChroma
  exit 0
}

if (-not (Test-Path $Wrapper)) {
  throw "GPU service wrapper not found at $Wrapper"
}

Write-Host '[mcs-v2] GPU embedding service not healthy; starting FastAPI wrapper'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Wrapper -NoBootWait
if ($LASTEXITCODE -ne 0) {
  throw "GPU service wrapper failed with exit code $LASTEXITCODE"
}

if (-not (Test-GpuHealth)) {
  throw 'GPU embedding service still unhealthy after startup wrapper'
}

Enable-GatewayChroma
