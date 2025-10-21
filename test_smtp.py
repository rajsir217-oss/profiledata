"""
SMTP Configuration Test
Tests SMTP connection and email sending
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sys

# Import config
try:
    from fastapi_backend.config import settings
    print("✅ Successfully imported config")
except ImportError:
    print("❌ Failed to import config")
    sys.exit(1)

print("\n📋 SMTP Configuration:")
print(f"   SMTP Host: {settings.smtp_host}")
print(f"   SMTP Port: {settings.smtp_port}")
print(f"   SMTP User: {settings.smtp_user}")
print(f"   SMTP Password: {'*' * len(settings.smtp_password) if settings.smtp_password else 'NOT SET'}")
print(f"   From Email: {settings.from_email}")
print(f"   From Name: {settings.from_name}")

# Check if credentials are set
if not settings.smtp_user or not settings.smtp_password:
    print("\n❌ ERROR: SMTP credentials not configured in .env file")
    print("   Please add SMTP_USER and SMTP_PASSWORD to /fastapi_backend/.env")
    sys.exit(1)

print("\n🔌 Testing SMTP Connection...")

try:
    # Create SMTP connection
    server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
    server.set_debuglevel(1)  # Show detailed debug info
    
    print("✅ Connected to SMTP server")
    
    # Start TLS
    server.starttls()
    print("✅ Started TLS encryption")
    
    # Login
    server.login(settings.smtp_user, settings.smtp_password)
    print("✅ Successfully authenticated with SMTP server")
    
    # Create test email
    msg = MIMEMultipart('alternative')
    msg['Subject'] = "L3V3L Notification Test"
    msg['From'] = f"{settings.from_name} <{settings.from_email}>"
    msg['To'] = settings.smtp_user  # Send to yourself
    
    # Email body
    text = "This is a test email from L3V3L Dating notification system."
    html = """
    <html>
      <body>
        <h2>🎉 L3V3L Notification Test</h2>
        <p>This is a test email from the L3V3L Dating notification system.</p>
        <p><strong>If you received this, your SMTP configuration is working correctly!</strong></p>
        <hr>
        <small>Sent from L3V3L Notification System</small>
      </body>
    </html>
    """
    
    part1 = MIMEText(text, 'plain')
    part2 = MIMEText(html, 'html')
    msg.attach(part1)
    msg.attach(part2)
    
    # Send email
    print(f"\n📧 Sending test email to {settings.smtp_user}...")
    server.send_message(msg)
    print("✅ Test email sent successfully!")
    
    # Close connection
    server.quit()
    print("✅ SMTP connection closed")
    
    print("\n" + "="*60)
    print("🎉 SMTP TEST PASSED!")
    print("="*60)
    print("\n✅ Configuration is correct and working")
    print(f"✅ Check your inbox at {settings.smtp_user}")
    print("✅ The notification system should work now")
    
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ AUTHENTICATION ERROR: {e}")
    print("\n💡 Possible solutions:")
    print("   1. Check that SMTP_USER and SMTP_PASSWORD are correct in .env")
    print("   2. For Gmail, you need an 'App Password', not your regular password")
    print("   3. Enable 'Less secure app access' or use App Passwords")
    print("   4. Visit: https://myaccount.google.com/apppasswords")
    sys.exit(1)
    
except smtplib.SMTPException as e:
    print(f"\n❌ SMTP ERROR: {e}")
    sys.exit(1)
    
except Exception as e:
    print(f"\n❌ UNEXPECTED ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
