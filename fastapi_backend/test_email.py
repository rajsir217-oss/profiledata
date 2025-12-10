"""
Email Configuration Test Script
Tests SMTP connection and email sending
"""

import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

async def test_email_config():
    """Test email configuration and send a test email"""
    
    print("=" * 60)
    print("EMAIL CONFIGURATION TEST")
    print("=" * 60)
    
    # 1. Check configuration
    print("\n1. CHECKING CONFIGURATION:")
    print(f"   SMTP Host: {settings.smtp_host or '❌ NOT SET'}")
    print(f"   SMTP Port: {settings.smtp_port or '❌ NOT SET'}")
    print(f"   SMTP User: {settings.smtp_user or '❌ NOT SET'}")
    print(f"   SMTP Password: {'✓ SET' if settings.smtp_password else '❌ NOT SET'}")
    print(f"   From Email: {settings.from_email or '❌ NOT SET'}")
    print(f"   From Name: {settings.from_name}")
    
    if not all([settings.smtp_host, settings.smtp_port, settings.smtp_user, settings.smtp_password]):
        print("\n❌ SMTP configuration incomplete!")
        print("\nAdd these to your .env file:")
        print("   SMTP_HOST=smtp.gmail.com")
        print("   SMTP_PORT=587")
        print("   SMTP_USER=your-email@gmail.com")
        print("   SMTP_PASSWORD=your-app-password")
        print("   FROM_EMAIL=your-email@gmail.com")
        print("   FROM_NAME=L3V3L MATCHES")
        return False
    
    print("\n✓ Configuration looks complete")
    
    # 2. Test SMTP connection
    print("\n2. TESTING SMTP CONNECTION:")
    try:
        print(f"   Connecting to {settings.smtp_host}:{settings.smtp_port}...")
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
        print("   ✓ Connected")
        
        print("   Starting TLS...")
        server.starttls()
        print("   ✓ TLS started")
        
        print("   Logging in...")
        server.login(settings.smtp_user, settings.smtp_password)
        print("   ✓ Login successful")
        
        server.quit()
        print("\n✓ SMTP connection test PASSED")
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ Authentication FAILED: {e}")
        print("\nFor Gmail:")
        print("   1. Enable 2-factor authentication")
        print("   2. Generate an App Password:")
        print("      https://myaccount.google.com/apppasswords")
        print("   3. Use the App Password (not your regular password)")
        return False
    except Exception as e:
        print(f"\n❌ Connection FAILED: {e}")
        return False
    
    # 3. Send test email
    print("\n3. SENDING TEST EMAIL:")
    test_email = input("   Enter email to send test to (or press Enter to skip): ").strip()
    
    if not test_email:
        print("   Skipped")
        return True
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{settings.from_name} <{settings.from_email}>"
        msg['To'] = test_email
        msg['Subject'] = "L3V3L MATCHES - Email Test"
        
        html_body = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                         color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
                .success { color: #28a745; font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💜 L3V3L MATCHES</h1>
                </div>
                <div class="content">
                    <p class="success">✓ Email Configuration Working!</p>
                    <p>Your SMTP email configuration is working correctly.</p>
                    <p><strong>Configuration:</strong></p>
                    <ul>
                        <li>SMTP Host: """ + settings.smtp_host + """</li>
                        <li>SMTP Port: """ + str(settings.smtp_port) + """</li>
                        <li>From: """ + settings.from_email + """</li>
                    </ul>
                    <p>You can now send notification emails from your app!</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_body, 'html'))
        
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        
        print(f"\n✓ Test email sent to {test_email}")
        print("   Check your inbox!")
        
    except Exception as e:
        print(f"\n❌ Failed to send test email: {e}")
        return False
    
    return True


async def check_notification_system():
    """Check notification system setup"""
    from database import get_database
    
    print("\n" + "=" * 60)
    print("NOTIFICATION SYSTEM CHECK")
    print("=" * 60)
    
    db = await get_database()
    
    # Check notification queue
    queue_count = await db.notification_queue.count_documents({
        "channels": "email",
        "status": "pending"
    })
    print(f"\n✓ Pending email notifications: {queue_count}")
    
    # Check templates
    template_count = await db.notification_templates.count_documents({
        "channel": "email",
        "active": True
    })
    print(f"✓ Active email templates: {template_count}")
    
    # Check if email job exists
    email_job = await db.dynamic_jobs.find_one({"template": "email_notifier"})
    if email_job:
        print(f"✓ Email notifier job: {'ENABLED' if email_job.get('enabled') else 'DISABLED'}")
        print(f"  Schedule: {email_job.get('schedule')}")
        print(f"  Next run: {email_job.get('nextRunAt')}")
    else:
        print("⚠ Email notifier job not created yet")
        print("  Create it in Dynamic Scheduler UI")


if __name__ == "__main__":
    print("\n🔧 L3V3L Email System Troubleshooting\n")
    
    # Run tests
    success = asyncio.run(test_email_config())
    
    if success:
        # Check notification system
        try:
            asyncio.run(check_notification_system())
        except Exception as e:
            print(f"\n⚠ Could not check notification system: {e}")
    
    print("\n" + "=" * 60)
    if success:
        print("✓ ALL TESTS PASSED - Email system is ready!")
    else:
        print("❌ TESTS FAILED - Fix configuration and try again")
    print("=" * 60 + "\n")
