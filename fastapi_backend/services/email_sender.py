"""
Direct Email Sender
For sending emails outside the notification queue (e.g., invitations)
Uses Resend as primary provider with SMTP fallback.
"""

import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Settings

settings = Settings()
logger = logging.getLogger(__name__)


async def _send_via_resend(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """Try to send email via Resend API"""
    try:
        import resend
        
        resend_api_key = os.environ.get("RESEND_API_KEY") or getattr(settings, 'resend_api_key', None)
        if not resend_api_key:
            print("📧 [email_sender] Resend API key not configured, skipping Resend", flush=True)
            logger.warning("📧 Resend API key not configured, skipping Resend")
            return False
        
        resend.api_key = resend_api_key
        from_email = (os.environ.get("FROM_EMAIL") or getattr(settings, 'from_email', 'noreply@l3v3lmatches.com')).strip()
        from_name = (os.environ.get("FROM_NAME") or getattr(settings, 'from_name', 'L3V3L MATCHES')).strip()
        
        print(f"📧 [email_sender] Attempting Resend to {to_email}", flush=True)
        logger.info(f"📧 Attempting to send via Resend to {to_email}")
        
        params = {
            "from": f"{from_name} <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content
        }
        
        response = resend.Emails.send(params)
        print(f"✅ [email_sender] Resend SUCCESS: {response}", flush=True)
        logger.info(f"✅ Resend success: {response}")
        return True
        
    except Exception as e:
        print(f"⚠️ [email_sender] Resend FAILED: {e}", flush=True)
        logger.warning(f"⚠️ Resend failed: {e}")
        return False


async def _send_via_smtp(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """Send email via SMTP (fallback)"""
    smtp_host = os.environ.get("SMTP_HOST") or getattr(settings, 'smtp_host', 'smtp.gmail.com')
    smtp_port = int(os.environ.get("SMTP_PORT") or getattr(settings, 'smtp_port', 587))
    smtp_user = os.environ.get("SMTP_USER") or getattr(settings, 'smtp_user', None)
    smtp_password = os.environ.get("SMTP_PASSWORD") or getattr(settings, 'smtp_password', None)
    from_name = (os.environ.get("FROM_NAME") or getattr(settings, 'from_name', 'L3V3L MATCHES')).strip()
    
    if not smtp_user or not smtp_password:
        raise Exception("SMTP credentials not configured")
    
    print(f"📧 [email_sender] Sending via SMTP ({smtp_user}) to {to_email}", flush=True)
    logger.info(f"📧 Sending via SMTP ({smtp_user}) to {to_email}")
    
    # Create email - use SMTP_USER as from address (Gmail requires this)
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"{from_name} (Do Not Reply) <{smtp_user}>"
    msg['To'] = to_email
    msg['Reply-To'] = f"No Reply <{smtp_user}>"
    msg['X-Auto-Response-Suppress'] = 'All'
    msg['Auto-Submitted'] = 'auto-generated'
    
    msg.attach(MIMEText(text_content, 'plain'))
    msg.attach(MIMEText(html_content, 'html'))
    
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        # Use sendmail() with explicit recipient to ensure To: header is respected
        server.sendmail(smtp_user, [to_email], msg.as_string())
    
    print(f"✅ [email_sender] SMTP SUCCESS to {to_email}", flush=True)
    logger.info(f"✅ SMTP success to {to_email}")
    return True


async def _send_email_with_fallback(to_email: str, subject: str, html_content: str, text_content: str) -> dict:
    """Send email using Resend as primary, SMTP as fallback. Returns result dict."""
    email_provider = os.environ.get("EMAIL_PROVIDER", "resend").lower()
    print(f"📧 [email_sender] EMAIL_PROVIDER={email_provider}", flush=True)
    
    result = {
        "success": False,
        "provider": None,
        "resend_attempted": False,
        "resend_error": None,
        "smtp_attempted": False,
        "smtp_error": None
    }
    
    if email_provider == "resend":
        # Try Resend first
        result["resend_attempted"] = True
        try:
            if await _send_via_resend(to_email, subject, html_content, text_content):
                result["success"] = True
                result["provider"] = "resend"
                return result
        except Exception as e:
            result["resend_error"] = str(e)
        
        # Fall back to SMTP
        print("📧 [email_sender] Resend failed, falling back to SMTP...", flush=True)
        logger.info("📧 Falling back to SMTP...")
        result["smtp_attempted"] = True
        try:
            await _send_via_smtp(to_email, subject, html_content, text_content)
            result["success"] = True
            result["provider"] = "smtp"
        except Exception as e:
            result["smtp_error"] = str(e)
            raise
    else:
        # SMTP only
        print("📧 [email_sender] Using SMTP only (EMAIL_PROVIDER != resend)", flush=True)
        result["smtp_attempted"] = True
        try:
            await _send_via_smtp(to_email, subject, html_content, text_content)
            result["success"] = True
            result["provider"] = "smtp"
        except Exception as e:
            result["smtp_error"] = str(e)
            raise
    
    return result


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = None
) -> dict:
    """
    Public function to send email using Resend + SMTP fallback.
    This is the centralized email sending function that all jobs should use.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML body content
        text_content: Plain text body (optional, defaults to stripped HTML)
    
    Returns:
        dict with keys: success, provider, resend_attempted, resend_error, smtp_attempted, smtp_error
    """
    if not text_content:
        # Strip HTML tags for plain text version
        import re
        text_content = re.sub(r'<[^>]+>', '', html_content)
    
    return await _send_email_with_fallback(to_email, subject, html_content, text_content)


async def send_invitation_email(
    to_email: str,
    to_name: str,
    invitation_link: str,
    custom_message: str = None,
    email_subject: str = None
):
    """
    Send invitation email directly via SMTP
    Bypasses notification queue since invitees aren't users yet
    
    Args:
        to_email: Recipient email address
        to_name: Recipient name
        invitation_link: Registration link with invitation token
        custom_message: Optional custom message to include
        email_subject: Optional custom subject (defaults to standard invitation subject)
    """
    
    # Email template
    html_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }}
        .header p {{
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 20px;
            color: #667eea;
            margin-bottom: 20px;
            font-weight: 600;
        }}
        .message {{
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 30px;
        }}
        .custom-message {{
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin: 20px 0;
            font-style: italic;
            color: #555;
        }}
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }}
        .features {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }}
        .features h3 {{
            color: #667eea;
            margin-top: 0;
            font-size: 18px;
        }}
        .feature-list {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}
        .feature-list li {{
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }}
        .feature-list li:before {{
            content: "✓";
            position: absolute;
            left: 0;
            color: #667eea;
            font-weight: bold;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 30px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💝 You're Invited!</h1>
            <p>Join L3V3L MATCHES - Where Connections Matter</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hello {to_name}! 👋
            </div>
            
            <div class="message">
                <p>We're excited to invite you to join <strong>L3V3L MATCHES</strong>, a premium matrimonial platform designed to help you find meaningful connections.</p>
                
                {custom_message_html}
                
                <p>Your exclusive invitation link is ready! Click the button below to create your profile and start your journey:</p>
            </div>
            
            <center>
                <a href="{invitation_link}" class="cta-button">
                    Create Your Profile →
                </a>
            </center>
            
            <div class="features">
                <h3>Why Join L3V3L MATCHES?</h3>
                <ul class="feature-list">
                    <li>Advanced L3V3L matching algorithm for compatibility</li>
                    <li>Privacy-first approach with controlled information sharing</li>
                    <li>Verified profiles for authentic connections</li>
                    <li>Smart preferences and detailed partner criteria</li>
                    <li>Secure messaging and communication</li>
                    <li>Professional and serious community</li>
                </ul>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                <strong>Note:</strong> This invitation link is valid for 30 days. If you have any questions, feel free to reply to this email.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>L3V3L MATCHES</strong> - Premium Matrimonial Platform</p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                This invitation was sent by the L3V3L MATCHES team. If you believe this was sent in error, 
                please ignore this email or contact support.
            </p>
        </div>
    </div>
</body>
</html>
    """
    
    # Prepare custom message HTML
    custom_message_html = ""
    if custom_message:
        custom_message_html = f"""
                <div class="custom-message">
                    <strong>Personal Message:</strong><br>
                    {custom_message}
                </div>
        """
    
    # Render template with Python format
    html_content = html_template.format(
        to_name=to_name,
        invitation_link=invitation_link,
        custom_message_html=custom_message_html
    )
    
    # Plain text version
    text_content = f"""
Hello {to_name}!

You're invited to join L3V3L MATCHES - a premium matrimonial platform designed to help you find meaningful connections.

{f'Personal Message: {custom_message}' if custom_message else ''}

Create your profile now: {invitation_link}

Why Join L3V3L MATCHES?
• Advanced L3V3L matching algorithm for compatibility
• Privacy-first approach with controlled information sharing
• Verified profiles for authentic connections
• Smart preferences and detailed partner criteria
• Secure messaging and communication
• Professional and serious community

This invitation link is valid for 30 days.

Best regards,
The L3V3L MATCHES Team
    """
    
    # Send email using Resend + SMTP fallback
    subject = email_subject or "You're Invited to Join L3V3L MATCHES! 💝"
    return await _send_email_with_fallback(to_email, subject, html_content, text_content)


async def send_password_reset_email(
    to_email: str,
    to_name: str,
    reset_code: str
):
    """
    Send password reset code via email
    """
    
    # Email template
    html_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 20px;
            color: #667eea;
            margin-bottom: 20px;
            font-weight: 600;
        }}
        .code-box {{
            background: #f8f9fa;
            border: 2px dashed #667eea;
            border-radius: 10px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }}
        .code {{
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }}
        .expiry {{
            color: #e74c3c;
            font-weight: 600;
            margin-top: 20px;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset</h1>
        </div>
        
        <div class="content">
            <div class="greeting">Hello {to_name}!</div>
            
            <p>You requested to reset your password for your L3V3L MATCHES account.</p>
            
            <p>Use the code below to complete your password reset:</p>
            
            <div class="code-box">
                <div class="code">{reset_code}</div>
            </div>
            
            <p class="expiry">⏰ This code expires in 15 minutes</p>
            
            <p style="margin-top: 30px;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
        
        <div class="footer">
            <p><strong>L3V3L MATCHES</strong> - Premium Matrimonial Platform</p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
    """
    
    # Render template
    html_content = html_template.format(
        to_name=to_name,
        reset_code=reset_code
    )
    
    # Plain text version
    text_content = f"""
Hello {to_name}!

You requested to reset your password for your L3V3L MATCHES account.

Your password reset code is: {reset_code}

This code expires in 15 minutes.

If you didn't request this password reset, please ignore this email.

Best regards,
The L3V3L MATCHES Team
    """
    
    # Send email using Resend + SMTP fallback
    subject = f"🔐 Password Reset Code - L3V3L MATCHES"
    return await _send_email_with_fallback(to_email, subject, html_content, text_content)
