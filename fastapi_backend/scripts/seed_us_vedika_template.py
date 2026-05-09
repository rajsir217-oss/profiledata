"""
Seed/upsert the 'us_vedika_message' notification template for external email
invitations from the US Vedika public group chat.

Run once:
    cd fastapi_backend
    ./venv/bin/python scripts/seed_us_vedika_template.py
"""
import asyncio
import os
import sys
from datetime import datetime

# Allow running as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


SUBJECT = "💬 {senderName} sent you a message on US Vedika"

BODY = """
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; background:#f4f4f7; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .card { background: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
  .logo-container { text-align: center; padding: 22px 0 8px 0; background: #ffffff; }
  .logo-container .brand { font-size: 30px; font-weight: bold; color: #667eea; letter-spacing: 1px; }
  .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #fff; padding: 24px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; }
  .header .flag { font-size: 28px; }
  .content { padding: 28px; }
  .message-box { background: #f9fafb; border-left: 4px solid #2563eb; padding: 16px 18px; border-radius: 6px; margin: 18px 0; white-space: pre-wrap; }
  .button { display: inline-block; background: #2563eb; color: #fff !important; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: 600; }
  .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff !important; padding: 14px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
  .invitation { background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 1px solid #c7d2fe; padding: 22px; border-radius: 10px; margin-top: 24px; }
  .invitation h3 { margin-top: 0; color: #4c1d95; font-size: 19px; }
  .invitation-link-box { background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 16px; margin: 16px 0 10px; }
  .invitation-link-label { display: block; font-size: 13px; font-weight: 600; color: #667eea; margin-bottom: 8px; }
  .invitation-link { font-size: 12px; line-height: 1.6; word-break: break-all; color: #333; font-family: 'Courier New', monospace; }
  .features { background: #ffffff; padding: 18px 22px; border-radius: 8px; margin: 18px 0 10px; border: 1px solid #e0e7ff; }
  .features h4 { color: #667eea; margin: 0 0 10px 0; font-size: 16px; }
  .feature-list { list-style: none; padding: 0; margin: 0; }
  .feature-list li { padding: 6px 0; padding-left: 24px; position: relative; font-size: 14px; color: #444; }
  .feature-list li:before { content: "✓"; position: absolute; left: 0; color: #16a34a; font-weight: bold; }
  .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 18px; }
  .footer a { color: #2563eb; text-decoration: none; }
  .footer .brand-line { font-weight: 600; color: #667eea; margin-bottom: 6px; font-size: 13px; }
</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="brand">🦋 L3V3L</div>
      </div>
      <div class="header">
        <div class="flag">🇺🇸</div>
        <h1>Message from {senderName}</h1>
        <div style="opacity:0.9; font-size:13px; margin-top:4px;">via US Vedika Group Chat</div>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p><strong>{senderName}</strong> sent you a message in the <strong>US Vedika</strong> community chat:</p>
        <div class="message-box">{messageContent}</div>

        <p style="text-align:center; margin: 24px 0;">
          <a href="{replyUrl}" class="button">Reply to this message</a>
        </p>

        {% if includeInvitation %}
        <div class="invitation">
          <h3>🎉 You're invited to join L3V3L MATCHES!</h3>
          <p style="margin: 8px 0; color:#444;">L3V3L MATCHES is a premium matrimonial platform connecting like-minded people. Create your free profile to participate fully in US Vedika and other groups.</p>

          <p style="text-align:center; margin: 18px 0;">
            <a href="{registerUrl}" class="cta-button">Create Your Profile →</a>
          </p>

          <div class="invitation-link-box">
            <span class="invitation-link-label">Or copy this invitation link:</span>
            <div class="invitation-link">{registerUrl}</div>
          </div>

          <div class="features">
            <h4>Why Join L3V3L MATCHES?</h4>
            <ul class="feature-list">
              <li>Advanced L3V3L matching algorithm for compatibility</li>
              <li>Privacy-first approach with controlled information sharing</li>
              <li>Verified profiles for authentic connections</li>
              <li>Smart preferences and detailed partner criteria</li>
              <li>Secure messaging and communication</li>
              <li>Professional and serious community</li>
            </ul>
          </div>

          <p style="font-size: 13px; color: #666; margin: 12px 0 0 0;">
            <strong>Note:</strong> This invitation link is valid for 30 days. If you have any questions, feel free to reply to this email.
          </p>
        </div>
        {% endif %}

        <p style="color:#6b7280; font-size:12px; margin-top:24px;">
          You received this email because {senderName} mentioned your address in a US Vedika group message.
          The reply link above expires in 7 days.
        </p>
      </div>
    </div>
    <div class="footer">
      <p class="brand-line">🦋 L3V3L MATCHES — Premium Matrimonial Platform</p>
      <p>US Vedika • <a href="{frontendUrl}">{frontendUrl}</a></p>
      <p style="margin-top: 14px; font-size: 11px; color: #999;">
        This invitation was sent by the L3V3L MATCHES team. If you believe this was sent in error,
        please ignore this email or contact support.
      </p>
    </div>
  </div>
</body>
</html>
"""


async def main():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    now = datetime.utcnow()
    doc = {
        "trigger": "us_vedika_message",
        "channel": "email",
        "category": "messaging",
        "subject": SUBJECT,
        "body": BODY,
        "priority": "medium",
        "enabled": True,
        "active": True,
        "updatedAt": now,
    }

    result = await db.notification_templates.update_one(
        {"trigger": "us_vedika_message", "channel": "email"},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True,
    )

    if result.upserted_id:
        print(f"✅ Created template us_vedika_message (id={result.upserted_id})")
    else:
        print(f"✅ Updated existing us_vedika_message template (matched={result.matched_count})")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
