"""
MongoDB Migration: Pre-compute Sort Fields
Adds pre-computed sort fields to user documents to eliminate expensive aggregation computations
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from pymongo import UpdateOne

SORT_FIELD_INDEXES = [
    ("_sortFreshness", -1),
    ("_sortHeightInches", 1),
    ("_sortFirstName", 1),
    ("_sortLocation", 1),
    ("_sortEducation", 1),
    ("_sortProfession", 1),
]

def _parse_datetime(value):
    """Parse a datetime string or object into a datetime."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except Exception:
            return None
    return None


def compute_sort_fields(user):
    """Compute pre-computed sort fields for a user document"""
    # _sortFreshness should reflect the newest profile in searches.
    # It is the later of creation time and admin approval time.
    # It must NOT be updated on normal profile edits, so we ignore updated_at here.
    freshness_values = []

    for field in ['createdAt', 'adminApprovedAt']:
        parsed = _parse_datetime(user.get(field))
        if parsed:
            freshness_values.append(parsed)

    _sortFreshness = max(freshness_values) if freshness_values else None
    
    # Compute _sortHeightInches
    _sortHeightInches = user.get('heightInches', 0)
    
    # Compute _sortFirstName (lowercase, trimmed)
    first_name = user.get('firstName') or user.get('username') or ''
    _sortFirstName = str(first_name).strip().lower()
    
    # Compute _sortLocation (lowercase, trimmed city/state/location)
    city = user.get('city') or ''
    state = user.get('state') or ''
    location = user.get('location') or ''
    _sortLocation = str(city or state or location).strip().lower()
    
    # Compute _sortEducation (lowercase, trimmed education or degree)
    education = user.get('education') or ''
    education_history = user.get('educationHistory', [])
    if education_history and len(education_history) > 0:
        degree = education_history[0].get('degree') or education_history[0].get('level') or ''
        _sortEducation = str(degree or education).strip().lower()
    else:
        _sortEducation = str(education).strip().lower()
    
    # Compute _sortProfession (lowercase, trimmed occupation or workType)
    occupation = user.get('occupation') or ''
    work_experience = user.get('workExperience', [])
    if work_experience and len(work_experience) > 0:
        work_type = work_experience[0].get('workType') or ''
        _sortProfession = str(work_type or occupation).strip().lower()
    else:
        _sortProfession = str(occupation).strip().lower()
    
    return {
        "_sortFreshness": _sortFreshness,
        "_sortHeightInches": _sortHeightInches,
        "_sortFirstName": _sortFirstName,
        "_sortLocation": _sortLocation,
        "_sortEducation": _sortEducation,
        "_sortProfession": _sortProfession
    }

async def up(db):
    """Pre-compute sort fields for all user documents"""
    print("🔍 Pre-computing sort fields for user documents...")
    
    # Get total count
    total_users = await db.users.count_documents({})
    print(f"📊 Total users to process: {total_users}")
    
    # Process in batches
    batch_size = 1000
    processed = 0
    updated = 0
    
    skip = 0
    while True:
        # Get batch of users
        users = await db.users.find({}).skip(skip).limit(batch_size).to_list(length=batch_size)
        
        if not users:
            break
        
        print(f"📦 Processing batch {processed // batch_size + 1} ({len(users)} users)...")
        
        bulk_operations = []
        
        for user in users:
            try:
                sort_fields = compute_sort_fields(user)
                
                update_doc = {"$set": sort_fields}
                bulk_operations.append(UpdateOne({"_id": user["_id"]}, update_doc))
                updated += 1
                
            except Exception as e:
                print(f"  ⚠️  Error processing user {user.get('username', user.get('_id'))}: {e}")
        
        # Execute bulk write
        if bulk_operations:
            result = await db.users.bulk_write(bulk_operations)
            print(f"  ✅ Updated {result.modified_count} documents in this batch")
        
        processed += len(users)
        skip += batch_size
        
        # Progress
        progress = (processed / total_users) * 100
        print(f"  📈 Progress: {progress:.1f}% ({processed}/{total_users})")
        
        if processed >= total_users:
            break
    
    print(f"\n✅ Migration up complete! Updated {updated} user documents.")
    
    # Add indexes for the new fields
    print("\n🔍 Adding indexes for pre-computed sort fields...")
    
    for field, direction in SORT_FIELD_INDEXES:
        try:
            index_name = f"idx_{field.lstrip('_')}"
            await db.users.create_index([(field, direction)], name=index_name)
            print(f"  ✅ Created index: {index_name}")
        except Exception as e:
            print(f"  ⚠️  Index {field} may already exist: {e}")
    
    print("\n✅ Migration up completed successfully!")

async def down(db):
    """Remove pre-computed sort fields and their indexes"""
    print("🗑️  Removing pre-computed sort fields...")
    
    # Remove sort fields from all documents
    result = await db.users.update_many(
        {},
        {"$unset": {
            "_sortFreshness": "",
            "_sortHeightInches": "",
            "_sortFirstName": "",
            "_sortLocation": "",
            "_sortEducation": "",
            "_sortProfession": ""
        }}
    )
    print(f"  ✅ Removed sort fields from {result.modified_count} documents")
    
    # Drop indexes
    print("\n🗑️  Dropping sort field indexes...")
    
    for field, direction in SORT_FIELD_INDEXES:
        try:
            index_name = f"idx_{field.lstrip('_')}"
            await db.users.drop_index(index_name)
            print(f"  ✅ Dropped index: {index_name}")
        except Exception as e:
            print(f"  ⚠️  Index {index_name} may not exist: {e}")
    
    print("\n✅ Migration down completed successfully!")
