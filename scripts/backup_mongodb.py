#!/usr/bin/env python3
"""
MongoDB Backup Strategy
- GCP Bucket backup for disaster recovery
- Local dev copy for development/testing
- Automated scheduling support
"""

import os
import sys
import subprocess
import datetime
import gzip
import json
from pathlib import Path
from typing import Optional, Dict, List
import logging

# Add backend path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'fastapi_backend'))

try:
    from google.cloud import storage
    from google.oauth2 import service_account
    GCP_AVAILABLE = True
except ImportError:
    GCP_AVAILABLE = False
    print("Warning: Google Cloud libraries not installed. GCP backups disabled.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/backup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MongoDBBackup:
    def __init__(self, config_file: Optional[str] = None):
        """Initialize backup manager with configuration"""
        self.config = self._load_config(config_file)
        self.backup_dir = Path(self.config.get('backup_dir', './backups'))
        self.backup_dir.mkdir(exist_ok=True)
        
        # Ensure logs directory exists
        Path('logs').mkdir(exist_ok=True)
        
    def _load_config(self, config_file: Optional[str]) -> Dict:
        """Load backup configuration from file or environment"""
        if config_file and Path(config_file).exists():
            with open(config_file) as f:
                return json.load(f)
        
        # Default configuration from environment
        return {
            'mongodb_url': os.getenv('MONGODB_URL', 'mongodb://localhost:27017'),
            'database_name': os.getenv('DATABASE_NAME', 'matrimonialDB'),
            'backup_dir': os.getenv('BACKUP_DIR', './backups'),
            'gcp_bucket_name': os.getenv('GCP_BACKUP_BUCKET', ''),
            'gcp_credentials_path': os.getenv('GOOGLE_APPLICATION_CREDENTIALS', ''),
            'retention_days': int(os.getenv('BACKUP_RETENTION_DAYS', '30')),
            'compress_backups': os.getenv('COMPRESS_BACKUPS', 'true').lower() == 'true',
            'local_dev_copy': os.getenv('LOCAL_DEV_COPY', 'true').lower() == 'true',
            'gcp_backup': os.getenv('GCP_BACKUP', 'true').lower() == 'true'
        }
    
    def create_backup(self, backup_type: str = 'full') -> Dict[str, str]:
        """
        Create MongoDB backup with both local and GCP storage
        Returns: Dict with backup file paths and status
        """
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"{self.config['database_name']}_{backup_type}_{timestamp}"
        
        logger.info(f"Starting {backup_type} backup: {backup_name}")
        
        result = {
            'backup_name': backup_name,
            'timestamp': timestamp,
            'status': 'started',
            'local_file': '',
            'gcp_file': '',
            'size_mb': 0,
            'error': ''
        }
        
        try:
            # Create mongodump
            dump_file = self._create_mongodump(backup_name, backup_type)
            result['local_file'] = str(dump_file)
            
            # Compress if enabled
            if self.config['compress_backups']:
                dump_file = self._compress_file(dump_file)
                result['local_file'] = str(dump_file)
            
            # Get file size
            result['size_mb'] = round(dump_file.stat().st_size / (1024 * 1024), 2)
            
            # Upload to GCP if enabled
            if self.config['gcp_backup'] and self.config['gcp_bucket_name']:
                gcp_path = self._upload_to_gcp(dump_file, backup_name)
                result['gcp_file'] = gcp_path
            
            # Create local dev copy if enabled
            if self.config['local_dev_copy'] and backup_type == 'full':
                self._create_dev_copy(dump_file, backup_name)
            
            result['status'] = 'completed'
            logger.info(f"Backup completed successfully: {backup_name}")
            
        except Exception as e:
            result['status'] = 'failed'
            result['error'] = str(e)
            logger.error(f"Backup failed: {backup_name} - {e}")
        
        return result
    
    def _create_mongodump(self, backup_name: str, backup_type: str) -> Path:
        """Create MongoDB dump using mongodump"""
        dump_dir = self.backup_dir / backup_name
        dump_dir.mkdir(exist_ok=True)
        
        cmd = [
            'mongodump',
            '--uri', self.config['mongodb_url'],
            '--db', self.config['database_name'],
            '--out', str(dump_dir.parent)
        ]
        
        if backup_type == 'collection':
            # For collection-specific backups, you can modify this
            pass
        
        logger.info(f"Running mongodump: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        if result.returncode != 0:
            raise Exception(f"mongodump failed: {result.stderr}")
        
        # The actual dump is in a subdirectory named after the database
        actual_dump_dir = dump_dir.parent / self.config['database_name']
        if actual_dump_dir.exists():
            # Rename to our backup name
            if dump_dir.exists():
                dump_dir.rmdir()
            actual_dump_dir.rename(dump_dir)
        
        return dump_dir
    
    def _compress_file(self, file_path: Path) -> Path:
        """Compress backup file/directory using gzip"""
        compressed_path = file_path.with_suffix(file_path.suffix + '.tar.gz')
        
        logger.info(f"Compressing backup: {file_path} -> {compressed_path}")
        
        cmd = ['tar', '-czf', str(compressed_path), '-C', str(file_path.parent), file_path.name]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        if result.returncode != 0:
            raise Exception(f"Compression failed: {result.stderr}")
        
        # Remove uncompressed directory
        subprocess.run(['rm', '-rf', str(file_path)], check=True)
        
        return compressed_path
    
    def _upload_to_gcp(self, local_file: Path, backup_name: str) -> str:
        """Upload backup to Google Cloud Storage"""
        if not GCP_AVAILABLE:
            raise ImportError("Google Cloud libraries not available")
        
        logger.info(f"Uploading to GCP bucket: {self.config['gcp_bucket_name']}")
        
        # Initialize GCP client
        if self.config['gcp_credentials_path']:
            credentials = service_account.Credentials.from_service_account_file(
                self.config['gcp_credentials_path']
            )
            client = storage.Client(credentials=credentials)
        else:
            client = storage.Client()
        
        bucket = client.bucket(self.config['gcp_bucket_name'])
        
        # Upload file
        blob_name = f"mongodb-backups/{backup_name}{local_file.suffix}"
        blob = bucket.blob(blob_name)
        
        blob.upload_from_filename(str(local_file))
        
        # Set metadata
        blob.metadata = {
            'backup_type': 'mongodb',
            'database': self.config['database_name'],
            'created_at': datetime.datetime.now().isoformat(),
            'source': 'automated_backup'
        }
        blob.patch()
        
        gcp_path = f"gs://{self.config['gcp_bucket_name']}/{blob_name}"
        logger.info(f"Uploaded to GCP: {gcp_path}")
        
        return gcp_path
    
    def _create_dev_copy(self, backup_file: Path, backup_name: str):
        """Create a copy for local development environment"""
        dev_dir = Path(self.config.get('dev_copy_dir', './dev_backups'))
        dev_dir.mkdir(exist_ok=True)
        
        dev_copy = dev_dir / f"{backup_name}_dev{backup_file.suffix}"
        
        logger.info(f"Creating dev copy: {dev_copy}")
        
        if backup_file.is_dir():
            subprocess.run(['cp', '-r', str(backup_file), str(dev_copy)], check=True)
        else:
            subprocess.run(['cp', str(backup_file), str(dev_copy)], check=True)
    
    def restore_backup(self, backup_path: str, target_db: Optional[str] = None) -> bool:
        """
        Restore MongoDB from backup
        backup_path: Local file path or GCP path (gs://...)
        target_db: Target database name (defaults to original)
        """
        try:
            logger.info(f"Starting restore from: {backup_path}")
            
            # Handle GCP path
            if backup_path.startswith('gs://'):
                local_file = self._download_from_gcp(backup_path)
            else:
                local_file = Path(backup_path)
            
            # Decompress if needed
            if local_file.suffix == '.gz':
                local_file = self._decompress_file(local_file)
            
            # Restore using mongorestore
            target_database = target_db or self.config['database_name']
            
            cmd = [
                'mongorestore',
                '--uri', self.config['mongodb_url'],
                '--db', target_database,
                '--drop',  # Drop existing collections
                str(local_file)
            ]
            
            logger.info(f"Running mongorestore: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            if result.returncode != 0:
                raise Exception(f"mongorestore failed: {result.stderr}")
            
            logger.info(f"Restore completed successfully to database: {target_database}")
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def _download_from_gcp(self, gcp_path: str) -> Path:
        """Download backup from Google Cloud Storage"""
        if not GCP_AVAILABLE:
            raise ImportError("Google Cloud libraries not available")
        
        # Parse gs://bucket/path
        parts = gcp_path[5:].split('/', 1)
        bucket_name = parts[0]
        blob_name = parts[1]
        
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        local_file = self.backup_dir / Path(blob_name).name
        blob.download_to_filename(str(local_file))
        
        logger.info(f"Downloaded from GCP: {gcp_path} -> {local_file}")
        return local_file
    
    def _decompress_file(self, compressed_file: Path) -> Path:
        """Decompress .tar.gz file"""
        extract_dir = compressed_file.parent / compressed_file.stem
        extract_dir.mkdir(exist_ok=True)
        
        cmd = ['tar', '-xzf', str(compressed_file), '-C', str(extract_dir)]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        if result.returncode != 0:
            raise Exception(f"Decompression failed: {result.stderr}")
        
        return extract_dir
    
    def cleanup_old_backups(self):
        """Remove backups older than retention period"""
        retention_days = self.config['retention_days']
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=retention_days)
        
        logger.info(f"Cleaning up backups older than {retention_days} days")
        
        # Clean local backups
        for backup_path in self.backup_dir.glob('*'):
            if backup_path.is_dir() or backup_path.suffix in ['.tar', '.gz']:
                mtime = datetime.datetime.fromtimestamp(backup_path.stat().st_mtime)
                if mtime < cutoff_date:
                    logger.info(f"Removing old backup: {backup_path}")
                    subprocess.run(['rm', '-rf', str(backup_path)], check=True)
        
        # Clean GCP backups
        if self.config['gcp_backup'] and GCP_AVAILABLE:
            self._cleanup_gcp_backups(cutoff_date)
    
    def _cleanup_gcp_backups(self, cutoff_date: datetime.datetime):
        """Remove old backups from GCP bucket"""
        try:
            client = storage.Client()
            bucket = client.bucket(self.config['gcp_bucket_name'])
            
            blobs = bucket.list_blobs(prefix='mongodb-backups/')
            
            for blob in blobs:
                if blob.time_created and blob.time_created.replace(tzinfo=None) < cutoff_date:
                    logger.info(f"Removing old GCP backup: {blob.name}")
                    blob.delete()
                    
        except Exception as e:
            logger.error(f"GCP cleanup failed: {e}")
    
    def list_backups(self) -> List[Dict]:
        """List all available backups with metadata"""
        backups = []
        
        # List local backups
        for backup_path in self.backup_dir.glob('*'):
            if backup_path.is_dir() or backup_path.suffix in ['.tar', '.gz']:
                stat = backup_path.stat()
                backups.append({
                    'name': backup_path.name,
                    'path': str(backup_path),
                    'size_mb': round(stat.st_size / (1024 * 1024), 2),
                    'created_at': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'type': 'local'
                })
        
        # List GCP backups
        if self.config['gcp_backup'] and GCP_AVAILABLE:
            try:
                client = storage.Client()
                bucket = client.bucket(self.config['gcp_bucket_name'])
                blobs = bucket.list_blobs(prefix='mongodb-backups/')
                
                for blob in blobs:
                    backups.append({
                        'name': blob.name,
                        'path': f"gs://{self.config['gcp_bucket_name']}/{blob.name}",
                        'size_mb': round(blob.size / (1024 * 1024), 2),
                        'created_at': blob.time_created.isoformat() if blob.time_created else '',
                        'type': 'gcp',
                        'metadata': blob.metadata or {}
                    })
            except Exception as e:
                logger.error(f"Failed to list GCP backups: {e}")
        
        return sorted(backups, key=lambda x: x['created_at'], reverse=True)


def main():
    """CLI interface for backup operations"""
    import argparse
    
    parser = argparse.ArgumentParser(description='MongoDB Backup Utility')
    parser.add_argument('action', choices=['backup', 'restore', 'list', 'cleanup'])
    parser.add_argument('--type', default='full', help='Backup type (full, collection)')
    parser.add_argument('--path', help='Path for restore operation')
    parser.add_argument('--target-db', help='Target database for restore')
    parser.add_argument('--config', help='Configuration file path')
    
    args = parser.parse_args()
    
    backup = MongoDBBackup(args.config)
    
    if args.action == 'backup':
        result = backup.create_backup(args.type)
        print(json.dumps(result, indent=2))
    
    elif args.action == 'restore':
        if not args.path:
            print("Error: --path required for restore operation")
            return 1
        success = backup.restore_backup(args.path, args.target_db)
        print(f"Restore {'successful' if success else 'failed'}")
    
    elif args.action == 'list':
        backups = backup.list_backups()
        print(json.dumps(backups, indent=2))
    
    elif args.action == 'cleanup':
        backup.cleanup_old_backups()
        print("Cleanup completed")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
