# Admin Tools for L3V3L Match Database Management

## 📁 Files

### 1. `seed_data_generator.py`
Generates realistic user profiles for testing the L3V3L matching algorithm.

**Features:**
- Creates 50 male + 50 female users
- Complete profiles with all required fields
- L3V3L dimension scores (Love, Loyalty, Laughter, Vulnerability, Elevation)
- Partner preferences for matching
- USA locations (25+ cities across all regions)
- Age range: 22-35 years
- Realistic Indian-American names
- Profile images (local file paths)
- Bio, interests, occupation, education
- Contact information
- Verification statuses

### 2. `cleanup_and_seed.py`
Main script to reset database with fresh test data.

**What it does:**
1. **Cleanup Phase**: Removes all users EXCEPT protected ones and cleans related data
2. **Seed Phase**: Inserts 50 male + 50 female realistic users
3. **Verification Phase**: Confirms database state

**Protected Users:**
- `admin`
- `testuser`
- `lokeshjain`
- `yogeshmukherjee010`

**Collections Cleaned:**
- users
- favorites
- shortlists
- exclusions
- messages
- conversations
- profile_views
- pii_access
- pii_requests
- activity_logs
- notification_queue
- notification_log
- notification_preferences

---

## 🚀 Usage

### Prerequisites
```bash
# Ensure you're in the fastapi_backend directory
cd fastapi_backend

# Install dependencies (if not already)
pip install motor python-dotenv
```

### Run Cleanup & Seed
```bash
python3 admin_tools/cleanup_and_seed.py
```

**You will be prompted for confirmation:**
```
⚠️  WARNING: This will DELETE all users except protected ones!
Type 'YES' to continue:
```

**Type `YES` to proceed.**

---

## 📊 Sample Output

```
============================================================
🚀 L3V3L MATCH DATABASE CLEANUP & SEED
============================================================
Started at: 2025-10-27 20:45:30
Database: matrimonialDB
Protected users: admin, testuser, lokeshjain, yogeshmukherjee010

⚠️  WARNING: This will DELETE all users except protected ones!
Type 'YES' to continue: YES

🧹 PHASE 1: DATABASE CLEANUP
============================================================
📊 Found 196 users to delete (keeping 4 protected users)
  ✅ users: Deleted 196 records
  ✅ favorites: Deleted 450 records
  ✅ profile_views: Deleted 1230 records
  ... (other collections)

✅ Cleanup complete! Total deleted: 2000

🌱 PHASE 2: SEEDING NEW USERS
============================================================
📝 Generating 100 user profiles (50 male + 50 female)...
✅ Generated 100 unique user profiles
✅ Successfully inserted 100 users

📋 Sample users created:
   1. arjunsharma001 - Arjun Sharma (Male, 28, New York, NY)
   2. rohanpatel002 - Rohan Patel (Male, 25, Los Angeles, CA)
   3. adityakumar003 - Aditya Kumar (Male, 31, Chicago, IL)
   4. rahulsingh004 - Rahul Singh (Male, 27, Houston, TX)
   5. karanreddy005 - Karan Reddy (Male, 29, Phoenix, AZ)
   ... and 95 more

🔍 PHASE 3: VERIFICATION
============================================================
✅ Total users in database: 104
   - Protected users: 4 ['admin', 'testuser', 'lokeshjain', 'yogeshmukherjee010']
   - New seeded users: 100
     • Male: 50
     • Female: 50
   - Users with L3V3L scores: 100
   - Average profile completeness: 92.3%

✅ Verification complete!

============================================================
🎉 SUCCESS!
============================================================
Summary:
  - Records deleted: 2000
  - Users seeded: 100
  - Protected users preserved: 4

Completed at: 2025-10-27 20:45:45
```

---

## 🎯 Generated User Data

### Profile Fields
- **Basic**: username, name, gender, age, DOB
- **Location**: City + region (USA)
- **Contact**: Email, phone
- **Physical**: Height, body type
- **Professional**: Occupation, education, working status
- **Personal**: Bio, interests, religion
- **Lifestyle**: Drinking, smoking, children preferences
- **L3V3L Scores**: All 5 dimensions (60-100 range)
- **Partner Preferences**: Age, height, location, L3V3L mins
- **Meta**: Profile completeness, trust score, verification status

### L3V3L Dimensions
Each user has realistic scores in:
- **Love** (0-100): Capacity for emotional connection
- **Loyalty** (0-100): Commitment and faithfulness
- **Laughter** (0-100): Humor and joy in life
- **Vulnerability** (0-100): Openness and authenticity
- **Elevation** (0-100): Personal growth and inspiration

### Partner Preferences
Each user specifies minimum acceptable scores for matches, enabling the matching algorithm to find compatible partners.

---

## 🔧 Customization

### Change Protected Users
Edit `cleanup_and_seed.py`:
```python
PROTECTED_USERS = ["admin", "user1", "user2", "user3"]
```

### Adjust Number of Users
Edit `seed_data_generator.py` `generate_all_users()`:
```python
# Generate 100 male users
for i in range(1, 101):
    users.append(generate_male_user(i))

# Generate 100 female users  
for i in range(1, 101):
    users.append(generate_female_user(i))
```

### Change Location Pool
Edit `USA_CITIES` list in `seed_data_generator.py`

### Modify Age Range
Edit `generate_male_user()` and `generate_female_user()`:
```python
age = random.randint(18, 45)  # Change range
```

---

## ⚠️ Important Notes

1. **Backup first**: Always backup your database before running cleanup
2. **Protected users**: Make sure protected usernames are correct
3. **Profile images**: Image paths are generated but files must exist:
   - `/uploads/profile_images/{username}_1.jpg`
   - `/uploads/profile_images/{username}_2.jpg`
4. **Password**: All seeded users have password `"password123"`
5. **Email verified**: All seeded users have `emailVerified: True`
6. **No conflicts**: Script checks for username conflicts before inserting

---

## 📝 Future Enhancements

Potential additions:
- Generate cross-references (favorites, profile views)
- Create message history between users
- Add PII access grants for testing
- Generate activity logs
- Create notification history
- Add profile verification badges
- Generate L3V3L match pairs

---

## 🐛 Troubleshooting

### "Database connection failed"
- Check MongoDB is running: `brew services list | grep mongodb`
- Verify `.env` file has correct `MONGODB_URL`

### "Username conflict"
- Protected users already exist, this is normal
- New users are checked for uniqueness

### "Collections not found"
- Some collections may not exist yet, this is OK
- Script handles missing collections gracefully

---

## 📧 Support

For issues or questions, contact the development team.

---

**Last Updated**: October 27, 2025
**Version**: 1.0.0
