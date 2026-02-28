# Google Cloud Storage Credentials Setup

## Problem
The application is failing to generate signed URLs because it's using compute engine credentials instead of service account credentials with a private key.

## Solution Steps

### 1. Create Service Account
```bash
# In Google Cloud Console or using gcloud CLI
gcloud iam service-accounts create matrimonial-storage \
    --description="Service account for matrimonial app storage" \
    --display-name="Matrimonial Storage Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding matrimonial-staging \
    --member="serviceAccount:matrimonial-storage@matrimonial-staging.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

# Create and download JSON key
gcloud iam service-accounts keys create ~/matrimonial-storage-key.json \
    --iam-account="matrimonial-storage@matrimonial-staging.iam.gserviceaccount.com"
```

### 2. Set Environment Variables in Cloud Run

In your Cloud Run deployment, set these environment variables:

```bash
# Path to service account key file
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/service-account-key.json

# Or use the JSON content directly
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type": "service_account", ...}'

# GCS Configuration
USE_GCS=True
GCS_BUCKET_NAME=your-bucket-name
GCS_PROJECT_ID=matrimonial-staging
```

### 3. Upload Service Account Key

Option A: Mount as file (recommended)
```bash
# Upload the JSON key file to Cloud Run
gcloud run services update matrimonial-backend \
    --region us-central1 \
    --set-cloudsql-instances matrimonial-db \
    --add-cloudsql-instances matrimonial-db \
    --set-env-vars GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/service-account-key.json
```

Option B: Use JSON content directly
```bash
gcloud run services update matrimonial-backend \
    --region us-central1 \
    --set-env-vars GOOGLE_APPLICATION_CREDENTIALS_JSON='$(cat ~/matrimonial-storage-key.json)'
```

### 4. Update Storage Service Code

The storage service should handle both credential types:

```python
# In services/storage_service.py
import os
from google.cloud import storage
from google.auth import default

def get_storage_client():
    try:
        # Try service account key first
        if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
            return storage.Client.from_service_account_json(
                os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            )
        elif os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON'):
            import json
            credentials_info = json.loads(
                os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
            )
            return storage.Client.from_service_account_info(credentials_info)
        else:
            # Fallback to default credentials
            return storage.Client()
    except Exception as e:
        logger.error(f"Failed to initialize storage client: {e}")
        raise
```

### 5. Verify Configuration

Test the credentials:
```python
from google.cloud import storage

try:
    client = storage.Client()
    buckets = list(client.list_buckets())
    print(f"Successfully connected. Found {len(buckets)} buckets")
except Exception as e:
    print(f"Failed to connect: {e}")
```

## Quick Fix for Production

If you need an immediate fix, you can:

1. **Disable signed URLs temporarily** by setting `USE_GCS=False`
2. **Use public URLs** instead of signed URLs
3. **Set up proper credentials** as described above

## Security Note

Never commit service account keys to Git. Always use environment variables or secret management in production.
