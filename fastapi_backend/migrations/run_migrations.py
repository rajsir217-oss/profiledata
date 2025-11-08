"""
Database Migration Runner
Automatically runs pending migrations during deployment
"""

import asyncio
import os
import sys
import importlib.util
from datetime import datetime
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import Settings

settings = Settings()

class MigrationRunner:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.client = None
        self.db = None
        
    async def connect(self):
        """Connect to MongoDB"""
        self.client = AsyncIOMotorClient(settings.mongodb_url)
        self.db = self.client[settings.database_name]
        print(f"✅ Connected to: {settings.database_name}")
        
    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
    
    async def get_migration_history(self):
        """Get list of already-applied migrations"""
        try:
            history = await self.db.migration_history.find({}).to_list(None)
            return {m['migration_name']: m for m in history}
        except Exception as e:
            print(f"⚠️  No migration history found (first run)")
            return {}
    
    async def record_migration(self, migration_name, status='completed'):
        """Record migration in history"""
        if self.dry_run:
            print(f"   [DRY RUN] Would record: {migration_name}")
            return
            
        await self.db.migration_history.insert_one({
            'migration_name': migration_name,
            'applied_at': datetime.utcnow(),
            'status': status,
            'environment': os.getenv('APP_ENVIRONMENT', 'unknown')
        })
    
    def get_migration_scripts(self):
        """Get all migration scripts from scripts/ directory"""
        scripts_dir = Path(__file__).parent / 'scripts'
        if not scripts_dir.exists():
            print(f"⚠️  Migrations directory not found: {scripts_dir}")
            return []
        
        # Get all .py files, sorted by name (001_, 002_, etc.)
        migrations = sorted([
            f for f in scripts_dir.glob('*.py')
            if not f.name.startswith('__')
        ])
        return migrations
    
    async def run_migration(self, migration_path):
        """Run a single migration script"""
        migration_name = migration_path.stem
        
        # Load the migration module
        spec = importlib.util.spec_from_file_location(migration_name, migration_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Check if it has an 'up' function
        if not hasattr(module, 'up'):
            print(f"   ⚠️  Skipping {migration_name} (no 'up' function)")
            return False
        
        if self.dry_run:
            print(f"   [DRY RUN] Would run: {migration_name}")
            return True
        
        # Run the migration
        try:
            await module.up(self.db)
            await self.record_migration(migration_name)
            return True
        except Exception as e:
            print(f"   ❌ Failed: {migration_name}")
            print(f"      Error: {e}")
            await self.record_migration(migration_name, status='failed')
            return False
    
    async def run_all(self):
        """Run all pending migrations"""
        print("\n" + "=" * 60)
        print("DATABASE MIGRATION RUNNER")
        print("=" * 60)
        print(f"Environment: {os.getenv('APP_ENVIRONMENT', 'unknown')}")
        print(f"Dry Run: {self.dry_run}")
        print("=" * 60)
        
        await self.connect()
        
        # Get migration history
        history = await self.get_migration_history()
        print(f"\n📊 Migration History: {len(history)} applied")
        
        # Get all migration scripts
        migrations = self.get_migration_scripts()
        print(f"📁 Found {len(migrations)} migration scripts")
        
        if not migrations:
            print("\n✅ No migrations to run")
            await self.close()
            return
        
        # Run pending migrations
        print("\n🚀 Running pending migrations...")
        applied = 0
        skipped = 0
        failed = 0
        
        for migration_path in migrations:
            migration_name = migration_path.stem
            
            # Check if already applied
            if migration_name in history:
                print(f"   ⏭️  Skipped: {migration_name} (already applied)")
                skipped += 1
                continue
            
            # Run the migration
            print(f"   ▶️  Running: {migration_name}...")
            success = await self.run_migration(migration_path)
            
            if success:
                print(f"   ✅ Completed: {migration_name}")
                applied += 1
            else:
                failed += 1
        
        # Summary
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"✅ Applied: {applied}")
        print(f"⏭️  Skipped: {skipped}")
        if failed > 0:
            print(f"❌ Failed: {failed}")
        print("=" * 60)
        
        await self.close()
        return failed == 0
    
    async def show_status(self):
        """Show migration status"""
        print("\n" + "=" * 60)
        print("MIGRATION STATUS")
        print("=" * 60)
        
        await self.connect()
        
        # Get history
        history = await self.get_migration_history()
        migrations = self.get_migration_scripts()
        
        print(f"\nTotal Scripts: {len(migrations)}")
        print(f"Applied: {len(history)}")
        print(f"Pending: {len(migrations) - len(history)}")
        
        print("\n📋 Migration List:")
        for migration_path in migrations:
            name = migration_path.stem
            if name in history:
                h = history[name]
                applied_at = h['applied_at'].strftime('%Y-%m-%d %H:%M')
                status = h['status']
                icon = "✅" if status == 'completed' else "❌"
                print(f"  {icon} {name} - {status} ({applied_at})")
            else:
                print(f"  ⏳ {name} - pending")
        
        print("=" * 60)
        await self.close()


async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Database Migration Runner')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without applying')
    parser.add_argument('--status', action='store_true', help='Show migration status')
    
    args = parser.parse_args()
    
    runner = MigrationRunner(dry_run=args.dry_run)
    
    if args.status:
        await runner.show_status()
    else:
        success = await runner.run_all()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
