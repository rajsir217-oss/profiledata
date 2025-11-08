# Database Migrations

This directory contains database migration scripts that run automatically during deployment.

## 🏗️ Structure

```
migrations/
├── README.md
├── run_migrations.py          # Main migration runner
└── scripts/
    ├── 001_seed_email_templates.py
    ├── 002_add_indexes.py
    └── 003_update_user_schema.py
```

## 📝 Creating a Migration

1. **Create a new migration file:**
   ```bash
   touch migrations/scripts/004_my_migration.py
   ```

2. **Use this template:**
   ```python
   """
   Migration: Brief description
   Created: YYYY-MM-DD
   """
   
   async def up(db):
       """Apply migration"""
       # Your migration code here
       pass
   
   async def down(db):
       """Rollback migration (optional)"""
       # Rollback code here
       pass
   ```

3. **Test locally first:**
   ```bash
   python migrations/run_migrations.py --test
   ```

## 🚀 Auto-Run on Deployment

Migrations run automatically during production deployment:
- `deploy-production.sh` → calls `run_migrations.py`
- Only runs new/pending migrations
- Logs all changes
- Skips already-applied migrations

## 🔒 Safety Features

- ✅ Migration history tracked in `migration_history` collection
- ✅ Each migration runs only once
- ✅ Dry-run mode available
- ✅ Rollback support (if implemented)
- ✅ Error handling and logging

## 📊 Migration Status

Check which migrations have been applied:
```bash
python migrations/run_migrations.py --status
```

## 🎯 Best Practices

1. **Never modify existing migrations** - Create new ones
2. **Test locally first** before deploying
3. **Make migrations idempotent** - Safe to run multiple times
4. **Add rollback logic** when possible
5. **Document breaking changes** in migration comments
