param(
  [string]$MongoUri = "mongodb://127.0.0.1:30000/momentum"
)

$ErrorActionPreference = "Stop"

foreach ($v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + $v) -ErrorAction SilentlyContinue
}

$now = (Get-Date).ToUniversalTime().ToString("o")
$rows = @(
  @{ _id = "agent_platform_audit_p0_lane0"; lane = "lane0-foundation"; state = "not_started"; current_leaf = "P0 items 5,6,10,16,17,18,19"; last_commit = ""; note = "Prepared; runs first"; updated_at = $now },
  @{ _id = "agent_platform_audit_p0_lane1"; lane = "lane1-michael"; state = "blocked"; current_leaf = "P0 items 1,2,3,4"; last_commit = ""; note = "Blocked until lane0 merges"; updated_at = $now },
  @{ _id = "agent_platform_audit_p0_lane2"; lane = "lane2-chroma"; state = "blocked"; current_leaf = "P0 items 7,8,9"; last_commit = ""; note = "Blocked until lane0 merges"; updated_at = $now },
  @{ _id = "agent_platform_audit_p0_lane3"; lane = "lane3-governance"; state = "blocked"; current_leaf = "P0 items 11,12,13,14,15"; last_commit = ""; note = "Blocked until lane0 merges"; updated_at = $now },
  @{ _id = "agent_platform_audit_p0_lane4"; lane = "lane4-final-gates"; state = "blocked"; current_leaf = "P0 item 20"; last_commit = ""; note = "Blocked until lanes1-3 merge"; updated_at = $now }
)

$json = $rows | ConvertTo-Json -Depth 10 -Compress
$eval = @"
const rows = $json;
for (const row of rows) {
  const existing = db.agent_status.findOne({ _id: row._id });
  if (existing) {
    db.agent_status.updateOne({ _id: row._id }, { `$set: row });
  } else {
    db.agent_status.insertOne(row);
  }
}
print(JSON.stringify(db.agent_status.find({ _id: { `$in: rows.map(r => r._id) } }).sort({ _id: 1 }).toArray(), null, 2))
"@

$tmp = Join-Path $env:TEMP ("mcs-platform-audit-agent-status-" + [guid]::NewGuid().ToString("N") + ".js")
try {
  Set-Content -Path $tmp -Value $eval -Encoding utf8
  mongosh $MongoUri --quiet $tmp
} finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}
