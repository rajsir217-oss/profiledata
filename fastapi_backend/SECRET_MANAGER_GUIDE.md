# 🔐 Secret Manager Guide

This guide explains how to manage sensitive credentials stored in Google Cloud Secret Manager.

## Current Secrets

| Secret Name | Purpose | Value Type |
|-------------|---------|------------|
| `ENCRYPTION_KEY` | PII data encryption key | Fernet key (44 chars) |
| `SMTP_USER` | Gmail account for sending emails | Email address |
| `SMTP_PASSWORD` | Gmail app password | 16-char app password |

## Viewing Secrets

### List all secrets:
```bash
gcloud secrets list --project=matrimonial-staging
```

### View secret value:
```bash
# SMTP User
gcloud secrets versions access latest --secret="SMTP_USER" --project=matrimonial-staging

# SMTP Password (be careful with this!)
gcloud secrets versions access latest --secret="SMTP_PASSWORD" --project=matrimonial-staging
```

## Creating New Secrets

### From command line:
```bash
gcloud secrets create SECRET_NAME \
  --data-file=- \
  --project=matrimonial-staging <<< "secret-value-here"
```

### From file:
```bash
echo "secret-value" > secret.txt
gcloud secrets create SECRET_NAME \
  --data-file=secret.txt \
  --project=matrimonial-staging
rm secret.txt  # Clean up!
```

## Updating Secrets

Secrets are versioned. When you update, a new version is created:

```bash
gcloud secrets versions add SECRET_NAME \
  --data-file=- \
  --project=matrimonial-staging <<< "new-value"
```

Cloud Run automatically uses `latest` version, so the service will pick up the new value on next deployment.

## Granting Access

Cloud Run service account needs access to read secrets:

```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:458052696267-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=matrimonial-staging
```

## Using Secrets in Cloud Run

Secrets are mounted as environment variables in the deployment script:

```bash
gcloud run services update matrimonial-backend \
  --set-secrets "SMTP_USER=SMTP_USER:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest"
```

The format is: `ENV_VAR_NAME=SECRET_NAME:VERSION`

## Rotating SMTP Credentials

If you need to change the Gmail app password:

### 1. Generate new app password in Gmail:
- Go to: https://myaccount.google.com/apppasswords
- Find "L3V3L Dating SMTP"
- Click "Revoke" (if needed)
- Create new app password
- Copy the 16-character password (without spaces)

### 2. Update the secret:
```bash
gcloud secrets versions add SMTP_PASSWORD \
  --data-file=- \
  --project=matrimonial-staging <<< "new-password-here"
```

### 3. Redeploy Cloud Run:
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/deploy_gcp
./deploy_backend_simple.sh
```

Cloud Run will automatically use the new version.

## Deleting Secrets

**⚠️ WARNING: This is irreversible!**

```bash
gcloud secrets delete SECRET_NAME --project=matrimonial-staging
```

## Security Best Practices

### ✅ DO:
- Store all sensitive credentials in Secret Manager
- Use versioning to track changes
- Grant minimal IAM permissions
- Rotate credentials regularly (every 90 days)
- Use `--no-store-value` when viewing secrets in shared environments

### ❌ DON'T:
- Commit secrets to Git (even in .env files)
- Share secret values in Slack/email
- Use the same password across environments
- Leave old versions of secrets with compromised values

## Troubleshooting

### "Permission denied" error
Cloud Run service account needs `secretAccessor` role. Grant it:
```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:458052696267-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=matrimonial-staging
```

### Secret not updating after change
Deploy a new revision to pick up the latest version:
```bash
cd deploy_gcp
./deploy_backend_simple.sh
```

### View which version is being used
```bash
gcloud run services describe matrimonial-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --format="value(spec.template.spec.containers[0].env)"
```

## Backup & Disaster Recovery

### Export all secrets (for backup):
```bash
# SMTP User
gcloud secrets versions access latest --secret="SMTP_USER" > smtp_user_backup.txt

# SMTP Password
gcloud secrets versions access latest --secret="SMTP_PASSWORD" > smtp_password_backup.txt

# Store backups in secure password manager (1Password, LastPass, etc.)
# Then delete the files:
rm smtp_*_backup.txt
```

### Restore from backup:
```bash
gcloud secrets versions add SMTP_USER --data-file=backup.txt
```

## Monitoring

View secret access logs:
```bash
gcloud logging read "protoPayload.serviceName=\"secretmanager.googleapis.com\"" \
  --limit=50 \
  --format=json \
  --project=matrimonial-staging
```

## Cost

Secret Manager pricing (as of 2025):
- **Secret versions**: First 6 active versions per secret are free
- **Access operations**: $0.03 per 10,000 access operations

For this app: **~$0.10/month** (negligible)

## Support

If you need help managing secrets:
1. Check GCP Console: https://console.cloud.google.com/security/secret-manager
2. View this guide
3. Contact support with specific error messages
