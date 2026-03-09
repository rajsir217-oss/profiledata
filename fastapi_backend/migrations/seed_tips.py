"""Seed tips collection from existing HelpPage.js pro tips.
Usage: cd fastapi_backend && python3 migrations/seed_tips.py [--prod]
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
use_prod = "--prod" in sys.argv

if use_prod:
    load_dotenv(os.path.join(backend_dir, ".env.production"), override=True)
    local_env = {}
    with open(os.path.join(backend_dir, ".env")) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                local_env[k.strip()] = v.strip()
    if not os.getenv("ENCRYPTION_KEY"):
        os.environ["ENCRYPTION_KEY"] = local_env.get("ENCRYPTION_KEY", "")
    print("🔴 PRODUCTION MODE")
else:
    load_dotenv(os.path.join(backend_dir, ".env"))
    print("🟢 LOCAL MODE")

TIPS = [
    # Getting Started
    {"category": "getting-started", "icon": "🚀", "helpContext": "Getting Started",
     "tipText": "Complete your profile to increase visibility — profiles with more detail get better matches",
     "link": "/edit-profile", "linkText": "Edit Profile", "priority": 1},
    {"category": "getting-started", "icon": "📸", "helpContext": "Getting Started",
     "tipText": "Profiles with 3+ photos get 5x more views — add photos to stand out",
     "link": "/edit-profile", "linkText": "Add Photos", "priority": 2},
    {"category": "getting-started", "icon": "🔍", "helpContext": "Getting Started",
     "tipText": "Start your search broad (age + location) then narrow down with filters",
     "link": "/search", "linkText": "Search Now", "priority": 3},
    {"category": "getting-started", "icon": "⭐", "helpContext": "Getting Started",
     "tipText": "Use Favorite and Shortlist to organize profiles you're interested in",
     "link": "/dashboard", "linkText": "Dashboard", "priority": 4},

    # Dashboard
    {"category": "dashboard", "icon": "🎯", "helpContext": "Your Dashboard",
     "tipText": "Check your Dashboard daily to stay on top of new views and requests",
     "link": "/dashboard", "linkText": "Go to Dashboard", "priority": 1},
    {"category": "dashboard", "icon": "📬", "helpContext": "Your Dashboard",
     "tipText": "Respond to Contact Requests promptly — it shows you're active and increases engagement",
     "link": "/pii-management?tab=inbox", "linkText": "View Requests", "priority": 2},
    {"category": "dashboard", "icon": "🔄", "helpContext": "Your Dashboard",
     "tipText": "Use the refresh button to get the latest counts without reloading the entire page",
     "link": "/dashboard", "priority": 3},
    {"category": "dashboard", "icon": "📝", "helpContext": "Your Dashboard",
     "tipText": "Use Notes to remember important details about profiles you're interested in",
     "link": "/dashboard", "priority": 4},
    {"category": "dashboard", "icon": "⏰", "helpContext": "Your Dashboard",
     "tipText": "Favorites and Shortlists auto-expire after 45 days — take action on profiles you like!",
     "link": "/dashboard", "priority": 5},

    # Search
    {"category": "search", "icon": "🔍", "helpContext": "Search & Filters",
     "tipText": "If search results feel empty, loosen your filters first then narrow down",
     "link": "/search", "linkText": "Try Search", "priority": 1},
    {"category": "search", "icon": "🎚️", "helpContext": "Search & Filters",
     "tipText": "Use the L3V3L compatibility slider at 50-60% for more options, 70%+ for stronger matches",
     "link": "/search", "priority": 2},
    {"category": "search", "icon": "📍", "helpContext": "Search & Filters",
     "tipText": "Select multiple locations in the search filter to expand your search area",
     "link": "/search", "priority": 3},
    {"category": "search", "icon": "💾", "helpContext": "Search & Filters",
     "tipText": "Save your search criteria to get notified when new profiles match your preferences",
     "link": "/search", "priority": 4},

    # L3V3L Matching
    {"category": "l3v3l", "icon": "🦋", "helpContext": "L3V3L Matching",
     "tipText": "Try L3V3L Matches for AI-powered compatibility scoring based on your profile",
     "link": "/l3v3l-matches", "linkText": "Try L3V3L", "priority": 1},
    {"category": "l3v3l", "icon": "📊", "helpContext": "L3V3L Matching",
     "tipText": "A complete profile improves your L3V3L compatibility score accuracy",
     "link": "/edit-profile", "priority": 2},

    # Profile
    {"category": "profile", "icon": "👤", "helpContext": "Your Profile",
     "tipText": "Add your interests and hobbies — they help the matching algorithm find compatible profiles",
     "link": "/edit-profile", "priority": 1},
    {"category": "profile", "icon": "📏", "helpContext": "Your Profile",
     "tipText": "Fill out education and work details to show up in more specific searches",
     "link": "/edit-profile", "priority": 2},
    {"category": "profile", "icon": "✍️", "helpContext": "Your Profile",
     "tipText": "Write a genuine 'About Me' section — it's often the first thing people read",
     "link": "/edit-profile", "priority": 3},

    # Connections & Chat
    {"category": "connections", "icon": "💬", "helpContext": "Connections & Chat",
     "tipText": "Send a personalized first message — generic greetings get fewer responses",
     "link": "/messages", "priority": 1},
    {"category": "connections", "icon": "🤝", "helpContext": "Connections & Chat",
     "tipText": "Be respectful and patient in conversations — quality connections take time",
     "link": "/messages", "priority": 2},
    {"category": "connections", "icon": "📱", "helpContext": "Connections & Chat",
     "tipText": "Check your messages regularly — quick responses show genuine interest",
     "link": "/messages", "priority": 3},

    # Contact & Photo Access
    {"category": "contact-access", "icon": "🔐", "helpContext": "Contact & Photo Access",
     "tipText": "Start a conversation before requesting contact info — it builds trust",
     "link": "/messages", "priority": 1},
    {"category": "contact-access", "icon": "🔓", "helpContext": "Contact & Photo Access",
     "tipText": "PII access expires after a set period — use the information within the timeframe",
     "link": "/pii-management", "priority": 2},

    # Privacy & Safety
    {"category": "privacy", "icon": "🔒", "helpContext": "Privacy & Safety",
     "tipText": "Enable Multi-Factor Authentication (MFA) for extra account security",
     "link": "/preferences", "linkText": "Enable MFA", "priority": 1},
    {"category": "privacy", "icon": "🛡️", "helpContext": "Privacy & Safety",
     "tipText": "Your contact info is encrypted and only shared when you explicitly grant access",
     "link": "/preferences", "priority": 2},
    {"category": "privacy", "icon": "🙈", "helpContext": "Privacy & Safety",
     "tipText": "Use the Hide feature to remove profiles you're not interested in from your search results",
     "link": "/dashboard", "priority": 3},

    # Account Settings
    {"category": "account", "icon": "⚙️", "helpContext": "Account Settings",
     "tipText": "Customize your notification preferences to control what emails and alerts you receive",
     "link": "/preferences", "priority": 1},
    {"category": "account", "icon": "⏸️", "helpContext": "Account Settings",
     "tipText": "Need a break? Pause your account to hide your profile temporarily without losing data",
     "link": "/preferences", "priority": 2},

    # FAQ / General
    {"category": "faq", "icon": "❓", "helpContext": "FAQ",
     "tipText": "Visit the Help page for detailed guides on every feature of the platform",
     "link": "/help", "linkText": "View Help", "priority": 1},
    {"category": "faq", "icon": "📧", "helpContext": "FAQ",
     "tipText": "Having trouble? Use the Contact page to reach our support team",
     "link": "/contact", "priority": 2},
]


async def run():
    c = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = c["matrimonialDB"]

    # Check if tips already exist
    existing = await db.tips.count_documents({})
    if existing > 0:
        print(f"⚠️  Tips collection already has {existing} documents.")
        resp = input("Overwrite? (y/N): ").strip().lower()
        if resp != "y":
            print("Skipped.")
            c.close()
            return
        await db.tips.delete_many({})
        print(f"🗑️  Deleted {existing} existing tips.")

    now = datetime.utcnow()
    docs = []
    for tip in TIPS:
        doc = {
            **tip,
            "active": True,
            "showInTicker": True,
            "showInHelp": True,
            "createdBy": "system",
            "createdAt": now,
            "updatedAt": now,
        }
        docs.append(doc)

    result = await db.tips.insert_many(docs)
    print(f"✅ Seeded {len(result.inserted_ids)} tips into the tips collection.")
    c.close()


asyncio.run(run())
