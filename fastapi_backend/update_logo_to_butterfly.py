"""
Update logo in email templates to butterfly + L3V3L text
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

async def update_logos():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Find templates without butterfly
    templates = await db.notification_templates.find({
        "channel": "email",
        "body": {"$not": {"$regex": "🦋"}}
    }).to_list(100)
    
    print(f"Found {len(templates)} templates to update")
    
    for template in templates:
        body = template["body"]
        
        # If template already has logo image tag, replace it
        if '<img src="{app.logoUrl}"' in body:
            new_body = body.replace(
                '<img src="{app.logoUrl}" alt="L3V3L" />',
                '<div style="font-size: 32px; font-weight: bold; color: #667eea;">🦋 L3V3L</div>'
            )
        # If template doesn't have logo section, add it after <body>
        elif '<body>' in body and 'logo-container' not in body:
            logo_html = '''
    <div class="logo-container" style="text-align: center; padding: 20px 0;">
        <div style="font-size: 32px; font-weight: bold; color: #667eea;">🦋 L3V3L</div>
    </div>'''
            new_body = body.replace(
                '<body>\n    <div class="container">',
                '<body>\n    <div class="container">' + logo_html
            )
        else:
            print(f"⏭️  Skipped: {template['trigger']} (no suitable insertion point)")
            continue
        
        await db.notification_templates.update_one(
            {"_id": template["_id"]},
            {"$set": {"body": new_body}}
        )
        print(f"✅ Updated: {template['trigger']}")
    
    # Verify all have butterfly now
    total = await db.notification_templates.count_documents({
        "channel": "email",
        "body": {"$regex": "🦋"}
    })
    
    print(f"\n🎉 Done! {total}/20 templates now have 🦋 L3V3L")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_logos())
