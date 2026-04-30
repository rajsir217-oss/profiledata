---
description: Restore production MongoDB backup to local dev environment
---

# Restore Production Backup to Dev Environment

## Prerequisites

- `mongorestore` or `mongoimport` installed (MongoDB Database Tools)
  - macOS: `brew install mongodb-database-tools`
  - Ubuntu: `sudo apt-get install mongo-tools`
- `gcloud` CLI authenticated (`gcloud auth login`) OR GCS bucket read access
- Local MongoDB running (`mongod` or Docker)

## Quick Reference

### 1. Download from GCS

```bash
# List available backups
gsutil ls gs://<GCS_BUCKET_NAME>/backups/ | sort | tail -10

# Download specific backup
gsutil cp gs://<GCS_BUCKET_NAME>/backups/matrimonialDB_YYYYMMDD_HHMMSS.archive.gz ./
```

### 2. Restore to Dev Database

**mongodump archive (.archive.gz):**
```bash
mongorestore \
  --uri="mongodb://localhost:27017" \
  --nsFrom="matrimonialDB.*" \
  --nsTo="matrimonialDB_dev.*" \
  --archive=matrimonialDB_YYYYMMDD_HHMMSS.archive.gz \
  --gzip
```

**Python JSON dump (.tar.gz):**
```bash
# Extract
tar -xzf matrimonialDB_YYYYMMDD_HHMMSS.tar.gz -C ./restore_temp/

# Import each collection
for f in restore_temp/*/*.json; do
  coll=$(basename "$f" .json)
  mongoimport --uri="mongodb://localhost:27017" \
    --db=matrimonialDB_dev \
    --collection="$coll" \
    --file="$f" --jsonArray --drop
done

# Cleanup
rm -rf restore_temp/
```

### 3. Verify

```bash
mongosh "mongodb://localhost:27017/matrimonialDB_dev" --eval "
  db.users.countDocuments();
  db.messages.countDocuments();
  db.activity_logs.countDocuments();
"
```

### 4. Point Dev Backend to Restored DB

Edit `fastapi_backend/.env` (dev copy, never commit):

```bash
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=matrimonialDB_dev
```

## Selective Collection Restore (Partial Data)

Restore only specific collections to save time/disk:

```bash
mongorestore \
  --uri="mongodb://localhost:27017" \
  --nsFrom="matrimonialDB.users" \
  --nsTo="matrimonialDB_dev.users" \
  --archive=backup.archive.gz --gzip

mongorestore \
  --uri="mongodb://localhost:27017" \
  --nsFrom="matrimonialDB.messages" \
  --nsTo="matrimonialDB_dev.messages" \
  --archive=backup.archive.gz --gzip
```

## Safety Rules

1. **Always** use `--nsTo=matrimonialDB_dev.*` (never restore directly to `matrimonialDB` on dev)
2. **Never** run restore commands against production URI
3. **Check** `DATABASE_NAME` in your dev `.env` before starting backend
4. The `restore_backup.py` script has a `YES` confirmation gate for production restores — this is for the server-side script only

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `mongorestore: command not found` | Database Tools not installed | `brew install mongodb-database-tools` |
| `Failed: error parsing archive` | Wrong file type | Check suffix — `.archive.gz` vs `.tar.gz` need different commands |
| `nsTo namespace doesn't match` | Archive was from different DB name | Check `--nsFrom` matches the source DB in the archive |
| GCS permission denied | Wrong GCP project or IAM | `gcloud config get-value project` then `gcloud auth login` |
