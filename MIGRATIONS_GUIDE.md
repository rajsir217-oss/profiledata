# Database Migrations Guide

**Automatic database syncing during production deployments!**

---

## 🎯 Quick Start

### **1. Create a New Migration**

```bash
cd fastapi_backend/migrations/scripts

# Create new migration file (use next number)
touch 003_my_migration.py
```

**Template:**
```python
"""
Migration: Your description here
Created: 2025-11-08
Description: Detailed explanation
"""

async def up(db):
    """Apply the migration"""
    print("      📝 Applying migration...")
    
    # Your migration code here
    # Example: Add new field to collection
    await db.users.update_many(
        {},
        {"$set": {"newField": "defaultValue"}}
    )
    
    print("      ✅ Migration complete")
    return True

async def down(db):
    """Rollback the migration (optional)"""
    print("      🔙 Rolling back...")
    
    # Rollback code here
    await db.users.update_many(
        {},
        {"$unset": {"newField": ""}}
    )
    
    print("      ✅ Rollback complete")
    return True
```

---

## 🚀 Automatic Deployment

Migrations run **automatically** when you deploy:

```bash
./deploy_gcp/deploy-production.sh
# Choose option 1 (Backend) or 3 (Both)
# Migrations run after backend deploys ✅
```

**What happens:**
1. Backend deploys
2. **Migrations run automatically** 🗄️
3. Only new migrations execute
4. Already-applied migrations are skipped
5. Migration history saved to MongoDB

---

## 🧪 Test Migrations Locally

**Before deploying to production, always test locally!**

```bash
cd fastapi_backend

# Run migrations on local database
python3 migrations/run_migrations.py

# Dry run (see what would happen)
python3 migrations/run_migrations.py --dry-run

# Check migration status
python3 migrations/run_migrations.py --status
```

---

## 📊 Migration Examples

### **Example 1: Add Database Index**

```python
"""Migration: Add index for faster user searches"""

async def up(db):
    await db.users.create_index([
        ("gender", 1),
        ("age", 1),
        ("location", 1)
    ], name="user_search_idx")
    return True

async def down(db):
    await db.users.drop_index("user_search_idx")
    return True
```

### **Example 2: Update Document Schema**

```python
"""Migration: Add email verification status"""

async def up(db):
    # Add new field to all users
    await db.users.update_many(
        {"emailVerified": {"$exists": False}},
        {"$set": {"emailVerified": False}}
    )
    return True

async def down(db):
    await db.users.update_many(
        {},
        {"$unset": {"emailVerified": ""}}
    )
    return True
```

### **Example 3: Seed Data**

```python
"""Migration: Add default notification preferences"""

async def up(db):
    default_prefs = {
        "emailNotifications": True,
        "pushNotifications": True,
        "smsNotifications": False
    }
    
    # Add to users without preferences
    await db.users.update_many(
        {"notificationPrefs": {"$exists": False}},
        {"$set": {"notificationPrefs": default_prefs}}
    )
    return True
```

---

## 🔒 Migration Safety

### **Best Practices:**

1. ✅ **Test locally first**
   ```bash
   python3 migrations/run_migrations.py --dry-run
   ```

2. ✅ **Make migrations idempotent**
   - Safe to run multiple times
   - Check if changes already exist

3. ✅ **Never modify existing migrations**
   - Create new migration instead
   - Old migrations already applied in production

4. ✅ **Add rollback logic when possible**
   - Implement `down()` function
   - Allows reverting changes if needed

5. ✅ **Document breaking changes**
   - Add clear comments
   - Update API docs if schema changes

---

## 📁 Migration Structure

```
fastapi_backend/
├── migrations/
│   ├── README.md                    # Detailed docs
│   ├── run_migrations.py            # Migration runner
│   └── scripts/                     # Migration scripts
│       ├── 001_seed_email_templates.py
│       ├── 002_add_notification_indexes.py
│       └── 003_your_migration.py    # Add new ones here
```

---

## 🛠️ Common Migration Tasks

### **Add Collection Index:**
```python
await db.collection_name.create_index([
    ("field1", 1),
    ("field2", -1)
], name="index_name")
```

### **Update All Documents:**
```python
await db.collection_name.update_many(
    {"condition": "value"},
    {"$set": {"newField": "value"}}
)
```

### **Remove Field:**
```python
await db.collection_name.update_many(
    {},
    {"$unset": {"oldField": ""}}
)
```

### **Rename Field:**
```python
await db.collection_name.update_many(
    {},
    {"$rename": {"oldName": "newName"}}
)
```

### **Insert Documents:**
```python
documents = [
    {"name": "item1", "value": 1},
    {"name": "item2", "value": 2}
]
await db.collection_name.insert_many(documents)
```

---

## 🔍 Migration Status

Check which migrations have been applied:

```bash
python3 migrations/run_migrations.py --status
```

**Output:**
```
============================================================
MIGRATION STATUS
============================================================

Total Scripts: 3
Applied: 2
Pending: 1

📋 Migration List:
  ✅ 001_seed_email_templates - completed (2025-11-08 10:05)
  ✅ 002_add_notification_indexes - completed (2025-11-08 10:06)
  ⏳ 003_my_migration - pending
============================================================
```

---

## 🚨 Troubleshooting

### **Migration fails during deployment:**
- Check migration history in MongoDB: `migration_history` collection
- Fix the migration script
- Re-run: `python3 migrations/run_migrations.py`

### **Need to rollback a migration:**
```python
# Add down() function to your migration
# Then manually run in MongoDB shell or create rollback script
```

### **Migration already applied but needs to run again:**
```bash
# Delete from migration_history in MongoDB
db.migration_history.deleteOne({migration_name: "003_my_migration"})
# Then re-run migrations
```

---

## ✅ Summary

**For everyday use:**
1. Create migration in `fastapi_backend/migrations/scripts/`
2. Test locally: `python3 migrations/run_migrations.py`
3. Deploy: `./deploy_gcp/deploy-production.sh`
4. ✅ Migrations run automatically!

**No manual database changes needed anymore!** 🎉
