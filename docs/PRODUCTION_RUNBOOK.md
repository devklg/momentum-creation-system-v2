# MCS v2 — PRODUCTION RUNBOOK (AS-BUILT)

> The operational truth of the production system as actually built and
> verified, 2026-07-02/03 (B1 deployment through launch week). If you are
> reading this without Claude in the loop: everything you need is here or
> pointed to from here. Keep this document current — it is the bus-factor
> insurance for the whole deployment.

## 1. Topology

| Thing | Value |
|---|---|
| VPS | InterServer, Los Angeles — **104.37.184.37** — Ubuntu 26.04, 2 vCPU / 7.3 GB |
| SSH | `root@104.37.184.37`, key auth only — private key `C:\Users\email\.ssh\mcs_vps` |
| Repo on box | `/opt/mcs-v2` (clone of devklg/momentum-creation-system-v2, **read-only deploy key**, cannot push) |
| Domains | teammagnificent.com + teammagnificent.team (Namecheap, acct devkev202, expire Feb 2027) |
| DNS (Namecheap Advanced DNS) | A `@` + A `www` on **both** domains → 104.37.184.37; A `admin` on `.team` → same |
| TLS | Let's Encrypt via certbot (`--nginx`), all 5 hostnames, HTTP→HTTPS redirect, auto-renew via systemd timer |

## 2. Services on the box

| Unit | What | Notes |
|---|---|---|
| `mcs-api` (systemd) | Express API — `tsx src/index.ts` from `/opt/mcs-v2/server`, port **7700** | Boot takes **10–15s** on 2 cores — a 502 right after restart is normal; wait, don't panic |
| `mcs-embedder` (systemd) | CPU MiniLM embedding service, Flask, port **8300** (`/opt/mcs-embedder/service.py`) | Production replacement for Kevin's local GPU embedder; same 384-dim model |
| `nginx` | Serves `apps/{com,team,admin}/dist` per hostname; proxies `/api/` → 127.0.0.1:7700 | Config in `/etc/nginx/sites-available/` |

Health: `curl https://teammagnificent.com/api/health` → `{"ok":true,...}` (also `.team` and `admin.` hostnames answer).

## 3. Production data stack

> **Updated 2026-08-13.** Mongo and Neo4j now run **on the VPS itself**. The cloud legs they replaced (MongoDB Atlas, Neo4j Aura) are no longer in the production path. Chroma Cloud is the only remaining cloud dependency.

| Leg | Where | Identity notes |
|---|---|---|
| MongoDB | **On the box** — `mongodb://127.0.0.1:27017/momentum` | Local `mongod` (service `mongod`), bound to 127.0.0.1, standalone (no replica set → no multi-document transactions). Moved off Atlas 2026-08-12; the Atlas cluster was terminated 2026-08-13. |
| Neo4j | **On the box** — `bolt://127.0.0.1:7687` | Neo4j Community 5, bound to 127.0.0.1, username `neo4j`. Moved off Aura Free 2026-07-13 after Aura auto-paused and took production down (see §9). |
| Chroma | Chroma Cloud, tenant `3164b531-611e-481c-91be-28c7b2705380`, database `MOMENTUM-CREATION-SYSTEM-V2` | 43 collections, reconciled with runtime write-guard registry (PR #118) |

**Both on-box legs are localhost-bound and therefore unreachable from the Universal Gateway connectors.** `mongodb2` / `neo4j2` / `chromadb2` point at Kevin's LOCAL DEV stack, not production — they return real, populated, plausible data from the wrong machine and never error. To inspect production, go through the box:

```
C:\Python313\python.exe D:\vps-run.py  "<command>" <timeout>
C:\Python313\python.exe D:\vps-task.py D:\<script>.sh <timeout>
C:\Python313\python.exe D:\vps-get.py  <remote> <local>
```

Raw `ssh`/`scp` from Kevin's workstation exit 255 with no output (a capture failure, not a down host). Use the paramiko helpers above.

**Never `source` `/opt/mcs-v2/.env` to read a connection string** — values contain `&`, which bash mangles; `mongosh` then silently falls back to `127.0.0.1:27017` and reports an empty database that looks like data loss. Extract with `grep -m1 '^MONGODB_URI=' /opt/mcs-v2/.env | cut -d= -f2-` and pass it quoted.

Embeddings in production go through the box's own CPU embedder (`GPU_EMBEDDER_URL=http://127.0.0.1:8300`). Kevin's home GPU is never a production dependency.

## 4. Secrets — where they live (values never in this file)

- **`/opt/mcs-v2/.env`** (chmod 600) — the single source of production config: JWT_SECRET, Mongo/Neo4j/Chroma credentials, ANTHROPIC_API_KEY (powers all agents; model default claude-haiku-4-5), TELNYX_* block, CORS_ORIGINS (all 5 https origins — login breaks without it), PROSPECT_BASE_URL=https://teammagnificent.com (invite links break without it), ADMIN_TMAG_IDS=TMAG-01, HEALTH_PROBE_SHARED_SECRET.
- **Founder login** — TMAG-01 + password: canonical copy in Kevin's password manager; bootstrap copies were `/root/founder-credentials.txt` (VPS) and `D:\founder-credentials.txt` (delete both once stored).
- **SSH key** — `C:\Users\email\.ssh\mcs_vps` on Kevin's machine. No password SSH.
- Telnyx API key: portal.telnyx.com → Keys & Credentials (also in .env).

## 5. Canonical deploy procedure (hardened 2026-07-03)

From Kevin's machine, helpers (both ASCII-safe for console output):
- `C:\Python313\python.exe D:\vps-run.py "<single command>" <timeout-s>` — one-liner over SSH.
- `C:\Python313\python.exe D:\vps-task.py D:\<script>.sh <timeout-s>` — uploads the .sh to `/root/task.sh` and runs it (quoting-proof; use for anything multi-line or with `$`).

The deploy sequence — **every step, every time**:
```bash
cd /opt/mcs-v2
git pull origin main
pnpm install --frozen-lockfile     # NEVER skip — missing this crash-looped prod on PR #125 (mammoth)
cd apps/team  && npm run build     # rebuild ONLY the app bundles the PR touched
cd ../admin   && npm run build
cd ../com     && npm run build
systemctl restart mcs-api
sleep 12
systemctl is-active mcs-api
curl -s -o /dev/null -w '%{http_code}\n' https://teammagnificent.com/api/health   # expect 200
```
Server code needs only pull+install+restart (tsx runs from src). App bundles need their build. `journalctl -u mcs-api -n 30 --no-pager` is the first move on any failure.

## 11. Observability — production health probe

`ops/health-probe.sh` is the dumb VPS self-check. It runs from `/opt/mcs-v2/ops`
on the `health-probe.timer` systemd timer, default every 15 minutes, and writes
`/opt/mcs-v2/ops/health-status.json`:

```json
{ "checkedAt": "...", "overall": "green", "checks": [{ "name": "...", "ok": true, "detail": "..." }] }
```

Checks: `systemctl is-active` for `mcs-api`, `mcs-embedder`, and `nginx`; HTTPS
200 for `teammagnificent.com`, `teammagnificent.team`, and
`admin.teammagnificent.team`; `/api/health` returns `ok:true`; root filesystem
is under 85%; available memory is over 500MB; `teammagnificent.com` TLS has more
than 20 days left; and the admin health endpoint completes a real
Mongo+Neo4j+Chroma heartbeat round-trip.

Install or refresh the timer after deploy:

```bash
cd /opt/mcs-v2
chmod +x ops/health-probe.sh
install -m 0644 ops/health-probe.service /etc/systemd/system/health-probe.service
install -m 0644 ops/health-probe.timer /etc/systemd/system/health-probe.timer
systemctl daemon-reload
systemctl enable --now health-probe.timer
systemctl list-timers health-probe.timer
```

The triple-stack leg uses `GET /api/admin/health/triple-stack` with
`x-mcs-health-secret: $HEALTH_PROBE_SHARED_SECRET`; set that secret in
`/opt/mcs-v2/.env`. Kevin's admin dashboard reads
`GET /api/admin/health/status`, which only reads the status file. A green-to-red
transition queues one SMS alert to Kevin through the existing broadcast SMS
worker; sustained red does not spam.

During planned maintenance:

```bash
systemctl stop health-probe.timer
# do the maintenance
systemctl start health-probe.timer
systemctl start health-probe.service   # optional immediate refresh
```

## 6. Seeded production data (all verified triple-stack)

Founders TMAG-01 (Kevin) / TMAG-02 (Paul); access codes TMAG-KEVN / TMAG-PAUB / TMAG-TEST; 16 webinar events; 16 orientation sessions; Ivory collection ready. Seed scripts in `server/scripts/` (all take `connectMongo` bootstrap — fixed PR #118/#119; they finish work then hang on open handles — run under `timeout 90`). Founder password/profile: `setup-founder-access.ts` (env `FOUNDER_PASSWORD`).

## 7. Telnyx / SMS / 10DLC — state as of 2026-07-03

- Numbers owned (3): **+13236931362** → voice app `mcs-vm-v2` (id 2995619818075325536, outbound voice profile attached, production webhook) — the future VM-dialer line; **+13234716774** → SMS from-number, bound to messaging profile `MCS-VM-App` (40019f26-11c0-4f7a-b7a0-788e37d3e852), webhook → `https://teammagnificent.com/api/telnyx/webhook`; **+13234026499** free.
- VM dialer audio v1 is URL-based: nginx should serve `https://teammagnificent.com/vm-audio/` from `/var/www/vm-audio/`; campaign setup stores the HTTPS audio URL and does not upload audio through the app.
- Webhook Ed25519 signature verification ARMED (TELNYX_PUBLIC_KEY in .env — account-wide key).
- App send path PROVEN (message accepted end-to-end) but **carrier delivery blocked: 40010 Not 10DLC Registered**.
- 10DLC brand submitted: id `4b20019f-2a24-78ef-cabd-d44042e2e90b`, status UNVERIFIED — **PARKED: Kevin gets a corrected-spelling EIN Monday** (IRS record says "TEAM MARGNIFICENT" — typo; TCR matches IRS exactly). Then: update/resubmit brand → campaign (Low Volume Mixed; description = account notifications + personally-requested links, opt-in, STOP honored) → assign to MCS-VM-App → re-run SMS smoke.
- Until then the app's SMS is dormant — member invitations unaffected (personal sends by doctrine).

## 8. Agents & feature flags

- All LLM agents (Steve interviewer, Ivory drafts, ScriptMaker, Michael) run on ANTHROPIC_API_KEY in .env; empty key = agents fail closed by design.
- Steve's browser conversation runtime: PR #121 (+ voice PR #122, Web Speech, browser-only). Steve gates everything until a member's discovery completes.
- Flags OFF in production, on purpose: `MCS_CONTEXT_MANAGER_LIVE_ENABLED=false`, `VOICEBOX_RUNTIME_ENABLED=false` (PR #125). Voicebox points at Kevin's LOCAL GPU (127.0.0.1:17493) — never enable in prod until a hosted TTS exists.
- `GRAPHRAG_PERSISTENCE_ENABLED=false` — knowledge serving is approved-only when it comes on.

## 9. Incidents survived & their lessons (don't relearn these)

1. **CORS 500 on login** — browser sends Origin, curl doesn't; production must set CORS_ORIGINS with all 5 https origins. Symptom: "could not reach the server" in UI while curl works.
2. **localhost invite links** — PROSPECT_BASE_URL unset → tokens minted `localhost:7701` URLs. Env, not code.
3. **PR #125 crash-loop** — new npm deps + no install step. Hence the frozen-lockfile line in §5.
4. **Aura auth (HISTORICAL)** — username was the instance id, not `neo4j`. No longer applies: Neo4j moved onto the box 2026-07-13 and uses `neo4j`.
5. **Seed scripts hang after success** — open Mongoose handles; `timeout 90` wrapper, work completes in seconds.
6. **Restart 502 window** — tsx boot 10–15s; verify AFTER `sleep 12`, and re-check before declaring an outage.
7. **Windows console vs emoji** — helpers encode ascii-backslashreplace; a "crash" printing Steve's 👋 was display-only.

## 10. If it's down and Claude isn't around

```bash
ssh root@104.37.184.37            # key: C:\Users\email\.ssh\mcs_vps
systemctl status mcs-api          # or: journalctl -u mcs-api -n 50 --no-pager
systemctl restart mcs-api && sleep 12 && curl -s https://teammagnificent.com/api/health
systemctl status mcs-embedder nginx   # the other two legs on the box
```
Certs renew themselves (`certbot renew --dry-run` to verify). DNS is at Namecheap. **Mongo and Neo4j run ON THE BOX** — `systemctl status mongod neo4j` — so an outage in either is a local service problem, not a cloud console problem. Chroma Cloud is the only managed store left; check its console before suspecting the box. (Atlas and Aura are no longer in the production path.)
