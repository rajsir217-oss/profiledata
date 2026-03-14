#!/usr/bin/env python3
"""
MongoDB Backup Restore Script
Standalone script to restore a database backup from local file or GCS.

Usage:
  # Restore from local mongodump archive (to temp DB)
  python restore_backup.py backups/matrimonialDB_20260314_060000.archive.gz

  # Restore from local JSON archive (to temp DB)
  python restore_backup.py backups/matrimonialDB_20260314_060000.tar.gz

  # Download from GCS first, then restore
  python restore_backup.py --from-gcs backups/matrimonialDB_20260314_060000.archive.gz

  # Restore directly to production DB (DANGEROUS — use with care)
  python restore_backup.py --target-db matrimonialDB backups/file.archive.gz

  # List available backups in GCS
  python restore_backup.py --list-gcs

NOTE: By default, restores go to '<dbname>_restore' to prevent accidental overwrites.
      Always inspect the restored data before merging into production.
"""

import argparse
import os
import sys
import subprocess
import shutil
import json
from pathlib import Path
from datetime import datetime

# Load .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def get_mongodb_url():
    return os.environ.get("MONGODB_URL", "mongodb://localhost:27017")


def get_database_name():
    return os.environ.get("DATABASE_NAME", "matrimonialDB")


def get_gcs_bucket():
    return os.environ.get("GCS_BUCKET_NAME", "")


def check_mongorestore():
    try:
        result = subprocess.run(
            ["mongorestore", "--version"],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_mongoimport():
    try:
        result = subprocess.run(
            ["mongoimport", "--version"],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def download_from_gcs(gcs_path: str, local_dir: str = "backups") -> str:
    """Download a backup from GCS to local."""
    bucket = get_gcs_bucket()
    if not bucket:
        print("ERROR: GCS_BUCKET_NAME not configured in environment")
        sys.exit(1)

    filename = gcs_path.split("/")[-1]
    local_path = os.path.join(local_dir, filename)

    # Try gsutil first
    gcs_uri = f"gs://{bucket}/{gcs_path}"
    print(f"Downloading: {gcs_uri} → {local_path}")

    try:
        result = subprocess.run(
            ["gsutil", "cp", gcs_uri, local_path],
            capture_output=True, text=True, timeout=600
        )
        if result.returncode == 0:
            print(f"Downloaded: {local_path} ({os.path.getsize(local_path)} bytes)")
            return local_path
        else:
            print(f"gsutil failed: {result.stderr}")
    except FileNotFoundError:
        print("gsutil not found, trying Python GCS client...")

    # Fallback to Python GCS client
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket_obj = client.bucket(bucket)
        blob = bucket_obj.blob(gcs_path)
        blob.download_to_filename(local_path)
        print(f"Downloaded: {local_path} ({os.path.getsize(local_path)} bytes)")
        return local_path
    except Exception as e:
        print(f"ERROR: Failed to download from GCS: {e}")
        sys.exit(1)


def list_gcs_backups():
    """List all backups in the GCS bucket."""
    bucket = get_gcs_bucket()
    if not bucket:
        print("ERROR: GCS_BUCKET_NAME not configured")
        sys.exit(1)

    try:
        from google.cloud import storage
        client = storage.Client()
        bucket_obj = client.bucket(bucket)
        blobs = list(bucket_obj.list_blobs(prefix="backups/"))

        if not blobs:
            print("No backups found in GCS")
            return

        print(f"\nBackups in gs://{bucket}/backups/")
        print("-" * 80)
        print(f"{'Filename':<50} {'Size':>10} {'Created':>18}")
        print("-" * 80)

        for blob in sorted(blobs, key=lambda b: b.time_created or datetime.min, reverse=True):
            name = blob.name.split("/")[-1]
            if not name:
                continue
            size = f"{(blob.size or 0) / (1024*1024):.1f} MB"
            created = blob.time_created.strftime("%Y-%m-%d %H:%M") if blob.time_created else "—"
            print(f"{name:<50} {size:>10} {created:>18}")

        print(f"\nTotal: {len(blobs)} backup(s)")

    except Exception as e:
        print(f"ERROR: {e}")
        # Fallback to gsutil
        try:
            result = subprocess.run(
                ["gsutil", "ls", "-l", f"gs://{bucket}/backups/"],
                capture_output=True, text=True, timeout=30
            )
            print(result.stdout)
        except FileNotFoundError:
            print("Neither google-cloud-storage nor gsutil available")
            sys.exit(1)


def restore_mongodump(archive_path: str, target_db: str, source_db: str):
    """Restore a mongodump .archive.gz file using mongorestore."""
    if not check_mongorestore():
        print("ERROR: mongorestore binary not found. Install mongodb-database-tools:")
        print("  brew install mongodb-database-tools")
        sys.exit(1)

    mongodb_url = get_mongodb_url()

    cmd = [
        "mongorestore",
        f"--uri={mongodb_url}",
        f"--archive={archive_path}",
        "--gzip",
    ]

    # If restoring to a different DB name, use namespace mapping
    if target_db != source_db:
        cmd.extend([
            f"--nsFrom={source_db}.*",
            f"--nsTo={target_db}.*",
        ])

    print(f"\nRestoring {archive_path} → database '{target_db}'")
    print(f"Command: mongorestore --archive={archive_path} --gzip --nsTo={target_db}.*")
    print()

    result = subprocess.run(cmd, capture_output=False, timeout=1800)

    if result.returncode == 0:
        print(f"\n✅ Restore successful! Data is in database: {target_db}")
        print(f"\nNext steps:")
        print(f"  1. Connect: mongosh \"{mongodb_url}\"")
        print(f"  2. Inspect: use {target_db}")
        print(f"  3. Verify: db.users.countDocuments()")
        if target_db != source_db:
            print(f"  4. To merge into production, manually copy collections from {target_db} → {source_db}")
    else:
        print(f"\n❌ Restore failed with exit code {result.returncode}")
        sys.exit(1)


def restore_json_dump(archive_path: str, target_db: str):
    """Restore a Python JSON dump .tar.gz file."""
    # Extract the archive
    extract_dir = Path("backups/_restore_temp")
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True)

    print(f"Extracting {archive_path}...")
    shutil.unpack_archive(archive_path, extract_dir)

    # Find JSON files
    json_files = list(extract_dir.rglob("*.json"))
    if not json_files:
        print("ERROR: No JSON files found in archive")
        shutil.rmtree(extract_dir)
        sys.exit(1)

    mongodb_url = get_mongodb_url()
    has_mongoimport = check_mongoimport()

    print(f"Found {len(json_files)} collection(s) to restore → {target_db}")

    for json_file in json_files:
        collection_name = json_file.stem
        print(f"  Restoring: {collection_name}...")

        if has_mongoimport:
            cmd = [
                "mongoimport",
                f"--uri={mongodb_url}",
                f"--db={target_db}",
                f"--collection={collection_name}",
                f"--file={json_file}",
                "--jsonArray",
                "--drop",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if result.returncode != 0:
                print(f"    ❌ Failed: {result.stderr[:200]}")
            else:
                print(f"    ✅ Done")
        else:
            # Python fallback using pymongo
            try:
                from pymongo import MongoClient
                client = MongoClient(mongodb_url)
                db = client[target_db]

                with open(json_file) as f:
                    records = json.load(f)

                if records:
                    db[collection_name].drop()
                    db[collection_name].insert_many(records)
                    print(f"    ✅ Inserted {len(records)} records")
                else:
                    print(f"    ⚠️ Empty collection, skipped")

                client.close()
            except Exception as e:
                print(f"    ❌ Failed: {e}")

    # Cleanup
    shutil.rmtree(extract_dir)
    print(f"\n✅ JSON restore complete → database: {target_db}")


def main():
    parser = argparse.ArgumentParser(
        description="Restore MongoDB backup from local file or GCS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("backup_file", nargs="?", help="Path to backup archive file")
    parser.add_argument("--target-db", default=None,
                       help="Target database name (default: <source_db>_restore)")
    parser.add_argument("--from-gcs", action="store_true",
                       help="Download backup_file from GCS first")
    parser.add_argument("--list-gcs", action="store_true",
                       help="List available backups in GCS bucket")

    args = parser.parse_args()

    if args.list_gcs:
        list_gcs_backups()
        return

    if not args.backup_file:
        parser.print_help()
        sys.exit(1)

    backup_path = args.backup_file

    # Download from GCS if requested
    if args.from_gcs:
        backup_path = download_from_gcs(backup_path)

    if not os.path.exists(backup_path):
        print(f"ERROR: File not found: {backup_path}")
        sys.exit(1)

    source_db = get_database_name()
    target_db = args.target_db or f"{source_db}_restore"

    file_size = os.path.getsize(backup_path)
    print(f"\n{'='*60}")
    print(f"  MongoDB Restore")
    print(f"{'='*60}")
    print(f"  File:      {backup_path}")
    print(f"  Size:      {file_size / (1024*1024):.1f} MB")
    print(f"  Source DB: {source_db}")
    print(f"  Target DB: {target_db}")
    print(f"{'='*60}")

    if target_db == source_db:
        print("\n⚠️  WARNING: You are restoring DIRECTLY to the production database!")
        confirm = input("Type 'YES' to confirm: ").strip()
        if confirm != "YES":
            print("Aborted.")
            sys.exit(0)

    if backup_path.endswith(".archive.gz"):
        restore_mongodump(backup_path, target_db, source_db)
    elif backup_path.endswith(".tar.gz"):
        restore_json_dump(backup_path, target_db)
    else:
        print(f"ERROR: Unsupported file format: {backup_path}")
        print("Supported: .archive.gz (mongodump), .tar.gz (JSON dump)")
        sys.exit(1)


if __name__ == "__main__":
    main()
