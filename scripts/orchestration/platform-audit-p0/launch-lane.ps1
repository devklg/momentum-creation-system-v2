param(
  [Parameter(Mandatory = $true)]
  [string]$LanePath,
  [ValidateSet("codex", "claude")]
  [string]$Engine = "codex",
  [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

foreach ($v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + $v) -ErrorAction SilentlyContinue
}

if (-not (Test-Path $LanePath)) { throw "Lane path does not exist: $LanePath" }
$briefPath = Join-Path $LanePath "LANE_BRIEF.md"
if (-not (Test-Path $briefPath)) { throw "Missing LANE_BRIEF.md in $LanePath" }

if (-not $LogPath) {
  $safeName = Split-Path $LanePath -Leaf
  $LogPath = Join-Path (Split-Path $LanePath -Parent) ($safeName + ".log")
}

if (Test-Path $LogPath) { Remove-Item $LogPath -Force }

$launcher = Join-Path $LanePath "run-lane.ps1"
$engineLine = if ($Engine -eq "codex") {
  '$brief | codex exec --full-auto 2>&1 | Tee-Object -FilePath "' + $LogPath + '"'
} else {
  '$brief | claude -p --model claude-opus-4-8 --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath "' + $LogPath + '"'
}

$script = @"
`$ErrorActionPreference = "Continue"
foreach (`$v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + `$v) -ErrorAction SilentlyContinue
}
Set-Location "$LanePath"
git fetch origin --quiet
git rebase origin/main 2>&1 | Tee-Object -FilePath "$LogPath"
`$brief = Get-Content "LANE_BRIEF.md" -Raw
$engineLine
Write-Output ('LANE PROCESS EXIT: ' + `$LASTEXITCODE) | Tee-Object -FilePath "$LogPath" -Append
"@

Set-Content -Path $launcher -Value $script -Encoding utf8
Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$launcher -WindowStyle Hidden
Write-Host "LAUNCHED $Engine lane at $LanePath"
Write-Host "LOG $LogPath"
