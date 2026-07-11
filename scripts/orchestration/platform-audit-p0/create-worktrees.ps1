param(
  [string]$RepoRoot = "D:/momentum-creation-system-v2",
  [string]$WorktreeRoot = "D:/mcs-v2-platform-audit-p0",
  [switch]$IncludeDependentLanes
)

$ErrorActionPreference = "Stop"

$lanes = @(
  @{ Id = "lane0-foundation"; Branch = "codex/platform-audit-p0-lane0-foundation"; Brief = "engineering/sprints/platform-audit-p0/LANE_0_FOUNDATION.md" },
  @{ Id = "lane1-michael"; Branch = "codex/platform-audit-p0-lane1-michael"; Brief = "engineering/sprints/platform-audit-p0/LANE_1_MICHAEL_RUNTIME.md" },
  @{ Id = "lane2-chroma"; Branch = "codex/platform-audit-p0-lane2-chroma"; Brief = "engineering/sprints/platform-audit-p0/LANE_2_CHROMA_HEALTH.md" },
  @{ Id = "lane3-governance"; Branch = "codex/platform-audit-p0-lane3-governance"; Brief = "engineering/sprints/platform-audit-p0/LANE_3_GOVERNANCE.md" },
  @{ Id = "lane4-final-gates"; Branch = "codex/platform-audit-p0-lane4-final-gates"; Brief = "engineering/sprints/platform-audit-p0/LANE_4_FINAL_GATES.md" }
)

if (-not $IncludeDependentLanes) {
  $lanes = @($lanes[0])
}

$masterBrief = Join-Path $RepoRoot "engineering/sprints/CODEX_EXECUTION_PROMPT_PLATFORM_AUDIT_P0.md"
$tasklist = Join-Path $RepoRoot "PLATFORM_AUDIT_PRIORITY_TASKLIST.md"

if (-not (Test-Path $masterBrief)) { throw "Missing master brief: $masterBrief" }
if (-not (Test-Path $tasklist)) { throw "Missing tasklist: $tasklist" }

New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

Push-Location $RepoRoot
try {
  git fetch origin --quiet
  foreach ($lane in $lanes) {
    $target = Join-Path $WorktreeRoot $lane.Id
    if (Test-Path $target) {
      Write-Host "SKIP existing worktree path: $target"
      continue
    }

    $existingBranch = git branch --list $lane.Branch
    if ($existingBranch) {
      git worktree add $target $lane.Branch
    } else {
      git worktree add $target -b $lane.Branch origin/main
    }

    Copy-Item $masterBrief (Join-Path $target "MASTER_BRIEF.md") -Force
    Copy-Item (Join-Path $RepoRoot $lane.Brief) (Join-Path $target "LANE_BRIEF.md") -Force
    Copy-Item $tasklist (Join-Path $target "PLATFORM_AUDIT_PRIORITY_TASKLIST.md") -Force
    Write-Host "READY $($lane.Id) -> $target [$($lane.Branch)]"
  }
} finally {
  Pop-Location
}
