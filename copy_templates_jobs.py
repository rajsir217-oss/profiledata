#!/usr/bin/env python3
"""
Copy notification templates and dynamic scheduler jobs to Docker MongoDB
Run this to seed the database with default templates and jobs
"""

from pymongo import MongoClient
from datetime import datetime

# Connect to Docker MongoDB
client = MongoClient("mongodb://localhost:27017")
db = client.matrimonialDB

print("🔄 Copying notification templates and jobs to MongoDB...")
print("=" * 60)

# ============================================================================
# NOTIFICATION TEMPLATES
# ============================================================================

templates = [
    {
        "trigger": "new_match",
        "channel": "email",
        "category": "Match",
        "subject": "You have a new match!",
        "body": """Hi {recipient.firstName},

Great news! You have a new match with {match.firstName}, {match.age} from {match.location}.

Match Score: {match.matchScore}%

{match.firstName} is a {match.occupation} with {match.education}.

View their profile: {app.profileUrl}
Start a conversation: {app.chatUrl}

Happy matching!
""",
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    {
        "trigger": "profile_view",
        "channel": "email",
        "category": "Activity",
        "subject": "Someone viewed your profile!",
        "body": """Hi {recipient.firstName},

{match.firstName} from {match.location} viewed your profile!

Check out who's interested: {app.profileUrl}

Keep your profile updated to get more views!
""",
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    {
        "trigger": "new_message",
        "channel": "email",
        "category": "Messages",
        "subject": "New message from {match.firstName}",
        "body": """Hi {recipient.firstName},

You have a new message from {match.firstName}!

Read and reply: {app.chatUrl}

Don't keep them waiting!
""",
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    {
        "trigger": "pii_request",
        "channel": "email",
        "category": "PII",
        "subject": "PII Access Request from {match.firstName}",
        "body": """Hi {recipient.firstName},

{match.firstName} has requested access to your personal contact information.

View request and respond: {app.profileUrl}

You can approve or deny this request.
""",
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    {
        "trigger": "pii_granted",
        "channel": "email",
        "category": "PII",
        "subject": "{match.firstName} granted you access!",
        "body": """Hi {recipient.firstName},

Good news! {match.firstName} has granted you access to their contact information.

View details: {app.profileUrl}

Remember to respect their privacy!
""",
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
]

# Clear existing templates
db.notification_templates.delete_many({})

# Insert templates
for template in templates:
    result = db.notification_templates.insert_one(template)
    print(f"✅ Created template: {template['trigger']} ({template['channel']})")

print(f"\n📧 Total templates created: {len(templates)}")

# ============================================================================
# DYNAMIC SCHEDULER JOBS
# ============================================================================

jobs = [
    {
        "name": "Email Notifications",
        "description": "Send pending email notifications in batches",
        "template_type": "email_notifier",
        "schedule_type": "interval",
        "interval_seconds": 300,  # Every 5 minutes
        "enabled": True,
        "parameters": {
            "batch_size": 100,
            "retry_failed": True
        },
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastRun": None,
        "nextRun": datetime.utcnow()
    },
    {
        "name": "SMS Notifications",
        "description": "Send pending SMS notifications with cost optimization",
        "template_type": "sms_notifier",
        "schedule_type": "interval",
        "interval_seconds": 600,  # Every 10 minutes
        "enabled": True,
        "parameters": {
            "batch_size": 50,
            "daily_limit_usd": 100
        },
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastRun": None,
        "nextRun": datetime.utcnow()
    },
    {
        "name": "Database Cleanup",
        "description": "Clean up expired sessions and temporary data",
        "template_type": "database_cleanup",
        "schedule_type": "interval",
        "interval_seconds": 3600,  # Every hour
        "enabled": True,
        "parameters": {
            "session_expiry_hours": 24,
            "temp_file_expiry_days": 7
        },
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastRun": None,
        "nextRun": datetime.utcnow()
    },
    {
        "name": "Message Stats Sync",
        "description": "Sync message statistics from Redis to MongoDB",
        "template_type": "message_stats_sync",
        "schedule_type": "interval",
        "interval_seconds": 1800,  # Every 30 minutes
        "enabled": True,
        "parameters": {},
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastRun": None,
        "nextRun": datetime.utcnow()
    }
]

# Clear existing jobs
db.dynamic_jobs.delete_many({})

# Insert jobs
for job in jobs:
    result = db.dynamic_jobs.insert_one(job)
    print(f"✅ Created job: {job['name']}")

print(f"\n⚙️ Total jobs created: {len(jobs)}")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "=" * 60)
print("✅ Database seeding complete!")
print(f"   Notification Templates: {db.notification_templates.count_documents({})}")
print(f"   Dynamic Scheduler Jobs: {db.dynamic_jobs.count_documents({})}")
print("=" * 60)

client.close()
