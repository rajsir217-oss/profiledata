# Cloud Monitoring — Real-time Alerts

Real-time alerting for the `matrimonial-backend` Cloud Run service. This is
GCP-native (log-based metrics + Cloud Monitoring alert policies) — there is **no
in-app code** and **no weekly narrative report**. Alerts fire within minutes of
a problem.

## What gets created

**Log-based metrics**
| Metric | Type | Counts / Measures |
|---|---|---|
| `redis_max_clients` | counter | Logs containing `max number of clients reached` |
| `backend_errors` | counter | All `severity>=ERROR` logs |
| `api_request_latency` | distribution (s) | Request latency from Cloud Run request logs, **excluding** streaming endpoints (`/socket.io`, `/messages/stream`). Config in `metrics/api_request_latency.json`. |

> **Why a custom latency metric?** The built-in `run.googleapis.com/request_latencies`
> measures the full lifetime of every HTTP request. Socket.IO and SSE streams stay
> open for minutes, so their connection duration (~5 min) dominates p95 and causes
> constant false-positive latency alerts. `api_request_latency` excludes those
> paths and reflects true API/DB latency. Threshold is in **seconds** (2s = 2000ms).

**Alert policies**
| Policy | Trigger | Source |
|---|---|---|
| Redis max clients reached | any occurrence in 5m | `redis_max_clients` log metric |
| Error log spike | > 50 errors in 5m | `backend_errors` log metric |
| HTTP 5xx responses | > 5 in 5m | built-in `run.googleapis.com/request_count` (5xx) |
| High request latency (p95) | p95 > 2s for 5m | `api_request_latency` log metric (excludes streaming) |

All policies notify a single **email notification channel**.

## Prerequisites

- `gcloud` authenticated with access to the project.
- The account needs roles: `roles/logging.configWriter` (create log metrics) and
  `roles/monitoring.editor` (create channels + policies).

## Setup

```bash
cd deploy_gcp/monitoring
ALERT_EMAIL=rajl3v3l@gmail.com ./setup_monitoring.sh
```

Defaults (if env vars are unset): `PROJECT_ID=matrimonial-staging`,
`BACKEND_SERVICE=matrimonial-backend`, `ALERT_EMAIL=rajl3v3l@gmail.com`.
`PROJECT_ID` / `BACKEND_SERVICE` are inherited from `../deploy.config.sh` when present.

The script is **idempotent** — re-running detects existing channels, metrics, and
policies and updates them instead of creating duplicates.

> Note: newly created log-based metrics take a few minutes before they have data,
> so their alert policies may show "no data" briefly after first setup.

## Customizing thresholds

Edit the JSON files in `policies/` and re-run `setup_monitoring.sh`:

- `thresholdValue` — the number that triggers the alert.
- `alignmentPeriod` — the evaluation window (e.g., `300s` = 5 minutes).
- `duration` — how long the condition must hold before firing.
- `alertStrategy.autoClose` — how long until an open incident auto-resolves.

The token `__NOTIFICATION_CHANNEL__` in each policy is replaced by the script with
the real channel ID at apply time — do not hardcode a channel.

## Adding another notification channel (e.g., Slack/SMS)

Create the channel once, then append its ID to `notificationChannels` in each
policy JSON (or extend the script to manage multiple channels).

## Verify

```
https://console.cloud.google.com/monitoring/alerting/policies?project=matrimonial-staging
```

## Teardown

```bash
gcloud alpha monitoring policies list --project=matrimonial-staging \
  --format="value(name)" | xargs -I{} gcloud alpha monitoring policies delete {} --quiet
gcloud logging metrics delete redis_max_clients --project=matrimonial-staging --quiet
gcloud logging metrics delete backend_errors --project=matrimonial-staging --quiet
gcloud logging metrics delete api_request_latency --project=matrimonial-staging --quiet
```
