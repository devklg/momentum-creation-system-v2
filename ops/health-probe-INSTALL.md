# Health Probe Timer Install

Files deploy with the repo under `/opt/mcs-v2/ops`.

```bash
cd /opt/mcs-v2
chmod +x ops/health-probe.sh
install -m 0644 ops/health-probe.service /etc/systemd/system/health-probe.service
install -m 0644 ops/health-probe.timer /etc/systemd/system/health-probe.timer
systemctl daemon-reload
systemctl enable --now health-probe.timer
systemctl list-timers health-probe.timer
```

`/opt/mcs-v2/.env` must include `HEALTH_PROBE_SHARED_SECRET`; the same value
guards `GET /api/admin/health/triple-stack`. The timer writes
`/opt/mcs-v2/ops/health-status.json` and exits `0` only when every check is
green.
