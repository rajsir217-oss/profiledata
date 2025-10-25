#!/usr/bin/env python3
"""
Seed Cloud MongoDB with Users, Templates, and Jobs
Run this after deploying to Cloud Run to populate MongoDB Atlas
"""

import sys
from pymongo import MongoClient
from datetime import datetime, timezone
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_database(mongodb_url):
    """Seed MongoDB Atlas with all necessary data"""
    
    print("🌱 Seeding Cloud MongoDB...")
    print("=" * 70)
    
    try:
        # Connect to MongoDB Atlas with SSL configuration
        # Use tlsAllowInvalidCertificates for development/testing
        # For production, ensure proper SSL certificates are installed
        client = MongoClient(
            mongodb_url,
            tlsAllowInvalidCertificates=True,  # Bypass SSL cert verification
            serverSelectionTimeoutMS=10000
        )
        db = client.matrimonialDB
        
        # Test connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas")
        print()
        
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        print("\n💡 Make sure:")
        print("   1. Your MongoDB Atlas connection string is correct")
        print("   2. Network Access is configured (0.0.0.0/0)")
        print("   3. Database user has read/write permissions")
        sys.exit(1)
    
    # ========================================================================
    # USERS
    # ========================================================================
    
    print("👥 Creating Users...")
    print("-" * 70)
    
    users = [
        {
            "username": "admin",
            "password": pwd_context.hash("admin123"),
            "email": "admin@l3v3l.com",
            "contactEmail": "admin@l3v3l.com",
            "role_name": "admin",
            "status": {"status": "active"},
            "firstName": "Admin",
            "lastName": "User",
            "age": 30,
            "gender": "Male",
            "location": "System",
            "profession": "Administrator",
            "createdAt": datetime.now(timezone.utc),
            "themePreference": "light-blue"
        },
        {
            "username": "testuser1",
            "password": pwd_context.hash("test123"),
            "email": "test1@l3v3l.com",
            "contactEmail": "test1@l3v3l.com",
            "role_name": "free_user",
            "status": {"status": "active"},
            "firstName": "Sarah",
            "lastName": "Johnson",
            "age": 27,
            "gender": "Female",
            "location": "Boston",
            "profession": "Software Engineer",
            "education": "Bachelor's Degree",
            "bio": "Love traveling and trying new restaurants!",
            "createdAt": datetime.now(timezone.utc),
            "themePreference": "light-pink"
        },
        {
            "username": "testuser2",
            "password": pwd_context.hash("test123"),
            "email": "test2@l3v3l.com",
            "contactEmail": "test2@l3v3l.com",
            "role_name": "free_user",
            "status": {"status": "active"},
            "firstName": "Michael",
            "lastName": "Chen",
            "age": 30,
            "gender": "Male",
            "location": "San Francisco",
            "profession": "Product Manager",
            "education": "Master's Degree",
            "bio": "Passionate about technology and outdoor adventures.",
            "createdAt": datetime.now(timezone.utc),
            "themePreference": "dark"
        },
        {
            "username": "testuser3",
            "password": pwd_context.hash("test123"),
            "email": "test3@l3v3l.com",
            "contactEmail": "test3@l3v3l.com",
            "role_name": "free_user",
            "status": {"status": "active"},
            "firstName": "Emily",
            "lastName": "Martinez",
            "age": 26,
            "gender": "Female",
            "location": "Austin",
            "profession": "UX Designer",
            "education": "Bachelor's Degree",
            "bio": "Creative mind with a love for art and music.",
            "createdAt": datetime.now(timezone.utc),
            "themePreference": "light-blue"
        },
        {
            "username": "testuser4",
            "password": pwd_context.hash("test123"),
            "email": "test4@l3v3l.com",
            "contactEmail": "test4@l3v3l.com",
            "role_name": "free_user",
            "status": {"status": "active"},
            "firstName": "David",
            "lastName": "Kumar",
            "age": 32,
            "gender": "Male",
            "location": "Seattle",
            "profession": "Data Scientist",
            "education": "PhD",
            "bio": "Coffee enthusiast and weekend hiker.",
            "createdAt": datetime.now(timezone.utc),
            "themePreference": "dark"
        }
    ]
    
    # Clear existing users (optional - comment out to keep existing users)
    # db.users.delete_many({})
    
    for user in users:
        result = db.users.update_one(
            {"username": user["username"]},
            {"$set": user},
            upsert=True
        )
        status = "created" if result.upserted_id else "updated"
        print(f"  ✅ {user['username']:15} ({user['firstName']:10}) - {status}")
    
    print(f"\n📊 Total users: {db.users.count_documents({})}")
    print()
    
    # ========================================================================
    # NOTIFICATION TEMPLATES
    # ========================================================================
    
    print("📧 Creating Notification Templates...")
    print("-" * 70)
    
    templates = [
        {
            "trigger": "new_match",
            "channel": "email",
            "category": "Match",
            "subject": "You have a new match!",
            "body": "Hi {recipient.firstName},\n\nGreat news! You have a new match with {match.firstName}, {match.age} from {match.location}.\n\nMatch Score: {match.matchScore}%\n\nView their profile: {app.profileUrl}\n\nHappy matching!",
            "active": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        },
        {
            "trigger": "profile_view",
            "channel": "email",
            "category": "Activity",
            "subject": "Someone viewed your profile!",
            "body": "Hi {recipient.firstName},\n\n{match.firstName} from {match.location} viewed your profile!\n\nCheck out who is interested: {app.profileUrl}",
            "active": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        },
        {
            "trigger": "new_message",
            "channel": "email",
            "category": "Messages",
            "subject": "New message from {match.firstName}",
            "body": "Hi {recipient.firstName},\n\nYou have a new message from {match.firstName}!\n\nRead and reply: {app.chatUrl}",
            "active": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        },
        {
            "trigger": "pii_request",
            "channel": "email",
            "category": "PII",
            "subject": "PII Access Request from {match.firstName}",
            "body": "Hi {recipient.firstName},\n\n{match.firstName} has requested access to your personal contact information.\n\nView request: {app.profileUrl}",
            "active": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        },
        {
            "trigger": "pii_granted",
            "channel": "email",
            "category": "PII",
            "subject": "{match.firstName} granted you access!",
            "body": "Hi {recipient.firstName},\n\nGood news! {match.firstName} has granted you access to their contact information.\n\nView details: {app.profileUrl}",
            "active": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        },
        {
            "trigger": "weekly_digest",
            "channel": "email",
            "category": "Engagement",
            "subject": "Your Weekly L3V3L Match Summary",
            "body": "Hi {recipient.firstName},\n\nHere is your weekly summary:\n\n📊 This Week:\n- New Matches: {stats.newMatches}\n- Profile Views: {stats.profileViews}\n- Messages Received: {stats.unreadMessages}\n\nView Dashboard: {app.profileUrl}\n\nStay active to find your perfect match!",
            "active": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
    ]
    
    # Clear existing templates
    db.notification_templates.delete_many({})
    
    for template in templates:
        result = db.notification_templates.insert_one(template)
        print(f"  ✅ {template['trigger']:20} ({template['category']:12}) - {template['subject'][:40]}")
    
    print(f"\n📊 Total templates: {db.notification_templates.count_documents({})}")
    print()
    
    # ========================================================================
    # DYNAMIC SCHEDULER JOBS
    # ========================================================================
    
    print("⚙️  Creating Dynamic Scheduler Jobs...")
    print("-" * 70)
    
    jobs = [
        {
            "name": "Email Notifications",
            "description": "Send pending email notifications in batches",
            "template_type": "email_notifier",
            "schedule_type": "interval",
            "interval_seconds": 300,
            "enabled": True,
            "parameters": {"batch_size": 100, "retry_failed": True},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "lastRun": None,
            "nextRun": datetime.now(timezone.utc)
        },
        {
            "name": "SMS Notifications",
            "description": "Send pending SMS notifications with cost optimization",
            "template_type": "sms_notifier",
            "schedule_type": "interval",
            "interval_seconds": 600,
            "enabled": True,
            "parameters": {"batch_size": 50, "daily_limit_usd": 100},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "lastRun": None,
            "nextRun": datetime.now(timezone.utc)
        },
        {
            "name": "Database Cleanup",
            "description": "Clean up expired sessions and temporary data",
            "template_type": "database_cleanup",
            "schedule_type": "interval",
            "interval_seconds": 3600,
            "enabled": True,
            "parameters": {"session_expiry_hours": 24, "temp_file_expiry_days": 7},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "lastRun": None,
            "nextRun": datetime.now(timezone.utc)
        },
        {
            "name": "Message Stats Sync",
            "description": "Sync message statistics from Redis to MongoDB",
            "template_type": "message_stats_sync",
            "schedule_type": "interval",
            "interval_seconds": 1800,
            "enabled": True,
            "parameters": {},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "lastRun": None,
            "nextRun": datetime.now(timezone.utc)
        },
        {
            "name": "Weekly Digest Emails",
            "description": "Send weekly summary emails to all active users",
            "template_type": "weekly_digest_notifier",
            "schedule_type": "cron",
            "cron_expression": "0 9 * * 1",
            "enabled": True,
            "parameters": {"send_to": "all_active_users", "max_batch_size": 500},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "lastRun": None,
            "nextRun": datetime.now(timezone.utc)
        }
    ]
    
    # Clear existing jobs
    db.dynamic_jobs.delete_many({})
    
    for job in jobs:
        result = db.dynamic_jobs.insert_one(job)
        schedule = f"{job.get('interval_seconds', 'N/A')}s" if job['schedule_type'] == 'interval' else job.get('cron_expression', 'N/A')
        print(f"  ✅ {job['name']:25} ({job['template_type']:25}) - {schedule}")
    
    print(f"\n📊 Total jobs: {db.dynamic_jobs.count_documents({})}")
    print()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    
    print("=" * 70)
    print("✅ Database Seeding Complete!")
    print("=" * 70)
    print()
    print("📊 Summary:")
    print(f"   Users:                  {db.users.count_documents({})}")
    print(f"   Notification Templates: {db.notification_templates.count_documents({})}")
    print(f"   Dynamic Scheduler Jobs: {db.dynamic_jobs.count_documents({})}")
    print()
    print("🔐 Test Credentials:")
    print("   Admin:     username=admin,      password=admin123")
    print("   Test User: username=testuser1,  password=test123")
    print("   Test User: username=testuser2,  password=test123")
    print("   Test User: username=testuser3,  password=test123")
    print("   Test User: username=testuser4,  password=test123")
    print()
    print("🎉 Your cloud database is ready!")
    print("=" * 70)
    
    client.close()


if __name__ == "__main__":
    print()
    print("🌱 MongoDB Atlas Database Seeding Tool")
    print("=" * 70)
    print()
    
    # Get MongoDB URL from command line or prompt
    if len(sys.argv) > 1:
        mongodb_url = sys.argv[1]
    else:
        print("Enter your MongoDB Atlas connection string:")
        print("(Format: mongodb+srv://username:password@cluster.mongodb.net/matrimonialDB)")
        print()
        mongodb_url = input("MongoDB URL: ").strip()
    
    if not mongodb_url:
        print("❌ Error: MongoDB URL is required")
        sys.exit(1)
    
    if not mongodb_url.startswith(('mongodb://', 'mongodb+srv://')):
        print("❌ Error: Invalid MongoDB URL format")
        print("   Should start with 'mongodb://' or 'mongodb+srv://'")
        sys.exit(1)
    
    print()
    seed_database(mongodb_url)
