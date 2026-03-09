"""Seed tips collection with rich HTML content from Help page subsections.
Each Help page subsection becomes a browsable tip in the Tip of the Day modal.
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

# ============================================================
# TIPS: Each Help page subsection as a rich HTML tip
# ============================================================

TIPS = [
    # ===== GETTING STARTED =====
    {"category": "getting-started", "icon": "🚀", "helpContext": "Getting Started",
     "tipText": "<h3>🚀 Welcome to L3V3L Matches!</h3><p>L3V3L Matches helps you discover compatible profiles, organize your shortlists, and chat — all in one place.</p><p>If you're new, don't worry. This guide is written for everyday users (no technical knowledge needed).</p>",
     "link": "/help", "linkText": "View Full Guide", "priority": 1},

    {"category": "getting-started", "icon": "📋", "helpContext": "Getting Started",
     "tipText": "<h3>📋 Quick Start (5 Steps)</h3><ol><li><strong>Create your account & verify your email</strong> — Check your inbox for a verification email.</li><li><strong>Complete your profile</strong> — Go to Edit Profile and fill out the key sections. More detail = better matching.</li><li><strong>Add photos</strong> — Photos increase trust and responses. You can keep them private too.</li><li><strong>Search for matches</strong> — Start broad (age + location + keyword), then refine.</li><li><strong>Organize and connect</strong> — Use Favorite, Shortlist, and Message to connect.</li></ol>",
     "link": "/edit-profile", "linkText": "Complete Your Profile", "priority": 2},

    # ===== DASHBOARD =====
    {"category": "dashboard", "icon": "🎯", "helpContext": "Your Dashboard",
     "tipText": "<h3>🎯 Dashboard Overview</h3><p>Your Dashboard is your home base — a quick snapshot of your activity, interactions, and things that need your attention. Everything you need is organized into easy-to-scan sections.</p>",
     "link": "/dashboard", "linkText": "Go to Dashboard", "priority": 1},

    {"category": "dashboard", "icon": "🔐", "helpContext": "Your Dashboard",
     "tipText": "<h3>🔐 MFA Security Banner</h3><p>At the top of your dashboard, you may see a security banner prompting you to enable Multi-Factor Authentication (MFA):</p><ul><li><strong>Why enable MFA?</strong> Adds an extra layer of security beyond your password</li><li><strong>How it works:</strong> After enabling, enter a code from your authenticator app when logging in</li><li><strong>Enable MFA button:</strong> Click to set up using Google Authenticator, Authy, etc.</li><li><strong>Dismiss (✕):</strong> Close temporarily — it will appear again next session</li></ul>",
     "link": "/preferences", "linkText": "Enable MFA", "priority": 2},

    {"category": "dashboard", "icon": "📸", "helpContext": "Your Dashboard",
     "tipText": "<h3>📸 Photo Upload Reminder</h3><p>If you haven't uploaded any photos yet, you'll see a reminder banner:</p><ul><li><strong>Why upload photos?</strong> Profiles with photos receive up to 10x more views and engagement</li><li><strong>Upload Photos button:</strong> Takes you directly to Edit Profile to add your photos</li><li><strong>Dismiss (✕):</strong> Close for this session — it will appear again if you still have no photos</li></ul>",
     "link": "/edit-profile", "linkText": "Upload Photos", "priority": 3},

    {"category": "dashboard", "icon": "⏸️", "helpContext": "Your Dashboard",
     "tipText": "<h3>⏸️ Pause Status Banner</h3><p>If your profile is paused (taking a break), you'll see a prominent banner:</p><ul><li><strong>What it shows:</strong> Confirms your profile is paused and hidden from searches</li><li><strong>Auto-unpause date:</strong> Shows when your profile will automatically reactivate</li><li><strong>Un-Pause Now button:</strong> Click to immediately reactivate your profile</li></ul>",
     "link": "/preferences", "priority": 4},

    {"category": "dashboard", "icon": "📊", "helpContext": "Your Dashboard",
     "tipText": "<h3>📊 Stats Overview Cards</h3><p>Five clickable stat cards showing your key metrics:</p><ul><li><strong>👁️ Profile Views:</strong> Total views + unique viewers. Click to see WHO viewed you</li><li><strong>💖 Favorited By:</strong> People who added you to favorites. Click to see admirers</li><li><strong>💬 Conversations:</strong> Active message threads. Click to see all conversations</li><li><strong>📷 Photo Requests:</strong> Your outgoing requests. Click to manage</li><li><strong>📥 Contact Requests:</strong> Incoming requests waiting for YOUR approval</li></ul><p><strong>Note:</strong> Contact Requests card glows when you have pending requests!</p>",
     "link": "/dashboard", "priority": 5},

    {"category": "dashboard", "icon": "📋", "helpContext": "Your Dashboard",
     "tipText": "<h3>📋 My Activities Column</h3><p>The left column shows YOUR activities and lists:</p><ul><li><strong>💬 Messages:</strong> Your conversations — click any card to open chat</li><li><strong>❤️ Favorites:</strong> Profiles you've favorited (auto-removed after 45 days)</li><li><strong>📋 Shortlists:</strong> Profiles you're seriously considering (auto-removed after 45 days)</li><li><strong>📸 Photo Requests:</strong> Your outgoing PII/photo access requests</li><li><strong>🙈 Hidden:</strong> Profiles you've hidden from searches</li></ul><p><strong>Drag & Drop:</strong> Drag profiles between Favorites, Shortlists, and Hidden to reorganize!</p>",
     "link": "/dashboard", "priority": 6},

    {"category": "dashboard", "icon": "👥", "helpContext": "Your Dashboard",
     "tipText": "<h3>👥 Others' Activities Column</h3><p>The right column shows how OTHERS interact with you:</p><ul><li><strong>👁️ Profile Views:</strong> Who viewed your profile and when</li><li><strong>📸 Photo Requests:</strong> Incoming access requests — approve or deny here</li><li><strong>❤️ Favorites:</strong> People who favorited YOUR profile (last 45 days)</li><li><strong>📋 Shortlists:</strong> People who shortlisted YOUR profile (last 45 days)</li></ul>",
     "link": "/dashboard", "priority": 7},

    {"category": "dashboard", "icon": "📝", "helpContext": "Your Dashboard",
     "tipText": "<h3>📝 Notes Feature</h3><p>Keep private notes about profiles you're interested in. Only you can see your notes.</p><ul><li><strong>How to add:</strong> Visit any profile → click the 📝 icon</li><li><strong>Where to find:</strong> Notes tab in My Activities on Dashboard</li><li><strong>Privacy:</strong> 100% private — the other person will never know</li></ul><p><strong>Use cases:</strong> Remember key details, track conversation topics, note your impressions.</p>",
     "link": "/dashboard", "priority": 8},

    {"category": "dashboard", "icon": "🙈", "helpContext": "Your Dashboard",
     "tipText": "<h3>🙈 Hide (Exclusion) Feature</h3><p>When you hide someone, a confirmation modal shows what will be removed:</p><ul><li><strong>Preview modal:</strong> Shows count of messages, favorites, shortlists to be deleted</li><li><strong>Search hiding:</strong> Hidden profile won't appear in your search results</li><li><strong>Undo:</strong> You can unhide someone to see them in searches again</li></ul>",
     "link": "/dashboard", "priority": 9},

    {"category": "dashboard", "icon": "🔔", "helpContext": "Your Dashboard",
     "tipText": "<h3>🔔 Notification Ticker</h3><p>The scrolling bar at the top shows recent activity:</p><ul><li><strong>Profile views:</strong> Shows who viewed you and when</li><li><strong>New matches:</strong> Profiles matching your saved searches</li><li><strong>Click to navigate:</strong> Click any notification to go to that profile</li><li><strong>Dismiss (✕):</strong> Click X to dismiss individual notifications</li><li><strong>Auto-scroll:</strong> Hover to pause scrolling</li></ul>",
     "link": "/dashboard", "priority": 10},

    {"category": "dashboard", "icon": "🎴", "helpContext": "Your Dashboard",
     "tipText": "<h3>🎴 User Cards & Kebab Menu</h3><p>Each profile card has a kebab menu (⋮) with quick actions:</p><ul><li><strong>👁️ View Profile:</strong> Open the full profile</li><li><strong>💬 Message:</strong> Start or continue a conversation</li><li><strong>❤️ Favorite:</strong> Toggle favorite status</li><li><strong>📋 Shortlist:</strong> Toggle shortlist status</li><li><strong>🔒 Request Access:</strong> Request photo or contact info</li><li><strong>🙈 Hide:</strong> Add to hidden profiles (with confirmation)</li></ul>",
     "link": "/dashboard", "priority": 11},

    # ===== SEARCH =====
    {"category": "search", "icon": "🔍", "helpContext": "Search & Filters",
     "tipText": "<h3>🔍 How Search Works</h3><p>Search shows you profiles that match your filters. Think of filters like a shopping checklist — the more you add, the fewer results you'll see.</p><p><strong>Start broad and narrow down as needed.</strong></p>",
     "link": "/search", "linkText": "Try Search", "priority": 1},

    {"category": "search", "icon": "🎯", "helpContext": "Search & Filters",
     "tipText": "<h3>🎯 Profile ID Search</h3><p>Know someone's exact Profile ID? Find them instantly:</p><ul><li>Enter the Profile ID (e.g., <code>STHa9Lor</code>) in the Profile ID field</li><li>Click Search — bypasses all other filters</li><li>Profile IDs are shown on each card and in the URL</li></ul>",
     "link": "/search", "priority": 2},

    {"category": "search", "icon": "🎚️", "helpContext": "Search & Filters",
     "tipText": "<h3>🎚️ L3V3L Compatibility Slider</h3><p>Filter matches by compatibility score:</p><ul><li><strong>0%</strong> — Show all profiles</li><li><strong>50-60%</strong> — Good starting point for more options</li><li><strong>70%+</strong> — Focus on stronger matches</li><li>Results update instantly as you move the slider</li></ul>",
     "link": "/search", "priority": 3},

    {"category": "search", "icon": "📝", "helpContext": "Search & Filters",
     "tipText": "<h3>📝 Basic Filters</h3><p>Always available at the top of search:</p><ul><li><strong>Keyword:</strong> Search bio, interests, occupation, education</li><li><strong>Location:</strong> Filter by city or state</li><li><strong>Age Range:</strong> Min and max age (19-100)</li><li><strong>Height Range:</strong> Min and max height</li><li><strong>Days Back:</strong> Only profiles created in last X days — great for new members!</li></ul>",
     "link": "/search", "priority": 4},

    {"category": "search", "icon": "⚙️", "helpContext": "Search & Filters",
     "tipText": "<h3>⚙️ Advanced Filters</h3><p>Click <strong>▼ View More</strong> to reveal:</p><ul><li><strong>Gender</strong></li><li><strong>Body Type</strong></li><li><strong>Occupation</strong></li><li><strong>Eating Preference:</strong> Vegetarian, non-veg, vegan, etc.</li><li><strong>Drinking:</strong> Never, socially, regularly</li><li><strong>Smoking:</strong> Never, occasionally, regularly</li></ul>",
     "link": "/search", "priority": 5},

    {"category": "search", "icon": "💾", "helpContext": "Search & Filters",
     "tipText": "<h3>💾 Saved Searches</h3><p>Save your favorite filter combinations:</p><ol><li>Set your desired filters</li><li>Click 💾 Save Search</li><li>Give it a name (e.g., \"Bay Area 25-30\")</li><li>Access saved searches from sidebar or search page</li><li>Get notified when new profiles match!</li></ol>",
     "link": "/search", "priority": 6},

    # ===== L3V3L =====
    {"category": "l3v3l", "icon": "🦋", "helpContext": "L3V3L Matching",
     "tipText": "<h3>🦋 What is L3V3L?</h3><p>L3V3L is our compatibility score. It summarizes how well two profiles align based on values, preferences, lifestyle, and more.</p>",
     "link": "/search", "linkText": "Try L3V3L", "priority": 1},

    {"category": "l3v3l", "icon": "📊", "helpContext": "L3V3L Matching",
     "tipText": "<h3>📊 L3V3L Score Breakdown</h3><ul><li><strong>85-100%</strong> — Excellent Match 💕 Very strong alignment</li><li><strong>70-84%</strong> — Great Match 💚 Strong compatibility</li><li><strong>50-69%</strong> — Good Match 👍 Worth exploring</li><li><strong>Below 50%</strong> — Lower alignment, but you can still connect</li></ul>",
     "link": "/search", "priority": 2},

    {"category": "l3v3l", "icon": "🔍", "helpContext": "L3V3L Matching",
     "tipText": "<h3>🔍 What the Score Looks At</h3><ul><li><strong>Demographics:</strong> Age, location, education, occupation</li><li><strong>Partner preferences:</strong> Whether you match each other's criteria</li><li><strong>Lifestyle:</strong> Day-to-day habits and preferences</li><li><strong>Values & personality:</strong> Based on profile and preference fields</li></ul><p><strong>Pro Tip:</strong> Use L3V3L to prioritize, then read the profile carefully. A great fit beats a number.</p>",
     "link": "/search", "priority": 3},

    # ===== PROFILE =====
    {"category": "profile", "icon": "👤", "helpContext": "Your Profile",
     "tipText": "<h3>👤 Why Your Profile Matters</h3><p>Your profile is what others use to decide whether to connect. The more complete and honest it is, the better your results.</p>",
     "link": "/edit-profile", "linkText": "Edit Profile", "priority": 1},

    {"category": "profile", "icon": "✏️", "helpContext": "Your Profile",
     "tipText": "<h3>✏️ Editing Your Profile</h3><ol><li><strong>Basic Information:</strong> Age, height, region — powers search filters</li><li><strong>About You:</strong> Write in simple, real language</li><li><strong>Education & Career:</strong> Background and occupation</li><li><strong>Background & Preferences:</strong> Values and expectations</li><li><strong>Lifestyle & Interests:</strong> Hobbies, eating preferences, habits</li><li><strong>Partner Preferences:</strong> Used heavily in matching — don't be too strict!</li></ol>",
     "link": "/edit-profile", "priority": 2},

    {"category": "profile", "icon": "📸", "helpContext": "Your Profile",
     "tipText": "<h3>📸 Photo Tips</h3><ul><li>Use clear, recent photos that look like you today</li><li>Avoid heavy filters (reduces trust)</li><li>If you prefer privacy, keep photos hidden and grant access later</li><li>Profiles with 3+ photos get 5x more views!</li></ul>",
     "link": "/edit-profile", "priority": 3},

    # ===== CONNECTIONS =====
    {"category": "connections", "icon": "💬", "helpContext": "Connections & Chat",
     "tipText": "<h3>💬 Ways to Connect</h3><ul><li><strong>Favorite:</strong> Save someone you like for quick access</li><li><strong>Shortlist:</strong> Your \"serious consideration\" list</li><li><strong>Message:</strong> Start a conversation in built-in chat</li></ul><p><strong>Chat features:</strong> Real-time messaging, conversation history, online indicators.</p>",
     "link": "/messages", "linkText": "Open Messages", "priority": 1},

    {"category": "connections", "icon": "📩", "helpContext": "Connections & Chat",
     "tipText": "<h3>📩 Messaging Workflow</h3><p><strong>Unattended messages must be addressed first.</strong> If you have unattended messages, reply before navigating elsewhere.</p><p><strong>Need to check a profile first?</strong></p><ol><li>Send a quick placeholder: \"I'll get back to you\"</li><li>Review their profile</li><li>Send your actual message</li></ol>",
     "link": "/messages", "priority": 2},

    {"category": "connections", "icon": "✋", "helpContext": "Connections & Chat",
     "tipText": "<h3>✋ \"Not Interested\" Button</h3><p>In the message screen, tap the hand icon to quickly decline:</p><ul><li>Automatically sends a polite decline message</li><li>Closes the message thread</li><li>Adds the profile to your hidden list</li></ul><p>This handles everything for you in one click!</p>",
     "link": "/messages", "priority": 3},

    {"category": "connections", "icon": "📋", "helpContext": "Connections & Chat",
     "tipText": "<h3>📋 Your Lists</h3><ul><li><strong>Favorites:</strong> Your saved profiles for quick access</li><li><strong>Shortlist:</strong> Your top candidates</li><li><strong>Hidden:</strong> Profiles you don't want to see again</li></ul><p>Manage all lists from your Dashboard.</p>",
     "link": "/dashboard", "priority": 4},

    # ===== CONTACT ACCESS =====
    {"category": "contact-access", "icon": "🔐", "helpContext": "Contact & Photo Access",
     "tipText": "<h3>🔐 Why Are Details Hidden?</h3><p>For privacy, sensitive details (contact info, private photos) are hidden by default. Access is shared only when the profile owner approves.</p>",
     "link": "/pii-management", "linkText": "Manage Access", "priority": 1},

    {"category": "contact-access", "icon": "📤", "helpContext": "Contact & Photo Access",
     "tipText": "<h3>📤 Requesting Access</h3><ol><li>Open the person's profile</li><li>Request the specific access you want (photos, LinkedIn, etc.)</li><li>Wait for approval (status: Pending → Approved)</li></ol><p>Once approved, view the info directly on their profile.</p>",
     "link": "/pii-management", "priority": 2},

    {"category": "contact-access", "icon": "📥", "helpContext": "Contact & Photo Access",
     "tipText": "<h3>📥 Approving Requests</h3><p>Go to <strong>PII Management</strong> to review:</p><ul><li><strong>Incoming:</strong> Requests you received — approve or reject</li><li><strong>Outgoing:</strong> Requests you sent — track status</li><li><strong>Received:</strong> Access granted to you</li><li><strong>Granted:</strong> Access you granted to others</li></ul>",
     "link": "/pii-management", "priority": 3},

    # ===== PRIVACY =====
    {"category": "privacy", "icon": "🔒", "helpContext": "Privacy & Safety",
     "tipText": "<h3>🔒 Your Privacy Matters</h3><ul><li>Share contact info only when you're ready (via request/approval)</li><li>Hide profiles you don't want to see again</li><li>Keep conversations inside the platform until trust is built</li></ul>",
     "link": "/preferences", "priority": 1},

    {"category": "privacy", "icon": "🛡️", "helpContext": "Privacy & Safety",
     "tipText": "<h3>🛡️ Safety Guidelines</h3><ul><li><strong>Don't share money or financial info</strong> — Never send money to someone you haven't met</li><li><strong>Meet in public first</strong> — Choose a safe, public place</li><li><strong>Trust your instincts</strong> — If something feels wrong, step back</li><li><strong>Move slowly</strong> — Verify details over time</li></ul>",
     "link": "/help", "priority": 2},

    {"category": "privacy", "icon": "🚩", "helpContext": "Privacy & Safety",
     "tipText": "<h3>🚩 Red Flags to Watch For</h3><ul><li>Requests for money or financial help</li><li>Pushing to move conversation off-platform immediately</li><li>Incomplete or vague profiles</li><li>Aggressive or inappropriate messages</li><li>Refusal to video chat or meet in person</li></ul><p><strong>⚠️ Never send money to someone you haven't met in person!</strong></p>",
     "link": "/help", "priority": 3},

    # ===== ACCOUNT =====
    {"category": "account", "icon": "⚙️", "helpContext": "Account Settings",
     "tipText": "<h3>⚙️ Account Management</h3><ul><li><strong>Password:</strong> Change from Preferences</li><li><strong>Notifications:</strong> Choose which updates you receive</li><li><strong>Pause account:</strong> Take a break without deleting your profile</li></ul>",
     "link": "/preferences", "linkText": "Open Settings", "priority": 1},

    {"category": "account", "icon": "🔔", "helpContext": "Account Settings",
     "tipText": "<h3>🔔 Notification Settings</h3><p>Control what you're notified about and by which channel:</p><ul><li>Messages</li><li>Requests for private access (photos/contact)</li><li>System announcements</li></ul>",
     "link": "/preferences", "priority": 2},

    {"category": "account", "icon": "⏸️", "helpContext": "Account Settings",
     "tipText": "<h3>⏸️ Pause Account (Taking a Break)</h3><p>Pausing hides you from search and stops interactions while keeping your profile saved.</p><ul><li>Hidden from searches while paused</li><li>Profile stays saved</li><li>You can still edit your profile</li></ul><p><strong>💡 Tip:</strong> If you stop seeing profiles or messages, check whether your account is paused.</p>",
     "link": "/preferences", "priority": 3},

    # ===== FAQ =====
    {"category": "faq", "icon": "❓", "helpContext": "FAQ",
     "tipText": "<h3>❓ Is L3V3L Matches free?</h3><p>Most core features are available to everyone. Some features may vary by account type.</p>",
     "priority": 1},

    {"category": "faq", "icon": "🦋", "helpContext": "FAQ",
     "tipText": "<h3>🦋 How does L3V3L matching work?</h3><p>It combines multiple parts of the profile (preferences + lifestyle + demographics + written profile info) into a single score (0–100%).</p>",
     "priority": 2},

    {"category": "faq", "icon": "🔍", "helpContext": "FAQ",
     "tipText": "<h3>🔍 Why can't I see certain profiles?</h3><p>Usually because filters are too strict, or the profile is paused/inactive. Try widening your filters.</p>",
     "priority": 3},

    {"category": "faq", "icon": "👁️", "helpContext": "FAQ",
     "tipText": "<h3>👁️ How do I get more profile views?</h3><p>Complete your profile, write a clear bio, add photos, and respond to messages. Consistency helps.</p>",
     "link": "/edit-profile", "priority": 4},

    {"category": "faq", "icon": "⏸️", "helpContext": "FAQ",
     "tipText": "<h3>⏸️ Can I hide my profile temporarily?</h3><p>Yes — use <strong>Pause Account</strong> in Preferences. Your data stays saved.</p>",
     "link": "/preferences", "priority": 5},

    {"category": "faq", "icon": "🔑", "helpContext": "FAQ",
     "tipText": "<h3>🔑 Forgot your password?</h3><p>Click \"Forgot Password\" on the login page. We'll send a reset link to your registered email.</p>",
     "link": "/forgot-password", "priority": 6},

    {"category": "faq", "icon": "📸", "helpContext": "FAQ",
     "tipText": "<h3>📸 Why can't I see photos or contact info?</h3><p>Some information is private by default. Request access, and the profile owner can approve it in PII Management.</p>",
     "link": "/pii-management", "priority": 7},

    {"category": "faq", "icon": "💾", "helpContext": "FAQ",
     "tipText": "<h3>💾 Can I save my search criteria?</h3><p>Yes! After setting filters, click \"Save Search\". Access saved searches anytime from the Saved tab.</p>",
     "link": "/search", "priority": 8},

    {"category": "faq", "icon": "📧", "helpContext": "FAQ",
     "tipText": "<h3>📧 Still need help?</h3><p>Email <strong>support@l3v3lmatches.com</strong> and include your username plus a short description of the issue.</p>",
     "link": "/contact", "linkText": "Contact Support", "priority": 9},
]


async def run():
    c = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = c["matrimonialDB"]

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
            "category": tip["category"],
            "icon": tip["icon"],
            "tipText": tip["tipText"],
            "helpContext": tip.get("helpContext", ""),
            "link": tip.get("link"),
            "linkText": tip.get("linkText"),
            "priority": tip.get("priority", 5),
            "active": True,
            "showInTicker": True,
            "showInHelp": True,
            "createdBy": "system",
            "createdAt": now,
            "updatedAt": now,
        }
        docs.append(doc)

    result = await db.tips.insert_many(docs)
    print(f"✅ Seeded {len(result.inserted_ids)} rich HTML tips into the tips collection.")

    # Summary by category
    from collections import Counter
    cats = Counter(t["category"] for t in TIPS)
    for cat, count in sorted(cats.items()):
        print(f"   {cat}: {count} tips")

    c.close()


asyncio.run(run())
