#!/usr/bin/env python3
"""
Test Resend email sending with verified l3v3lmatches.com domain
"""

import asyncio
import os
import sys

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import after loading env
from services.email_sender import send_email

async def test_resend():
    """Test sending email via Resend"""
    
    # Get test email from command line or use default
    test_email = sys.argv[1] if len(sys.argv) > 1 else "raj@nimbledata.us"
    
    print("=" * 60)
    print("🧪 RESEND EMAIL TEST")
    print("=" * 60)
    print(f"📧 EMAIL_PROVIDER: {os.environ.get('EMAIL_PROVIDER', 'not set')}")
    print(f"📧 FROM_EMAIL: {os.environ.get('FROM_EMAIL', 'not set')}")
    print(f"📧 FROM_NAME: {os.environ.get('FROM_NAME', 'not set')}")
    print(f"📧 RESEND_API_KEY: {os.environ.get('RESEND_API_KEY', 'not set')[:20]}...")
    print(f"📧 Sending to: {test_email}")
    print("=" * 60)
    
    # Test email content
    subject = "🧪 Test Email from L3V3L MATCHES (Resend)"
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 10px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { padding: 20px; background: white; border-radius: 0 0 10px 10px; }
            .success { color: #27ae60; font-size: 24px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 L3V3L MATCHES</h1>
            </div>
            <div class="content">
                <p class="success">✅ Resend Email Test Successful!</p>
                <p>This email was sent using:</p>
                <ul>
                    <li><strong>Provider:</strong> Resend</li>
                    <li><strong>Domain:</strong> l3v3lmatches.com</li>
                    <li><strong>From:</strong> noreply@l3v3lmatches.com</li>
                </ul>
                <p>If you received this email, your Resend configuration is working correctly!</p>
                <hr>
                <p style="color: #666; font-size: 12px;">This is a test email from the L3V3L MATCHES platform.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = """
    L3V3L MATCHES - Resend Email Test
    
    ✅ Resend Email Test Successful!
    
    This email was sent using:
    - Provider: Resend
    - Domain: l3v3lmatches.com
    - From: noreply@l3v3lmatches.com
    
    If you received this email, your Resend configuration is working correctly!
    """
    
    try:
        result = await send_email(
            to_email=test_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        print("\n" + "=" * 60)
        print("📊 RESULT:")
        print("=" * 60)
        for key, value in result.items():
            print(f"  {key}: {value}")
        
        if result.get("success"):
            print("\n✅ SUCCESS! Email sent via", result.get("provider", "unknown"))
            print(f"📬 Check inbox: {test_email}")
        else:
            print("\n❌ FAILED to send email")
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_resend())
