#!/usr/bin/env bash
set -u

OPS_DIR="${MCS_OPS_DIR:-/opt/mcs-v2/ops}"
STATUS_FILE="${HEALTH_STATUS_PATH:-$OPS_DIR/health-status.json}"
TMP_CHECKS="$(mktemp)"

cleanup() {
  rm -f "$TMP_CHECKS"
}
trap cleanup EXIT

add_check() {
  local name="$1"
  local ok="$2"
  local detail="$3"
  printf '%s\t%s\t%s\n' "$name" "$ok" "$detail" >> "$TMP_CHECKS"
}

check_systemd() {
  local unit="$1"
  if systemctl is-active --quiet "$unit"; then
    add_check "systemd:$unit" true "active"
  else
    local state
    state="$(systemctl is-active "$unit" 2>/dev/null || true)"
    add_check "systemd:$unit" false "${state:-unknown}"
  fi
}

check_https_200() {
  local host="$1"
  local code
  code="$(curl -L -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$host/" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    add_check "https:$host" true "HTTP 200"
  else
    add_check "https:$host" false "HTTP ${code:-curl_failed}"
  fi
}

check_api_health() {
  local body
  body="$(curl -sS --max-time 15 "https://teammagnificent.com/api/health" 2>/dev/null || true)"
  if BODY="$body" python3 - <<'PY'
import json, os, sys
try:
    sys.exit(0 if json.loads(os.environ.get("BODY", "")).get("ok") is True else 1)
except Exception:
    sys.exit(1)
PY
  then
    add_check "api:/api/health" true "ok:true"
  else
    add_check "api:/api/health" false "missing ok:true"
  fi
}

check_root_fs() {
  local pct
  pct="$(df -P / | awk 'NR==2 { gsub("%","",$5); print $5 }')"
  if [ -n "$pct" ] && [ "$pct" -lt 85 ]; then
    add_check "root_fs" true "${pct}% used"
  else
    add_check "root_fs" false "${pct:-unknown}% used"
  fi
}

check_memory() {
  local kb
  kb="$(awk '/MemAvailable:/ { print $2 }' /proc/meminfo)"
  if [ -n "$kb" ] && [ "$kb" -gt 512000 ]; then
    add_check "memory" true "$((kb / 1024))MB available"
  else
    add_check "memory" false "${kb:-0}KB available"
  fi
}

check_tls() {
  local enddate end_epoch now_epoch days
  enddate="$(
    echo | openssl s_client -servername teammagnificent.com -connect teammagnificent.com:443 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null \
      | sed 's/^notAfter=//'
  )"
  if [ -z "$enddate" ]; then
    add_check "tls:teammagnificent.com" false "notAfter unreadable"
    return
  fi
  end_epoch="$(date -d "$enddate" +%s 2>/dev/null || true)"
  now_epoch="$(date +%s)"
  if [ -z "$end_epoch" ]; then
    add_check "tls:teammagnificent.com" false "notAfter parse failed: $enddate"
    return
  fi
  days="$(((end_epoch - now_epoch) / 86400))"
  if [ "$days" -gt 20 ]; then
    add_check "tls:teammagnificent.com" true "$days days remaining"
  else
    add_check "tls:teammagnificent.com" false "$days days remaining"
  fi
}

check_triple_stack() {
  if [ -z "${HEALTH_PROBE_SHARED_SECRET:-}" ]; then
    add_check "triple_stack" false "HEALTH_PROBE_SHARED_SECRET not set"
    return
  fi

  local body
  body="$(curl -sS --max-time 30 -H "x-mcs-health-secret: ${HEALTH_PROBE_SHARED_SECRET}" \
    "https://teammagnificent.com/api/admin/health/triple-stack" 2>/dev/null || true)"

  if TRIPLE_BODY="$body" python3 - <<'PY'
import json, os, sys
try:
    payload = json.loads(os.environ.get("TRIPLE_BODY", ""))
    legs = payload.get("legs") or {}
    failed = [name for name in ("mongo", "neo4j", "chroma") if legs.get(name) is not True]
    if payload.get("ok") is True and not failed:
        print("ok")
        sys.exit(0)
    print(",".join(failed) if failed else "unknown")
    sys.exit(1)
except Exception:
    print("invalid_response")
    sys.exit(1)
PY
  then
    add_check "triple_stack" true "mongo/neo4j/chroma readback ok"
  else
    local failed
    failed="$(
      TRIPLE_BODY="$body" python3 - <<'PY' 2>/dev/null || true
import json, os
try:
    payload = json.loads(os.environ.get("TRIPLE_BODY", ""))
    legs = payload.get("legs") or {}
    failed = [name for name in ("mongo", "neo4j", "chroma") if legs.get(name) is not True]
    print(",".join(failed) if failed else payload.get("error", "unknown"))
except Exception:
    print("invalid_response")
PY
    )"
    add_check "triple_stack" false "failed leg(s): ${failed:-unknown}"
  fi
}

mkdir -p "$(dirname "$STATUS_FILE")"

check_systemd mcs-api
check_systemd mcs-embedder
check_systemd nginx
check_https_200 teammagnificent.com
check_https_200 teammagnificent.team
check_https_200 admin.teammagnificent.team
check_api_health
check_root_fs
check_memory
check_tls
check_triple_stack

CHECKS_FILE="$TMP_CHECKS" STATUS_FILE="$STATUS_FILE" python3 - <<'PY'
import json, os
from datetime import datetime, timezone

checks = []
with open(os.environ["CHECKS_FILE"], "r", encoding="utf-8") as fh:
    for line in fh:
        name, ok, detail = line.rstrip("\n").split("\t", 2)
        checks.append({"name": name, "ok": ok == "true", "detail": detail})

payload = {
    "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "overall": "green" if all(c["ok"] for c in checks) else "red",
    "checks": checks,
}

tmp = os.environ["STATUS_FILE"] + ".tmp"
with open(tmp, "w", encoding="utf-8") as out:
    json.dump(payload, out, indent=2)
    out.write("\n")
os.replace(tmp, os.environ["STATUS_FILE"])
print(json.dumps(payload, separators=(",", ":")))
raise SystemExit(0 if payload["overall"] == "green" else 1)
PY
