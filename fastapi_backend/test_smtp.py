#!/usr/bin/env python3
"""
Test SMTP email sending with Gmail
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Gmail SMTP settings
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "rajl3v3l@gmail.com"
SMTP_PASSWORD = "anypnmtpkxcqvboz"  # App password without spaces
FROM_EMAIL = "rajl3v3l@gmail.com"
FROM_NAME = "L3V3L Dating"
TO_EMAIL = "rsiripuram04@gmail.com"

def test_smtp():
    """Test SMTP connection and send test email"""
    try:
        print("🔧 Testing SMTP Configuration...")
        print(f"   Host: {SMTP_HOST}")
        print(f"   Port: {SMTP_PORT}")
        print(f"   User: {SMTP_USER}")
        print(f"   Password: {'*' * len(SMTP_PASSWORD)}")
        print()
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg['To'] = TO_EMAIL
        msg['Subject'] = "Test Email - SMTP Verification"
        
        # HTML content
        html_content = """
        <html>
        <body>
            <h2>SMTP Test Successful!</h2>
            <p>If you're reading this, the SMTP configuration is working correctly.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
                <li>SMTP Host: smtp.gmail.com</li>
                <li>SMTP Port: 587</li>
                <li>From: noreply@l3v3l.com</li>
            </ul>
        </body>
        </html>
        """
        
        # Plain text content
        text_content = """
        SMTP Test Successful!
        
        If you're reading this, the SMTP configuration is working correctly.
        
        Configuration:
        - SMTP Host: smtp.gmail.com
        - SMTP Port: 587
        - From: noreply@l3v3l.com
        """
        
        # Attach both parts
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        print("📧 Connecting to SMTP server...")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            print("✅ Connected!")
            
            print("🔐 Starting TLS...")
            server.starttls()
            print("✅ TLS enabled!")
            
            print(f"🔑 Logging in as {SMTP_USER}...")
            server.login(SMTP_USER, SMTP_PASSWORD)
            print("✅ Login successful!")
            
            print(f"📤 Sending test email to {TO_EMAIL}...")
            server.send_message(msg)
            print("✅ Email sent successfully!")
        
        print()
        print("=" * 50)
        print("🎉 SUCCESS! SMTP is working correctly!")
        print("=" * 50)
        print()
        print(f"📬 Check your inbox at {TO_EMAIL}")
        print("   (Also check spam folder)")
        
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print()
        print("=" * 50)
        print("❌ AUTHENTICATION FAILED!")
        print("=" * 50)
        print(f"Error: {e}")
        print()
        print("Possible causes:")
        print("1. Incorrect app password")
        print("2. App password has spaces (should be removed)")
        print("3. 2FA not enabled on Gmail account")
        print("4. App password was deleted/revoked")
        print()
        print("To fix:")
        print("1. Go to: https://myaccount.google.com/apppasswords")
        print("2. Generate a new app password")
        print("3. Remove all spaces from the password")
        print("4. Update SMTP_PASSWORD in this script")
        return False
        
    except Exception as e:
        print()
        print("=" * 50)
        print("❌ ERROR!")
        print("=" * 50)
        print(f"Error: {e}")
        import traceback
        print()
        print("Full traceback:")
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    print()
    print("╔════════════════════════════════════════════╗")
    print("║        SMTP Email Test Script              ║")
    print("╚════════════════════════════════════════════╝")
    print()
    
    success = test_smtp()
    
    if success:
        exit(0)
    else:
        exit(1)
