#!/bin/bash
#
# Cloud Monitoring setup for matrimonial-backend
# Creates (idempotently):
#   1. An email notification channel
#   2. Log-based metrics (redis_max_clients, backend_errors)
#   3. Alert policies (Redis max clients, error spike, 5xx, p95 latency)
#
# Real-time alerting only (no weekly narrative report).
#
# Usage:
#   ./setup_monitoring.sh                    # uses defaults below
#   ALERT_EMAIL=rajl3v3l@gmail.com ./setup_monitoring.sh
#
# Re-running is safe: existing metrics/policies/channels are detected and skipped.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load shared deploy config if available (PROJECT_ID, BACKEND_SERVICE, REGION).
# Temporarily disable nounset: deploy.config.sh references some vars (e.g.
# REPO_ROOT) that are only set when invoked from the main deploy scripts.
if [ -f "$SCRIPT_DIR/../deploy.config.sh" ]; then
  set +u
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/../deploy.config.sh"
  set -u
fi

PROJECT_ID="${PROJECT_ID:-matrimonial-staging}"
BACKEND_SERVICE="${BACKEND_SERVICE:-matrimonial-backend}"
ALERT_EMAIL="${ALERT_EMAIL:-rajl3v3l@gmail.com}"
POLICY_DIR="$SCRIPT_DIR/policies"

echo "============================================="
echo "Cloud Monitoring setup"
echo "  Project:  $PROJECT_ID"
echo "  Service:  $BACKEND_SERVICE"
echo "  Email:    $ALERT_EMAIL"
echo "============================================="

# ---------------------------------------------------------------------------
# 1. Notification channel (email)
# ---------------------------------------------------------------------------
echo ""
echo "==> Ensuring email notification channel..."
CHANNEL_ID="$(gcloud beta monitoring channels list \
  --project="$PROJECT_ID" \
  --filter="type='email' AND labels.email_address='$ALERT_EMAIL'" \
  --format="value(name)" | head -n1 || true)"

if [ -z "$CHANNEL_ID" ]; then
  CHANNEL_ID="$(gcloud beta monitoring channels create \
    --project="$PROJECT_ID" \
    --display-name="L3V3L Alerts ($ALERT_EMAIL)" \
    --type=email \
    --channel-labels="email_address=$ALERT_EMAIL" \
    --format="value(name)")"
  echo "    Created channel: $CHANNEL_ID"
else
  echo "    Reusing channel: $CHANNEL_ID"
fi

# ---------------------------------------------------------------------------
# 2. Log-based metrics
# ---------------------------------------------------------------------------
create_log_metric() {
  local name="$1"
  local description="$2"
  local filter="$3"

  if gcloud logging metrics describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "    Metric '$name' already exists - updating filter"
    gcloud logging metrics update "$name" \
      --project="$PROJECT_ID" \
      --description="$description" \
      --log-filter="$filter" >/dev/null
  else
    gcloud logging metrics create "$name" \
      --project="$PROJECT_ID" \
      --description="$description" \
      --log-filter="$filter" >/dev/null
    echo "    Created metric '$name'"
  fi
}

echo ""
echo "==> Ensuring log-based metrics..."
create_log_metric "redis_max_clients" \
  "Count of Redis 'max number of clients reached' errors in the backend" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$BACKEND_SERVICE\" AND textPayload:\"max number of clients reached\""

create_log_metric "backend_errors" \
  "Count of ERROR-severity logs from the backend" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$BACKEND_SERVICE\" AND severity>=ERROR"

echo "    (New log-based metrics need a few minutes before data appears.)"

# ---------------------------------------------------------------------------
# 3. Alert policies
# ---------------------------------------------------------------------------
create_policy() {
  local file="$1"
  local display_name
  display_name="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['displayName'])" "$file")"

  local existing
  existing="$(gcloud alpha monitoring policies list \
    --project="$PROJECT_ID" \
    --filter="displayName=\"$display_name\"" \
    --format="value(name)" | head -n1 || true)"

  # Substitute the notification channel placeholder into a temp file
  local tmp
  tmp="$(mktemp)"
  sed "s|__NOTIFICATION_CHANNEL__|$CHANNEL_ID|g" "$file" > "$tmp"

  if [ -n "$existing" ]; then
    echo "    Policy '$display_name' exists - updating ($existing)"
    gcloud alpha monitoring policies update "$existing" \
      --project="$PROJECT_ID" \
      --policy-from-file="$tmp" >/dev/null
  else
    gcloud alpha monitoring policies create \
      --project="$PROJECT_ID" \
      --policy-from-file="$tmp" >/dev/null
    echo "    Created policy '$display_name'"
  fi
  rm -f "$tmp"
}

echo ""
echo "==> Ensuring alert policies..."
create_policy "$POLICY_DIR/redis_max_clients.json"
create_policy "$POLICY_DIR/backend_error_spike.json"
create_policy "$POLICY_DIR/http_5xx.json"
create_policy "$POLICY_DIR/high_latency_p95.json"

echo ""
echo "============================================="
echo "Done. Verify in the console:"
echo "  https://console.cloud.google.com/monitoring/alerting/policies?project=$PROJECT_ID"
echo "============================================="
